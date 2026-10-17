import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'export',
    // The renderers are pure string/byte producers; browser-only steps (rasterization) take
    // their dependencies as parameters so they can be tested in node too.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
