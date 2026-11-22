/**
 * Timing tests: wall-clock assertions are only meaningful alone on the machine, so the default `vitest run` skips them
 * and `npm run test:perf` (vitest.perf.config.ts, one file at a time, HW_PERF=1) runs them. Whole files that measure
 * time are named `*.perf.test.ts`; a timing test inside a larger file uses `perfIt` instead of `it`.
 */
import { it } from 'vitest';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
export const PERF = env?.HW_PERF === '1';
export const perfIt: typeof it = (PERF ? it : it.skip) as typeof it;
