import { defineConfig } from 'tsup';

export default defineConfig([
  // Main package
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'styled-components', '@waveform-playlist/browser'],
  },
  // Web Worker (no DTS generation)
  {
    entry: {
      'worker/spectrogram.worker': 'src/worker/spectrogram.worker.ts',
    },
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
]);
