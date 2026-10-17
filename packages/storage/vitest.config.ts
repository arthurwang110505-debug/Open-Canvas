import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'storage',
    // Node provides Blob, File and URL.createObjectURL natively; jsdom does not implement
    // object URLs, so the storage primitives are tested in the node environment.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
