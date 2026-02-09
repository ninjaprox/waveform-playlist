import type { WaveformDataObject } from "@waveform-playlist/core";

export interface MediaElementTrackOptions {
  /** The audio source - can be a URL, Blob URL, or HTMLAudioElement */
  source: string | HTMLAudioElement;
  /** Pre-computed waveform data for visualization (required - no AudioBuffer decoding) */
  peaks: WaveformDataObject;
  /** Track ID */
  id?: string;
  /** Track name for display */
  name?: string;
  /** Initial volume (0.0 to 1.0) */
  volume?: number;
  /** Initial playback rate (0.5 to 2.0, pitch preserved) */
  playbackRate?: number;
}

/**
 * Single-track playback using HTMLAudioElement.
 *
 * Benefits over AudioBuffer/Tone.js:
 * - Pitch-preserving playback rate (0.5x - 2.0x) via browser's built-in algorithm
 * - No AudioBuffer decoding required (uses pre-computed peaks for visualization)
 * - Simpler, lighter-weight for single-track use cases
 *
 * Limitations:
 * - Single track only (no multi-track mixing)
 * - No clip-level effects or fades (track-level volume only)
 * - Relies on browser's time-stretching quality
 */
export class MediaElementTrack {
  private audioElement: HTMLAudioElement;
  private ownsElement: boolean; // Whether we created the element (need to clean up)
  private _peaks: WaveformDataObject;
  private _id: string;
  private _name: string;
  private _playbackRate: number = 1;
  private onStopCallback?: () => void;
  private onTimeUpdateCallback?: (time: number) => void;

  constructor(options: MediaElementTrackOptions) {
    this._peaks = options.peaks;
    this._id = options.id ?? `track-${Date.now()}`;
    this._name = options.name ?? "Track";
    this._playbackRate = options.playbackRate ?? 1;

    // Create or use provided audio element
    if (typeof options.source === "string") {
      this.audioElement = new Audio(options.source);
      this.ownsElement = true;
    } else {
      this.audioElement = options.source;
      this.ownsElement = false;
    }

    // Configure audio element
    this.audioElement.preload = "auto";
    this.audioElement.volume = options.volume ?? 1;
    this.audioElement.playbackRate = this._playbackRate;

    // Preserve pitch when changing playback rate (default in modern browsers)
    // Some older browsers may not support this, but it's the default behavior
    if ("preservesPitch" in this.audioElement) {
      (this.audioElement as any).preservesPitch = true;
    } else if ("mozPreservesPitch" in this.audioElement) {
      // Firefox prefix
      (this.audioElement as any).mozPreservesPitch = true;
    } else if ("webkitPreservesPitch" in this.audioElement) {
      // Safari prefix
      (this.audioElement as any).webkitPreservesPitch = true;
    }

    // Set up event listeners
    this.audioElement.addEventListener("ended", this.handleEnded);
    this.audioElement.addEventListener("timeupdate", this.handleTimeUpdate);
  }

  private handleEnded = () => {
    if (this.onStopCallback) {
      this.onStopCallback();
    }
  };

  private handleTimeUpdate = () => {
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.audioElement.currentTime);
    }
  };

  /**
   * Start playback from a specific time
   */
  play(offset: number = 0): void {
    this.audioElement.currentTime = offset;
    this.audioElement.play().catch((err) => {
      console.warn("MediaElementTrack: play() failed:", err);
    });
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.audioElement.pause();
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  /**
   * Seek to a specific time
   */
  seekTo(time: number): void {
    this.audioElement.currentTime = Math.max(0, Math.min(time, this.duration));
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set playback rate (0.5 to 2.0, pitch preserved)
   */
  setPlaybackRate(rate: number): void {
    // Clamp to reasonable range for pitch preservation quality
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    this._playbackRate = clampedRate;
    this.audioElement.playbackRate = clampedRate;
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    this.audioElement.muted = muted;
  }

  /**
   * Set callback for when playback ends
   */
  setOnStopCallback(callback: () => void): void {
    this.onStopCallback = callback;
  }

  /**
   * Set callback for time updates
   */
  setOnTimeUpdateCallback(callback: (time: number) => void): void {
    this.onTimeUpdateCallback = callback;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.audioElement.removeEventListener("ended", this.handleEnded);
    this.audioElement.removeEventListener("timeupdate", this.handleTimeUpdate);
    this.audioElement.pause();

    if (this.ownsElement) {
      this.audioElement.src = "";
      this.audioElement.load(); // Release resources
    }
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get peaks(): WaveformDataObject {
    return this._peaks;
  }

  get currentTime(): number {
    return this.audioElement.currentTime;
  }

  get duration(): number {
    return this.audioElement.duration || this._peaks.duration;
  }

  get isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  get volume(): number {
    return this.audioElement.volume;
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  get muted(): boolean {
    return this.audioElement.muted;
  }

  /**
   * Get the underlying audio element (for advanced use cases)
   */
  get element(): HTMLAudioElement {
    return this.audioElement;
  }
}
