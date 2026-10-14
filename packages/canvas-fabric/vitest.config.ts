import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'canvas-fabric',
    environment: 'jsdom',
    setupFiles: ['./test/setup-canvas.ts'],
    include: ['src/**/*.test.ts'],
  },
});
