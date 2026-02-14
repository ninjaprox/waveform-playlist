# Horizontal Virtual Scrolling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent canvas crashes and spectrogram OOM on long audio files (1+ hours) by only rendering canvas chunks visible in the scroll viewport.

**Architecture:** A shared `ScrollViewportContext` broadcasts the visible pixel range. `TimeScale`, `Channel`, and `SpectrogramChannel` consume it to only mount canvas elements within the viewport + buffer. Canvas chunks switch from `float: left` to absolute positioning so unmounted chunks leave no gaps.

**Tech Stack:** React Context, requestAnimationFrame, ResizeObserver, existing styled-components patterns

**Design Doc:** `docs/plans/2026-02-13-horizontal-virtual-scrolling-design.md`

---

### Task 1: Create ScrollViewportContext

**Files:**
- Create: `packages/ui-components/src/contexts/ScrollViewport.tsx`
- Modify: `packages/ui-components/src/contexts/index.tsx`

**Step 1: Create the ScrollViewport context, provider, and hook**

Create `packages/ui-components/src/contexts/ScrollViewport.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface ScrollViewport {
  /** Current horizontal scroll offset in CSS pixels */
  scrollLeft: number;
  /** Visible width of the scroll container in CSS pixels */
  containerWidth: number;
  /** Start of the visible+buffered range (scrollLeft - buffer, clamped >= 0) */
  visibleStart: number;
  /** End of the visible+buffered range (scrollLeft + containerWidth + buffer) */
  visibleEnd: number;
}

const ScrollViewportContext = createContext<ScrollViewport | null>(null);

/**
 * Returns the current scroll viewport, or null if no ScrollViewportProvider exists.
 * When null, components should render all chunks (backwards-compatible fallback).
 */
export const useScrollViewport = (): ScrollViewport | null => useContext(ScrollViewportContext);

/** Buffer multiplier: how many viewport widths to pre-render on each side */
const BUFFER_MULTIPLIER = 1.5;

interface ScrollViewportProviderProps {
  /** Ref to the scrollable container element (the overflow-x: auto wrapper) */
  containerRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
}

export const ScrollViewportProvider: React.FC<ScrollViewportProviderProps> = ({ containerRef, children }) => {
  const [viewport, setViewport] = useState<ScrollViewport | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const updateViewport = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    const containerWidth = el.clientWidth;
    const buffer = containerWidth * BUFFER_MULTIPLIER;

    setViewport({
      scrollLeft,
      containerWidth,
      visibleStart: Math.max(0, scrollLeft - buffer),
      visibleEnd: scrollLeft + containerWidth + buffer,
    });
  }, [containerRef]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      updateViewport();
    });
  }, [updateViewport]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measurement
    updateViewport();

    // Scroll events
    el.addEventListener('scroll', scheduleUpdate, { passive: true });

    // Resize observer for container width changes
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', scheduleUpdate);
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [containerRef, updateViewport, scheduleUpdate]);

  return (
    <ScrollViewportContext.Provider value={viewport}>
      {children}
    </ScrollViewportContext.Provider>
  );
};
```

**Step 2: Export from contexts index**

Add to `packages/ui-components/src/contexts/index.tsx`:

```typescript
import { useScrollViewport, ScrollViewportProvider } from './ScrollViewport';

// Add to the export block:
export {
  // ... existing exports ...
  useScrollViewport,
  ScrollViewportProvider,
};
```

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS (no errors in ui-components)

**Step 4: Commit**

```bash
git add packages/ui-components/src/contexts/ScrollViewport.tsx packages/ui-components/src/contexts/index.tsx
git commit -m "feat: add ScrollViewportContext for horizontal virtual scrolling"
```

---

### Task 2: Integrate ScrollViewportProvider into Playlist

**Files:**
- Modify: `packages/ui-components/src/components/Playlist.tsx`

The `Playlist` component is the scroll container (`overflow-x: auto`). We need to:
1. Capture a ref to the `Wrapper` div
2. Wrap children with `ScrollViewportProvider`

**Step 1: Add provider to Playlist**

In `packages/ui-components/src/components/Playlist.tsx`:

1. Import `ScrollViewportProvider`:
```typescript
import { ScrollViewportProvider } from '../contexts/ScrollViewport';
```

2. Add an internal ref for the Wrapper. The component currently passes `scrollContainerRef` directly to the `Wrapper`'s `ref`. We need to capture it ourselves AND forward it:

```typescript
export const Playlist: FunctionComponent<PlaylistProps> = ({
  // ... existing destructured props ...
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleRef = useCallback((el: HTMLDivElement | null) => {
    wrapperRef.current = el;
    // Forward to consumer's ref callback
    scrollContainerRef?.(el);
  }, [scrollContainerRef]);

  return (
    <Wrapper data-scroll-container="true" data-playlist-state={playlistState} ref={handleRef}>
      <ScrollViewportProvider containerRef={wrapperRef}>
        <ScrollContainer
          $backgroundColor={backgroundColor}
          $width={scrollContainerWidth}
        >
          {timescale && <TimescaleWrapper $width={timescaleWidth} $backgroundColor={timescaleBackgroundColor}>{timescale}</TimescaleWrapper>}
          <TracksContainer $width={tracksWidth} $backgroundColor={backgroundColor}>
            {children}
            {(onTracksClick || onTracksMouseDown) && (
              <ClickOverlay
                $controlsWidth={controlsWidth}
                $isSelecting={isSelecting}
                onClick={onTracksClick}
                onMouseDown={onTracksMouseDown}
                onMouseMove={onTracksMouseMove}
                onMouseUp={onTracksMouseUp}
              />
            )}
          </TracksContainer>
        </ScrollContainer>
      </ScrollViewportProvider>
    </Wrapper>
  );
};
```

Add `useRef`, `useCallback` to the React imports.

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Verify website builds**

Run: `pnpm --filter website build`
Expected: PASS (CSS calc warnings are pre-existing, harmless)

**Step 4: Commit**

```bash
git add packages/ui-components/src/components/Playlist.tsx
git commit -m "feat: integrate ScrollViewportProvider into Playlist component"
```

---

### Task 3: Virtualize Channel (Waveform)

**Files:**
- Modify: `packages/ui-components/src/components/Channel.tsx`

This is the waveform canvas component. Currently renders ALL canvas chunks with `float: left`. We need to:
1. Switch to absolute positioning per chunk
2. Only mount canvases within the visible viewport
3. Adjust drawing logic for sparse chunk arrays

**Step 1: Switch canvas positioning from float to absolute**

In `Channel.tsx`, modify the `Waveform` styled component:

```typescript
// Old:
const Waveform = styled.canvas.attrs<WaveformProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WaveformProps>`
  float: left;
  position: relative;
  will-change: transform;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

// New — add $left prop for absolute positioning:
interface WaveformProps {
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $left: number;
}

const Waveform = styled.canvas.attrs<WaveformProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
    left: `${props.$left}px`,
  },
}))<WaveformProps>`
  position: absolute;
  top: 0;
  will-change: transform;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;
```

**Step 2: Add viewport-aware chunk rendering**

Import `useScrollViewport` and add visibility filtering to the chunk rendering loop:

```typescript
import { useScrollViewport } from '../contexts/ScrollViewport';

// Inside the Channel component, before the while loop:
const viewport = useScrollViewport();

// Replace the chunk building loop:
const totalChunks = Math.ceil(length / MAX_CANVAS_WIDTH);
const waveforms = [];

for (let i = 0; i < totalChunks; i++) {
  const chunkLeft = i * MAX_CANVAS_WIDTH;
  const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

  // Visibility check
  if (viewport) {
    const chunkEnd = chunkLeft + currentWidth;
    if (chunkEnd <= viewport.visibleStart || chunkLeft >= viewport.visibleEnd) {
      continue; // Skip non-visible chunks
    }
  }

  waveforms.push(
    <Waveform
      key={`${length}-${i}`}
      $cssWidth={currentWidth}
      $left={chunkLeft}
      width={currentWidth * devicePixelRatio}
      height={waveHeight * devicePixelRatio}
      $waveHeight={waveHeight}
      data-index={i}
      ref={canvasRef}
    />
  );
}
```

**Step 3: Adjust drawing logic for sparse canvas refs**

The `useLayoutEffect` currently iterates `canvasesRef.current` sequentially and tracks `globalPixelOffset`. With virtualization, not all indices exist. Change to:

```typescript
useLayoutEffect(() => {
  const canvases = canvasesRef.current;
  const step = barWidth + barGap;

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    if (!canvas) continue; // Skip unmounted chunks

    const ctx = canvas.getContext('2d');
    const h2 = Math.floor(waveHeight / 2);
    const maxValue = 2 ** (bits - 1);

    if (ctx) {
      const canvasIdx = parseInt(canvas.dataset.index!, 10);
      const globalPixelOffset = canvasIdx * MAX_CANVAS_WIDTH;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      const canvasWidth = canvas.width / devicePixelRatio;

      let fillColor: WaveformColor;
      if (drawMode === 'normal') {
        fillColor = waveFillColor;
      } else {
        fillColor = waveOutlineColor;
      }
      ctx.fillStyle = createCanvasFillStyle(ctx, fillColor, canvasWidth, waveHeight);

      const canvasStartGlobal = globalPixelOffset;
      const canvasEndGlobal = globalPixelOffset + canvasWidth;
      const firstBarGlobal = Math.floor((canvasStartGlobal - barWidth + step) / step) * step;

      for (let barGlobal = Math.max(0, firstBarGlobal); barGlobal < canvasEndGlobal; barGlobal += step) {
        const x = barGlobal - canvasStartGlobal;
        if (x + barWidth <= 0) continue;

        const peakIndex = barGlobal;
        if (peakIndex * 2 + 1 < data.length) {
          const minPeak = data[peakIndex * 2] / maxValue;
          const maxPeak = data[peakIndex * 2 + 1] / maxValue;
          const min = Math.abs(minPeak * h2);
          const max = Math.abs(maxPeak * h2);

          if (drawMode === 'normal') {
            ctx.fillRect(x, h2 - max, barWidth, max + min);
          } else {
            ctx.fillRect(x, 0, barWidth, h2 - max);
            ctx.fillRect(x, h2 + min, barWidth, h2 - min);
          }
        }
      }
    }
  }
}, [data, bits, waveHeight, waveOutlineColor, waveFillColor, devicePixelRatio, length, barWidth, barGap, drawMode]);
```

Key change: compute `globalPixelOffset` from `canvas.dataset.index` instead of sequential iteration.

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ui-components/src/components/Channel.tsx
git commit -m "feat: virtualize Channel canvas rendering with viewport awareness"
```

---

### Task 4: Virtualize TimeScale

**Files:**
- Modify: `packages/ui-components/src/components/TimeScale.tsx`

The TimeScale currently creates a **single canvas** at full timeline width — this is the component that crashes. We need to chunk it into 1000px canvases and only render visible ones.

**Step 1: Add chunked canvas rendering with absolute positioning**

Replace the single `TimeTicks` canvas with chunked canvases. Import `useScrollViewport`:

```typescript
import { useScrollViewport } from '../contexts/ScrollViewport';
```

Add `MAX_CANVAS_WIDTH`:
```typescript
const MAX_CANVAS_WIDTH = 1000;
```

**Step 2: Modify the component to render chunked canvases**

The current component has:
- A `useMemo` that computes `canvasInfo` (Map of pixel positions to tick heights) and `timeMarkers` (array of timestamp divs)
- A `useLayoutEffect` that draws all ticks to a single canvas
- JSX that renders a single `<TimeTicks>` canvas and all `timeMarkers`

Change to:
1. Keep the `useMemo` for computing tick data
2. Filter `timeMarkers` to visible range only
3. Render multiple chunked canvases, only for visible chunks
4. Each chunk's `useLayoutEffect` draws only its tick marks

Replace the `TimeTicks` styled component with an absolutely positioned chunk canvas:

```typescript
interface TimeTickChunkProps {
  readonly $cssWidth: number;
  readonly $timeScaleHeight: number;
  readonly $left: number;
}
const TimeTickChunk = styled.canvas.attrs<TimeTickChunkProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$timeScaleHeight}px`,
    left: `${props.$left}px`,
  },
}))<TimeTickChunkProps>`
  position: absolute;
  bottom: 0;
  will-change: transform;
`;
```

**Step 3: Update the rendering logic**

Replace the existing render section. The key changes:
- Build multiple canvas chunks instead of one
- Filter chunks and time labels to visible range
- Draw ticks per chunk using the chunk's local coordinate system

```typescript
const viewport = useScrollViewport();

// Filter time markers to visible range
const visibleTimeMarkers = useMemo(() => {
  if (!viewport) return timeMarkers; // No provider = render all
  return timeMarkers.filter((_, idx) => {
    // Each marker has a pixel position; filter by visibility
    // We need the pixel positions — extract from canvasInfo
    const markerPositions = Array.from(canvasInfo.entries())
      .filter(([_, height]) => height === timeScaleHeight) // Full-height = marker ticks
      .map(([pix]) => pix);

    if (idx >= markerPositions.length) return false;
    const pix = markerPositions[idx];
    return pix >= viewport.visibleStart && pix <= viewport.visibleEnd;
  });
}, [viewport, timeMarkers, canvasInfo, timeScaleHeight]);
```

However, this approach of re-filtering is fragile. A cleaner approach: in the existing `useMemo`, pair each marker with its pixel position, then filter in the render. Refactor the useMemo to return `timeMarkersWithPositions: Array<{ pix: number; element: ReactNode }>` and filter during render.

**Step 4: Refactor useMemo to track marker positions**

```typescript
const { widthX, canvasInfo, timeMarkersWithPositions } = useMemo(() => {
  const nextCanvasInfo = new Map<number, number>();
  const nextMarkers: Array<{ pix: number; element: React.ReactNode }> = [];
  const nextWidthX = secondsToPixels(duration / 1000, samplesPerPixel, sampleRate);
  const pixPerSec = sampleRate / samplesPerPixel;
  let counter = 0;

  for (let i = 0; i < nextWidthX; i += (pixPerSec * secondStep) / 1000) {
    const pix = Math.floor(i);

    if (counter % marker === 0) {
      const timeMs = counter;
      const timestamp = formatTime(timeMs);

      const element = renderTimestamp ? (
        <React.Fragment key={`timestamp-${counter}`}>
          {renderTimestamp(timeMs, pix)}
        </React.Fragment>
      ) : (
        <TimeStamp key={timestamp} $left={pix}>
          {timestamp}
        </TimeStamp>
      );

      nextMarkers.push({ pix, element });
      nextCanvasInfo.set(pix, timeScaleHeight);
    } else if (counter % bigStep === 0) {
      nextCanvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
    } else if (counter % secondStep === 0) {
      nextCanvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
    }

    counter += secondStep;
  }

  return {
    widthX: nextWidthX,
    canvasInfo: nextCanvasInfo,
    timeMarkersWithPositions: nextMarkers,
  };
}, [duration, samplesPerPixel, sampleRate, marker, bigStep, secondStep, renderTimestamp, timeScaleHeight]);
```

**Step 5: Render chunked canvases with visibility filtering**

Replace the canvas refs and drawing logic. Use multiple canvas refs keyed by chunk index:

```typescript
const canvasRefsMap = useRef<Map<number, HTMLCanvasElement>>(new Map());

const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
  if (canvas !== null) {
    const idx = parseInt(canvas.dataset.index!, 10);
    canvasRefsMap.current.set(idx, canvas);
  }
}, []);

// Build visible chunks
const totalChunks = Math.ceil(widthX / MAX_CANVAS_WIDTH);
const visibleChunks: React.ReactNode[] = [];

for (let i = 0; i < totalChunks; i++) {
  const chunkLeft = i * MAX_CANVAS_WIDTH;
  const chunkWidth = Math.min(widthX - chunkLeft, MAX_CANVAS_WIDTH);

  if (viewport) {
    const chunkEnd = chunkLeft + chunkWidth;
    if (chunkEnd <= viewport.visibleStart || chunkLeft >= viewport.visibleEnd) {
      continue;
    }
  }

  visibleChunks.push(
    <TimeTickChunk
      key={`timescale-${i}`}
      $cssWidth={chunkWidth}
      $left={chunkLeft}
      $timeScaleHeight={timeScaleHeight}
      width={chunkWidth * devicePixelRatio}
      height={timeScaleHeight * devicePixelRatio}
      data-index={i}
      ref={canvasRefCallback}
    />
  );
}

// Filter time markers to visible range
const visibleMarkers = viewport
  ? timeMarkersWithPositions
      .filter(({ pix }) => pix >= viewport.visibleStart && pix <= viewport.visibleEnd)
      .map(({ element }) => element)
  : timeMarkersWithPositions.map(({ element }) => element);
```

**Step 6: Update useLayoutEffect to draw per-chunk**

```typescript
useLayoutEffect(() => {
  for (const [chunkIdx, canvas] of canvasRefsMap.current.entries()) {
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const chunkLeft = chunkIdx * MAX_CANVAS_WIDTH;
    const chunkWidth = canvas.width / devicePixelRatio;

    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = timeColor;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    for (const [pixLeft, scaleHeight] of canvasInfo.entries()) {
      // Only draw ticks within this chunk's range
      if (pixLeft < chunkLeft || pixLeft >= chunkLeft + chunkWidth) continue;

      const localX = pixLeft - chunkLeft;
      const scaleY = timeScaleHeight - scaleHeight;
      ctx.fillRect(localX, scaleY, 1, scaleHeight);
    }
  }
}, [duration, devicePixelRatio, timeColor, timeScaleHeight, canvasInfo]);
```

**Step 7: Update JSX return**

```typescript
return (
  <PlaylistTimeScaleScroll
    $cssWidth={widthX}
    $controlWidth={showControls ? controlWidth : 0}
    $timeScaleHeight={timeScaleHeight}
  >
    {visibleMarkers}
    {visibleChunks}
  </PlaylistTimeScaleScroll>
);
```

**Step 8: Clean up old single-canvas code**

Remove the old `TimeTicks` styled component and the old single `canvasRef`.

**Step 9: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

**Step 10: Commit**

```bash
git add packages/ui-components/src/components/TimeScale.tsx
git commit -m "feat: chunk TimeScale canvas and virtualize rendering"
```

---

### Task 5: Virtualize SpectrogramChannel

**Files:**
- Modify: `packages/ui-components/src/components/SpectrogramChannel.tsx`

Same pattern as Channel — switch to absolute positioning and only mount visible chunks. The spectrogram has two code paths (main-thread and worker) that both need updating.

**Step 1: Switch canvas positioning from float to absolute**

```typescript
interface CanvasProps {
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $left: number;
}

const SpectrogramCanvas = styled.canvas.attrs<CanvasProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
    left: `${props.$left}px`,
  },
}))<CanvasProps>`
  position: absolute;
  top: 0;
  will-change: transform;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;
```

**Step 2: Add viewport-aware chunk rendering**

Import and use `useScrollViewport`:

```typescript
import { useScrollViewport } from '../contexts/ScrollViewport';

// Inside component:
const viewport = useScrollViewport();

// Replace the chunk building loop:
const totalChunks = Math.ceil(length / MAX_CANVAS_WIDTH);
const canvases = [];

for (let i = 0; i < totalChunks; i++) {
  const chunkLeft = i * MAX_CANVAS_WIDTH;
  const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

  // Visibility check
  if (viewport) {
    const chunkEnd = chunkLeft + currentWidth;
    if (chunkEnd <= viewport.visibleStart || chunkLeft >= viewport.visibleEnd) {
      continue; // Skip non-visible chunks
    }
  }

  canvases.push(
    <SpectrogramCanvas
      key={`${length}-${i}`}
      $cssWidth={currentWidth}
      $left={chunkLeft}
      width={currentWidth * devicePixelRatio}
      height={waveHeight * devicePixelRatio}
      $waveHeight={waveHeight}
      data-index={i}
      ref={canvasRef}
    />
  );
}
```

**Step 3: Adjust main-thread drawing for sparse canvas refs**

In the main-thread `useLayoutEffect`, change from sequential iteration to index-based:

```typescript
useLayoutEffect(() => {
  if (isWorkerMode || !data) return;

  const canvases = canvasesRef.current;
  const { frequencyBinCount, frameCount, hopSize, sampleRate, gainDb, rangeDb: rawRangeDb } = data;
  const rangeDb = rawRangeDb === 0 ? 1 : rawRangeDb;

  const binToFreq = (bin: number) => (bin / frequencyBinCount) * (sampleRate / 2);

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    if (!canvas) continue;

    const canvasIdx = parseInt(canvas.dataset.index!, 10);
    const globalPixelOffset = canvasIdx * MAX_CANVAS_WIDTH;

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const canvasWidth = canvas.width / devicePixelRatio;
    const canvasHeight = waveHeight;

    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const imgData = ctx.createImageData(canvasWidth, canvasHeight);
    const pixels = imgData.data;

    for (let x = 0; x < canvasWidth; x++) {
      const globalX = globalPixelOffset + x;
      const samplePos = globalX * samplesPerPixel;
      const frame = Math.floor(samplePos / hopSize);

      if (frame < 0 || frame >= frameCount) continue;

      const frameOffset = frame * frequencyBinCount;

      for (let y = 0; y < canvasHeight; y++) {
        const normalizedY = 1 - y / canvasHeight;

        let bin = Math.floor(normalizedY * frequencyBinCount);

        if (hasCustomFrequencyScale) {
          let lo = 0;
          let hi = frequencyBinCount - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const freq = binToFreq(mid);
            const scaled = scaleFn(freq, minFrequency, maxF);
            if (scaled < normalizedY) {
              lo = mid + 1;
            } else {
              hi = mid;
            }
          }
          bin = lo;
        }

        if (bin < 0 || bin >= frequencyBinCount) continue;

        const db = data.data[frameOffset + bin];
        const normalized = Math.max(0, Math.min(1, (db + rangeDb + gainDb) / rangeDb));

        const colorIdx = Math.floor(normalized * 255);
        const pixelIdx = (y * canvasWidth + x) * 4;
        pixels[pixelIdx] = lut[colorIdx * 3];
        pixels[pixelIdx + 1] = lut[colorIdx * 3 + 1];
        pixels[pixelIdx + 2] = lut[colorIdx * 3 + 2];
        pixels[pixelIdx + 3] = 255;
      }
    }

    ctx.resetTransform();
    ctx.putImageData(imgData, 0, 0);

    if (devicePixelRatio !== 1) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = canvasWidth;
      tmpCanvas.height = canvasHeight;
      const tmpCtx = tmpCanvas.getContext('2d');
      if (!tmpCtx) continue;
      tmpCtx.putImageData(imgData, 0, 0);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height);
    }
  }
}, [isWorkerMode, data, length, waveHeight, devicePixelRatio, samplesPerPixel, lut, minFrequency, maxF, scaleFn, hasCustomFrequencyScale]);
```

**Step 4: Adjust worker-mode canvas registration for dynamic mount/unmount**

The worker registration effect needs to handle canvases that appear/disappear as the user scrolls. The existing effect runs on `[isWorkerMode, clipId, channelIndex, length]`. Since chunks now mount/unmount based on scroll position, the effect needs to also depend on the viewport (or we rely on React's mount/unmount lifecycle).

The simplest approach: keep the existing effect but let it only register canvases that are currently mounted. When chunks unmount due to scrolling, React calls the cleanup which unregisters them. When they remount, the effect re-runs.

Add `viewport` to the dependency array of the worker registration effect:

```typescript
useEffect(() => {
  if (!isWorkerMode) return;
  const currentWorkerApi = workerApiRef.current;
  if (!currentWorkerApi || !clipId) return;

  const canvases = canvasesRef.current;
  const ids: string[] = [];
  const widths: number[] = [];

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    if (!canvas) continue;

    if (transferredCanvasesRef.current.has(canvas)) continue;

    const canvasIdx = parseInt(canvas.dataset.index!, 10);
    const canvasId = `${clipId}-ch${channelIndex}-chunk${canvasIdx}`;

    try {
      const offscreen = canvas.transferControlToOffscreen();
      currentWorkerApi.registerCanvas(canvasId, offscreen);
      transferredCanvasesRef.current.add(canvas);
      ids.push(canvasId);
      widths.push(Math.min(length - canvasIdx * MAX_CANVAS_WIDTH, MAX_CANVAS_WIDTH));
    } catch (err) {
      console.warn(`[spectrogram] transferControlToOffscreen failed for ${canvasId}:`, err);
      continue;
    }
  }

  registeredIdsRef.current = [...registeredIdsRef.current, ...ids];

  if (ids.length > 0) {
    onCanvasesReadyRef.current?.(ids, widths);
  }

  return () => {
    for (const id of ids) {
      currentWorkerApi.unregisterCanvas(id);
    }
    registeredIdsRef.current = registeredIdsRef.current.filter(id => !ids.includes(id));
  };
}, [isWorkerMode, clipId, channelIndex, length, viewport]);
```

Note: Adding `viewport` to deps ensures re-registration when visible chunks change. The `transferredCanvasesRef` WeakSet prevents double-transfers.

**Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/ui-components/src/components/SpectrogramChannel.tsx
git commit -m "feat: virtualize SpectrogramChannel with viewport-aware chunk rendering"
```

---

### Task 6: Build and Manual Verification

**Files:**
- No modifications

**Step 1: Build all packages**

Run: `pnpm build`
Expected: PASS — all 10 packages build successfully

**Step 2: Build website**

Run: `pnpm --filter website build`
Expected: PASS (CSS calc warnings are pre-existing, harmless)

**Step 3: Manual smoke test**

Run: `pnpm --filter website start`

Test with:
1. Load a short audio file — should render normally (all chunks visible)
2. Load a long audio file (~1 hour) — should NOT crash
3. Scroll horizontally — canvases should appear/disappear smoothly
4. Zoom in/out — chunks should re-render at new zoom levels
5. Play audio — playhead animation should work normally during scroll

**Step 4: Commit any fixes**

If any issues found, fix and commit individually.

---

### Task 7: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `TODO.md`
- Modify: `website/docs/api/llm-reference.md` (if new exports need documenting)

**Step 1: Update CLAUDE.md**

Add to Architectural Decisions section:

```markdown
### Horizontal Virtual Scrolling (Phase 4)

**Decision:** Viewport-aware canvas rendering — only mount canvas chunks visible in the scroll container + buffer.

**Implementation:**
- `ScrollViewportContext` in `packages/ui-components/src/contexts/ScrollViewport.tsx`
- `ScrollViewportProvider` wraps content inside `Playlist.tsx`, observes `Wrapper` scroll element
- `useScrollViewport()` returns `{ scrollLeft, containerWidth, visibleStart, visibleEnd }` or `null`
- Buffer: 1.5x viewport width on each side
- RAF-throttled scroll listener + ResizeObserver

**Components affected:**
- `TimeScale` — chunked into 1000px canvases (was single canvas, crashed with long files)
- `Channel` — absolute positioning, only renders visible chunks
- `SpectrogramChannel` — only mounts visible chunks (biggest memory win)
- All use absolute positioning (`left: chunkIndex * 1000px`) instead of `float: left`

**Backwards compatibility:** `useScrollViewport()` returns `null` without provider. All components default to rendering everything when viewport is `null`.
```

**Step 2: Update TODO.md**

Move Phase 4 horizontal scrolling to "Recently Completed" or mark as done.

**Step 3: Commit**

```bash
git add CLAUDE.md TODO.md
git commit -m "docs: document horizontal virtual scrolling architecture"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | New: `ScrollViewport.tsx`, Mod: `contexts/index.tsx` | Create scroll viewport context, provider, hook |
| 2 | Mod: `Playlist.tsx` | Integrate provider into Playlist |
| 3 | Mod: `Channel.tsx` | Virtualize waveform canvas chunks |
| 4 | Mod: `TimeScale.tsx` | Chunk + virtualize timescale (fixes crash) |
| 5 | Mod: `SpectrogramChannel.tsx` | Virtualize spectrogram chunks (fixes OOM) |
| 6 | None | Build verification + manual smoke test |
| 7 | Mod: `CLAUDE.md`, `TODO.md` | Documentation updates |
