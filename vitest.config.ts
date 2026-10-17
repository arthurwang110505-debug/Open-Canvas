import { defineConfig } from 'vitest/config';

// Each workspace package owns its own vitest.config.ts (environment, setup files, etc.).
// The root config simply aggregates them so `pnpm test` runs everything.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts'],
    },
  },
});
