/**
 * Compute spectrogram data from an AudioBuffer.
 */

import type { SpectrogramConfig, SpectrogramData } from '@waveform-playlist/core';
import { fft, magnitudeSpectrum, toDecibels } from './fft';
import { getWindowFunction } from './windowFunctions';

/**
 * Compute spectrogram for a single channel of audio.
 *
 * @param audioBuffer - Source audio buffer
 * @param config - Spectrogram configuration
 * @param offsetSamples - Start offset into the audio buffer
 * @param durationSamples - Number of samples to process
 * @param channel - Channel index (0 = left, 1 = right). Default: 0
 */
export function computeSpectrogram(
  audioBuffer: AudioBuffer,
  config: SpectrogramConfig = {},
  offsetSamples: number = 0,
  durationSamples?: number,
  channel: number = 0
): SpectrogramData {
  const fftSize = config.fftSize ?? 2048;
  const hopSize = config.hopSize ?? Math.floor(fftSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const minDecibels = config.minDecibels ?? -100;
  const maxDecibels = config.maxDecibels ?? -20;
  const gainDb = config.gainDb ?? 0;
  const alpha = config.alpha;

  const sampleRate = audioBuffer.sampleRate;
  const frequencyBinCount = fftSize >> 1;
  const totalSamples = durationSamples ?? (audioBuffer.length - offsetSamples);

  // Get channel data
  const channelIdx = Math.min(channel, audioBuffer.numberOfChannels - 1);
  const channelData = audioBuffer.getChannelData(channelIdx);

  // Pre-compute window
  const window = getWindowFunction(windowName, fftSize, alpha);

  // Calculate frame count
  const frameCount = Math.max(1, Math.floor((totalSamples - fftSize) / hopSize) + 1);

  // Output: frameCount × frequencyBinCount
  const data = new Float32Array(frameCount * frequencyBinCount);

  // Reusable buffers
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let frame = 0; frame < frameCount; frame++) {
    const start = offsetSamples + frame * hopSize;

    // Fill real buffer with windowed samples
    for (let i = 0; i < fftSize; i++) {
      const sampleIdx = start + i;
      real[i] = sampleIdx < channelData.length ? channelData[sampleIdx] * window[i] : 0;
      imag[i] = 0;
    }

    // FFT
    fft(real, imag);

    // Magnitude → dB
    const mags = magnitudeSpectrum(real, imag);
    const dbs = toDecibels(mags, minDecibels, maxDecibels, gainDb);

    // Store in output
    data.set(dbs, frame * frequencyBinCount);
  }

  return {
    fftSize,
    frequencyBinCount,
    sampleRate,
    hopSize,
    frameCount,
    data,
    minDecibels,
    maxDecibels,
  };
}

/**
 * Compute a mono (mixed-down) spectrogram from all channels.
 */
export function computeSpectrogramMono(
  audioBuffer: AudioBuffer,
  config: SpectrogramConfig = {},
  offsetSamples: number = 0,
  durationSamples?: number
): SpectrogramData {
  if (audioBuffer.numberOfChannels === 1) {
    return computeSpectrogram(audioBuffer, config, offsetSamples, durationSamples, 0);
  }

  // Mix down channels
  const fftSize = config.fftSize ?? 2048;
  const hopSize = config.hopSize ?? Math.floor(fftSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const minDecibels = config.minDecibels ?? -100;
  const maxDecibels = config.maxDecibels ?? -20;
  const gainDb = config.gainDb ?? 0;
  const alpha = config.alpha;

  const sampleRate = audioBuffer.sampleRate;
  const frequencyBinCount = fftSize >> 1;
  const totalSamples = durationSamples ?? (audioBuffer.length - offsetSamples);
  const numChannels = audioBuffer.numberOfChannels;

  const window = getWindowFunction(windowName, fftSize, alpha);
  const frameCount = Math.max(1, Math.floor((totalSamples - fftSize) / hopSize) + 1);
  const data = new Float32Array(frameCount * frequencyBinCount);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Get all channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  for (let frame = 0; frame < frameCount; frame++) {
    const start = offsetSamples + frame * hopSize;

    // Mix channels and apply window
    for (let i = 0; i < fftSize; i++) {
      const sampleIdx = start + i;
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += sampleIdx < channels[ch].length ? channels[ch][sampleIdx] : 0;
      }
      real[i] = (sum / numChannels) * window[i];
      imag[i] = 0;
    }

    fft(real, imag);
    const mags = magnitudeSpectrum(real, imag);
    const dbs = toDecibels(mags, minDecibels, maxDecibels, gainDb);
    data.set(dbs, frame * frequencyBinCount);
  }

  return {
    fftSize,
    frequencyBinCount,
    sampleRate,
    hopSize,
    frameCount,
    data,
    minDecibels,
    maxDecibels,
  };
}
