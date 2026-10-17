import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'editor-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
