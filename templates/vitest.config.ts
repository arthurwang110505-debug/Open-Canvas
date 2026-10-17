import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'templates',
    // Definitions are plain data and instantiation is pure, so node is enough.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
