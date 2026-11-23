import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { POTIONS, potionFactors } from './potions';
import { ALCHEMY } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';
import { itemOrNull } from '../core/registry';

describe('magic potions', () => {
  it('four potions are items with crucible recipes behind research', () => {
    for (const p of POTIONS) {
      expect(itemOrNull(p.key)).not.toBeNull();
      expect(ALCHEMY.some((r) => r.output.item === p.key)).toBe(true);
    }
    for (const r of ALCHEMY.filter((a) => a.id.startsWith('brew_'))) expect(RESEARCH_GATES.has(r.id)).toBe(true);
  });

  it('a catalyst dropped into a hot pot with the essentia comes out as the potion', () => {
    const t = setup();
    t.magic.load({ crucibles: [[4, 1, 4, 1, { gale: 3, drive: 2 }]] });
    t.put(4, 1, 4, 'crucible');
    t.learn('crucible', 'warm_hearth');
    t.hold('sugar', 2);
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.player.inventory.count('potion_haste')).toBe(1);
    expect(t.magic.crucibleAt(4, 1, 4)!.ess).toEqual({});
  });

  it('drinking runs a draught: factors apply, a second one refreshes, it wears off, and it saves', () => {
    const t = setup();
    t.hold('potion_haste', 2);
    t.magic.use(null);
    t.magic.tick(0.05);
    expect(t.player.buffs.speedMult).toBeCloseTo(1.25);
    expect(t.player.inventory.count('glass_vial')).toBe(1);
    expect(t.magic.activePotions()[0].item).toBe('potion_haste');
    t.player.inventory.clear();
    t.player.inventory.add('potion_stoneskin', 1);
    t.player.inventory.add('potion_mending', 1);
    t.player.selectedSlot = 0;
    t.magic.use(null);
    t.player.selectedSlot = 1;
    t.magic.use(null);
    t.magic.tick(0.05);
    expect(t.player.damageScale).toBeCloseTo(0.7);
    expect(t.player.buffs.regenMult).toBeCloseTo(1.6);
    const u = setup();
    u.magic.load(JSON.parse(JSON.stringify(t.magic.toJSON())));
    expect(u.magic.activePotions().map((p) => p.item).sort()).toEqual(['potion_haste', 'potion_mending', 'potion_stoneskin']);
    t.magic.tick(121);
    t.magic.tick(0.05);
    expect(t.player.buffs.speedMult).toBe(1);
    expect(t.player.damageScale).toBe(1);
    expect(potionFactors({})).toEqual({ speed: 1, damage: 1, regen: 1 });
  });

  it('Clarity lifts warp at once and is refused with a clear mind', () => {
    const t = setup();
    t.hold('potion_clarity', 2);
    expect(t.magic.use(null)).toBe('refused');
    t.magic.addWarp(5);
    expect(t.magic.use(null)).toBe('worked');
    expect(t.magic.warp).toBe(3);
  });
});
