import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works under any path (e.g. GitHub Pages /Multiplikation/).
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
