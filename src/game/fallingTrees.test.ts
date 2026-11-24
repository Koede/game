import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FLAG_FELLED_TREE } from '../core/constants';
import { block } from '../core/registry';
import { FakeWorld } from './fakeWorld';
import { FallingTrees, cellLocal, treeBaseOf } from './fallingTrees';
import { PlayerState } from './playerState';
import { rodProfile } from './treeBody';

/** A grass floor at y = 9 and a straight oak of `height` logs standing on it (base at y = 10). */
function grove(height: number) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-12, 9, -12, 12, 9, 12, 'grass');
  world.fill(0, 10, 0, 0, 9 + height, 0, 'oak_log');
  const player = new PlayerState(bus, { x: -4.5, y: 10, z: 0.5 });
  player.inventory.set(player.selectedSlot, { item: 'steel_axe', count: 1, durability: 700 });
  const flags: string[] = [];
  bus.on('flag', (e) => flags.push(e.flag));
  const trees = new FallingTrees(world, player, bus, { rng: () => 0.5 });
  const hit = { x: 0, y: 10, z: 0, block: block('oak_log'), voxel: 0, face: 0 } as never;
  return { bus, world, player, trees, hit, flags };
}

describe('felling a tree with an axe', () => {
  it('takes several blows, then warns, then falls and comes to rest with its wood on the ground', () => {
    const t = grove(5);
    let blows = 0;
    while (t.trees.chop(t.hit)) {
      blows++;
      if (blows > 50) throw new Error('never fells');
      if (t.trees.trees().length > 0) break;
    }
    expect(blows).toBeGreaterThan(1);
    expect(t.trees.trees()).toHaveLength(1);
    // Still standing during the warning.
    expect(t.world.getBlock(0, 11, 0).key).toBe('oak_log');
    for (let n = 0; n < 60 && t.world.getBlock(0, 11, 0).key === 'oak_log'; n++) t.trees.tick(1 / 60);
    expect(t.world.getBlock(0, 11, 0).key).toBe('air');
    for (let n = 0; n < 60 * 20 && t.trees.trees().length > 0; n++) t.trees.tick(1 / 60);
    expect(t.trees.trees()).toHaveLength(0);
    // Four trunk logs above the stump (the base log is the stump); no canopy in this grove.
    expect(t.player.ground.count('oak_log')).toBe(4);
    expect(t.flags).toContain(FLAG_FELLED_TREE);
  });

  it('keeps a tree with fewer than 3 logs breaking the normal way', () => {
    const t = grove(2);
    expect(t.trees.chop(t.hit)).toBe(false);
    expect(t.trees.trees()).toHaveLength(0);
  });

  it('does nothing without an axe in hand', () => {
    const t = grove(5);
    t.player.inventory.set(t.player.selectedSlot, null);
    expect(t.trees.chop(t.hit)).toBe(false);
  });
});

describe('tree helpers', () => {
  it('finds the base of a trunk from any of its logs', () => {
    const t = grove(5);
    expect(treeBaseOf(t.world, 0, 13, 0, 'oak_log')).toEqual({ x: 0, y: 10, z: 0 });
  });

  it('maps a trunk cell into the body frame: a cell straight up the trunk has lat 0 and s 0', () => {
    const pivot = { px: 0.5, pz: 0.5, py: 10, dx: 1, dz: 0 };
    const l = cellLocal({ x: 0, y: 11, z: 0, key: 'oak_log' }, pivot);
    expect(l.lat).toBeCloseTo(0, 9);
    expect(l.s).toBeCloseTo(0, 9);
    expect(l.a).toBeCloseTo(1.5 - 0, 9);
    expect(rodProfile(2, 1)).toHaveLength(3);
  });
});
