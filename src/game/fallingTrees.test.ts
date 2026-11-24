import { defaultSettings } from '../core/context';
import { sanitizeSettings } from '../save/document';
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FLAG_FELLED_TREE } from '../core/constants';
import { block } from '../core/registry';
import { FakeWorld } from './fakeWorld';
import { FallingTrees, cellLocal, treeBaseOf } from './fallingTrees';
import { PlayerState } from './playerState';
import { rodProfile } from './treeBody';
import { pieceSizes } from './treeFell';

/** A grass floor at y = 9 and a straight oak of `height` logs standing on it (base at y = 10). */
function grove(height: number, options: { autoBuck?: boolean } = {}) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-12, 9, -12, 12, 9, 12, 'grass');
  world.fill(0, 10, 0, 0, 9 + height, 0, 'oak_log');
  const player = new PlayerState(bus, { x: -4.5, y: 10, z: 0.5 });
  player.inventory.set(player.selectedSlot, { item: 'steel_axe', count: 1, durability: 700 });
  const flags: string[] = [];
  bus.on('flag', (e) => flags.push(e.flag));
  const trees = new FallingTrees(world, player, bus, { rng: () => 0.5, autoBuck: () => options.autoBuck ?? false });
  const hit = { x: 0, y: 10, z: 0, block: block('oak_log'), voxel: 0, face: 0 } as never;
  return { bus, world, player, trees, hit, flags };
}

/** Advances the falling trees by `seconds` at 60 Hz. */
function run(t: ReturnType<typeof grove>, seconds: number): void {
  for (let n = 0; n < seconds * 60; n++) t.trees.tick(1 / 60);
}

/** Blows until the tree is given its warning (the trunk is still standing). */
function fell(t: ReturnType<typeof grove>): void {
  for (let n = 0; n < 50 && t.trees.trees().length === 0; n++) t.trees.chop(t.hit);
}

describe('felling a tree with an axe', () => {
  it('takes several blows, then warns, then falls, and lies as a fallen log', () => {
    const t = grove(5);
    let blows = 1;
    while (t.trees.chop(t.hit) && t.trees.trees().length === 0 && blows < 50) blows++;
    expect(blows).toBeGreaterThan(1);
    expect(t.trees.trees()).toHaveLength(1);
    // Still standing during the warning.
    expect(t.world.getBlock(0, 11, 0).key).toBe('oak_log');
    run(t, 0.95);
    expect(t.world.getBlock(0, 11, 0).key).toBe('air');
    for (let n = 0; n < 60 * 20 && t.trees.trees().length > 0; n++) t.trees.tick(1 / 60);
    expect(t.trees.trees()).toHaveLength(0);
    expect(t.trees.logs()).toHaveLength(1);
    // Four trunk logs above the stump (the base log is the stump); no crown in this grove.
    expect(t.trees.logs()[0].length).toBe(4);
    expect(t.flags).toContain(FLAG_FELLED_TREE);
  });

  it('cuts the fallen log into pieces: each axe cut drops its piece, and all the wood comes out', () => {
    const t = grove(5);
    fell(t);
    run(t, 25);
    const log = t.trees.logs()[0];
    const sizes = pieceSizes(log.length);
    let cuts = 0;
    while (t.trees.logs().length > 0) {
      expect(t.trees.chop({ x: 0, y: 0, z: 0, block: block('oak_log'), voxel: -1 - log.id } as never)).toBe(true);
      cuts++;
      if (cuts > 20) throw new Error('never cut up');
    }
    expect(cuts).toBe(sizes.length);
    expect(t.player.ground.count('oak_log')).toBe(4);
  });

  it('with Auto-buck the landed log is cut into pieces at once', () => {
    const t = grove(5, { autoBuck: true });
    fell(t);
    run(t, 25);
    expect(t.trees.logs()).toHaveLength(0);
    expect(t.player.ground.count('oak_log')).toBe(4);
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
    expect(l.a).toBeCloseTo(1.5, 9);
    expect(rodProfile(2, 1)).toHaveLength(3);
  });
});

describe('the Auto-buck setting', () => {
  it('is off by default, saved on and read back', () => {
    expect(defaultSettings(false).autoBuck).toBe(false);
    expect(sanitizeSettings({ autoBuck: true }).autoBuck).toBe(true);
    expect(sanitizeSettings({ autoBuck: "yes" }).autoBuck).toBe(false);
  });
});
