import type { SpectrogramConfig, SpectrogramData } from '@waveform-playlist/core';

export interface SpectrogramWorkerComputeParams {
  channelDataArrays: Float32Array[];
  config: SpectrogramConfig;
  sampleRate: number;
  offsetSamples: number;
  durationSamples: number;
  mono: boolean;
}

export interface SpectrogramWorkerRenderParams extends SpectrogramWorkerComputeParams {
  render: {
    canvasIds: string[][];
    canvasWidths: number[];
    canvasHeight: number;
    devicePixelRatio: number;
    samplesPerPixel: number;
    colorLUT: Uint8Array;
    frequencyScale: string;
    minFrequency: number;
    maxFrequency: number;
  };
}

export interface SpectrogramWorkerFFTParams {
  clipId: string;
  channelDataArrays: Float32Array[];
  config: SpectrogramConfig;
  sampleRate: number;
  offsetSamples: number;
  durationSamples: number;
  mono: boolean;
  sampleRange?: { start: number; end: number };
}

export interface SpectrogramWorkerRenderChunksParams {
  cacheKey: string;
  canvasIds: string[];
  canvasWidths: number[];
  globalPixelOffsets: number[];
  canvasHeight: number;
  devicePixelRatio: number;
  samplesPerPixel: number;
  colorLUT: Uint8Array;
  frequencyScale: string;
  minFrequency: number;
  maxFrequency: number;
  gainDb: number;
  rangeDb: number;
  channelIndex: number;
}

type ComputeResponse =
  | { id: string; type: 'spectrograms'; spectrograms: SpectrogramData[] }
  | { id: string; type: 'cache-key'; cacheKey: string }
  | { id: string; type: 'done' }
  | { id: string; type: 'error'; error: string };

export interface SpectrogramWorkerApi {
  compute(params: SpectrogramWorkerComputeParams): Promise<SpectrogramData[]>;
  computeFFT(params: SpectrogramWorkerFFTParams): Promise<{ cacheKey: string }>;
  renderChunks(params: SpectrogramWorkerRenderChunksParams): Promise<void>;
  registerCanvas(canvasId: string, canvas: OffscreenCanvas): void;
  unregisterCanvas(canvasId: string): void;
  registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void;
  unregisterAudioData(clipId: string): void;
  computeAndRender(params: SpectrogramWorkerRenderParams): Promise<void>;
  terminate(): void;
}

let idCounter = 0;

/**
 * Wraps a Web Worker running `spectrogram.worker.ts` with a promise-based API.
 *
 * The caller is responsible for creating the Worker, e.g.:
 * ```ts
 * const worker = new Worker(
 *   new URL('@waveform-playlist/spectrogram/worker/spectrogram.worker', import.meta.url),
 *   { type: 'module' }
 * );
 * const api = createSpectrogramWorker(worker);
 * ```
 */
export function createSpectrogramWorker(worker: Worker): SpectrogramWorkerApi {
  const pending = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: unknown) => void;
  }>();

  // Track which clipIds have pre-registered audio data in the worker
  const registeredClipIds = new Set<string>();
  let terminated = false;

  worker.onmessage = (e: MessageEvent<ComputeResponse>) => {
    const msg = e.data;
    const entry = pending.get(msg.id);
    if (entry) {
      pending.delete(msg.id);
      switch (msg.type) {
        case 'error':
          entry.reject(new Error(msg.error));
          break;
        case 'cache-key':
          entry.resolve({ cacheKey: msg.cacheKey });
          break;
        case 'done':
          entry.resolve(undefined);
          break;
        case 'spectrograms':
          entry.resolve(msg.spectrograms);
          break;
      }
    } else if (msg.id) {
      console.warn(`[spectrogram] Received response for unknown message ID: ${msg.id}`);
    }
  };

  worker.onerror = (e: ErrorEvent) => {
    terminated = true;
    for (const [, entry] of pending) {
      entry.reject(e.error ?? new Error(e.message));
    }
    pending.clear();
  };

  return {
    compute(params: SpectrogramWorkerComputeParams): Promise<SpectrogramData[]> {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const id = String(++idCounter);

      return new Promise<SpectrogramData[]>((resolve, reject) => {
        pending.set(id, { resolve, reject });

        // Slice channel data so we can transfer without detaching the original AudioBuffer views
        const transferableArrays = params.channelDataArrays.map(arr => arr.slice());
        const transferables = transferableArrays.map(arr => arr.buffer);

        worker.postMessage(
          {
            id,
            channelDataArrays: transferableArrays,
            config: params.config,
            sampleRate: params.sampleRate,
            offsetSamples: params.offsetSamples,
            durationSamples: params.durationSamples,
            mono: params.mono,
          },
          transferables,
        );
      });
    },

    computeFFT(params: SpectrogramWorkerFFTParams): Promise<{ cacheKey: string }> {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const id = String(++idCounter);

      return new Promise<{ cacheKey: string }>((resolve, reject) => {
        pending.set(id, { resolve, reject });

        // Skip transfer if audio data is pre-registered in the worker
        const isPreRegistered = registeredClipIds.has(params.clipId);
        const transferableArrays = isPreRegistered ? [] : params.channelDataArrays.map(arr => arr.slice());
        const transferables = transferableArrays.map(arr => arr.buffer);

        worker.postMessage(
          {
            type: 'compute-fft',
            id,
            clipId: params.clipId,
            channelDataArrays: transferableArrays,
            config: params.config,
            sampleRate: params.sampleRate,
            offsetSamples: params.offsetSamples,
            durationSamples: params.durationSamples,
            mono: params.mono,
            ...(params.sampleRange ? { sampleRange: params.sampleRange } : {}),
          },
          transferables,
        );
      });
    },

    renderChunks(params: SpectrogramWorkerRenderChunksParams): Promise<void> {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const id = String(++idCounter);

      return new Promise<void>((resolve, reject) => {
        pending.set(id, { resolve, reject });

        worker.postMessage({
          type: 'render-chunks',
          id,
          cacheKey: params.cacheKey,
          canvasIds: params.canvasIds,
          canvasWidths: params.canvasWidths,
          globalPixelOffsets: params.globalPixelOffsets,
          canvasHeight: params.canvasHeight,
          devicePixelRatio: params.devicePixelRatio,
          samplesPerPixel: params.samplesPerPixel,
          colorLUT: params.colorLUT,
          frequencyScale: params.frequencyScale,
          minFrequency: params.minFrequency,
          maxFrequency: params.maxFrequency,
          gainDb: params.gainDb,
          rangeDb: params.rangeDb,
          channelIndex: params.channelIndex,
        });
      });
    },

    registerCanvas(canvasId: string, canvas: OffscreenCanvas): void {
      worker.postMessage(
        { type: 'register-canvas', canvasId, canvas },
        [canvas],
      );
    },

    unregisterCanvas(canvasId: string): void {
      worker.postMessage({ type: 'unregister-canvas', canvasId });
    },

    registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void {
      const transferableArrays = channelDataArrays.map(arr => arr.slice());
      const transferables = transferableArrays.map(arr => arr.buffer);
      worker.postMessage(
        { type: 'register-audio-data', clipId, channelDataArrays: transferableArrays, sampleRate },
        transferables,
      );
      registeredClipIds.add(clipId);
    },

    unregisterAudioData(clipId: string): void {
      worker.postMessage({ type: 'unregister-audio-data', clipId });
      registeredClipIds.delete(clipId);
    },

    computeAndRender(params: SpectrogramWorkerRenderParams): Promise<void> {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const id = String(++idCounter);

      return new Promise<void>((resolve, reject) => {
        pending.set(id, { resolve, reject });

        const transferableArrays = params.channelDataArrays.map(arr => arr.slice());
        const transferables: Transferable[] = transferableArrays.map(arr => arr.buffer);

        worker.postMessage(
          {
            type: 'compute-render',
            id,
            channelDataArrays: transferableArrays,
            config: params.config,
            sampleRate: params.sampleRate,
            offsetSamples: params.offsetSamples,
            durationSamples: params.durationSamples,
            mono: params.mono,
            render: params.render,
          },
          transferables,
        );
      });
    },

    terminate() {
      terminated = true;
      worker.terminate();
      for (const [, entry] of pending) {
        entry.reject(new Error('Worker terminated'));
      }
      pending.clear();
    },
  };
}
