import { useState, useEffect } from 'react';
import { ClipTrack, createTrack, createClipFromSeconds, type Fade, type TrackEffectsFunction, type WaveformDataObject, type RenderMode, type SpectrogramConfig, type ColorMapValue } from '@waveform-playlist/core';
import * as Tone from 'tone';

/**
 * Configuration for a single audio track to load
 *
 * Audio can be provided in three ways:
 * 1. `src` - URL to fetch and decode (standard loading)
 * 2. `audioBuffer` - Pre-loaded AudioBuffer (skip fetch/decode)
 * 3. `waveformData` only - Peaks-first rendering (audio loads later)
 *
 * For peaks-first rendering, just provide `waveformData` - the sample rate
 * and duration are derived from the waveform data automatically.
 */
export interface AudioTrackConfig {
  /** URL to audio file - used if audioBuffer not provided */
  src?: string;
  /** Pre-loaded AudioBuffer - skips fetch/decode if provided */
  audioBuffer?: AudioBuffer;
  name?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
  effects?: TrackEffectsFunction;
  // Multi-clip support
  startTime?: number;  // When the clip starts on the timeline (default: 0)
  duration?: number;   // Duration of the clip (default: full audio duration)
  offset?: number;     // Offset into the source audio file (default: 0)
  // Fade support
  fadeIn?: Fade;       // Fade in configuration
  fadeOut?: Fade;      // Fade out configuration
  // Pre-computed waveform data (BBC audiowaveform format)
  // For peaks-first rendering, provide this without audioBuffer/src
  // Sample rate and duration are derived from waveformData.sample_rate and waveformData.duration
  waveformData?: WaveformDataObject;
  /** Visualization render mode: 'waveform' | 'spectrogram' | 'both'. Default: 'waveform' */
  renderMode?: RenderMode;
  /** Spectrogram configuration (FFT size, window, frequency scale, etc.) */
  spectrogramConfig?: SpectrogramConfig;
  /** Spectrogram color map name or custom color array */
  spectrogramColorMap?: ColorMapValue;
}

/**
 * Options for useAudioTracks hook
 */
export interface UseAudioTracksOptions {
  /**
   * When true, tracks are added to the playlist progressively as they load,
   * rather than waiting for all tracks to finish loading.
   * Default: false (wait for all tracks)
   */
  progressive?: boolean;
}

/**
 * Hook to load audio from URLs and convert to ClipTrack format
 *
 * This hook fetches audio files, decodes them, and creates ClipTrack objects
 * with a single clip per track. Supports custom positioning for multi-clip arrangements.
 *
 * @param configs - Array of audio track configurations
 * @param options - Optional configuration for loading behavior
 * @returns Object with tracks array, loading state, and progress info
 *
 * @example
 * ```typescript
 * // Basic usage (clips positioned at start)
 * const { tracks, loading, error } = useAudioTracks([
 *   { src: 'audio/vocals.mp3', name: 'Vocals' },
 *   { src: 'audio/drums.mp3', name: 'Drums' },
 * ]);
 *
 * // Progressive loading (tracks appear as they load)
 * const { tracks, loading, loadedCount, totalCount } = useAudioTracks(
 *   [{ src: 'audio/vocals.mp3' }, { src: 'audio/drums.mp3' }],
 *   { progressive: true }
 * );
 *
 * // Pre-loaded AudioBuffer (skip fetch/decode)
 * const { tracks } = useAudioTracks([
 *   { audioBuffer: myPreloadedBuffer, name: 'Pre-loaded' },
 * ]);
 *
 * // Peaks-first rendering (instant visual, audio loads later)
 * const { tracks } = useAudioTracks([
 *   { waveformData: preloadedPeaks, name: 'Peaks Only' },  // Renders immediately
 * ]);
 *
 * if (loading) return <div>Loading {loadedCount}/{totalCount}...</div>;
 * if (error) return <div>Error: {error}</div>;
 *
 * return <WaveformPlaylistProvider tracks={tracks}>...</WaveformPlaylistProvider>;
 * ```
 */
export function useAudioTracks(
  configs: AudioTrackConfig[],
  options: UseAudioTracksOptions = {}
) {
  const { progressive = false } = options;
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  // Track which configs need audio loading vs already have data
  const totalCount = configs.length;

  useEffect(() => {
    if (configs.length === 0) {
      setTracks([]);
      setLoading(false);
      setLoadedCount(0);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    // Track loaded tracks by their config index for progressive mode
    const loadedTracksMap = new Map<number, ClipTrack>();

    const createTrackFromConfig = (
      config: AudioTrackConfig,
      index: number,
      audioBuffer?: AudioBuffer
    ): ClipTrack => {
      // Use provided audioBuffer, config's audioBuffer, or undefined for peaks-only
      const buffer = audioBuffer ?? config.audioBuffer;

      // For peaks-first rendering, we need waveformData if no buffer
      if (!buffer && !config.waveformData) {
        throw new Error(
          `Track ${index + 1}: Must provide src, audioBuffer, or waveformData`
        );
      }

      // Determine source duration for clip creation
      const sourceDuration = buffer?.duration ?? config.waveformData?.duration;

      // Create clip - createClipFromSeconds handles deriving sampleRate from waveformData
      const clip = createClipFromSeconds({
        audioBuffer: buffer,
        startTime: config.startTime ?? 0,
        duration: config.duration ?? sourceDuration,
        offset: config.offset ?? 0,
        name: config.name || `Track ${index + 1}`,
        fadeIn: config.fadeIn,
        fadeOut: config.fadeOut,
        waveformData: config.waveformData,
      });

      // Validate clip values
      if (isNaN(clip.startSample) || isNaN(clip.durationSamples) || isNaN(clip.offsetSamples)) {
        console.error('Invalid clip values:', clip);
        throw new Error(`Invalid clip values for track ${index + 1}`);
      }

      // Create the track with the single clip
      const track: ClipTrack = {
        ...createTrack({
          name: config.name || `Track ${index + 1}`,
          clips: [clip],
          muted: config.muted ?? false,
          soloed: config.soloed ?? false,
          volume: config.volume ?? 1.0,
          pan: config.pan ?? 0,
          color: config.color,
        }),
        effects: config.effects,
        renderMode: config.renderMode,
        spectrogramConfig: config.spectrogramConfig,
        spectrogramColorMap: config.spectrogramColorMap,
      };

      return track;
    };

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);
        setLoadedCount(0);

        const audioContext = Tone.getContext().rawContext as AudioContext;

        // Process each config
        const loadPromises = configs.map(async (config, index) => {
          // Case 1: Already have audioBuffer - no loading needed
          if (config.audioBuffer) {
            const track = createTrackFromConfig(config, index, config.audioBuffer);

            if (progressive && !cancelled) {
              loadedTracksMap.set(index, track);
              setLoadedCount(prev => prev + 1);
              // Update tracks maintaining order
              setTracks(
                Array.from({ length: configs.length }, (_, i) => loadedTracksMap.get(i))
                  .filter((t): t is ClipTrack => t !== undefined)
              );
            }

            return track;
          }

          // Case 2: Have waveformData but no src - peaks-only (no audio to load)
          if (!config.src && config.waveformData) {
            const track = createTrackFromConfig(config, index);

            if (progressive && !cancelled) {
              loadedTracksMap.set(index, track);
              setLoadedCount(prev => prev + 1);
              setTracks(
                Array.from({ length: configs.length }, (_, i) => loadedTracksMap.get(i))
                  .filter((t): t is ClipTrack => t !== undefined)
              );
            }

            return track;
          }

          // Case 3: Need to fetch and decode audio from src
          if (!config.src) {
            throw new Error(`Track ${index + 1}: Must provide src, audioBuffer, or waveformData`);
          }

          const response = await fetch(config.src, { signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`Failed to fetch ${config.src}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Validate audioBuffer
          if (!audioBuffer || !audioBuffer.sampleRate || !audioBuffer.duration) {
            throw new Error(`Invalid audio buffer for ${config.src}`);
          }

          const track = createTrackFromConfig(config, index, audioBuffer);

          if (progressive && !cancelled) {
            loadedTracksMap.set(index, track);
            setLoadedCount(prev => prev + 1);
            // Update tracks maintaining original config order
            setTracks(
              Array.from({ length: configs.length }, (_, i) => loadedTracksMap.get(i))
                .filter((t): t is ClipTrack => t !== undefined)
            );
          }

          return track;
        });

        const loadedTracks = await Promise.all(loadPromises);

        if (!cancelled) {
          // For non-progressive mode, set all tracks at once
          if (!progressive) {
            setTracks(loadedTracks);
            setLoadedCount(loadedTracks.length);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error loading audio';
          setError(errorMessage);
          setLoading(false);
          console.error('Error loading audio tracks:', err);
        }
      }
    };

    loadTracks();

    // Cleanup: prevent state updates and abort in-flight fetches on unmount
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [configs, progressive]);

  return { tracks, loading, error, loadedCount, totalCount };
}
