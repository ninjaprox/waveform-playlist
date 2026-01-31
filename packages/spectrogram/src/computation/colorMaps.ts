/**
 * Color maps for spectrogram rendering.
 * Each map is a 256-entry RGB lookup table (768 bytes).
 */

import type { ColorMapName, ColorMapValue } from '@waveform-playlist/core';

// Pre-computed 256-entry LUT: Uint8Array of length 768 (256 * 3 RGB)
type ColorLUT = Uint8Array;

function interpolateLUT(stops: number[][]): ColorLUT {
  const lut = new Uint8Array(256 * 3);
  const n = stops.length;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const pos = t * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, n - 1);
    const frac = pos - lo;
    lut[i * 3] = Math.round(stops[lo][0] * (1 - frac) + stops[hi][0] * frac);
    lut[i * 3 + 1] = Math.round(stops[lo][1] * (1 - frac) + stops[hi][1] * frac);
    lut[i * 3 + 2] = Math.round(stops[lo][2] * (1 - frac) + stops[hi][2] * frac);
  }
  return lut;
}

// Key color stops for each map (interpolated to 256)
const VIRIDIS_STOPS: number[][] = [
  [68, 1, 84], [72, 36, 117], [65, 68, 135], [53, 95, 141],
  [42, 120, 142], [33, 145, 140], [34, 168, 132], [68, 191, 112],
  [122, 209, 81], [189, 223, 38], [253, 231, 37],
];

const MAGMA_STOPS: number[][] = [
  [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
  [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 140],
  [254, 248, 213],
];

const INFERNO_STOPS: number[][] = [
  [0, 0, 4], [22, 11, 57], [66, 10, 104], [115, 12, 116],
  [160, 40, 99], [205, 70, 63], [237, 121, 20], [252, 185, 11],
  [252, 255, 164],
];

const ROSEUS_STOPS: number[][] = [
  [12, 3, 24], [56, 15, 60], [98, 27, 85], [139, 43, 95],
  [176, 65, 91], [204, 96, 85], [225, 132, 88], [241, 172, 111],
  [252, 214, 155], [255, 251, 213],
];

const lutCache = new Map<string, ColorLUT>();

function getOrCreateLUT(name: string, stops: number[][]): ColorLUT {
  let lut = lutCache.get(name);
  if (!lut) {
    lut = interpolateLUT(stops);
    lutCache.set(name, lut);
  }
  return lut;
}

function grayscaleLUT(): ColorLUT {
  let lut = lutCache.get('grayscale');
  if (!lut) {
    lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      lut[i * 3] = lut[i * 3 + 1] = lut[i * 3 + 2] = i;
    }
    lutCache.set('grayscale', lut);
  }
  return lut;
}

function igrayLUT(): ColorLUT {
  let lut = lutCache.get('igray');
  if (!lut) {
    lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = 255 - i;
      lut[i * 3] = lut[i * 3 + 1] = lut[i * 3 + 2] = v;
    }
    lutCache.set('igray', lut);
  }
  return lut;
}

/**
 * Get a 256-entry RGB LUT for the given color map.
 */
export function getColorMap(value: ColorMapValue): ColorLUT {
  if (Array.isArray(value)) {
    return interpolateLUT(value);
  }

  switch (value) {
    case 'viridis': return getOrCreateLUT('viridis', VIRIDIS_STOPS);
    case 'magma': return getOrCreateLUT('magma', MAGMA_STOPS);
    case 'inferno': return getOrCreateLUT('inferno', INFERNO_STOPS);
    case 'roseus': return getOrCreateLUT('roseus', ROSEUS_STOPS);
    case 'grayscale': return grayscaleLUT();
    case 'igray': return igrayLUT();
    default: return getOrCreateLUT('viridis', VIRIDIS_STOPS);
  }
}
