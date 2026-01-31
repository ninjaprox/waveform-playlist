import React, { FunctionComponent, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { SpectrogramData, ColorMapValue } from '@waveform-playlist/core';

const MAX_CANVAS_WIDTH = 1000;

interface WrapperProps {
  readonly $index: number;
  readonly $cssWidth: number;
  readonly $waveHeight: number;
}

const Wrapper = styled.div.attrs<WrapperProps>((props) => ({
  style: {
    top: `${props.$waveHeight * props.$index}px`,
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WrapperProps>`
  position: absolute;
  background: #000;
  transform: translateZ(0);
  backface-visibility: hidden;
`;

interface CanvasProps {
  readonly $cssWidth: number;
  readonly $waveHeight: number;
}

const SpectrogramCanvas = styled.canvas.attrs<CanvasProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<CanvasProps>`
  float: left;
  position: relative;
  will-change: transform;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

// Inline getColorMap to avoid cross-package import at component level
// This avoids needing browser package as dependency of ui-components
function defaultGetColorMap(): Uint8Array {
  // Viridis fallback — 256-entry grayscale
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    lut[i * 3] = lut[i * 3 + 1] = lut[i * 3 + 2] = i;
  }
  return lut;
}

export interface SpectrogramWorkerCanvasApi {
  registerCanvas(canvasId: string, canvas: OffscreenCanvas): void;
  unregisterCanvas(canvasId: string): void;
}

export interface SpectrogramChannelProps {
  /** Channel index (0 = first, 1 = second, etc.) */
  index: number;
  /** Computed spectrogram data (not needed when workerApi is provided) */
  data?: SpectrogramData;
  /** Width in CSS pixels */
  length: number;
  /** Height in CSS pixels */
  waveHeight: number;
  /** Device pixel ratio for sharp rendering */
  devicePixelRatio?: number;
  /** Samples per pixel at current zoom level */
  samplesPerPixel: number;
  /** 256-entry RGB LUT (768 bytes) from getColorMap() */
  colorLUT?: Uint8Array;
  /** Frequency scale function: (freqHz, minF, maxF) => [0,1] */
  frequencyScaleFn?: (f: number, minF: number, maxF: number) => number;
  /** Min frequency in Hz */
  minFrequency?: number;
  /** Max frequency in Hz (defaults to sampleRate/2) */
  maxFrequency?: number;
  /** Worker API for transferring canvas ownership. When provided, rendering is done in the worker. */
  workerApi?: SpectrogramWorkerCanvasApi;
  /** Clip ID used to construct unique canvas IDs for worker registration */
  clipId?: string;
  /** Callback when canvases are registered with the worker, providing canvas IDs and widths */
  onCanvasesReady?: (canvasIds: string[], canvasWidths: number[]) => void;
}

export const SpectrogramChannel: FunctionComponent<SpectrogramChannelProps> = ({
  index,
  data,
  length,
  waveHeight,
  devicePixelRatio = 1,
  samplesPerPixel,
  colorLUT,
  frequencyScaleFn,
  minFrequency = 0,
  maxFrequency,
  workerApi,
  clipId,
  onCanvasesReady,
}) => {
  const canvasesRef = useRef<HTMLCanvasElement[]>([]);
  const registeredIdsRef = useRef<string[]>([]);

  // Track whether we're in worker mode (canvas transferred)
  const isWorkerMode = !!(workerApi && clipId);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas !== null) {
        const idx = parseInt(canvas.dataset.index!, 10);
        canvasesRef.current[idx] = canvas;
      }
    },
    []
  );

  // Worker mode: transfer canvases to worker on mount
  useEffect(() => {
    if (!isWorkerMode) return;

    const canvasCount = Math.ceil(length / MAX_CANVAS_WIDTH);
    canvasesRef.current.length = canvasCount;
    const canvases = canvasesRef.current;
    const ids: string[] = [];
    const widths: number[] = [];

    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      if (!canvas) continue;

      const canvasId = `${clipId}-ch${index}-chunk${i}`;

      try {
        const offscreen = canvas.transferControlToOffscreen();
        workerApi!.registerCanvas(canvasId, offscreen);
        ids.push(canvasId);
        widths.push(Math.min(length - i * MAX_CANVAS_WIDTH, MAX_CANVAS_WIDTH));
      } catch (err) {
        console.warn(`[spectrogram] transferControlToOffscreen failed for ${canvasId}:`, err);
        break;
      }
    }

    registeredIdsRef.current = ids;

    if (ids.length > 0 && onCanvasesReady) {
      onCanvasesReady(ids, widths);
    }

    return () => {
      for (const id of registeredIdsRef.current) {
        workerApi!.unregisterCanvas(id);
      }
      registeredIdsRef.current = [];
    };
  // Re-run when canvas keys change (length changes cause remount via key prop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkerMode, clipId, index, length]);

  const lut = colorLUT ?? defaultGetColorMap();
  const maxF = maxFrequency ?? (data ? data.sampleRate / 2 : 22050);
  const scaleFn = frequencyScaleFn ?? ((f: number, minF: number, maxF: number) => (f - minF) / (maxF - minF));

  // Main-thread rendering (skipped in worker mode)
  useLayoutEffect(() => {
    if (isWorkerMode || !data) return;

    const canvases = canvasesRef.current;
    const { frequencyBinCount, frameCount, hopSize, sampleRate, gainDb, rangeDb: rawRangeDb } = data;
    const rangeDb = rawRangeDb === 0 ? 1 : rawRangeDb;
    let globalPixelOffset = 0;

    // Pre-compute Y mapping: for each pixel row, which frequency bin(s) to sample
    const binToFreq = (bin: number) => (bin / frequencyBinCount) * (sampleRate / 2);

    for (let canvasIdx = 0; canvasIdx < canvases.length; canvasIdx++) {
      const canvas = canvases[canvasIdx];
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = canvas.width / devicePixelRatio;
      const canvasHeight = waveHeight;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      // Create ImageData at CSS pixel size, then putImageData at scaled resolution
      const imgData = ctx.createImageData(canvasWidth, canvasHeight);
      const pixels = imgData.data;

      for (let x = 0; x < canvasWidth; x++) {
        const globalX = globalPixelOffset + x;

        // Map pixel X → spectrogram frame
        const samplePos = globalX * samplesPerPixel;
        const frame = Math.floor(samplePos / hopSize);

        if (frame < 0 || frame >= frameCount) continue;

        const frameOffset = frame * frequencyBinCount;

        for (let y = 0; y < canvasHeight; y++) {
          // Y=0 is top of canvas, but low frequencies should be at bottom
          const normalizedY = 1 - y / canvasHeight; // 0=bottom, 1=top

          // Map normalizedY through frequency scale to find which frequency this pixel represents
          // We need the inverse: given a normalized position, find the frequency
          // Use binary search over frequency bins
          let bin = Math.floor(normalizedY * frequencyBinCount);

          // If we have a non-linear scale, find the correct bin
          if (frequencyScaleFn) {
            // Binary search: find the bin whose scaled position is closest to normalizedY
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

          // Get dB value and normalize to [0, 1]
          const db = data.data[frameOffset + bin];
          const normalized = Math.max(0, Math.min(1, (db + rangeDb + gainDb) / rangeDb));

          // Map to color via LUT (0-255 index)
          const colorIdx = Math.floor(normalized * 255);
          const pixelIdx = (y * canvasWidth + x) * 4;
          pixels[pixelIdx] = lut[colorIdx * 3];
          pixels[pixelIdx + 1] = lut[colorIdx * 3 + 1];
          pixels[pixelIdx + 2] = lut[colorIdx * 3 + 2];
          pixels[pixelIdx + 3] = 255;
        }
      }

      // Put at device pixel ratio scale
      ctx.resetTransform();
      ctx.putImageData(imgData, 0, 0);

      // Scale up to fill canvas
      if (devicePixelRatio !== 1) {
        // Draw the image data at 1:1, then scale
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

      globalPixelOffset += canvasWidth;
    }

  }, [isWorkerMode, data, length, waveHeight, devicePixelRatio, samplesPerPixel, lut, frequencyScaleFn, minFrequency, maxF, scaleFn]);

  // Build canvas chunks
  let totalWidth = length;
  let canvasCount = 0;
  const canvases = [];
  while (totalWidth > 0) {
    const currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
    canvases.push(
      <SpectrogramCanvas
        key={`${length}-${canvasCount}`}
        $cssWidth={currentWidth}
        width={currentWidth * devicePixelRatio}
        height={waveHeight * devicePixelRatio}
        $waveHeight={waveHeight}
        data-index={canvasCount}
        ref={canvasRef}
      />
    );
    totalWidth -= currentWidth;
    canvasCount++;
  }

  return (
    <Wrapper $index={index} $cssWidth={length} $waveHeight={waveHeight}>
      {canvases}
    </Wrapper>
  );
};

