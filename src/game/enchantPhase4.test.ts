import { describe, expect, it } from 'vitest';
import { AIR, type IWorld, type ItemAmount, type Slot } from '../core/types';
import { canEnchant, enchantCost, enchantInstability, ENCHANTS, enchantLevel, nextEnchantLevel, sanitizeEnchants } from '../core/enchant';
import { itemOrNull } from '../core/registry';
import { makeEnchantedStack } from './inventory';
import { BOUNTY_CHANCE, LightTrail, TRAIL_CAP, TRAIL_S, bountyDrops, emberSmelt, featherfallNegates, glides, shapeDrops } from './enchantEffects';

/** A stack of `item` carrying `enchants` (no world needed). */
const held = (item: string, enchants: Record<string, number>): Slot => makeEnchantedStack(item, enchants);

/** A world of cells keyed "x,y,z": only what LightTrail reads and writes (block keys; air where unset). */
function cellWorld() {
  const cells = new Map<string, string>();
  const world = {
    cells,
    isLoaded: () => true,
    getBlock: (x: number, y: number, z: number) => ({ key: cells.get(`${x},${y},${z}`) ?? 'air' }),
    setVoxel: (x: number, y: number, z: number, v: number) => {
      cells.set(`${x},${y},${z}`, v === AIR ? 'air' : 'magic_light');
      return true;
    },
  };
  return world as typeof world & IWorld;
}

describe('the enchant set (registry)', () => {
  it('holds the six enchants of the plan and attunement, each with an aspect, a level cap of at most III, and a cost per level', () => {
    expect(ENCHANTS.map((e) => e.key)).toEqual(['veinseeker', 'magnet', 'ember', 'featherfall', 'lightstep', 'bounty', 'attunement']); // attunement: legendary weapons only (docs/api/legendary.md)
    for (const e of ENCHANTS) {
      expect(e.max).toBeGreaterThanOrEqual(1);
      expect(e.max).toBeLessThanOrEqual(3);
      expect(e.cost.aspect).toBe(e.aspect);
      expect(e.cost.perLevel).toBeGreaterThan(0);
    }
    expect(new Set(ENCHANTS.map((e) => e.aspect)).size).toBe(ENCHANTS.length); // one aspect per enchant: the hum names one
  });

  it('sanitising keeps the new keys and drops unknown ones; levels clamp to each enchant\'s cap', () => {
    expect(sanitizeEnchants({ ember: 9, featherfall: 9, lightstep: 3, bounty: 2, nope: 1, magnet: 0 })).toEqual({
      ember: 1, featherfall: 2, lightstep: 3, bounty: 2,
    });
    expect(sanitizeEnchants({ nope: 4 })).toBeUndefined();
  });

  it('which tools take which enchant: digging tools take Ember, Bounty and Magnet; any tool takes Featherfall and Lightstep', () => {
    const pick = itemOrNull('iron_pickaxe');
    const shovel = itemOrNull('iron_shovel');
    expect(canEnchant(pick, 'ember')).toBe(true);
    expect(canEnchant(pick, 'bounty')).toBe(true);
    expect(canEnchant(pick, 'featherfall')).toBe(true);
    expect(canEnchant(pick, 'lightstep')).toBe(true);
    expect(canEnchant(shovel, 'ember')).toBe(true);
    expect(canEnchant(itemOrNull('glass'), 'featherfall')).toBe(false);
    expect(canEnchant(itemOrNull('glass'), 'bounty')).toBe(false);
  });

  it('the altar steps levels one at a time, costs scale with the level, and instability rises with what is there', () => {
    expect(nextEnchantLevel(undefined, 'ember')).toBe(1);
    expect(nextEnchantLevel({ ember: 2 }, 'ember')).toBeNull();
    expect(nextEnchantLevel({ lightstep: 1 }, 'lightstep')).toBe(2);
    expect(nextEnchantLevel(undefined, 'nope')).toBeNull();
    expect(enchantCost('ember', 1)).toEqual({ cinder: 2 });
    expect(enchantCost('ember', 2)).toEqual({ cinder: 4 });
    expect(enchantCost('lightstep', 3)).toEqual({ glow: 6 });
    expect(enchantInstability(undefined, 1)).toBe(0);
    expect(enchantInstability({ veinseeker: 2 }, 1)).toBe(2);
    expect(enchantInstability({ veinseeker: 1, bounty: 1 }, 2)).toBe(3);
  });
});

describe('Ember', () => {
  it('smelts what it breaks where a furnace recipe exists, and leaves the rest', () => {
    const out = emberSmelt([{ item: 'copper_ore', count: 2 }], held('iron_pickaxe', { ember: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].item).toBe('copper_ingot');
    expect(out[0].count).toBeGreaterThan(0);
    const plain: ItemAmount[] = [{ item: 'fiber', count: 1 }];
    expect(emberSmelt(plain, held('iron_pickaxe', { ember: 1 }))).toEqual(plain);
  });

  it('does nothing without the enchant', () => {
    const drops: ItemAmount[] = [{ item: 'copper_ore', count: 2 }];
    expect(emberSmelt(drops, held('iron_pickaxe', {}))).toBe(drops);
    expect(emberSmelt(drops, null)).toBe(drops);
  });
});

describe('Bounty', () => {
  it('chance by level: 10%, 20%, 30%; one extra of the first drop, flagged for the glint', () => {
    expect(BOUNTY_CHANCE.slice(1)).toEqual([0.1, 0.2, 0.3]);
    const drops: ItemAmount[] = [{ item: 'coal', count: 1 }, { item: 'stone', count: 1 }];
    const hit = bountyDrops(drops, held('iron_pickaxe', { bounty: 3 }), () => 0.29);
    expect(hit.bonus).toBe(true);
    expect(hit.drops).toEqual([{ item: 'coal', count: 2 }, { item: 'stone', count: 1 }]);
    expect(bountyDrops(drops, held('iron_pickaxe', { bounty: 3 }), () => 0.3).bonus).toBe(false);
    expect(bountyDrops(drops, held('iron_pickaxe', { bounty: 1 }), () => 0.1).bonus).toBe(false);
    expect(bountyDrops(drops, held('iron_pickaxe', { bounty: 1 }), () => 0.09).bonus).toBe(true);
  });

  it('never adds to nothing, and a tool without the enchant never adds', () => {
    expect(bountyDrops([], held('iron_pickaxe', { bounty: 3 }), () => 0)).toEqual({ drops: [], bonus: false });
    expect(bountyDrops([{ item: 'coal', count: 1 }], held('iron_pickaxe', {}), () => 0).bonus).toBe(false);
  });

  it('shapeDrops runs Ember then Bounty on a broken block; nothing for an empty break', () => {
    const shaped = shapeDrops([{ item: 'copper_ore', count: 1 }], held('iron_pickaxe', { ember: 1, bounty: 3 }), () => 0);
    expect(shaped.bonus).toBe(true);
    expect(shaped.drops[0].item).toBe('copper_ingot');
    expect(shaped.drops[0].count).toBeGreaterThanOrEqual(2);
    expect(shapeDrops([], held('iron_pickaxe', { ember: 1, bounty: 3 }), () => 0)).toEqual({ drops: [], bonus: false });
  });
});

describe('Featherfall', () => {
  it('any level stops fall damage; only II lets you glide', () => {
    expect(featherfallNegates(held('iron_pickaxe', { featherfall: 1 }))).toBe(true);
    expect(featherfallNegates(held('iron_pickaxe', { featherfall: 2 }))).toBe(true);
    expect(featherfallNegates(held('iron_pickaxe', {}))).toBe(false);
    expect(featherfallNegates(null)).toBe(false);
    expect(glides(held('iron_pickaxe', { featherfall: 1 }))).toBe(false);
    expect(glides(held('iron_pickaxe', { featherfall: 2 }))).toBe(true);
    expect(enchantLevel(held('iron_pickaxe', { featherfall: 2 }), 'featherfall')).toBe(2);
  });
});

describe('Lightstep trail', () => {
  it('lights the cell the player stands in, and each cell goes out after its level\'s seconds', () => {
    const world = cellWorld();
    const trail = new LightTrail(world);
    const ls1 = held('iron_pickaxe', { lightstep: 1 });
    trail.step(0, { x: 0.5, y: 10, z: 0.5 }, ls1);
    expect(world.cells.get('0,10,0')).toBe('magic_light');
    trail.step(1, { x: 1.5, y: 10, z: 0.5 }, ls1);
    trail.step(1, { x: 1.5, y: 10, z: 0.5 }, ls1);
    expect(world.cells.get('0,10,0')).toBe('magic_light'); // 2 s in: still inside its 2.5 s
    trail.step(1, { x: 1.5, y: 10, z: 0.5 }, ls1);
    expect(world.cells.get('0,10,0')).toBe('air'); // 3 s: gone
    expect(world.cells.get('1,10,0')).toBe('magic_light');
    expect(trail.lit).toBe(1);
    expect(TRAIL_S[1]).toBe(2.5);
  });

  it('lasts longer at higher levels, and a tool without the enchant lights nothing', () => {
    const world = cellWorld();
    const trail = new LightTrail(world);
    trail.step(0, { x: 0.5, y: 10, z: 0.5 }, held('iron_pickaxe', {}));
    expect(world.cells.size).toBe(0);
    const ls3 = held('iron_pickaxe', { lightstep: 3 });
    trail.step(0, { x: 0.5, y: 10, z: 0.5 }, ls3);
    trail.step(5, { x: 0.5, y: 10, z: 0.5 }, ls3); // still inside its 6 s
    expect(world.cells.get('0,10,0')).toBe('magic_light');
    trail.step(1.5, { x: 0.5, y: 10, z: 0.5 }, ls3);
    expect(world.cells.get('0,10,0')).toBe('air');
  });

  it('keeps at most TRAIL_CAP cells lit, the oldest going out first', () => {
    const world = cellWorld();
    const trail = new LightTrail(world);
    const ls3 = held('iron_pickaxe', { lightstep: 3 });
    for (let i = 0; i < TRAIL_CAP + 5; i++) trail.step(0, { x: i + 0.5, y: 10, z: 0.5 }, ls3);
    expect(trail.lit).toBe(TRAIL_CAP);
    expect(world.cells.get('0,10,0')).toBe('air');
    expect(world.cells.get(`${TRAIL_CAP + 4},10,0`)).toBe('magic_light');
  });

  it('never lights a cell that is already solid or not open air', () => {
    const world = cellWorld();
    world.cells.set('0,10,0', 'stone');
    const trail = new LightTrail(world);
    trail.step(0, { x: 0.5, y: 10, z: 0.5 }, held('iron_pickaxe', { lightstep: 2 }));
    expect(world.cells.get('0,10,0')).toBe('stone');
    expect(trail.lit).toBe(0);
  });
});
