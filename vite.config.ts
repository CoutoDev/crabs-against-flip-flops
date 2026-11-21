import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works on GitHub Pages or any sub-path.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
