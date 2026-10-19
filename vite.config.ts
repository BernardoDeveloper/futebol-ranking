import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the build works under any GitHub Pages sub-path.
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
