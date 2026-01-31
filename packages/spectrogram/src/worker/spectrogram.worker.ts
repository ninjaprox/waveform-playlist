/**
 * Web Worker for off-main-thread spectrogram computation and rendering.
 *
 * Supports three modes:
 * 1. `compute` — FFT only, returns SpectrogramData to main thread (backward compat)
 * 2. `register-canvas` / `unregister-canvas` — manage OffscreenCanvas ownership
 * 3. `compute-render` — FFT + direct pixel rendering to registered OffscreenCanvases
 */

import type { SpectrogramConfig, SpectrogramData } from '@waveform-playlist/core';
import { fft, magnitudeSpectrum, toDecibels } from '../computation/fft';
import { getWindowFunction } from '../computation/windowFunctions';
import { getFrequencyScale, type FrequencyScaleName } from '../computation/frequencyScales';

// --- Canvas registry ---
const canvasRegistry = new Map<string, OffscreenCanvas>();

// --- Message types ---

interface ComputeRequest {
  type?: 'compute';
  id: string;
  channelDataArrays: Float32Array[];
  config: SpectrogramConfig;
  sampleRate: number;
  offsetSamples: number;
  durationSamples: number;
  mono: boolean;
}

interface RegisterCanvasMessage {
  type: 'register-canvas';
  canvasId: string;
  canvas: OffscreenCanvas;
}

interface UnregisterCanvasMessage {
  type: 'unregister-canvas';
  canvasId: string;
}

interface ComputeRenderRequest {
  type: 'compute-render';
  id: string;
  channelDataArrays: Float32Array[];
  config: SpectrogramConfig;
  sampleRate: number;
  offsetSamples: number;
  durationSamples: number;
  mono: boolean;
  render: {
    canvasIds: string[][];      // [channel][chunk] → canvasId
    canvasWidths: number[];     // per-chunk CSS widths
    canvasHeight: number;
    devicePixelRatio: number;
    samplesPerPixel: number;
    colorLUT: Uint8Array;
    frequencyScale: string;
    minFrequency: number;
    maxFrequency: number;
  };
}

type WorkerMessage = ComputeRequest | RegisterCanvasMessage | UnregisterCanvasMessage | ComputeRenderRequest;

interface ComputeResponse {
  id: string;
  spectrograms?: SpectrogramData[];
  done?: boolean;
}

// --- FFT computation (unchanged) ---

function computeFromChannelData(
  channelData: Float32Array,
  config: SpectrogramConfig,
  sampleRate: number,
  offsetSamples: number,
  durationSamples: number,
): SpectrogramData {
  const windowSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const actualFftSize = windowSize * zeroPaddingFactor;
  const hopSize = config.hopSize ?? Math.floor(windowSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const gainDb = config.gainDb ?? 20;
  const rangeDb = config.rangeDb ?? 80;
  const alpha = config.alpha;

  const frequencyBinCount = actualFftSize >> 1;
  const totalSamples = durationSamples;

  const window = getWindowFunction(windowName, windowSize, alpha);
  const frameCount = Math.max(1, Math.floor((totalSamples - windowSize) / hopSize) + 1);
  const data = new Float32Array(frameCount * frequencyBinCount);
  const real = new Float32Array(actualFftSize);
  const imag = new Float32Array(actualFftSize);

  for (let frame = 0; frame < frameCount; frame++) {
    const start = offsetSamples + frame * hopSize;

    for (let i = 0; i < windowSize; i++) {
      const sampleIdx = start + i;
      real[i] = sampleIdx < channelData.length ? channelData[sampleIdx] * window[i] : 0;
    }
    for (let i = windowSize; i < actualFftSize; i++) {
      real[i] = 0;
    }
    imag.fill(0);

    fft(real, imag);
    const mags = magnitudeSpectrum(real, imag);
    const dbs = toDecibels(mags);
    data.set(dbs, frame * frequencyBinCount);
  }

  return { fftSize: actualFftSize, windowSize, frequencyBinCount, sampleRate, hopSize, frameCount, data, gainDb, rangeDb };
}

function computeMonoFromChannels(
  channels: Float32Array[],
  config: SpectrogramConfig,
  sampleRate: number,
  offsetSamples: number,
  durationSamples: number,
): SpectrogramData {
  if (channels.length === 1) {
    return computeFromChannelData(channels[0], config, sampleRate, offsetSamples, durationSamples);
  }

  const windowSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const actualFftSize = windowSize * zeroPaddingFactor;
  const hopSize = config.hopSize ?? Math.floor(windowSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const gainDb = config.gainDb ?? 20;
  const rangeDb = config.rangeDb ?? 80;
  const alpha = config.alpha;

  const frequencyBinCount = actualFftSize >> 1;
  const numChannels = channels.length;

  const window = getWindowFunction(windowName, windowSize, alpha);
  const frameCount = Math.max(1, Math.floor((durationSamples - windowSize) / hopSize) + 1);
  const data = new Float32Array(frameCount * frequencyBinCount);
  const real = new Float32Array(actualFftSize);
  const imag = new Float32Array(actualFftSize);

  for (let frame = 0; frame < frameCount; frame++) {
    const start = offsetSamples + frame * hopSize;

    for (let i = 0; i < windowSize; i++) {
      const sampleIdx = start + i;
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += sampleIdx < channels[ch].length ? channels[ch][sampleIdx] : 0;
      }
      real[i] = (sum / numChannels) * window[i];
    }
    for (let i = windowSize; i < actualFftSize; i++) {
      real[i] = 0;
    }
    imag.fill(0);

    fft(real, imag);
    const mags = magnitudeSpectrum(real, imag);
    const dbs = toDecibels(mags);
    data.set(dbs, frame * frequencyBinCount);
  }

  return { fftSize: actualFftSize, windowSize, frequencyBinCount, sampleRate, hopSize, frameCount, data, gainDb, rangeDb };
}

// --- Rendering ---

function renderSpectrogramToCanvas(
  specData: SpectrogramData,
  canvasIds: string[],
  canvasWidths: number[],
  canvasHeight: number,
  devicePixelRatio: number,
  samplesPerPixel: number,
  colorLUT: Uint8Array,
  scaleFn: (f: number, minF: number, maxF: number) => number,
  minFrequency: number,
  maxFrequency: number,
  isNonLinear: boolean,
): void {
  const { frequencyBinCount, frameCount, hopSize, sampleRate, gainDb, rangeDb } = specData;
  const maxF = maxFrequency > 0 ? maxFrequency : sampleRate / 2;
  const binToFreq = (bin: number) => (bin / frequencyBinCount) * (sampleRate / 2);

  let globalPixelOffset = 0;

  for (let chunkIdx = 0; chunkIdx < canvasIds.length; chunkIdx++) {
    const canvasId = canvasIds[chunkIdx];
    const offscreen = canvasRegistry.get(canvasId);
    if (!offscreen) continue;

    const canvasWidth = canvasWidths[chunkIdx];

    // Set physical canvas size for DPR
    offscreen.width = canvasWidth * devicePixelRatio;
    offscreen.height = canvasHeight * devicePixelRatio;

    const ctx = offscreen.getContext('2d');
    if (!ctx) continue;

    ctx.resetTransform();
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.imageSmoothingEnabled = false;

    // Create ImageData at CSS pixel size
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

        if (isNonLinear) {
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

        const db = specData.data[frameOffset + bin];
        const normalized = Math.max(0, Math.min(1, (db + rangeDb + gainDb) / rangeDb));

        const colorIdx = Math.floor(normalized * 255);
        const pixelIdx = (y * canvasWidth + x) * 4;
        pixels[pixelIdx] = colorLUT[colorIdx * 3];
        pixels[pixelIdx + 1] = colorLUT[colorIdx * 3 + 1];
        pixels[pixelIdx + 2] = colorLUT[colorIdx * 3 + 2];
        pixels[pixelIdx + 3] = 255;
      }
    }

    // Put image data and scale up for DPR
    if (devicePixelRatio === 1) {
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Render at CSS size to a temporary OffscreenCanvas, then scale up
      const tmpCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmpCanvas, 0, 0, offscreen.width, offscreen.height);
    }

    globalPixelOffset += canvasWidth;
  }
}

// --- Message handler ---

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  // Register canvas
  if (msg.type === 'register-canvas') {
    canvasRegistry.set(msg.canvasId, msg.canvas);
    return;
  }

  // Unregister canvas
  if (msg.type === 'unregister-canvas') {
    canvasRegistry.delete(msg.canvasId);
    return;
  }

  // Compute + render to registered canvases
  if (msg.type === 'compute-render') {
    const { id, channelDataArrays, config, sampleRate, offsetSamples, durationSamples, mono, render } = msg;

    // Compute spectrograms
    const spectrograms: SpectrogramData[] = [];
    if (mono || channelDataArrays.length === 1) {
      spectrograms.push(
        computeMonoFromChannels(channelDataArrays, config, sampleRate, offsetSamples, durationSamples)
      );
    } else {
      for (const channelData of channelDataArrays) {
        spectrograms.push(
          computeFromChannelData(channelData, config, sampleRate, offsetSamples, durationSamples)
        );
      }
    }

    // Render each channel's spectrogram to its canvas chunks
    const scaleFn = getFrequencyScale((render.frequencyScale ?? 'mel') as FrequencyScaleName);
    const isNonLinear = render.frequencyScale !== 'linear';

    for (let ch = 0; ch < spectrograms.length; ch++) {
      const channelCanvasIds = render.canvasIds[ch];
      if (!channelCanvasIds || channelCanvasIds.length === 0) continue;

      renderSpectrogramToCanvas(
        spectrograms[ch],
        channelCanvasIds,
        render.canvasWidths,
        render.canvasHeight,
        render.devicePixelRatio,
        render.samplesPerPixel,
        render.colorLUT,
        scaleFn,
        render.minFrequency,
        render.maxFrequency,
        isNonLinear,
      );
    }

    const response: ComputeResponse = { id, done: true };
    (self as unknown as Worker).postMessage(response);
    return;
  }

  // Legacy compute-only (backward compat — no type field or type === 'compute')
  const { id, channelDataArrays, config, sampleRate, offsetSamples, durationSamples, mono } = msg as ComputeRequest;

  const spectrograms: SpectrogramData[] = [];

  if (mono || channelDataArrays.length === 1) {
    spectrograms.push(
      computeMonoFromChannels(channelDataArrays, config, sampleRate, offsetSamples, durationSamples)
    );
  } else {
    for (const channelData of channelDataArrays) {
      spectrograms.push(
        computeFromChannelData(channelData, config, sampleRate, offsetSamples, durationSamples)
      );
    }
  }

  // Transfer the data Float32Arrays back (zero-copy)
  const transferables = spectrograms.map(s => s.data.buffer);

  const response: ComputeResponse = { id, spectrograms };
  (self as unknown as Worker).postMessage(response, transferables);
};
