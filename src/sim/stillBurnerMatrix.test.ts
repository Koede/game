import { describe, expect, it } from 'vitest';
import { BURNER_C, GLASS_MAX_C, burnerTemp } from '../core/distill';
import { ITEMS, fuelOf } from '../core/registry';

describe('still-base ground burner', () => {
  it('takes every plain furnace fuel, at a heat the glass can stand, and refuses the fierce ones', () => {
    const plain = ITEMS.filter((i) => i.fuel && i.fuel.fuelReturns === undefined && i.key !== 'ember_core').map((i) => i.key);
    for (const k of plain) expect(burnerTemp(k), k).not.toBeNull();
    for (const k of ['lava_bucket', 'ember_core', 'gasoline_canister', 'diesel_canister', 'kerosene_canister', 'plank_not_an_item']) expect(burnerTemp(k), k).toBeNull();
    for (const [k, t] of Object.entries(BURNER_C)) {
      expect(t, k).toBeLessThanOrEqual(GLASS_MAX_C);
      expect(t, k).toBeLessThanOrEqual(fuelOf(k)?.flameTempC ?? 1100);
    }
  });
});
