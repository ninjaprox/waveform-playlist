/**
 * Common interface for playout engines.
 *
 * Both TonePlayout and MediaElementPlayout implement this interface,
 * allowing the browser package to work with either engine.
 */
export interface PlayoutEngine {
  // Lifecycle
  init(): Promise<void>;
  dispose(): void;

  // Playback
  play(when?: number, offset?: number, duration?: number): void;
  pause(): void;
  stop(): void;
  seekTo(time: number): void;
  getCurrentTime(): number;

  // Volume
  setMasterVolume(volume: number): void;

  // Track controls (optional - not all engines support all features)
  setMute?(trackId: string, muted: boolean): void;
  setSolo?(trackId: string, soloed: boolean): void;

  // Callbacks
  setOnPlaybackComplete(callback: () => void): void;

  // State
  readonly isPlaying: boolean;
  readonly duration: number;
  readonly sampleRate: number;
}

/**
 * Extended interface for engines that support playback rate.
 */
export interface PlaybackRateEngine extends PlayoutEngine {
  setPlaybackRate(rate: number): void;
  readonly playbackRate: number;
}

/**
 * Type guard to check if an engine supports playback rate.
 */
export function supportsPlaybackRate(
  engine: PlayoutEngine,
): engine is PlaybackRateEngine {
  return (
    "setPlaybackRate" in engine &&
    typeof (engine as any).setPlaybackRate === "function"
  );
}
