import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { dishQuality, dishScore, foodStrength, heatScore, ingredientQuality } from './cookingQuality';
import { Inventory, canMerge } from './inventory';
import { eat } from './hunger';
import { PlayerState } from './playerState';

const stew = [{ item: 'raw_chop', count: 1 }, { item: 'carrot', count: 1 }, { item: 'potato', count: 1 }];

describe('cooking quality', () => {
  it('heat peaks at the ideal and falls off both ways', () => {
    expect(heatScore(150, 'hearth_stew')).toBe(1);
    expect(heatScore(60, 'hearth_stew')).toBeLessThan(heatScore(120, 'hearth_stew'));
    expect(heatScore(600, 'hearth_stew')).toBe(0);
  });

  it('better heat, variety and ingredients make a better dish', () => {
    const plain = [{ item: 'raw_chop', count: 1 }];
    expect(dishQuality({ output: 'cooked_chop', inputs: plain, heatC: 600 })).toBe(0);
    expect(dishQuality({ output: 'cooked_chop', inputs: plain, heatC: 230 })).toBe(1);
    expect(dishQuality({ output: 'hearth_stew', inputs: stew, heatC: 150 })).toBe(1);
    expect(dishQuality({ output: 'hearth_stew', inputs: stew, heatC: 150, ingredientQuality: 1 })).toBe(2);
    expect(dishScore({ output: 'hearth_stew', inputs: stew, heatC: 150 })).toBeGreaterThan(
      dishScore({ output: 'hearth_stew', inputs: stew, heatC: 90 }),
    );
    expect(dishScore({ output: 'hearth_stew', inputs: stew, heatC: 90, ingredientQuality: 2 })).toBeGreaterThan(
      dishScore({ output: 'hearth_stew', inputs: stew, heatC: 90 }),
    );
  });

  it('measures ingredient quality from the pack', () => {
    const inv = new Inventory(6);
    inv.add('carrot', 2, undefined, 0, 6, 2);
    inv.add('potato', 2);
    expect(ingredientQuality([{ item: 'carrot', count: 2 }, { item: 'potato', count: 2 }], [inv])).toBe(1);
  });

  it('keeps quality stacks apart and saves them', () => {
    const inv = new Inventory(6);
    inv.add('bread', 3);
    inv.add('bread', 2, undefined, 0, 6, 1);
    expect(inv.slots.filter((s) => s?.item === 'bread')).toHaveLength(2);
    expect(canMerge(inv.slots[0]!, inv.slots[1]!)).toBe(false);
    const back = Inventory.fromJSON(inv.toJSON());
    expect(back.slots[1]!.quality).toBe(1);
  });

  it('eating a better dish feeds more and its buff lasts longer', () => {
    const ate = (quality?: 1 | 2): { hunger: number; wellFedS: number } => {
      const p = new PlayerState(createBus());
      p.food = 0;
      p.inventory.add('hearth_stew', 1, undefined, 0, 9, quality);
      p.selectedSlot = 0;
      const r = eat(p, 0);
      return { hunger: r.ok ? r.hunger : -1, wellFedS: p.buffs.wellFedS };
    };
    const base = ate();
    const exquisite = ate(2);
    expect(exquisite.hunger).toBeCloseTo(base.hunger * 1.5, 5);
    expect(exquisite.wellFedS).toBeCloseTo(base.wellFedS * 2, 5);
    expect(foodStrength({ item: 'bread', count: 1, quality: 1 }).buff).toBe(1.5);
  });
});
