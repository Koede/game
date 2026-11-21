import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { mulberry32 } from '../core/math';
import { blockId } from '../core/registry';
import { AIR, makeVoxel, voxelId, type Voxel } from '../core/types';
import { LEAF_DELAY_MAX, LEAF_LOG_DISTANCE, LEAF_MAX_PER_TICK, LeafDecay, isLeafVoxel, rollLeafDrops } from './leafDecay';
import { World } from './world';

const LOG = makeVoxel(blockId('oak_log'));
const LEAF = makeVoxel(blockId('oak_leaves'));
const STONE = makeVoxel(blockId('stone'));
const FLOOR = 80;
const Y = FLOOR + 1;

function makeWorld(seed = 5150, bus = createBus()): World {
  const world = new World(seed, bus);
  world.ensureLoadedAround(0, 0, 2);
  for (let z = -14; z <= 14; z++) for (let x = -14; x <= 14; x++) world.setVoxel(x, FLOOR, z, STONE, 'load');
  return world;
}

/** Scenery is written as 'load' edits: it wakes nothing, like a world restored from a save. */
function put(world: World, x: number, y: number, z: number, v: Voxel): void {
  world.setVoxel(x, y, z, v, 'load');
}

/** A trunk of `height` logs at (tx, tz) with a 3x3 crown of leaves two layers thick on top. */
function tree(world: World, tx: number, tz: number, height = 4): void {
  for (let y = 0; y < height; y++) put(world, tx, Y + y, tz, LOG);
  for (let y = height - 1; y <= height; y++) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (world.getVoxel(tx + dx, Y + y, tz + dz) === AIR) put(world, tx + dx, Y + y, tz + dz, LEAF);
  }
}

function cutTree(world: World, tx: number, tz: number, height = 4): void {
  for (let y = 0; y < height; y++) world.setVoxel(tx, Y + y, tz, AIR, 'player');
}

function leaves(world: World, x0: number, x1: number, z0 = -14, z1 = 14): number {
  let n = 0;
  for (let y = Y; y < Y + 12; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (isLeafVoxel(world.getVoxel(x, y, z))) n++;
  return n;
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.leaves.tick();
}

describe('leaf decay', () => {
  it('leaves stay while the log stands, even after a long time', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    const before = leaves(world, -3, 3);
    run(world, 400);
    expect(leaves(world, -3, 3)).toBe(before);
    expect(world.leaves.stats().pending).toBe(0);
  });

  it('mining the only log makes the whole crown fall away after a delay, not at once', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    const before = leaves(world, -3, 3);
    expect(before).toBeGreaterThan(10);
    cutTree(world, 0, 0);
    expect(leaves(world, -3, 3)).toBe(before);
    run(world, 3);
    expect(leaves(world, -3, 3)).toBe(before);
    run(world, LEAF_DELAY_MAX);
    expect(leaves(world, -3, 3)).toBeLessThan(before);
    run(world, 400);
    expect(leaves(world, -3, 3)).toBe(0);
    expect(world.leaves.stats().pending).toBe(0);
  });

  it('a crown peels over several ticks (a few steps), not all in one', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    cutTree(world, 0, 0);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      world.leaves.tick();
      seen.add(leaves(world, -3, 3));
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it('leaves next to another, still supported log stay', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    for (let y = 0; y < 4; y++) put(world, 2, Y + y, 0, LOG);
    cutTree(world, 0, 0);
    run(world, 600);
    expect(leaves(world, -3, 3)).toBeGreaterThan(0);
    // Whatever is left is within the rule's distance of a standing log.
    for (let y = Y; y < Y + 8; y++) for (let z = -3; z <= 3; z++) for (let x = -3; x <= 6; x++) {
      if (isLeafVoxel(world.getVoxel(x, y, z))) expect(world.leaves.supported(x, y, z)).toBe(true);
    }
    // The leaves touching the second trunk are all still there.
    for (let y = Y + 3; y <= Y + 4; y++) expect(isLeafVoxel(world.getVoxel(1, y, 0))).toBe(true);
  });

  it('keeps leaves exactly LEAF_LOG_DISTANCE steps from a log and drops the one beyond', () => {
    const world = makeWorld();
    put(world, 0, Y, 0, LOG);
    for (let i = 1; i <= LEAF_LOG_DISTANCE + 1; i++) put(world, i, Y, 0, LEAF);
    expect(world.leaves.supported(LEAF_LOG_DISTANCE, Y, 0)).toBe(true);
    expect(world.leaves.supported(LEAF_LOG_DISTANCE + 1, Y, 0)).toBe(false);
  });

  it('cutting a log leaves unrelated trees alone', () => {
    const world = makeWorld();
    tree(world, -8, 0);
    tree(world, 8, 0);
    const right = leaves(world, 4, 12);
    cutTree(world, -8, 0);
    run(world, 600);
    expect(leaves(world, 4, 12)).toBe(right);
    expect(leaves(world, -12, -4)).toBe(0);
  });

  it('removing a leaf (not a log) wakes nothing', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    world.setVoxel(1, Y + 3, 0, AIR, 'player');
    expect(world.leaves.stats().pending).toBe(0);
  });

  it('does not decay leaves whose neighbourhood is not loaded', () => {
    const far = 300;
    let removed = 0;
    const sim = new LeafDecay({
      getVoxel: (x, y, z) => (x === far && y === Y && z === 0 ? LEAF : AIR),
      isLoaded: (x) => x !== far + 1,
      setVoxel: () => { removed++; return true; },
      decayed: () => undefined,
    }, mulberry32(1));
    sim.changed(far - 1, Y, 0, LOG, AIR, 'player');
    for (let i = 0; i < 100; i++) sim.tick();
    expect(removed).toBe(0);
    expect(sim.stats().checked).toBeGreaterThan(0);
  });

  it('is deterministic with a seeded rng, and the world seed changes the timing', () => {
    const trace = (seed: number): string => {
      const world = makeWorld(seed);
      tree(world, 0, 0, 5);
      cutTree(world, 0, 0, 5);
      const out: number[] = [];
      for (let i = 0; i < 80; i++) {
        world.leaves.tick();
        out.push(leaves(world, -3, 3));
      }
      return out.join(',');
    };
    expect(trace(1)).toBe(trace(1));
    expect(trace(1)).not.toBe(trace(2));
  });

  it('emits one event per decayed leaf with drops from the leaf table', () => {
    const bus = createBus();
    const world = makeWorld(5150, bus);
    tree(world, 0, 0);
    const events: Array<{ drops: Array<{ item: string; count: number }> }> = [];
    bus.on('leaves:decayed', (e) => events.push(e));
    const before = leaves(world, -3, 3);
    cutTree(world, 0, 0);
    run(world, 400);
    expect(events).toHaveLength(before);
    const items = new Set(events.flatMap((e) => e.drops.map((d) => d.item)));
    expect([...items].every((i) => i === 'fiber' || i === 'stick')).toBe(true);
    expect(items.size).toBeGreaterThan(0);
  });

  it('rollLeafDrops follows the table: chance and counts', () => {
    expect(rollLeafDrops(LEAF, () => 0.99)).toEqual([]);
    expect(rollLeafDrops(LEAF, () => 0)).toEqual([{ item: 'fiber', count: 1 }, { item: 'stick', count: 1 }]);
  });

  it('looks at no more than LEAF_MAX_PER_TICK leaves a tick; the rest carry over', () => {
    const world = makeWorld();
    put(world, 0, Y, 0, LOG);
    for (let z = -5; z <= 5; z++) for (let x = -5; x <= 5; x++) put(world, x, Y + 1, z, LEAF);
    world.setVoxel(0, Y, 0, AIR, 'player');
    let worst = 0;
    for (let i = 0; i < 300; i++) {
      const c0 = world.leaves.stats().checked;
      world.leaves.tick();
      worst = Math.max(worst, world.leaves.stats().checked - c0);
    }
    expect(worst).toBeLessThanOrEqual(LEAF_MAX_PER_TICK);
    expect(leaves(world, -6, 6, -6, 6)).toBe(0);
  });

  it('pending work survives a snapshot round trip and bad data is refused', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    cutTree(world, 0, 0);
    const snap = world.leaves.toJSON();
    expect(snap.queue.length).toBeGreaterThan(0);
    const fresh = new LeafDecay({
      getVoxel: (x, y, z) => world.getVoxel(x, y, z),
      isLoaded: (x, z) => world.isLoaded(x, z),
      setVoxel: (x, y, z, v, s) => world.setVoxel(x, y, z, v, s),
      decayed: () => undefined,
    }, mulberry32(9));
    fresh.load(JSON.parse(JSON.stringify(snap)));
    expect(fresh.stats().pending).toBe(snap.queue.length / 4);
    for (let i = 0; i < 400; i++) fresh.tick();
    expect(leaves(world, -3, 3)).toBe(0);
    expect(() => fresh.load({ queue: [1, 2, 3] })).toThrow();
    expect(() => fresh.load(undefined)).not.toThrow();
  });

  it('world snapshots carry the pending decay', () => {
    const world = makeWorld();
    tree(world, 0, 0);
    cutTree(world, 0, 0);
    const snap = world.toJSON();
    expect(snap.leaves?.queue.length ?? 0).toBeGreaterThan(0);
    const again = World.fromJSON(JSON.parse(JSON.stringify(snap)), createBus());
    expect(again.leaves.stats().pending).toBeGreaterThan(0);
  });

  it('natural woodland sheds nothing until a log is taken', () => {
    const world = new World(4242, createBus());
    world.ensureLoadedAround(0, 0, 3);
    const sp = world.spawnPoint();
    let logs = 0;
    for (let y = 0; y < 60; y++) for (let z = sp.z - 20; z < sp.z + 20; z++) for (let x = sp.x - 20; x < sp.x + 20; x++) {
      const id = voxelId(world.getVoxel(x, y, z));
      if (id === blockId('oak_log') || id === blockId('pine_log')) logs++;
    }
    expect(logs).toBeGreaterThan(0);
    run(world, 200);
    expect(world.leaves.stats().removed).toBe(0);
  });
});
