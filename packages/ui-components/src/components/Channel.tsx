import React, { FunctionComponent, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import type { Peaks, Bits } from '@waveform-playlist/core';
import { WaveformColor, WaveformDrawMode, isWaveformGradient, waveformColorToCss } from '../wfpl-theme';
import { useScrollViewportSelector } from '../contexts/ScrollViewport';
import { MAX_CANVAS_WIDTH } from '../constants';

// Re-export WaveformColor for consumers
export type { WaveformColor } from '../wfpl-theme';
export type { WaveformDrawMode } from '../wfpl-theme';

/**
 * Creates a Canvas gradient from a WaveformColor configuration
 */
function createCanvasFillStyle(
  ctx: CanvasRenderingContext2D,
  color: WaveformColor,
  width: number,
  height: number
): string | CanvasGradient {
  if (!isWaveformGradient(color)) {
    return color;
  }

  let gradient: CanvasGradient;
  if (color.direction === 'vertical') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
  } else {
    gradient = ctx.createLinearGradient(0, 0, width, 0);
  }

  for (const stop of color.stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return gradient;
}

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
  /* Promote to own compositing layer for smoother scrolling */
  will-change: transform;
  /* Disable image rendering interpolation */
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

interface WrapperProps {
  readonly $index: number;
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $waveFillColor: string; // CSS background value (solid or gradient)
}

const Wrapper = styled.div.attrs<WrapperProps>((props) => ({
  style: {
    top: `${props.$waveHeight * props.$index}px`,
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WrapperProps>`
  position: absolute;
  background: ${(props) => props.$waveFillColor};
  /* Force GPU compositing layer to reduce scroll flickering */
  transform: translateZ(0);
  backface-visibility: hidden;
`;

export interface ChannelProps {
  className?: string;
  index: number;
  data: Peaks;
  bits: Bits;
  length: number;
  devicePixelRatio?: number;
  waveHeight?: number;
  /** Waveform bar color - can be a solid color string or gradient config */
  waveOutlineColor?: WaveformColor;
  /** Waveform background color - can be a solid color string or gradient config */
  waveFillColor?: WaveformColor;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth?: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap?: number;
  /** If true, background is transparent (for use with external progress overlay) */
  transparentBackground?: boolean;
  /**
   * Drawing mode:
   * - 'inverted': Draw waveOutlineColor where there's NO audio (current default). Good for gradient bars.
   * - 'normal': Draw waveFillColor where there IS audio. Good for gradient backgrounds.
   */
  drawMode?: WaveformDrawMode;
}

export const Channel: FunctionComponent<ChannelProps> = (props) => {
  const {
    data,
    bits,
    length,
    index,
    className,
    devicePixelRatio = 1,
    waveHeight = 80,
    waveOutlineColor = '#E0EFF1',
    waveFillColor = 'grey',
    barWidth = 1,
    barGap = 0,
    transparentBackground = false,
    drawMode = 'inverted',
  } = props;
  const canvasesRef = useRef<HTMLCanvasElement[]>([]);

  // Selector returns a comma-joined string of visible chunk indices.
  // useSyncExternalStore compares strings by value (Object.is), so
  // the component only re-renders when the set of visible chunks changes,
  // not on every scroll pixel.
  const visibleChunkKey = useScrollViewportSelector((viewport) => {
    const totalChunks = Math.ceil(length / MAX_CANVAS_WIDTH);
    const indices: number[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunkLeft = i * MAX_CANVAS_WIDTH;
      const chunkWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

      if (viewport) {
        const chunkEnd = chunkLeft + chunkWidth;
        if (chunkEnd <= viewport.visibleStart || chunkLeft >= viewport.visibleEnd) {
          continue;
        }
      }

      indices.push(i);
    }

    return indices.join(',');
  });

  // Parse the key back to indices for rendering and drawing
  const visibleChunkIndices = visibleChunkKey
    ? visibleChunkKey.split(',').map(Number)
    : [];

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas !== null) {
        const index: number = parseInt(canvas.dataset.index!, 10);
        canvasesRef.current[index] = canvas;
      }
    },
    []
  );

  // Clean up stale refs for unmounted chunks
  useEffect(() => {
    const canvases = canvasesRef.current;
    for (let i = canvases.length - 1; i >= 0; i--) {
      if (canvases[i] && !canvases[i].isConnected) {
        delete canvases[i];
      }
    }
  });

  // Draw waveform bars on visible canvas chunks.
  // visibleChunkKey changes only when chunks mount/unmount, not on every scroll pixel.
  useLayoutEffect(() => {
    const canvases = canvasesRef.current;
    const step = barWidth + barGap;

    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      if (!canvas) continue; // Skip unmounted chunks (sparse array from virtualization)

      const canvasIdx = parseInt(canvas.dataset.index!, 10);
      const globalPixelOffset = canvasIdx * MAX_CANVAS_WIDTH;

      const ctx = canvas.getContext('2d');
      const h2 = Math.floor(waveHeight / 2);
      const maxValue = 2 ** (bits - 1);

      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        // Create gradient using CSS pixel coordinates (after scaling)
        // This ensures the gradient aligns with the drawing coordinates
        const canvasWidth = canvas.width / devicePixelRatio;

        // Choose canvas fill color based on draw mode:
        let fillColor: WaveformColor;
        if (drawMode === 'normal') {
          // Normal: canvas draws the bars directly
          fillColor = waveFillColor;
        } else {
          // Inverted: canvas masks non-audio areas, background shows as bars
          fillColor = waveOutlineColor;
        }
        ctx.fillStyle = createCanvasFillStyle(
          ctx,
          fillColor,
          canvasWidth,
          waveHeight
        );

        // Calculate where bars should be drawn in this canvas
        // by finding where in the global bar pattern this canvas starts
        const canvasStartGlobal = globalPixelOffset;
        const canvasEndGlobal = globalPixelOffset + canvasWidth;

        // Find the first bar that could affect this canvas
        // A bar at position X extends from X to X+barWidth-1
        // So we need bars where barStart + barWidth > canvasStartGlobal
        // Which means barStart > canvasStartGlobal - barWidth
        const firstBarGlobal = Math.floor((canvasStartGlobal - barWidth + step) / step) * step;

        // Draw bars at the correct positions
        for (let barGlobal = Math.max(0, firstBarGlobal); barGlobal < canvasEndGlobal; barGlobal += step) {
          const x = barGlobal - canvasStartGlobal; // Local x position in this canvas

          // Skip if the entire bar would be before this canvas
          if (x + barWidth <= 0) continue;

          const peakIndex = barGlobal; // Each pixel position corresponds to a peak

          if (peakIndex * 2 + 1 < data.length) {
            const minPeak = data[peakIndex * 2] / maxValue;
            const maxPeak = data[peakIndex * 2 + 1] / maxValue;

            const min = Math.abs(minPeak * h2);
            const max = Math.abs(maxPeak * h2);

            if (drawMode === 'normal') {
              // Normal mode: draw the actual peak bars
              // Draw from h2-max to h2+min (the actual waveform shape)
              ctx.fillRect(x, h2 - max, barWidth, max + min);
            } else {
              // Inverted mode (default): draw areas WITHOUT audio
              // This masks the background color to reveal the peaks
              // draw top region (above max peak)
              ctx.fillRect(x, 0, barWidth, h2 - max);
              // draw bottom region (below min peak)
              ctx.fillRect(x, h2 + min, barWidth, h2 - min);
            }
          }
        }
      }
    }
  }, [
    data,
    bits,
    waveHeight,
    waveOutlineColor,
    waveFillColor,
    devicePixelRatio,
    length,
    barWidth,
    barGap,
    drawMode,
    visibleChunkKey,
  ]);

  // Build visible canvas chunk elements
  const waveforms = visibleChunkIndices.map((i) => {
    const chunkLeft = i * MAX_CANVAS_WIDTH;
    const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

    return (
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
  });

  // Background color depends on draw mode:
  // Visual result is always: waveOutlineColor = bars, waveFillColor = background
  // - normal: waveFillColor is background, canvas draws waveOutlineColor bars on top
  // - inverted: waveFillColor is background, canvas masks with it to reveal waveOutlineColor (bars)
  const bgColor = waveFillColor;
  const backgroundCss = transparentBackground ? 'transparent' : waveformColorToCss(bgColor);

  return (
    <Wrapper
      $index={index}
      $cssWidth={length}
      className={className}
      $waveHeight={waveHeight}
      $waveFillColor={backgroundCss}
    >
      {waveforms}
    </Wrapper>
  );
};
