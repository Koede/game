import { describe, expect, it } from 'vitest';
import { FLAG_DROVE_TRACTOR, FLAG_FELLED_TREE } from '../core/constants';
import { OBJECTIVES, TEXTURE_NAMES, item, recipesAt, validateContent } from '../core/registry';
import { conditionMet, solve } from './progression';

const KEYS = ['chainsaw', 'tractor', 'tractor_tiller', 'tractor_harvester'];

describe('Current Age engines: chainsaw and tractor content', () => {
  it('passes the content validator', () => {
    expect(validateContent()).toEqual([]);
  });

  it('are age 2 items with icons and texts', () => {
    for (const key of KEYS) {
      const def = item(key);
      expect(def.age, key).toBe(2);
      expect(def.desc.length, key).toBeGreaterThan(40);
      expect(TEXTURE_NAMES, key).toContain(`item_${key}`);
    }
    expect(item('tractor').stack).toBe(1);
  });

  it('are forged at the Arc Furnace (tier 3) from engine parts, and not before', () => {
    const forge = recipesAt('furnace').filter((r) => KEYS.includes(r.output.item));
    expect(forge.map((r) => r.output.item).sort()).toEqual([...KEYS].sort());
    for (const r of forge) {
      expect(r.minTier, r.id).toBe(3);
      expect(r.age, r.id).toBe(2);
    }
    // Relative to the Combustion Engine (same parts, same furnace): whatever the solver can reach for it, it reaches
    // for these, and nothing earlier. (Absolute reachability is content.test.ts's job.)
    const early = solve(2);
    for (const key of KEYS) expect(early.items.has(key), key).toBe(false);
    const arc = solve(3);
    for (const key of KEYS) expect(arc.items.has(key), key).toBe(arc.items.has('combustion_engine'));
  });

  it('have objectives in the Current Age that the solver can reach with an Arc Furnace and not earlier', () => {
    for (const [id, flag] of [['fell_tree', FLAG_FELLED_TREE], ['drive_tractor', FLAG_DROVE_TRACTOR]]) {
      const o = OBJECTIVES.find((x) => x.id === id)!;
      expect(o.age).toBe(2);
      expect(o.condition).toEqual({ type: 'flag', flag });
      expect(conditionMet(o.condition, solve(2))).toBe(false);
      expect(conditionMet(o.condition, solve(3))).toBe(solve(3).items.has('combustion_engine') && solve(3).items.has('fuel_canister'));
    }
  });

  it('give the saw a fuel tank in its durability and a canister refill that adds something', () => {
    const fell = item('chainsaw').tool!.fell!;
    expect(item('chainsaw').tool!.durability - 1).toBeGreaterThanOrEqual(fell.canisterFuel);
    expect(fell.fuelPerLog).toBeGreaterThan(0);
    expect(fell.maxLogs).toBeGreaterThan(8);
  });
});
