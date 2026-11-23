import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { CHARMS, charmFactors } from './charms';
import { arcaneRecipe } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';
import { WARD_SCALE } from './magic';
import { itemOrNull } from '../core/registry';

describe('rune-etched charms', () => {
  it('three charms are items with Arcane Workbench recipes, gated by research', () => {
    for (const c of CHARMS) {
      expect(itemOrNull(c.key)).not.toBeNull();
      expect(arcaneRecipe(c.key)?.bench).toBe(true);
      expect(RESEARCH_GATES.has(c.key)).toBe(true);
    }
  });

  it('factors fold what is carried; duplicates of one kind count once', () => {
    expect(charmFactors(() => false)).toEqual({ damage: 1, speed: 1, food: 1 });
    expect(charmFactors((k) => k === 'charm_ward' || k === 'charm_hunger')).toEqual({ damage: 0.85, speed: 1, food: 0.75 });
  });

  it('carried, they scale damage, speed and food drain; dropped, they stop', () => {
    const t = setup();
    t.hold('charm_ward');
    t.player.inventory.add('charm_speed', 1);
    t.player.inventory.add('charm_hunger', 1);
    t.magic.tick(0.05);
    expect(t.player.damageScale).toBeCloseTo(0.85);
    expect(t.player.buffs.speedMult).toBeCloseTo(1.1);
    expect(t.player.buffs.foodDrainMult).toBeCloseTo(0.75);
    t.player.inventory.clear();
    t.magic.tick(0.05);
    expect(t.player.damageScale).toBe(1);
    expect(t.player.buffs.speedMult).toBe(1);
    expect(t.player.buffs.foodDrainMult).toBe(1);
  });

  it('the ward focus and the ward charm stack', () => {
    const t = setup();
    t.learnAll();
    t.hold('focus_ward');
    t.player.inventory.add('vis_rod', 1);
    t.player.inventory.add('charm_ward', 1);
    t.magic.vis.loam = 8;
    t.magic.vis.rune = 8;
    t.magic.use(null);
    t.magic.tick(0.05);
    expect(t.player.damageScale).toBeCloseTo(WARD_SCALE * 0.85);
  });
});
