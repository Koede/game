import { describe, expect, it } from 'vitest';
import { perfIt } from '../testing/perf';
import { BLOCKS, ITEMS } from '../core/registry';
import { ASPECT_LIST, ASPECTS, kin, kinOf, PRIMALS, type Aspect } from './aspects';
import { aspectsOf, resetFingerprints } from './fingerprint';
import { KEYWORD_RULES, MAX_AMOUNT, MAX_ASPECTS, OVERRIDES } from './aspectTable';

describe('aspects', () => {
  it('has 21 aspects, compounds built from earlier tiers', () => {
    expect(ASPECTS).toHaveLength(21);
    for (const a of ASPECTS) {
      if (!a.parts) continue;
      for (const p of a.parts) expect(ASPECTS.find((b) => b.key === p)!.tier).toBeLessThan(a.tier);
    }
  });
  it('kinship is symmetric and every aspect links to a primal through kin steps', () => {
    for (const a of ASPECT_LIST) for (const b of ASPECT_LIST) expect(kin(a, b)).toBe(kin(b, a));
    const seen = new Set<Aspect>(PRIMALS);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of ASPECT_LIST) if (!seen.has(a) && kinOf(a).some((b) => seen.has(b))) { seen.add(a); grew = true; }
    }
    expect(seen.size).toBe(ASPECT_LIST.length);
  });
  it('the table names only real aspects', () => {
    for (const as of [...Object.values(KEYWORD_RULES), ...Object.values(OVERRIDES)])
      for (const k of Object.keys(as)) expect(ASPECT_LIST).toContain(k);
  });
});

describe('fingerprints', () => {
  const keys = [...new Set([...BLOCKS.map((b) => b.key), ...ITEMS.map((i) => i.key)])];
  it('covers every block and item with 1-4 aspects of 1..8', () => {
    for (const k of keys) {
      const as = aspectsOf(k);
      const n = Object.keys(as);
      expect(n.length, k).toBeGreaterThan(0);
      expect(n.length, k).toBeLessThanOrEqual(MAX_ASPECTS);
      for (const v of Object.values(as)) expect(v! >= 1 && v! <= MAX_AMOUNT, k).toBe(true);
    }
  });
  it('is deterministic', () => {
    const a = keys.map((k) => JSON.stringify(aspectsOf(k)));
    resetFingerprints();
    expect(keys.map((k) => JSON.stringify(aspectsOf(k)))).toEqual(a);
  });
  it('reads sensibly for a few known objects', () => {
    expect(aspectsOf('copper_ore').vein).toBeGreaterThan(0);
    expect(aspectsOf('water').brook).toBeGreaterThan(0);
    expect(aspectsOf('stone').loam).toBeGreaterThan(0);
    expect(aspectsOf('oak_log').spring).toBeGreaterThan(0);
  });
  it('every primal shows up somewhere in the world', () => {
    const all = new Set(keys.flatMap((k) => Object.keys(aspectsOf(k))));
    for (const p of PRIMALS) expect(all.has(p), p).toBe(true);
  });
  perfIt('builds the whole table quickly', () => {
    resetFingerprints();
    const t = performance.now();
    for (const k of keys) aspectsOf(k);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
