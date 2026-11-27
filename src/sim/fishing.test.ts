import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES } from '../core/registry';
import { mulberry32 } from '../core/math';
import { FISH_CHOWDER_BUFF_S, WINTER_BROTH_BUFF_S, COOKED_FISH_ITEMS, FISH, FISHING_ROD, FISH_ITEMS, JUNK, type WaterKind } from '../content/fishing';
import { LAKE_AREA, biteDelayS, fishIn, fishInSeason, rollCatch, waterKind, type WaterSpot } from './fishing';

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

describe('fishing by place and season', () => {
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
  const KINDS: WaterKind[] = ['pond', 'river', 'lake', 'marsh', 'frozen', 'cave'];
  const tally = (kind: WaterKind, season: (typeof SEASONS)[number], n = 4000): Record<string, number> => {
    const rng = mulberry32(21);
    const out: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const c = rollCatch(kind, { ...DAY, season }, rng); if (c.item) out[c.item] = (out[c.item] ?? 0) + 1; }
    return out;
  };

  it('has nine fish, each living somewhere', () => {
    expect(FISH.length).toBe(9);
    for (const f of FISH) expect(KINDS.some((k) => (f.weights[k] ?? 0) > 0), f.item).toBe(true);
  });

  it('something always bites: every water has a fish in every season', () => {
    for (const k of KINDS) for (const s of SEASONS) expect(fishInSeason(k, s).length, `${k} ${s}`).toBeGreaterThan(0);
  });

  it('salmon run in autumn and are gone by winter', () => {
    expect(fishInSeason('river', 'winter')).not.toContain('raw_salmon');
    expect(fishInSeason('river', 'autumn')).toContain('raw_salmon');
    expect(tally('river', 'autumn').raw_salmon).toBeGreaterThan(tally('river', 'spring').raw_salmon);
    expect(tally('river', 'winter').raw_salmon).toBeUndefined();
  });

  it('whitefish peak through the winter ice and carp in summer', () => {
    expect(tally('frozen', 'winter').raw_whitefish).toBeGreaterThan(tally('frozen', 'spring').raw_whitefish);
    expect(tally('pond', 'summer').raw_carp).toBeGreaterThan(tally('pond', 'winter').raw_carp);
    expect(fishInSeason('marsh', 'winter')).not.toContain('raw_crayfish');
  });

  it('is unchanged when no season is given', () => {
    const rng = (): (() => number) => mulberry32(3);
    const a = Array.from({ length: 50 }, ((r) => () => rollCatch('lake', DAY, r))(rng()));
    const b = Array.from({ length: 50 }, ((r) => () => rollCatch('lake', DAY, r))(rng()));
    expect(a).toEqual(b);
    expect(fishInSeason('lake')).toEqual(fishIn('lake'));
  });

  it('the dishes stay inside the buff bounds: under the stew, and the broth no better than ale', () => {
    const stew = ITEMS.find((i) => i.key === 'hearth_stew')?.food;
    const chowder = ITEMS.find((i) => i.key === 'fish_chowder')?.food;
    const broth = ITEMS.find((i) => i.key === 'winter_broth')?.food;
    expect(chowder).toMatchObject({ buff: 'well_fed', buffS: FISH_CHOWDER_BUFF_S });
    expect(broth).toMatchObject({ buff: 'well_warmed', buffS: WINTER_BROTH_BUFF_S });
    expect(chowder!.buffS!).toBeLessThanOrEqual(stew!.buffS!);
    expect(chowder!.hunger).toBeLessThan(stew!.hunger);
    expect(broth!.buffS!).toBeLessThanOrEqual(240);
    for (const f of FISH) expect(ITEMS.find((i) => i.key === f.cooked)?.food?.hunger ?? 0).toBeGreaterThan(2);
  });

  it('every chowder and broth recipe takes cooked fish and returns the pail', () => {
    const dishes = RECIPES.filter((r) => ['fish_chowder', 'winter_broth'].includes(r.output.item));
    expect(dishes.length).toBeGreaterThanOrEqual(8);
    for (const r of dishes) {
      expect(COOKED_FISH_ITEMS).toContain(r.inputs[0].item);
      expect(r.inputs).toContainEqual({ item: 'water_pail', count: 1 });
      expect(r.byproducts).toEqual([{ item: 'pail', count: 1 }]);
    }
  });
});
