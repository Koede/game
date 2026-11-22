import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.mjs'],
    exclude: ['**/node_modules/**', '**/*.perf.test.ts'],
    globalSetup: ['./scripts/vitest-global-setup.mjs'],
    testTimeout: 30000,
  },
});
