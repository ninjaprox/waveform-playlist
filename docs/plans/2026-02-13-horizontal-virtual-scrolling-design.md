# Horizontal Virtual Scrolling Design

**Date:** 2026-02-13
**Phase:** 4 (Performance & Virtual Scrolling)
**Scope:** Horizontal only (vertical track virtualization deferred)

## Problem

Long audio files (1+ hours) crash the browser:
1. **TimeScale** creates a single canvas at full timeline width. At 48kHz, `samplesPerPixel=4096`, 1 hour = ~43,594px CSS. At 2x DPR = ~87,188 device pixels, exceeding browser canvas limits (~65,535px).
2. **SpectrogramChannel** chunks at 1000px but mounts ALL chunks. Each allocates an `ImageData(1000, height)` buffer. 44 chunks at 160px height = ~28MB of ImageData, plus worker canvases.
3. **Channel** (waveform) chunks at 1000px but renders all chunks always. Less memory per chunk than spectrogram but still unnecessary DOM/canvas overhead.

## Approach: Viewport-Aware Rendering

Keep the existing 1000px canvas chunking system. Add a shared scroll-position observer. Only mount/render canvas chunks that overlap the visible viewport plus a buffer zone.

### Key Decision: Absolute Positioning

Switch canvas chunks from `float: left` to absolute positioning (`left: chunkIndex * MAX_CANVAS_WIDTH`). This eliminates the need for spacer divs when chunks are unmounted and makes virtualization cleaner.

## Architecture

### New: ScrollViewportContext

**File:** `packages/ui-components/src/contexts/ScrollViewport.tsx`

React context providing the visible pixel range to all consumers.

```typescript
interface ScrollViewport {
  scrollLeft: number;       // current scroll offset
  containerWidth: number;   // visible container width
  visibleStart: number;     // scrollLeft - buffer (clamped >= 0)
  visibleEnd: number;       // scrollLeft + containerWidth + buffer
}
```

**Implementation:**
- Observes the `[data-scroll-container]` element's scroll events
- Throttled via `requestAnimationFrame` (one update per frame)
- `ResizeObserver` for container width changes
- Buffer: `containerWidth * 1.5` on each side (~1.5 screens of pre-rendered content)
- Exported hook: `useScrollViewport()` returns `ScrollViewport | null`
- Returns `null` when no provider exists (backwards-compatible fallback: render everything)

**Provider placement:** Inside `Playlist.tsx`, wrapping `ScrollContainer` and observing the `Wrapper` div.

### Visibility Utility

Shared utility function for chunk visibility:

```typescript
function isChunkVisible(
  chunkIndex: number,
  chunkWidth: number,  // MAX_CANVAS_WIDTH or remainder
  viewport: ScrollViewport | null
): boolean {
  if (!viewport) return true; // no provider = render all
  const chunkStart = chunkIndex * MAX_CANVAS_WIDTH;
  const chunkEnd = chunkStart + chunkWidth;
  return chunkEnd > viewport.visibleStart && chunkStart < viewport.visibleEnd;
}
```

### Modified: TimeScale

**File:** `packages/ui-components/src/components/TimeScale.tsx`

**Current:** Single canvas at full width. Crashes with long files.

**Change:**
1. Chunk the canvas into `MAX_CANVAS_WIDTH` (1000px) segments, same pattern as `Channel.tsx`
2. Only render chunks within viewport range
3. Filter time labels (`<TimeStamp>` divs) to visible range only
4. Each chunk's canvas draws only the tick marks within its pixel range
5. Absolutely position each chunk at `left: chunkIndex * 1000px`

### Modified: Channel (Waveform)

**File:** `packages/ui-components/src/components/Channel.tsx`

**Current:** All canvas chunks rendered and drawn.

**Change:**
1. Switch chunks from `float: left` to absolute positioning
2. Consume `useScrollViewport()` to get visible range
3. Only mount canvas elements for visible chunks
4. In `useLayoutEffect`, compute each chunk's global pixel offset from its index: `chunkGlobalOffset = chunkIndex * MAX_CANVAS_WIDTH`
5. Draw peak data only for mounted canvases

### Modified: SpectrogramChannel

**File:** `packages/ui-components/src/components/SpectrogramChannel.tsx`

**Current:** All canvas chunks mounted and rendered. Each allocates `ImageData`. Worker mode transfers all canvases on mount.

**Change:**
1. Switch chunks from `float: left` to absolute positioning
2. Only mount canvas elements for visible chunks
3. Non-visible chunks are simply not in the DOM (no spacers needed with absolute positioning)

**Worker mode specifics:**
- As chunks scroll into view: mount canvas, `transferControlToOffscreen()`, `registerCanvas()` to worker
- As chunks scroll out: unmount canvas, `unregisterCanvas()` from worker
- `transferControlToOffscreen()` can only be called once per canvas element. Since React unmount/remount creates new elements, this works naturally.
- No caching of rendered chunks. Re-render on re-entry is acceptable.

**Main-thread mode:**
- Same approach: only mount and compute `ImageData` for visible chunks
- Biggest memory win: ~28MB down to ~3MB for a 1-hour file

### Modified: Playlist

**File:** `packages/ui-components/src/components/Playlist.tsx`

**Change:** Add `ScrollViewportProvider` wrapping the scroll container content. The provider observes the `Wrapper` div.

```
<Wrapper data-scroll-container ref={wrapperRef}>
  <ScrollViewportProvider containerRef={wrapperRef}>
    <ScrollContainer ...>
      <TimescaleWrapper>...</TimescaleWrapper>
      <TracksContainer>...</TracksContainer>
    </ScrollContainer>
  </ScrollViewportProvider>
</Wrapper>
```

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `ui-components/src/contexts/ScrollViewport.tsx` | **New** | Scroll viewport context, provider, hook |
| `ui-components/src/components/TimeScale.tsx` | **Modify** | Chunk canvas + viewport-aware rendering |
| `ui-components/src/components/Channel.tsx` | **Modify** | Absolute positioning + viewport-aware rendering |
| `ui-components/src/components/SpectrogramChannel.tsx` | **Modify** | Viewport-aware mount/unmount + worker coordination |
| `ui-components/src/components/Playlist.tsx` | **Modify** | Add ScrollViewportProvider |
| `ui-components/src/contexts/index.ts` | **Modify** | Export new context |
| `ui-components/src/components/index.tsx` | **Modify** | Export if needed |

## Backwards Compatibility

- `useScrollViewport()` returns `null` when no provider exists
- All visibility checks default to "render everything" when viewport is `null`
- Consumers using `Channel` or `SpectrogramChannel` standalone (without `Playlist`) get the current behavior
- No API changes to component props

## Memory Impact (1-hour file, 48kHz, samplesPerPixel=4096)

| Component | Before | After (1200px viewport) |
|-----------|--------|------------------------|
| TimeScale | 1 canvas, ~87K device px wide (CRASH) | ~4 visible 1000px chunks |
| Channel (per track) | 44 canvases | ~7 visible canvases |
| Spectrogram (per track) | ~28MB ImageData | ~3MB ImageData |
| Total DOM canvases (10 tracks, stereo) | ~880+ canvases | ~140 canvases |

## Edge Cases

1. **Zoom changes** recalculate total width and chunk count. Viewport context updates automatically.
2. **Programmatic scroll** (e.g., follow playhead) triggers scroll events normally.
3. **Window resize** handled by ResizeObserver updating `containerWidth`.
4. **No audio loaded** (empty state) has no chunks to virtualize.
5. **Recording in progress** extends duration dynamically. New chunks mount as they enter viewport.
