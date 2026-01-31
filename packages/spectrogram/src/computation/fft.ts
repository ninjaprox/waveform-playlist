/**
 * Inline radix-2 Cooley-Tukey FFT implementation.
 * No external dependencies. Works for power-of-2 sizes.
 */

/**
 * In-place radix-2 FFT.
 * @param real - Real part (modified in place)
 * @param imag - Imaginary part (modified in place)
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;

    if (i < j) {
      // Swap real
      let tmp = real[i];
      real[i] = real[j];
      real[j] = tmp;
      // Swap imag
      tmp = imag[i];
      imag[i] = imag[j];
      imag[j] = tmp;
    }
  }

  // Cooley-Tukey butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;

      for (let j = 0; j < halfLen; j++) {
        const evenIdx = i + j;
        const oddIdx = i + j + halfLen;

        const tReal = curReal * real[oddIdx] - curImag * imag[oddIdx];
        const tImag = curReal * imag[oddIdx] + curImag * real[oddIdx];

        real[oddIdx] = real[evenIdx] - tReal;
        imag[oddIdx] = imag[evenIdx] - tImag;
        real[evenIdx] += tReal;
        imag[evenIdx] += tImag;

        const newCurReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = newCurReal;
      }
    }
  }
}

/**
 * Compute magnitude spectrum from FFT output.
 * Returns only the first half (positive frequencies).
 */
export function magnitudeSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
  const n = real.length >> 1;
  const magnitudes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return magnitudes;
}

/**
 * Convert magnitudes to decibels, clamped to [minDb, maxDb] and shifted by gainDb.
 */
export function toDecibels(
  magnitudes: Float32Array,
  minDb: number,
  maxDb: number,
  gainDb: number = 0
): Float32Array {
  const result = new Float32Array(magnitudes.length);
  for (let i = 0; i < magnitudes.length; i++) {
    let db = 20 * Math.log10(magnitudes[i] + 1e-10) + gainDb;
    if (db < minDb) db = minDb;
    if (db > maxDb) db = maxDb;
    result[i] = db;
  }
  return result;
}
