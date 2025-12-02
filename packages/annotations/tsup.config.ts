import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'styled-components', '@dnd-kit/core', '@dnd-kit/modifiers', '@dnd-kit/utilities'],
});
