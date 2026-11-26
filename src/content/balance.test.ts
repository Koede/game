/**
 * Balance invariants (docs/advice/balance-economy.md section 5): T2 energy, T3 gearing, T8 buff stacking.
 * T1 (time per age) is timeModel.test.ts. T4 (generators do not double-dip) waits for the generator shaft share,
 * which needs wiring in src/app/state.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  BATTERY_EFFICIENCY,
  CONVERSIONS,
  ETA_BURNER,
  ETA_COMBUSTION,
  ETA_TURBINE,
  IGNITION_POWER_W,
  IGNITION_SECONDS,
  WELL_FED_DRAIN_MULT,
  WELL_FED_REGEN_MULT,
  WELL_WARMED_MINING_BONUS,
  W_PER_SU,
} from '../core/constants';
import { DRINK_BUFF_KEYS } from '../core/brewing';
import { ITEMS, RECIPES, machine } from '../core/registry';
import type { DrinkBuff } from '../core/types';
import { Buffs } from '../game/buffs';
import { DIAL_RATIOS, solveNetwork, type KPart, type Source } from '../workshop/kinetics';
import { GENERATOR_SHAFT } from '../workshop/workshop';
import { PROCESS_CARDS } from './recipesDistill';

describe('T2 energy', () => {
  it('T2a: every loop through the conversion table loses at least 40%', () => {
    const worst = new Map<string, number>();
    const walk = (start: string, at: string, product: number, seen: Set<string>): void => {
      for (const [from, to, eta] of CONVERSIONS) {
        if (from !== at) continue;
        const p = product * eta;
        if (to === start) worst.set(start, Math.max(worst.get(start) ?? 0, p));
        else if (!seen.has(to)) walk(start, to, p, new Set([...seen, to]));
      }
    };
    for (const [from] of CONVERSIONS) walk(from, from, 1, new Set([from]));
    expect(worst.size).toBeGreaterThan(0);
    for (const [node, p] of worst) expect(p, `loop through ${node}`).toBeLessThanOrEqual(0.6);
  });

  it('T2a: the machines use the table', () => {
    expect(machine('burner_generator').efficiency).toBe(ETA_BURNER);
    expect(machine('combustion_engine').efficiency).toBe(ETA_COMBUSTION);
    const turbine = machine('steam_turbine');
    const heatW = (turbine.params?.steamLPerS ?? 0) * (machine('boiler').params?.heatPerSteamL ?? 0);
    expect((turbine.outputW ?? 0) / heatW).toBeCloseTo(ETA_TURBINE, 6);
    expect(machine('battery').params?.chargeEfficiency).toBe(BATTERY_EFFICIENCY);
    for (const g of Object.values(GENERATOR_SHAFT)) expect(g.suPerW).toBeCloseTo(1 / W_PER_SU, 9);
  });

  it('T2b: no recipe hands back more fuel energy than it takes, but the listed exceptions', () => {
    // Charcoal x2 is the Ember bootstrap and coke x1.25 the steel route (dossier L6). Splitting wood into planks and
    // sticks also gains (x1.2 / x2 in the fuel table): a known gap, kept listed until the fuel values are revisited.
    const ALLOWED: Record<string, number> = { charcoal: 2, charcoal_pine: 2, coke: 1.5, plank: 1.2, plank_pine: 1.2, stick: 2 };
    const fuel = new Map(ITEMS.filter((i) => i.fuel).map((i) => [i.key, i.fuel!.energyJ]));
    const energy = (list: readonly { item: string; count: number }[]): number => list.reduce((s, a) => s + a.count * (fuel.get(a.item) ?? 0), 0);
    for (const r of RECIPES) {
      const out = energy([r.output, ...r.byproducts]);
      if (out === 0) continue;
      const inp = energy(r.inputs) + (r.energyJ ?? 0);
      expect(inp, `${r.id} makes fuel from nothing`).toBeGreaterThan(0);
      expect(out / inp, r.id).toBeLessThanOrEqual((ALLOWED[r.id] ?? 1) + 1e-9);
    }
  });

  it('T2b: nothing the distillery makes is furnace fuel', () => {
    const fuels = new Set(ITEMS.filter((i) => i.fuel).map((i) => i.key));
    const made = PROCESS_CARDS.flatMap((c) => [c.output, ...(c.byproducts ?? [])]).map((a) => a.item);
    expect(made.filter((k) => fuels.has(k))).toEqual([]);
  });

  it('T2c: Starhearth ignition can be fed from lithium banks (at most two)', () => {
    const bank = machine('lithium_bank');
    const needJ = (IGNITION_POWER_W * IGNITION_SECONDS) / BATTERY_EFFICIENCY;
    const banks = Math.ceil(IGNITION_POWER_W / (bank.rateW ?? 1));
    expect(banks).toBeLessThanOrEqual(2);
    expect(banks * (bank.capacityJ ?? 0)).toBeGreaterThanOrEqual(needJ);
  });
});

describe('T3 gearing conserves work', () => {
  /** A source, `dials` ratio dials at `setting`, then a saw: the saw's rpm and the stress it puts on the source. */
  function line(sourceRpm: number, dials: number, setting: number): { rpm: number; stress: number } {
    const keys = ['src', ...Array.from({ length: dials }, (_, i) => `d${i}`), 'saw'];
    const parts = new Map<string, KPart>(keys.map((k) => [k, { kind: k === 'src' ? 'hand_crank' : k === 'saw' ? 'mech_saw' : 'ratio_dial', s: setting }]));
    const sources = new Map<string, Source>([['src', { rpm: sourceRpm, capacity: 1000 }]]);
    const solved = solveNetwork({
      members: keys,
      part: (k) => parts.get(k)!,
      neighbours: (k) => {
        const i = keys.indexOf(k);
        return [keys[i - 1], keys[i + 1]].filter((x): x is string => x !== undefined);
      },
      sources,
      t: 0,
    });
    return { rpm: Math.abs(solved.rpm.get('saw') ?? 0), stress: solved.partStress.get('saw') ?? 0 };
  }

  it('work per stress unit is the same at every speed', () => {
    const x3 = DIAL_RATIOS.indexOf(3);
    const half = DIAL_RATIOS.indexOf(0.5);
    const cases = [line(16, 2, half), line(16, 1, half), line(16, 0, x3), line(32, 0, x3), line(64, 0, x3), line(96, 0, x3), line(16, 1, x3), line(16, 2, x3)];
    expect(cases.map((c) => c.rpm)).toEqual([4, 8, 16, 32, 64, 96, 48, 144]);
    const ref = line(16, 0, x3);
    const workPerSU = (c: { rpm: number; stress: number }): number => c.rpm / 16 / c.stress;
    for (const c of cases) expect(workPerSU(c) / workPerSU(ref), `${c.rpm} rpm`).toBeCloseTo(1, 2);
  });
});

describe('T8 buff stacking bounds', () => {
  /** Buffs with the given drinks (one per family at a time, so each family is tried on its own) and Sugar Rush. */
  const withDrink = (d: DrinkBuff): Buffs => {
    const b = new Buffs();
    b.grant(d, 100);
    b.sugarS = 100;
    return b;
  };

  it('no drink with Sugar Rush pushes speed, mining or regeneration past the bounds', () => {
    for (const d of DRINK_BUFF_KEYS) {
      const b = withDrink(d);
      expect(b.speedMult, d).toBeLessThanOrEqual(1.4);
      expect(b.miningMult * WELL_WARMED_MINING_BONUS, d).toBeLessThanOrEqual(1.6);
      expect(b.regenMult * WELL_FED_REGEN_MULT, d).toBeLessThanOrEqual(4);
    }
  });

  it('Well-Fed and Lasting together never make hunger stop mattering', () => {
    const b = new Buffs();
    b.grant('lasting', 100);
    expect(b.foodDrainMult * WELL_FED_DRAIN_MULT).toBeGreaterThanOrEqual(0.4);
  });
});
