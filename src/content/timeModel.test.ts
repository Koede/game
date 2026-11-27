/**
 * Balance tests T1, T1b of docs/advice/balance-economy.md section 5, on the pure time model (timeModel.ts).
 *
 * Every threshold is a band. The advice doc's TARGET bands describe the intended curve; the model run on today's
 * content lands outside most of them (Bronze steam parts are not built, Current/Atomic gates are 2-5x too big). So each
 * age carries two checks: a GUARD band around today's value (fails if content drifts, so a tweak is a visible decision),
 * and the TARGET band, marked `it.fails` while the age is known to be off. When a content change brings an age into its
 * target the `it.fails` goes red: delete the age from KNOWN_OFF_TARGET.
 */
import { describe, expect, it } from 'vitest';
import { ITEMS, ORE_VEINS, BLOCKS } from '../core/registry';
import {
  AGE_KITS, TIME_PARAMS, ageBundle, ageMinutes, ageToolTier, costTable, expertMinutes, expertSeconds, gatherSeconds, playerMinutes,
  rawBill, stationSeconds,
} from './timeModel';
import { RECIPES } from '../core/registry';

const AGES = AGE_KITS.map((k) => k.age);
type Band = [number, number];

/** Advice doc T1: expert minutes to leave each age (kit + gate). */
const TARGET: Record<string, Band> = { ember: [8, 18], bronze: [28, 42], forge: [20, 32], current: [24, 36], atomic: [28, 48] };
/** Today's model value with room for honest tweaks (about -25% / +30%). */
const GUARD: Record<string, Band> = { ember: [5.5, 10.5], bronze: [20, 34], forge: [25, 43], current: [32, 56], atomic: [55, 95] };
const KNOWN_OFF_TARGET = new Set(['ember', 'bronze', 'forge', 'current', 'atomic']);
const TOTAL_TARGET_MAX = 190;

const within = (x: number, [lo, hi]: Band): boolean => x >= lo && x <= hi;
const minutes = AGES.map((_, i) => ageMinutes(i));

describe('time model: gathering', () => {
  it('mining takes hardness / tool speed, with a one-tap floor', () => {
    // oak_log: hardness 2, flint axe speed 2 -> 1 s + 6/4 s of tree overhead per log.
    expect(gatherSeconds('oak_log', 1)).toBeCloseTo(1 + TIME_PARAMS.TREE_OVERHEAD_S / TIME_PARAMS.TREE_LOGS, 5);
    expect(gatherSeconds('fiber', 1)).toBeGreaterThan(0);
  });

  it('is gated by tool tier and gets faster with better tools', () => {
    expect(gatherSeconds('iron_ore', 1)).toBe(Infinity);
    expect(gatherSeconds('iron_ore', 2)).toBeLessThan(Infinity);
    expect(gatherSeconds('iron_ore', 3)).toBeLessThan(gatherSeconds('iron_ore', 2));
    expect(gatherSeconds('wolframite', 3)).toBe(Infinity);
    expect(gatherSeconds('wolframite', 4)).toBeLessThan(Infinity);
    expect(gatherSeconds('copper_ore', 5)).toBeLessThanOrEqual(gatherSeconds('copper_ore', 1));
  });

  it('charges vein overhead: a smaller vein costs more per ore than a bigger one of the same hardness', () => {
    // copper (vein 6) and tin (vein 5) are both hardness 5.5.
    expect(gatherSeconds('tin_ore', 2)).toBeGreaterThan(gatherSeconds('copper_ore', 2));
  });

  it('does not count breaking a placed machine as gathering', () => {
    const { via } = costTable(5);
    for (const key of ['crusher', 'boiler', 'workbench', 'furnace_clay', 'fission_pile']) expect(via.get(key), key).not.toBeNull();
  });
});

describe('time model: cost table', () => {
  const { cost, via } = costTable(5);

  it('every crafted item costs at least the cheapest recipe inputs, per unit', () => {
    for (const r of RECIPES) {
      const c = cost.get(r.output.item);
      if (c === undefined) continue;
      expect(c, r.id).toBeLessThanOrEqual(
        (r.inputs.reduce((s, i) => s + (TIME_PARAMS.REUSABLE.test(i.item) ? 0 : cost.get(i.item) ?? Infinity) * i.count, 0) + stationSeconds(r, 5)) / r.output.count + 1e-6,
      );
    }
  });

  it('prices smelting by furnace fuel: a smelt costs more than a bare hand craft', () => {
    const smelt = RECIPES.find((r) => r.id === 'bronze_ingot' || (r.station === 'furnace' && r.kind === 'smelt'))!;
    expect(stationSeconds(smelt, 2)).toBeGreaterThan(TIME_PARAMS.HAND_CRAFT_S);
  });

  it('prices a metal above its ore, and a cast head at its ingots', () => {
    expect(cost.get('copper_ingot')!).toBeGreaterThan(cost.get('copper_ore')!);
    expect(cost.get('bronze_pickaxe_head')!).toBeGreaterThanOrEqual(3 * cost.get('bronze_ingot')!);
    expect(via.get('bronze_pickaxe_head')?.station).toBe('cast');
  });

  it('is deterministic: better tools never make anything dearer', () => {
    const lo = costTable(1).cost;
    for (const [k, c] of lo) expect(cost.get(k)!, k).toBeLessThanOrEqual(c + 1e-6);
  });

  it('expertMinutes is expertSeconds / 60 and the player factor is the named parameter', () => {
    const b = [{ item: 'bronze_ingot', count: 3 }];
    expect(expertMinutes(b, 2)).toBeCloseTo(expertSeconds(b, 2) / 60, 9);
    expect(playerMinutes(10)).toBe(10 * TIME_PARAMS.EXPERT_TO_PLAYER);
  });

  it('throws on an item no route can make instead of silently costing it nothing', () => {
    expect(() => expertSeconds([{ item: 'iron_ore', count: 1 }], 1)).toThrow(/no route/);
  });
});

describe('T1: time to the next age', () => {
  it('every kit item exists in content and every bundle is buildable', () => {
    const keys = new Set(ITEMS.map((it) => it.key));
    for (const { age, kit } of AGE_KITS) for (const a of kit) expect(keys.has(a.item), `${age}: ${a.item}`).toBe(true);
    for (let i = 0; i < AGES.length; i++) expect(Number.isFinite(ageMinutes(i)), AGES[i]).toBe(true);
  });

  it('the gate of each age is the furnace upgrade of the next tier, read live', () => {
    expect(ageBundle(0).some((a) => a.item === 'firebrick' && a.count === 4)).toBe(true); // tier 2 upgradeCost
    expect(ageBundle(1).some((a) => a.item === 'brick')).toBe(true); // tier 3 hearth shell
  });

  for (const [i, age] of AGES.entries()) {
    it(`${age}: stays within today's guard band (${GUARD[age].join('-')} expert min)`, () => {
      expect(minutes[i], `${age} = ${minutes[i].toFixed(1)}`).toBeGreaterThanOrEqual(GUARD[age][0]);
      expect(minutes[i], `${age} = ${minutes[i].toFixed(1)}`).toBeLessThanOrEqual(GUARD[age][1]);
    });
    (KNOWN_OFF_TARGET.has(age) ? it.fails : it)(`${age}: meets the advice target band (${TARGET[age].join('-')} expert min)`, () => {
      expect(within(minutes[i], TARGET[age]), `${age} = ${minutes[i].toFixed(1)}`).toBe(true);
    });
  }

  it('ages grow with the tier of their gate (monotone)', () => {
    for (let i = 1; i < minutes.length; i++) expect(minutes[i], AGES[i]).toBeGreaterThan(minutes[i - 1] * 0.6);
  });

  it('each age after the Ember tutorial is within 0.6x-2.5x of the previous (advice target)', () => {
    // Ember is exempt: its real length is carried by farming, brewing and learning waits the model does not see.
    for (let i = 2; i < minutes.length; i++) {
      const ratio = minutes[i] / minutes[i - 1];
      expect(ratio, `${AGES[i]}/${AGES[i - 1]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(0.6);
      expect(ratio, `${AGES[i]}/${AGES[i - 1]} = ${ratio.toFixed(2)}`).toBeLessThanOrEqual(2.5);
    }
  });

  it(`whole game is at most ${TOTAL_TARGET_MAX} expert minutes (advice target)`, () => {
    expect(minutes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(TOTAL_TARGET_MAX);
  });
});

describe('T1b: ore bill sanity', () => {
  const oreItems = new Set(ORE_VEINS.flatMap((v) => BLOCKS.find((b) => b.key === v.block)!.drops.map((d) => d.item)));
  const ores = (i: number): Map<string, number> => new Map([...rawBill(ageBundle(i), ageToolTier(i))].filter(([k]) => oreItems.has(k)));

  for (const [i, age] of AGES.entries()) {
    it(`${age}: no ore kind above 120 blocks`, () => {
      for (const [k, n] of ores(i)) expect(n, `${age} ${k}`).toBeLessThanOrEqual(120);
    });
  }

  it('Ember and Bronze need tin at 25% of copper or more, or the player stalls on scarce tin', () => {
    for (const i of [0, 1]) {
      const bill = ores(i);
      const cu = bill.get('copper_ore') ?? 0;
      expect(cu, AGES[i]).toBeGreaterThan(0);
      expect((bill.get('tin_ore') ?? 0) / cu, AGES[i]).toBeGreaterThanOrEqual(0.25);
    }
  });
});
