import React, { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import type { SpectrogramData, SpectrogramConfig, SpectrogramComputeConfig, ColorMapValue, RenderMode, TrackSpectrogramOverrides } from '@waveform-playlist/core';
import { computeSpectrogram, computeSpectrogramMono, getColorMap, getFrequencyScale } from './computation';
import { createSpectrogramWorker, type SpectrogramWorkerApi } from './worker';
import { SpectrogramMenuItems } from './components';
import { SpectrogramSettingsModal } from './components';
import { SpectrogramIntegrationProvider, type SpectrogramIntegration } from '@waveform-playlist/browser';
import { usePlaylistData, usePlaylistControls } from '@waveform-playlist/browser';

export interface SpectrogramProviderProps {
  config?: SpectrogramConfig;
  colorMap?: ColorMapValue;
  children: ReactNode;
}

export const SpectrogramProvider: React.FC<SpectrogramProviderProps> = ({
  config: spectrogramConfig,
  colorMap: spectrogramColorMap,
  children,
}) => {
  const {
    tracks,
    waveHeight,
    samplesPerPixel,
    isReady,
    mono,
    controls,
  } = usePlaylistData();
  const { scrollContainerRef } = usePlaylistControls();

  // State
  const [spectrogramDataMap, setSpectrogramDataMap] = useState<Map<string, SpectrogramData[]>>(new Map());
  const [trackSpectrogramOverrides, setTrackSpectrogramOverrides] = useState<Map<string, TrackSpectrogramOverrides>>(new Map());

  // OffscreenCanvas registry for worker-rendered spectrograms
  const spectrogramCanvasRegistryRef = useRef<Map<string, Map<number, { canvasIds: string[]; canvasWidths: number[] }>>>(new Map());
  const [spectrogramCanvasVersion, setSpectrogramCanvasVersion] = useState(0);

  // Spectrogram refs
  const prevSpectrogramConfigRef = useRef<Map<string, string>>(new Map());
  const prevSpectrogramFFTKeyRef = useRef<Map<string, string>>(new Map());
  const spectrogramWorkerRef = useRef<SpectrogramWorkerApi | null>(null);
  const spectrogramGenerationRef = useRef(0);
  const prevCanvasVersionRef = useRef(0);
  const [spectrogramWorkerReady, setSpectrogramWorkerReady] = useState(false);
  const clipCacheKeysRef = useRef<Map<string, string>>(new Map());
  const backgroundRenderAbortRef = useRef<{ aborted: boolean } | null>(null);
  const registeredAudioClipIdsRef = useRef<Set<string>>(new Set());

  // Terminate worker on unmount
  useEffect(() => {
    return () => {
      spectrogramWorkerRef.current?.terminate();
      spectrogramWorkerRef.current = null;
    };
  }, []);

  // Eagerly transfer audio data to worker when tracks load
  useEffect(() => {
    if (!isReady || tracks.length === 0) return;

    let workerApi = spectrogramWorkerRef.current;
    if (!workerApi) {
      try {
        const rawWorker = new Worker(
          new URL('@waveform-playlist/spectrogram/worker/spectrogram.worker', import.meta.url),
          { type: 'module' }
        );
        workerApi = createSpectrogramWorker(rawWorker);
        spectrogramWorkerRef.current = workerApi;
        setSpectrogramWorkerReady(true);
      } catch {
        console.warn('Spectrogram Web Worker unavailable for pre-transfer');
        return;
      }
    }

    const currentClipIds = new Set<string>();

    for (const track of tracks) {
      for (const clip of track.clips) {
        if (!clip.audioBuffer) continue;
        currentClipIds.add(clip.id);

        if (!registeredAudioClipIdsRef.current.has(clip.id)) {
          const channelDataArrays: Float32Array[] = [];
          for (let ch = 0; ch < clip.audioBuffer.numberOfChannels; ch++) {
            channelDataArrays.push(clip.audioBuffer.getChannelData(ch));
          }
          workerApi.registerAudioData(clip.id, channelDataArrays, clip.audioBuffer.sampleRate);
          registeredAudioClipIdsRef.current.add(clip.id);
        }
      }
    }

    for (const clipId of registeredAudioClipIdsRef.current) {
      if (!currentClipIds.has(clipId)) {
        workerApi.unregisterAudioData(clipId);
        registeredAudioClipIdsRef.current.delete(clipId);
      }
    }
  }, [isReady, tracks]);

  // Main spectrogram computation effect
  useEffect(() => {
    if (tracks.length === 0) return;

    const currentKeys = new Map<string, string>();
    const currentFFTKeys = new Map<string, string>();
    tracks.forEach((track) => {
      const mode = trackSpectrogramOverrides.get(track.id)?.renderMode ?? track.renderMode ?? 'waveform';
      if (mode === 'waveform') return;
      const cfg = trackSpectrogramOverrides.get(track.id)?.config ?? track.spectrogramConfig ?? spectrogramConfig;
      const cm = trackSpectrogramOverrides.get(track.id)?.colorMap ?? track.spectrogramColorMap ?? spectrogramColorMap;
      currentKeys.set(track.id, JSON.stringify({ mode, cfg, cm, mono }));
      const computeConfig: SpectrogramComputeConfig = {
        fftSize: cfg?.fftSize, hopSize: cfg?.hopSize,
        windowFunction: cfg?.windowFunction, alpha: cfg?.alpha,
        zeroPaddingFactor: cfg?.zeroPaddingFactor,
      };
      currentFFTKeys.set(track.id, JSON.stringify({ mode, mono, ...computeConfig }));
    });

    const prevKeys = prevSpectrogramConfigRef.current;
    const prevFFTKeys = prevSpectrogramFFTKeyRef.current;

    let configChanged = currentKeys.size !== prevKeys.size;
    if (!configChanged) {
      for (const [idx, key] of currentKeys) {
        if (prevKeys.get(idx) !== key) { configChanged = true; break; }
      }
    }

    let fftKeyChanged = currentFFTKeys.size !== prevFFTKeys.size;
    if (!fftKeyChanged) {
      for (const [idx, key] of currentFFTKeys) {
        if (prevFFTKeys.get(idx) !== key) { fftKeyChanged = true; break; }
      }
    }

    const canvasVersionChanged = spectrogramCanvasVersion !== prevCanvasVersionRef.current;
    prevCanvasVersionRef.current = spectrogramCanvasVersion;

    if (!configChanged && !canvasVersionChanged) return;

    if (configChanged) {
      prevSpectrogramConfigRef.current = currentKeys;
      prevSpectrogramFFTKeyRef.current = currentFFTKeys;
    }

    if (configChanged) {
      setSpectrogramDataMap(prevMap => {
        const activeClipIds = new Set<string>();
        for (const track of tracks) {
          const mode = trackSpectrogramOverrides.get(track.id)?.renderMode ?? track.renderMode ?? 'waveform';
          if (mode === 'spectrogram' || mode === 'both') {
            for (const clip of track.clips) {
              activeClipIds.add(clip.id);
            }
          }
        }
        const newMap = new Map(prevMap);
        for (const clipId of newMap.keys()) {
          if (!activeClipIds.has(clipId)) {
            newMap.delete(clipId);
          }
        }
        return newMap;
      });
    }

    if (backgroundRenderAbortRef.current) {
      backgroundRenderAbortRef.current.aborted = true;
    }

    const generation = ++spectrogramGenerationRef.current;

    let workerApi = spectrogramWorkerRef.current;
    if (!workerApi) {
      try {
        const rawWorker = new Worker(
          new URL('@waveform-playlist/spectrogram/worker/spectrogram.worker', import.meta.url),
          { type: 'module' }
        );
        workerApi = createSpectrogramWorker(rawWorker);
        spectrogramWorkerRef.current = workerApi;
        setSpectrogramWorkerReady(true);
      } catch {
        console.warn('Spectrogram Web Worker unavailable, falling back to synchronous computation');
      }
    }

    const clipsNeedingFFT: Array<{
      clipId: string;
      trackIndex: number;
      channelDataArrays: Float32Array[];
      config: SpectrogramConfig;
      sampleRate: number;
      offsetSamples: number;
      durationSamples: number;
      clipStartSample: number;
      monoFlag: boolean;
      colorMap: ColorMapValue;
    }> = [];
    const clipsNeedingDisplayOnly: Array<{
      clipId: string;
      trackIndex: number;
      config: SpectrogramConfig;
      clipStartSample: number;
      monoFlag: boolean;
      colorMap: ColorMapValue;
      numChannels: number;
    }> = [];

    tracks.forEach((track, i) => {
      const mode = trackSpectrogramOverrides.get(track.id)?.renderMode ?? track.renderMode ?? 'waveform';
      if (mode === 'waveform') return;

      const trackConfigChanged = configChanged && (currentKeys.get(track.id) !== prevKeys.get(track.id));
      const trackFFTChanged = fftKeyChanged && (currentFFTKeys.get(track.id) !== prevFFTKeys.get(track.id));
      const hasRegisteredCanvases = canvasVersionChanged && track.clips.some(
        clip => spectrogramCanvasRegistryRef.current.has(clip.id)
      );
      if (!trackConfigChanged && !hasRegisteredCanvases) return;

      const cfg = trackSpectrogramOverrides.get(track.id)?.config ?? track.spectrogramConfig ?? spectrogramConfig ?? {};
      const cm = trackSpectrogramOverrides.get(track.id)?.colorMap ?? track.spectrogramColorMap ?? spectrogramColorMap ?? 'viridis';

      for (const clip of track.clips) {
        if (!clip.audioBuffer) continue;

        const monoFlag = mono || clip.audioBuffer.numberOfChannels === 1;

        if (!trackFFTChanged && !hasRegisteredCanvases && clipCacheKeysRef.current.has(clip.id)) {
          clipsNeedingDisplayOnly.push({
            clipId: clip.id,
            trackIndex: i,
            config: cfg,
            clipStartSample: clip.startSample,
            monoFlag,
            colorMap: cm,
            numChannels: monoFlag ? 1 : clip.audioBuffer.numberOfChannels,
          });
          continue;
        }

        const channelDataArrays: Float32Array[] = [];
        for (let ch = 0; ch < clip.audioBuffer.numberOfChannels; ch++) {
          channelDataArrays.push(clip.audioBuffer.getChannelData(ch));
        }

        clipsNeedingFFT.push({
          clipId: clip.id,
          trackIndex: i,
          channelDataArrays,
          config: cfg,
          sampleRate: clip.audioBuffer.sampleRate,
          offsetSamples: clip.offsetSamples,
          durationSamples: clip.durationSamples,
          clipStartSample: clip.startSample,
          monoFlag,
          colorMap: cm,
        });
      }
    });

    if (clipsNeedingFFT.length === 0 && clipsNeedingDisplayOnly.length === 0) return;

    if (!workerApi) {
      try {
        setSpectrogramDataMap(prevMap => {
          const newMap = new Map(prevMap);
          for (const item of clipsNeedingFFT) {
            const clip = tracks.flatMap(t => t.clips).find(c => c.id === item.clipId);
            if (!clip?.audioBuffer) continue;
            const channelSpectrograms: SpectrogramData[] = [];
            if (item.monoFlag) {
              channelSpectrograms.push(
                computeSpectrogramMono(
                  clip.audioBuffer,
                  item.config, item.offsetSamples, item.durationSamples
                )
              );
            } else {
              for (let ch = 0; ch < clip.audioBuffer.numberOfChannels; ch++) {
                channelSpectrograms.push(
                  computeSpectrogram(clip.audioBuffer, item.config, item.offsetSamples, item.durationSamples, ch)
                );
              }
            }
            newMap.set(item.clipId, channelSpectrograms);
          }
          return newMap;
        });
      } catch (err) {
        console.error('[waveform-playlist] Synchronous spectrogram computation failed:', err);
      }
      return;
    }

    const getVisibleChunkRange = (canvasWidths: number[], clipPixelOffset = 0): { visibleIndices: number[]; remainingIndices: number[] } => {
      const container = scrollContainerRef.current;
      if (!container) {
        return { visibleIndices: canvasWidths.map((_, i) => i), remainingIndices: [] };
      }

      const scrollLeft = container.scrollLeft;
      const viewportWidth = container.clientWidth;
      const controlWidth = controls.show ? controls.width : 0;

      const visibleIndices: number[] = [];
      const remainingIndices: number[] = [];
      let offset = 0;

      for (let i = 0; i < canvasWidths.length; i++) {
        const chunkLeft = offset + controlWidth + clipPixelOffset;
        const chunkRight = chunkLeft + canvasWidths[i];
        if (chunkRight > scrollLeft && chunkLeft < scrollLeft + viewportWidth) {
          visibleIndices.push(i);
        } else {
          remainingIndices.push(i);
        }
        offset += canvasWidths[i];
      }

      return { visibleIndices, remainingIndices };
    };

    const renderChunkSubset = async (
      api: SpectrogramWorkerApi,
      cacheKey: string,
      channelInfo: { canvasIds: string[]; canvasWidths: number[] },
      indices: number[],
      item: { config: SpectrogramConfig; colorMap: ColorMapValue },
      channelIndex: number,
    ) => {
      if (indices.length === 0) return;

      const canvasIds = indices.map(i => channelInfo.canvasIds[i]);
      const canvasWidths = indices.map(i => channelInfo.canvasWidths[i]);

      const globalPixelOffsets: number[] = [];
      for (const idx of indices) {
        let offset = 0;
        for (let j = 0; j < idx; j++) {
          offset += channelInfo.canvasWidths[j];
        }
        globalPixelOffsets.push(offset);
      }

      const colorLUT = getColorMap(item.colorMap);

      await api.renderChunks({
        cacheKey,
        canvasIds,
        canvasWidths,
        globalPixelOffsets,
        canvasHeight: waveHeight,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        samplesPerPixel,
        colorLUT,
        frequencyScale: item.config.frequencyScale ?? 'mel',
        minFrequency: item.config.minFrequency ?? 0,
        maxFrequency: item.config.maxFrequency ?? 0,
        gainDb: item.config.gainDb ?? 20,
        rangeDb: item.config.rangeDb ?? 80,
        channelIndex,
      });
    };

    const computeAsync = async () => {
      const abortToken = { aborted: false };
      backgroundRenderAbortRef.current = abortToken;

      for (const item of clipsNeedingFFT) {
        if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

        try {
          const clipCanvasInfo = spectrogramCanvasRegistryRef.current.get(item.clipId);
          if (clipCanvasInfo && clipCanvasInfo.size > 0) {
            const numChannels = item.monoFlag ? 1 : item.channelDataArrays.length;
            const clipPixelOffset = Math.floor(item.clipStartSample / samplesPerPixel);

            const container = scrollContainerRef.current;
            const windowSize = item.config.fftSize ?? 2048;
            let visibleRange: { start: number; end: number } | undefined;

            if (container) {
              const scrollLeft = container.scrollLeft;
              const viewportWidth = container.clientWidth;
              const controlWidth = controls.show ? controls.width : 0;

              const vpStartPx = Math.max(0, scrollLeft - controlWidth);
              const vpEndPx = vpStartPx + viewportWidth;

              const clipStartPx = clipPixelOffset;
              const clipEndPx = clipStartPx + Math.ceil(item.durationSamples / samplesPerPixel);

              const overlapStartPx = Math.max(vpStartPx, clipStartPx);
              const overlapEndPx = Math.min(vpEndPx, clipEndPx);

              if (overlapEndPx > overlapStartPx) {
                const localStartPx = overlapStartPx - clipStartPx;
                const localEndPx = overlapEndPx - clipStartPx;
                const visStartSample = item.offsetSamples + Math.floor(localStartPx * samplesPerPixel);
                const visEndSample = Math.min(
                  item.offsetSamples + item.durationSamples,
                  item.offsetSamples + Math.ceil(localEndPx * samplesPerPixel)
                );
                const paddedStart = Math.max(item.offsetSamples, visStartSample - windowSize);
                const paddedEnd = Math.min(item.offsetSamples + item.durationSamples, visEndSample + windowSize);

                if ((paddedEnd - paddedStart) < item.durationSamples * 0.8) {
                  visibleRange = { start: paddedStart, end: paddedEnd };
                }
              }
            }

            const fullClipAlreadyCached = clipCacheKeysRef.current.has(item.clipId);
            if (visibleRange && !fullClipAlreadyCached) {
              const { cacheKey: visibleCacheKey } = await workerApi!.computeFFT({
                clipId: item.clipId,
                channelDataArrays: item.channelDataArrays,
                config: item.config,
                sampleRate: item.sampleRate,
                offsetSamples: item.offsetSamples,
                durationSamples: item.durationSamples,
                mono: item.monoFlag,
                sampleRange: visibleRange,
              });
              if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

              for (let ch = 0; ch < numChannels; ch++) {
                const channelInfo = clipCanvasInfo.get(ch);
                if (!channelInfo) continue;

                const { visibleIndices } = getVisibleChunkRange(channelInfo.canvasWidths, clipPixelOffset);
                await renderChunkSubset(workerApi!, visibleCacheKey, channelInfo, visibleIndices, item, ch);
              }

              if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;
            }

            const { cacheKey } = await workerApi!.computeFFT({
              clipId: item.clipId,
              channelDataArrays: item.channelDataArrays,
              config: item.config,
              sampleRate: item.sampleRate,
              offsetSamples: item.offsetSamples,
              durationSamples: item.durationSamples,
              mono: item.monoFlag,
            });

            if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

            clipCacheKeysRef.current.set(item.clipId, cacheKey);

            for (let ch = 0; ch < numChannels; ch++) {
              const channelInfo = clipCanvasInfo.get(ch);
              if (!channelInfo) continue;

              const { visibleIndices, remainingIndices } = getVisibleChunkRange(channelInfo.canvasWidths, clipPixelOffset);

              await renderChunkSubset(workerApi!, cacheKey, channelInfo, visibleIndices, item, ch);

              if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

              const BATCH_SIZE = 4;
              for (let batchStart = 0; batchStart < remainingIndices.length; batchStart += BATCH_SIZE) {
                if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

                const batch = remainingIndices.slice(batchStart, batchStart + BATCH_SIZE);

                await new Promise<void>(resolve => {
                  if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => resolve());
                  } else {
                    setTimeout(resolve, 0);
                  }
                });

                if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

                await renderChunkSubset(workerApi!, cacheKey, channelInfo, batch, item, ch);
              }
            }
          } else {
            const spectrograms = await workerApi!.compute({
              channelDataArrays: item.channelDataArrays,
              config: item.config,
              sampleRate: item.sampleRate,
              offsetSamples: item.offsetSamples,
              durationSamples: item.durationSamples,
              mono: item.monoFlag,
            });

            if (spectrogramGenerationRef.current !== generation) return;

            setSpectrogramDataMap(prevMap => {
              const newMap = new Map(prevMap);
              newMap.set(item.clipId, spectrograms);
              return newMap;
            });
          }
        } catch (err) {
          console.warn('Spectrogram worker error for clip', item.clipId, err);
        }
      }

      for (const item of clipsNeedingDisplayOnly) {
        if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

        const cacheKey = clipCacheKeysRef.current.get(item.clipId);
        if (!cacheKey) continue;

        const clipCanvasInfo = spectrogramCanvasRegistryRef.current.get(item.clipId);
        if (!clipCanvasInfo || clipCanvasInfo.size === 0) continue;

        try {
          const clipPixelOffset = Math.floor(item.clipStartSample / samplesPerPixel);
          for (let ch = 0; ch < item.numChannels; ch++) {
            const channelInfo = clipCanvasInfo.get(ch);
            if (!channelInfo) continue;

            const { visibleIndices, remainingIndices } = getVisibleChunkRange(channelInfo.canvasWidths, clipPixelOffset);

            await renderChunkSubset(workerApi!, cacheKey, channelInfo, visibleIndices, item, ch);

            if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

            const BATCH_SIZE = 4;
            for (let batchStart = 0; batchStart < remainingIndices.length; batchStart += BATCH_SIZE) {
              if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

              const batch = remainingIndices.slice(batchStart, batchStart + BATCH_SIZE);

              await new Promise<void>(resolve => {
                if (typeof requestIdleCallback === 'function') {
                  requestIdleCallback(() => resolve());
                } else {
                  setTimeout(resolve, 0);
                }
              });

              if (spectrogramGenerationRef.current !== generation || abortToken.aborted) return;

              await renderChunkSubset(workerApi!, cacheKey, channelInfo, batch, item, ch);
            }
          }
        } catch (err) {
          console.warn('Spectrogram display re-render error for clip', item.clipId, err);
        }
      }
    };

    computeAsync().catch(err => {
      console.error('[waveform-playlist] Spectrogram computation failed:', err);
    });
  }, [tracks, mono, spectrogramConfig, spectrogramColorMap, trackSpectrogramOverrides, waveHeight, samplesPerPixel, spectrogramCanvasVersion, controls, scrollContainerRef]);

  // Setters
  const setTrackRenderMode = useCallback((trackId: string, mode: RenderMode) => {
    setTrackSpectrogramOverrides(prev => {
      const next = new Map(prev);
      const existing = next.get(trackId);
      next.set(trackId, { ...existing, renderMode: mode });
      return next;
    });
  }, []);

  const setTrackSpectrogramConfig = useCallback((trackId: string, config: SpectrogramConfig, colorMap?: ColorMapValue) => {
    setTrackSpectrogramOverrides(prev => {
      const next = new Map(prev);
      const existing = next.get(trackId);
      next.set(trackId, {
        renderMode: existing?.renderMode ?? 'waveform',
        config,
        ...(colorMap !== undefined ? { colorMap } : { colorMap: existing?.colorMap }),
      });
      return next;
    });
  }, []);

  const registerSpectrogramCanvases = useCallback((clipId: string, channelIndex: number, canvasIds: string[], canvasWidths: number[]) => {
    const registry = spectrogramCanvasRegistryRef.current;
    if (!registry.has(clipId)) {
      registry.set(clipId, new Map());
    }
    registry.get(clipId)!.set(channelIndex, { canvasIds, canvasWidths });
    setSpectrogramCanvasVersion(v => v + 1);
  }, []);

  const unregisterSpectrogramCanvases = useCallback((clipId: string, channelIndex: number) => {
    const registry = spectrogramCanvasRegistryRef.current;
    const clipChannels = registry.get(clipId);
    if (clipChannels) {
      clipChannels.delete(channelIndex);
      if (clipChannels.size === 0) {
        registry.delete(clipId);
      }
    }
  }, []);

  const renderMenuItems = useCallback((props: { renderMode: string; onRenderModeChange: (mode: RenderMode) => void; onOpenSettings: () => void; onClose?: () => void }) => {
    return SpectrogramMenuItems({
      renderMode: props.renderMode as RenderMode,
      onRenderModeChange: props.onRenderModeChange,
      onOpenSettings: props.onOpenSettings,
      onClose: props.onClose,
    });
  }, []);

  const value: SpectrogramIntegration = useMemo(() => ({
    spectrogramDataMap,
    trackSpectrogramOverrides,
    spectrogramWorkerApi: spectrogramWorkerReady ? spectrogramWorkerRef.current : null,
    spectrogramConfig,
    spectrogramColorMap,
    setTrackRenderMode,
    setTrackSpectrogramConfig,
    registerSpectrogramCanvases,
    unregisterSpectrogramCanvases,
    renderMenuItems,
    SettingsModal: SpectrogramSettingsModal,
    getColorMap,
    getFrequencyScale: getFrequencyScale as (name: string) => (f: number, minF: number, maxF: number) => number,
  }), [
    spectrogramDataMap,
    trackSpectrogramOverrides,
    spectrogramWorkerReady,
    spectrogramConfig,
    spectrogramColorMap,
    setTrackRenderMode,
    setTrackSpectrogramConfig,
    registerSpectrogramCanvases,
    unregisterSpectrogramCanvases,
    renderMenuItems,
  ]);

  return (
    <SpectrogramIntegrationProvider value={value}>
      {children}
    </SpectrogramIntegrationProvider>
  );
};
