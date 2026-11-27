import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { MODS, MOD_MAX, blinkRange, rayReach, thriftCost, wardTuning } from './focusMods';
import { arcaneRecipe } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';
import { WARD_S, WARD_SCALE } from './magic';
import { itemOrNull } from '../core/registry';

describe('focus upgrade modifiers', () => {
  it('three runes are items with desk recipes behind research', () => {
    for (const m of MODS) {
      expect(itemOrNull(m.key)).not.toBeNull();
      expect(arcaneRecipe(m.key)).not.toBeNull();
      expect(RESEARCH_GATES.has(m.key)).toBe(true);
    }
  });

  it('tuning grows with the level and never breaks the floor', () => {
    expect(thriftCost(6, 0)).toBe(6);
    expect(thriftCost(6, 3)).toBeLessThan(thriftCost(6, 1));
    expect(thriftCost(1, 3)).toBe(1);
    expect(rayReach(2)).toBeGreaterThan(rayReach(1));
    expect(blinkRange(8, 3)).toBe(14);
    expect(wardTuning(0.5, 30, 3).scale).toBeLessThan(0.5);
    expect(wardTuning(0.5, 30, 3).seconds).toBe(60);
    expect(wardTuning(0.5, 30, 0)).toEqual({ scale: 0.5, seconds: 30 });
  });

  it('Use at a bench with a rune raises the first carried focus, up to the cap', () => {
    const t = setup();
    t.put(2, 1, 2, 'arcane_workbench');
    t.hold('focus_mod_cost', 8);
    t.player.inventory.add('focus_ward', 1);
    for (let i = 0; i < MOD_MAX; i++) expect(t.magic.use(t.at(2, 1, 2))).toBe('worked');
    expect(t.magic.levelsOf('focus_ward')).toEqual({ reach: 0, power: 0, cost: MOD_MAX });
    expect(t.magic.use(t.at(2, 1, 2))).toBe('refused');
    expect(t.player.inventory.count('focus_mod_cost')).toBe(8 - MOD_MAX);
    // no focus carried: refused
    const u = setup();
    u.put(2, 1, 2, 'rune_desk');
    u.hold('focus_mod_power');
    expect(u.magic.use(u.at(2, 1, 2))).toBe('refused');
  });

  it('Thrift lowers what a cast takes from the vis pools', () => {
    const t = setup();
    t.learnAll();
    t.put(2, 1, 2, 'arcane_workbench');
    t.hold('focus_mod_cost', 3);
    t.player.inventory.add('focus_ward', 1);
    t.player.inventory.add('vis_rod', 1);
    for (let i = 0; i < 3; i++) t.magic.use(t.at(2, 1, 2));
    t.hold('focus_ward');
    t.player.inventory.add('vis_rod', 1);
    t.magic.vis.loam = 10;
    t.magic.vis.rune = 10;
    expect(t.magic.use(null)).toBe('worked');
    // ward costs loam 3, rune 3: with 3 Thrift levels floor(3 * 4 / 7) = 1 each
    expect(t.magic.vis.loam).toBe(9);
    expect(t.magic.vis.rune).toBe(9);
  });

  it('Power makes the ward stronger and longer; levels save and load', () => {
    const t = setup();
    t.put(2, 1, 2, 'arcane_workbench');
    t.hold('focus_mod_power', 2);
    t.player.inventory.add('focus_ward', 1);
    t.magic.use(t.at(2, 1, 2));
    t.magic.use(t.at(2, 1, 2));
    t.hold('focus_ward');
    t.player.inventory.add('vis_rod', 1);
    t.magic.vis.loam = 10;
    t.magic.vis.rune = 10;
    t.magic.use(null);
    expect(t.magic.wardS).toBe(WARD_S + 20);
    t.magic.tick(0.05);
    expect(t.player.damageScale).toBeLessThan(WARD_SCALE);
    const u = setup();
    u.magic.load(JSON.parse(JSON.stringify(t.magic.toJSON())));
    expect(u.magic.levelsOf('focus_ward').power).toBe(2);
  });

  it('Reach lets the Light focus place a light on a block farther than the ordinary reach', () => {
    const t = setup();
    t.put(2, 1, 2, 'arcane_workbench');
    t.player.yaw = 0;
    t.player.pitch = 0;
    t.put(0, 2, -12, 'stone');
    t.hold('focus_mod_reach', 3);
    t.player.inventory.add('focus_light', 1);
    for (let i = 0; i < 3; i++) t.magic.use(t.at(2, 1, 2));
    t.hold('focus_light');
    t.player.inventory.add('vis_rod', 1);
    t.magic.vis.cinder = 4;
    t.player.position.x = 0.5;
    t.player.position.z = 0.5;
    expect(t.magic.use(null)).toBe('worked');
    expect(t.world.getBlock(0, 2, -11).key).toBe('magic_light');
    // without Reach the same cast has no target
    const u = setup();
    u.player.yaw = 0;
    u.put(0, 2, -12, 'stone');
    u.hold('focus_light');
    u.player.inventory.add('vis_rod', 1);
    u.magic.vis.cinder = 4;
    expect(u.magic.use(null)).toBe('refused');
  });
});
