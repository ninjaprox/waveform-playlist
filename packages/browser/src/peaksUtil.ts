import extractPeaks, { type PeakData } from '@waveform-playlist/webaudio-peaks';

/**
 * Generate peaks from an AudioBuffer for waveform visualization
 * This is a thin wrapper around the webaudio-peaks package
 *
 * @param audioBuffer - The audio buffer to extract peaks from
 * @param samplesPerPixel - Number of samples per pixel
 * @param isMono - Whether to merge channels to mono
 * @param bits - Bit depth for peak data (8 or 16)
 * @param offsetSamples - Start offset in samples (for trimming)
 * @param durationSamples - Duration in samples (for trimming)
 */
export function generatePeaks(
  audioBuffer: AudioBuffer,
  samplesPerPixel: number = 1000,
  isMono: boolean = true,
  bits: 8 | 16 = 8,
  offsetSamples: number = 0,
  durationSamples?: number
): PeakData {
  // Calculate cueOut from offset + duration (both in samples)
  const cueOut = durationSamples !== undefined
    ? offsetSamples + durationSamples
    : undefined;

  return extractPeaks(audioBuffer, samplesPerPixel, isMono, offsetSamples, cueOut, bits);
}
