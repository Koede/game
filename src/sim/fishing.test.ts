import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES } from '../core/registry';
import { mulberry32 } from '../core/math';
import { COOKED_FISH_ITEMS, FISH, FISHING_ROD, FISH_ITEMS, JUNK, type WaterKind } from '../content/fishing';
import { LAKE_AREA, biteDelayS, fishIn, rollCatch, waterKind, type WaterSpot } from './fishing';

const spot = (p: Partial<WaterSpot> = {}): WaterSpot => ({ biome: 'woodland', depth: 2, area: 6, flowing: false, underground: false, ...p });
const DAY = { night: false, raining: false };

describe('fishing content', () => {
  it('has real items, a cooking recipe for every fish and a craftable rod', () => {
    const keys = new Set(ITEMS.map((i) => i.key));
    for (const k of [FISHING_ROD, ...FISH_ITEMS, ...COOKED_FISH_ITEMS, ...JUNK.map((j) => j.item)]) expect(keys.has(k), k).toBe(true);
    for (const f of FISH) {
      const r = RECIPES.find((x) => x.inputs.length === 1 && x.inputs[0].item === f.item && x.output.item === f.cooked);
      expect(r?.output.item, f.item).toBe(f.cooked);
    }
    expect(RECIPES.some((r) => r.output.item === FISHING_ROD)).toBe(true);
  });
});

describe('fishing rules', () => {
  it('classifies water', () => {
    expect(waterKind(spot({ depth: 0 }))).toBeNull();
    expect(waterKind(spot())).toBe('pond');
    expect(waterKind(spot({ area: LAKE_AREA, depth: 4 }))).toBe('lake');
    expect(waterKind(spot({ area: LAKE_AREA, depth: 2 }))).toBe('pond');
    expect(waterKind(spot({ flowing: true }))).toBe('river');
    expect(waterKind(spot({ biome: 'marsh' }))).toBe('marsh');
    expect(waterKind(spot({ biome: 'frostfell' }))).toBe('frozen');
    expect(waterKind(spot({ underground: true, biome: 'frostfell' }))).toBe('cave');
  });

  it('every water kind has fish, and only the right ones', () => {
    const kinds: WaterKind[] = ['pond', 'river', 'lake', 'marsh', 'frozen', 'cave'];
    for (const k of kinds) expect(fishIn(k).length, k).toBeGreaterThan(0);
    expect(fishIn('cave')).toContain('raw_glowfin');
    expect(fishIn('pond')).not.toContain('raw_glowfin');
  });

  it('is deterministic for a seeded rng and only lands fish that live there', () => {
    const run = (kind: WaterKind): string[] => {
      const rng = mulberry32(5);
      return Array.from({ length: 200 }, () => rollCatch(kind, DAY, rng)).filter((c) => c.kind === 'fish').map((c) => c.item!);
    };
    expect(run('marsh')).toEqual(run('marsh'));
    for (const item of run('cave')) expect(fishIn('cave')).toContain(item);
    expect(run('river').length).toBeGreaterThan(100);
  });

  it('night favours eels in the marsh and rain shortens the wait', () => {
    const count = (night: boolean): number => {
      const rng = mulberry32(9);
      let n = 0;
      for (let i = 0; i < 2000; i++) if (rollCatch('marsh', { night, raining: false }, rng).item === 'raw_eel') n++;
      return n;
    };
    expect(count(true)).toBeGreaterThan(count(false));
    expect(biteDelayS({ night: false, raining: true }, () => 0.5)).toBeLessThan(biteDelayS(DAY, () => 0.5));
  });
});
