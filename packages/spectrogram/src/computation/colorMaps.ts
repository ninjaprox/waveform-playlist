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

// Roseus colormap - 256 RGB entries from https://github.com/dofuuz/roseus
// Perceptually uniform colormap by dofuuz, licensed under CC0 1.0 Universal
// prettier-ignore
const ROSEUS_LUT = new Uint8Array([
  1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 2, 3, 4, 2, 4, 5, 2, 5, 6, 3, 6, 7,
  3, 7, 8, 3, 8, 10, 3, 9, 12, 3, 10, 14, 3, 12, 16, 3, 13, 17, 3, 14, 19, 2, 15, 21,
  2, 16, 23, 2, 17, 25, 2, 18, 27, 2, 19, 30, 1, 20, 32, 1, 21, 34, 1, 22, 36, 1, 23, 38,
  1, 24, 40, 0, 25, 43, 0, 26, 45, 0, 27, 47, 0, 27, 50, 0, 28, 52, 0, 29, 54, 0, 30, 57,
  0, 30, 59, 1, 31, 62, 1, 32, 64, 1, 32, 67, 2, 33, 69, 3, 33, 72, 4, 34, 74, 5, 35, 77,
  6, 35, 79, 8, 35, 82, 9, 36, 84, 11, 36, 86, 13, 37, 89, 15, 37, 91, 17, 37, 94, 19, 37, 96,
  21, 38, 99, 23, 38, 101, 25, 38, 104, 27, 38, 106, 29, 38, 108, 31, 38, 111, 33, 38, 113, 35, 38, 115,
  38, 38, 118, 40, 38, 120, 42, 38, 122, 44, 38, 124, 46, 38, 126, 49, 38, 128, 51, 38, 130, 53, 37, 132,
  55, 37, 134, 58, 37, 136, 60, 36, 138, 62, 36, 139, 65, 36, 141, 67, 35, 143, 69, 35, 144, 72, 35, 146,
  74, 34, 147, 76, 34, 149, 79, 33, 150, 81, 33, 151, 84, 32, 152, 86, 32, 153, 88, 31, 154, 91, 31, 155,
  93, 30, 156, 95, 29, 157, 98, 29, 158, 100, 28, 159, 103, 28, 159, 105, 27, 160, 107, 27, 160, 110, 26, 161,
  112, 26, 161, 114, 25, 161, 117, 25, 162, 119, 24, 162, 121, 24, 162, 124, 23, 162, 126, 23, 162, 128, 23, 162,
  131, 22, 161, 133, 22, 161, 135, 22, 161, 137, 22, 161, 140, 22, 160, 142, 22, 160, 144, 22, 159, 146, 22, 159,
  148, 22, 158, 150, 22, 157, 153, 22, 157, 155, 23, 156, 157, 23, 155, 159, 23, 154, 161, 24, 153, 163, 24, 152,
  165, 25, 151, 167, 26, 150, 169, 26, 149, 171, 27, 148, 173, 28, 147, 175, 29, 146, 177, 29, 145, 179, 30, 144,
  181, 31, 142, 183, 32, 141, 184, 33, 140, 186, 34, 139, 188, 35, 137, 190, 36, 136, 192, 37, 135, 193, 39, 133,
  195, 40, 132, 197, 41, 130, 198, 42, 129, 200, 43, 128, 202, 45, 126, 203, 46, 125, 205, 47, 123, 206, 48, 122,
  208, 50, 120, 209, 51, 119, 211, 52, 117, 212, 54, 116, 214, 55, 114, 215, 57, 113, 217, 58, 111, 218, 60, 110,
  219, 61, 109, 221, 63, 107, 222, 64, 106, 223, 66, 104, 225, 67, 103, 226, 69, 101, 227, 70, 100, 228, 72, 99,
  229, 73, 97, 230, 75, 96, 231, 77, 94, 233, 78, 93, 234, 80, 92, 235, 82, 91, 236, 83, 89, 237, 85, 88,
  237, 87, 87, 238, 89, 86, 239, 90, 84, 240, 92, 83, 241, 94, 82, 242, 96, 81, 242, 97, 80, 243, 99, 79,
  244, 101, 78, 245, 103, 77, 245, 105, 76, 246, 107, 75, 246, 108, 74, 247, 110, 74, 248, 112, 73, 248, 114, 72,
  248, 116, 72, 249, 118, 71, 249, 120, 71, 250, 122, 70, 250, 124, 70, 250, 126, 70, 251, 128, 70, 251, 130, 69,
  251, 132, 70, 251, 134, 70, 251, 136, 70, 252, 138, 70, 252, 140, 70, 252, 142, 71, 252, 144, 72, 252, 146, 72,
  252, 148, 73, 252, 150, 74, 251, 152, 75, 251, 154, 76, 251, 156, 77, 251, 158, 78, 251, 160, 80, 251, 162, 81,
  250, 164, 83, 250, 166, 85, 250, 168, 87, 249, 170, 88, 249, 172, 90, 248, 174, 93, 248, 176, 95, 248, 178, 97,
  247, 180, 99, 247, 182, 102, 246, 184, 104, 246, 186, 107, 245, 188, 110, 244, 190, 112, 244, 192, 115, 243, 194, 118,
  243, 195, 121, 242, 197, 124, 242, 199, 127, 241, 201, 131, 240, 203, 134, 240, 205, 137, 239, 207, 140, 239, 208, 144,
  238, 210, 147, 238, 212, 151, 237, 213, 154, 237, 215, 158, 236, 217, 161, 236, 218, 165, 236, 220, 169, 236, 222, 172,
  235, 223, 176, 235, 225, 180, 235, 226, 183, 235, 228, 187, 235, 229, 191, 235, 230, 194, 236, 232, 198, 236, 233, 201,
  236, 234, 205, 237, 236, 208, 237, 237, 212, 238, 238, 215, 239, 239, 219, 240, 240, 222, 241, 242, 225, 242, 243, 228,
  243, 244, 231, 244, 245, 234, 246, 246, 237, 247, 247, 240, 249, 248, 242, 251, 249, 245, 253, 250, 247, 254, 251, 249,
]);

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
    case 'roseus': return ROSEUS_LUT;
    case 'grayscale': return grayscaleLUT();
    case 'igray': return igrayLUT();
    default: return getOrCreateLUT('viridis', VIRIDIS_STOPS);
  }
}
