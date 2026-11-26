/**
 * The time model (timeModel.ts) and the balance tests built on it (docs/advice/balance-economy.md section 5, T1 and
 * T1b). Every threshold is a band, not a point, so ordinary content tweaks do not churn these tests.
 *
 * Ages the advice already found out of band are listed in KNOWN_OUT_OF_BAND with the fix it proposes. Those tests
 * assert the age is STILL out of band: when a content change brings it back, the test fails and asks for the entry
 * to be removed, so the band then guards it like every other age.
 */
import { describe, expect, it } from 'vitest';
import { FURNACE_TIERS, ITEMS, RECIPES } from '../core/registry';
import { hearthMaterials } from './progression';
import {
  AGE_KEYS, AGE_KITS, TIME_PARAMS, ageBundle, ageCurve, ageGate, bill, costModel, expertMinutes, isItem, kitItems, recipeOperation,
} from './timeModel';

/** T1: expert minutes per age (kit + gate). */
const BANDS: Record<string, [number, number]> = {
  ember: [8, 18],
  bronze: [28, 42],
  forge: [20, 32],
  current: [24, 36],
  atomic: [28, 48],
};

/**
 * Ages out of their band today, and why (balance-economy.md section 2). Remove an entry once the content change
 * that fixes it lands.
 */
const KNOWN_OUT_OF_BAND: Record<string, string> = {
  bronze: 'too short: the Bronze steam kit (docs/STEAM_PLAN.md: boiler plates, gauges, steam engine) is not in code yet',
  current: 'too long: 53 plasma_casing in the Arc -> Plasma hearth; the advice proposes a 24-block shell',
  atomic: 'too long: 93 star_casing each carrying a magnet_ring; the advice proposes 30 casings, rings only in star_core',
};

/** Whole game, expert minutes. */
const TOTAL_MAX = 190;
/** Consecutive ages: next / previous within this range. */
const RATIO: [number, number] = [0.6, 2.5];
/** Pairs [age, previous age] known to break the ratio rule today (same causes as above). */
const KNOWN_RATIO_BREAKS = ['atomic/current'];

/** T1b: no age needs more than this many ore blocks of one kind. */
const ORE_MAX = 120;
/** Ages known to break the ore cap today, and the ores (same cause as their band entry). */
const KNOWN_ORE_BREAKS: Record<string, string[]> = { atomic: ['coal', 'copper_ore', 'iron_ore'] };

const curve = ageCurve();
const fmt = (n: number): string => n.toFixed(1);
const ores = new Set(['copper_ore', 'tin_ore', 'iron_ore', 'coal', 'sulfur', 'bauxite', 'quartz_ore', 'wolframite', 'spodumene', 'limestone', 'pitchblende', 'oil_shale']);

describe('time model: building blocks', () => {
  it('has one kit per age that ends in a furnace upgrade, naming real items', () => {
    expect(AGE_KITS.length).toBe(FURNACE_TIERS.length - 1);
    expect(kitItems().filter((k) => !isItem(k))).toEqual([]);
  });

  it('builds each gate from the next tier upgrade cost and its smallest hearth', () => {
    for (let age = 0; age < AGE_KITS.length; age++) {
      const next = FURNACE_TIERS[age + 1];
      expect(ageGate(age)).toEqual([...next.upgradeCost, ...hearthMaterials(next.tier)]);
    }
    expect(ageGate(FURNACE_TIERS.length - 1)).toEqual([]);
  });

  it('can price every item of every bundle in its own age', () => {
    for (let age = 0; age < AGE_KITS.length; age++) {
      const b = bill(costModel(age), ageBundle(age));
      expect(b.missing, AGE_KEYS[age]).toEqual([]);
      expect(b.expertS, AGE_KEYS[age]).toBeGreaterThan(0);
    }
  });

  it('prices raw ores by vein: the scarce tin costs more than copper, and better tools are cheaper', () => {
    const ember = costModel(0);
    const bronze = costModel(1);
    expect(ember.cost('tin_ore')).toBeGreaterThan(ember.cost('copper_ore'));
    expect(bronze.cost('copper_ore')).toBeLessThan(ember.cost('copper_ore'));
    // Iron ore needs a bronze pickaxe (tier 2): flint cannot win it in the Ember Age.
    expect(ember.route('iron_ore')?.kind ?? 'none').not.toBe('raw');
    expect(bronze.route('iron_ore')).toEqual({ kind: 'raw', source: 'mine:iron_ore' });
  });

  it('never prices a raw item from a scarce block (ruins, crystals)', () => {
    for (let age = 0; age < AGE_KITS.length; age++) {
      const m = costModel(age);
      for (const it of ITEMS) {
        const r = m.route(it.key);
        if (r?.kind === 'raw') for (const b of TIME_PARAMS.scarceBlocks) expect(r.source, it.key).not.toBe(`mine:${b}`);
      }
    }
  });

  it('is a true cheapest-route fixed point: no usable recipe beats the price of its output', () => {
    let checked = 0;
    for (let age = 0; age < AGE_KITS.length; age++) {
      const m = costModel(age);
      for (const r of RECIPES) {
        const op = recipeOperation(r, age);
        if (!op) continue;
        const inputs = r.inputs.reduce((sum, i) => sum + i.count * m.cost(i.item), 0);
        if (!Number.isFinite(inputs)) continue;
        checked++;
        expect(m.cost(r.output.item), `${AGE_KEYS[age]} ${r.id}`).toBeLessThanOrEqual((inputs + op.opS) / op.outCount + 1e-6);
        const route = m.route(r.output.item);
        if (route?.kind === 'recipe' && route.recipe.id === r.id) expect(m.cost(r.output.item)).toBeCloseTo((inputs + op.opS) / op.outCount, 6);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('charges a bill exactly the sum of its unit prices', () => {
    const m = costModel(3);
    const wanted = [{ item: 'steel_plate', count: 3 }, { item: 'circuit', count: 2 }];
    expect(bill(m, wanted).expertS).toBeCloseTo(3 * m.cost('steel_plate') + 2 * m.cost('circuit'), 6);
  });

  it('uses the mortar bonus: crushed copper is cheaper per ingot than smelting raw ore', () => {
    const m = costModel(0);
    const route = m.route('copper_ingot');
    expect(route?.kind === 'recipe' && route.recipe.id).toBe('copper_ingot_crushed');
    const crushed = m.route('crushed_copper');
    expect(crushed?.kind === 'recipe' && crushed.outCount).toBeCloseTo(1.35, 6);
  });

  it('responds to its parameters', () => {
    const base = expertMinutes(2, ageBundle(2));
    expect(expertMinutes(2, ageBundle(2), { ...TIME_PARAMS, craftS: TIME_PARAMS.craftS * 2 })).toBeGreaterThan(base);
    expect(expertMinutes(2, ageBundle(2), { ...TIME_PARAMS, veinTravelS: 0 })).toBeLessThan(base);
    for (const a of curve) expect(a.playerMin).toBeCloseTo(a.expertMin * TIME_PARAMS.playerFactor, 6);
  });
});

describe('T1: time to next age', () => {
  it('reports the curve', () => {
    // A readable table in the test log, for whoever tunes the bands next.
    const rows = curve.map((a) => `${a.key.padEnd(8)} kit ${fmt(a.kitMin).padStart(6)}  gate ${fmt(a.gateMin).padStart(6)}  expert ${fmt(a.expertMin).padStart(6)}  player ${fmt(a.playerMin).padStart(6)}`);
    console.log(`time model (expert minutes)\n${rows.join('\n')}`);
    expect(curve.map((a) => a.key)).toEqual(AGE_KEYS.slice(0, AGE_KITS.length));
  });

  for (const [key, [lo, hi]] of Object.entries(BANDS)) {
    const why = KNOWN_OUT_OF_BAND[key];
    it(why ? `${key} is still out of its ${lo}-${hi} min band (${why})` : `${key} takes ${lo}-${hi} expert minutes`, () => {
      const a = curve.find((c) => c.key === key);
      expect(a).toBeDefined();
      const inBand = a!.expertMin >= lo && a!.expertMin <= hi;
      expect(inBand, `${key}: ${fmt(a!.expertMin)} expert min${why ? ' - now in band: remove it from KNOWN_OUT_OF_BAND' : ''}`).toBe(!why);
    });
  }

  it(`keeps each age within x${RATIO[0]}-${RATIO[1]} of the one before (known breaks: ${KNOWN_RATIO_BREAKS.join(', ')})`, () => {
    for (let i = 1; i < curve.length; i++) {
      const pair = `${curve[i].key}/${curve[i - 1].key}`;
      const ratio = curve[i].expertMin / curve[i - 1].expertMin;
      const ok = ratio >= RATIO[0] && ratio <= RATIO[1];
      expect(ok, `${pair} = x${ratio.toFixed(2)}${KNOWN_RATIO_BREAKS.includes(pair) ? ' - now in range: remove it from KNOWN_RATIO_BREAKS' : ''}`).toBe(!KNOWN_RATIO_BREAKS.includes(pair));
    }
  });

  it(`whole game total: under ${TOTAL_MAX} expert minutes once every age is in band`, () => {
    const total = curve.reduce((sum, a) => sum + a.expertMin, 0);
    const outOfBand = Object.keys(KNOWN_OUT_OF_BAND).length > 0;
    // While ages are known to be out of band the total is too; it must come under the cap once they are all fixed.
    expect(total <= TOTAL_MAX, `total ${fmt(total)} expert min`).toBe(!outOfBand);
  });
});

describe('T1b: ore bill sanity', () => {
  it(`no age needs more than ${ORE_MAX} ore blocks of one kind (known: ${JSON.stringify(KNOWN_ORE_BREAKS)})`, () => {
    for (const a of curve) {
      const over = [...a.bill.raw].filter(([k, n]) => ores.has(k) && n > ORE_MAX).map(([k]) => k).sort();
      expect(over, `${a.key} over the cap`).toEqual([...(KNOWN_ORE_BREAKS[a.key] ?? [])].sort());
    }
  });

  it('Ember and Bronze ask for tin at least a quarter of their copper', () => {
    for (const a of curve.filter((c) => c.key === 'ember' || c.key === 'bronze')) {
      const copper = a.bill.raw.get('copper_ore') ?? 0;
      const tin = a.bill.raw.get('tin_ore') ?? 0;
      expect(copper, a.key).toBeGreaterThan(0);
      expect(tin / copper, `${a.key}: ${fmt(tin)} tin / ${fmt(copper)} copper`).toBeGreaterThanOrEqual(0.25);
    }
  });
});
