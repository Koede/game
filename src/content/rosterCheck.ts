/**
 * Helpers for the content roster tests (R2). The hand-written rosters (specRoster*.ts) PIN what existed: every pinned
 * entry must still be there with its numbers. Content ADDED by a lane never needs a roster or test edit; the golden
 * snapshot (tests/golden/content.json, `npm run golden:update`) is where additions are reviewed.
 */
import { expect } from 'vitest';

/** Every expected value is present (extras allowed). */
export function expectContains<T>(actual: Iterable<T>, expected: Iterable<T>, label = ''): void {
  const have = new Set(actual);
  const missing = [...expected].filter((e) => !have.has(e));
  expect(missing, `${label} missing from the build`.trim()).toEqual([]);
}

/** The expected entries are a subsequence of `actual` (order kept, extras allowed anywhere). */
export function expectSubsequence<T>(actual: readonly T[], expected: readonly T[], label = ''): void {
  let at = 0;
  const missing: T[] = [];
  for (const e of expected) {
    const i = actual.indexOf(e, at);
    if (i < 0) missing.push(e);
    else at = i + 1;
  }
  expect(missing, `${label} missing or out of order`.trim()).toEqual([]);
}

/** Every expected key exists in `actual` with an equal value (extra keys allowed). */
export function expectPinned(actual: Record<string, unknown>, expected: Record<string, unknown>, label = ''): void {
  for (const [k, v] of Object.entries(expected)) expect(actual[k], `${label} ${k}`.trim()).toEqual(v);
}
