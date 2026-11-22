import { defineConfig } from 'vitest/config';

/** The timing tests, alone and serial (npm run test:perf; take the cpu lock first: scripts/local-check.sh --perf does). */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      '**/*.perf.test.ts',
      'src/magic/fingerprint.test.ts', 'src/mobs/hostileWorld.test.ts', 'src/mobs/persistence.test.ts',
      'src/render/machines/machineParts.test.ts', 'src/render/textures/textures.test.ts', 'src/sim/brewing.test.ts',
      'src/sim/crops.test.ts', 'src/sim/handWork.test.ts', 'src/world/mesher.test.ts', 'src/world/worldgen.test.ts', 'src/world/flow.test.ts',
    ],
    exclude: ['**/node_modules/**'],
    env: { HW_PERF: '1' },
    fileParallelism: false,
    testTimeout: 60000,
    globalSetup: ['./scripts/vitest-global-setup.mjs'],
  },
});
