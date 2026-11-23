import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { CELL_AURA, MAX_CELLS, TAINT_BLOCK } from './taint';
import { arcaneRecipe } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';
import { FOCI } from '../content/itemsMagic';
import { itemOrNull } from '../core/registry';

/** A 21 x 21 patch of grass at y = 1 over the stone floor, with air above. */
function meadow() {
  const t = setup();
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) t.put(x, 1, z, 'grass');
  return t;
}
const count = (t: ReturnType<typeof setup>): number => {
  let n = 0;
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) if (t.world.getBlock(x, 1, z).key === TAINT_BLOCK) n++;
  return n;
};

describe('taint', () => {
  it('the Cleansing Focus is a focus item with a gated recipe', () => {
    expect(FOCI.some((f) => f.key === 'focus_cleanse')).toBe(true);
    expect(itemOrNull('focus_cleanse')).not.toBeNull();
    expect(arcaneRecipe('focus_cleanse')).not.toBeNull();
    expect(RESEARCH_GATES.has('focus_cleanse')).toBe(true);
  });

  it('an overflowing crucible stains the ground beside it', () => {
    const t = meadow();
    t.put(0, 2, 0, 'crucible');
    t.learn('crucible');
    t.hold('water_vial');
    t.magic.use(t.at(0, 2, 0));
    // dissolve until it boils over the 64 cap
    for (let i = 0; i < 30 && count(t) === 0; i++) {
      t.hold('copper_ore', 8);
      t.magic.use(t.at(0, 2, 0));
    }
    expect(count(t)).toBeGreaterThan(0);
    expect(count(t)).toBeLessThanOrEqual(3);
  });

  it('spreads over open grass a little each second, never past the cap, and drags the aura down', () => {
    const t = meadow();
    expect(t.magic.seedTaint(0, 1, 0, 1)).toBe(1);
    expect(count(t)).toBe(1);
    t.magic.rng = () => 0.1; // always spreads
    for (let i = 0; i < 12; i++) t.magic.tick(1);
    expect(count(t)).toBeGreaterThan(3);
    expect(count(t)).toBeLessThanOrEqual(MAX_CELLS);
    expect(t.magic.auraAt(0, 0)).toBeLessThan(0);
    expect(t.magic.auraAt(0, 0)).toBeCloseTo(-CELL_AURA * count(t), 5);
  });

  it('only eats open surface grass, dirt and sand', () => {
    const t = setup();
    t.put(0, 1, 0, 'stone');
    t.put(1, 1, 0, 'grass');
    t.put(1, 2, 0, 'stone'); // covered
    expect(t.magic.taint.seed(0, 1, 0, 5)).toBe(0);
    expect(t.world.getBlock(0, 1, 0).key).toBe('stone');
    expect(t.world.getBlock(1, 1, 0).key).toBe('grass');
  });

  it('the Cleansing Focus restores what taint ate and lifts the aura; mining a stained block removes it from the field', () => {
    const t = meadow();
    t.magic.taint.seed(0, 1, 0, 6);
    const before = count(t);
    expect(before).toBe(6);
    t.learnAll();
    t.hold('focus_cleanse');
    t.player.inventory.add('vis_rod', 1);
    t.magic.vis.brook = 6;
    t.magic.vis.rune = 6;
    expect(t.magic.use(t.at(0, 1, 0))).toBe('worked');
    expect(count(t)).toBe(0);
    expect(t.world.getBlock(0, 1, 0).key).toBe('grass');
    expect(t.magic.vis.brook).toBe(4);
    expect(t.magic.taint.size).toBe(0);
    // aimed at clean ground in a calm chunk: nothing to do
    t.magic.tick(2);
    expect(t.magic.use(t.at(0, 1, 0))).toBe('refused');
    // mining
    t.magic.taint.seed(5, 1, 5, 1);
    const [x, , z] = [5, 1, 5];
    const k = [...t.magic.taint.cells.keys()][0];
    expect(k).toBeDefined();
    const [kx, ky, kz] = k.split(',').map(Number);
    t.world.setVoxel(kx, ky, kz, 0);
    expect(t.magic.taint.size).toBe(0);
    expect(x + z).toBe(10);
  });

  it('standing on stained ground wears at the mind', () => {
    const t = meadow();
    t.magic.taint.seed(0, 1, 0, 1);
    t.magic.rng = () => 0.99; // no spreading
    t.player.position.x = 0.5;
    t.player.position.y = 2;
    t.player.position.z = 0.5;
    const w = t.magic.warp;
    for (let i = 0; i < 22; i++) t.magic.tick(1);
    expect(t.magic.warp).toBeGreaterThan(w);
  });

  it('the stain is saved with what it replaced', () => {
    const t = meadow();
    t.magic.taint.seed(0, 1, 0, 3);
    const raw = JSON.parse(JSON.stringify(t.magic.toJSON()));
    expect(raw.taint).toHaveLength(3);
    expect(raw.taint[0][3]).toBe('grass');
    const u = meadow();
    u.magic.load(raw);
    expect(u.magic.taint.size).toBe(3);
  });
});
