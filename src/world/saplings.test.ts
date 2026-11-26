import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { mulberry32 } from '../core/math';
import { block, blockId } from '../core/registry';
import { AIR, WORLD_HEIGHT, makeVoxel, voxelId } from '../core/types';
import { LEAF_SAPLING_CHANCE } from '../content/blocks';
import { CUT_SAPLING_CHANCE, FallenLogs } from '../game/fallenLogs';
import { FakeWorld } from '../game/fakeWorld';
import { rollDrops } from '../game/mining';
import { growthRule } from './treeGrowth';
import {
  SAPLING_DAYS, START_TRUNK, STUMP_DAYS, Saplings, plantedTree, stumpSprouts,
} from './saplings';
import { World, type WorldSnapshot } from './world';
import { findSpawn } from './worldgen';
import { OAK, PINE } from './flora';

const SEED = 20261121;
const OAK_SAPLING = blockId('oak_sapling');
const PINE_SAPLING = blockId('pine_sapling');
const OAK_LOG = blockId('oak_log');
const OAK_STUMP = blockId('oak_stump');
const GRASS = blockId('grass');

/** Share of `n` rolls of a block's drops that include `item`. */
function dropShare(key: string, item: string, n: number): number {
  const rng = mulberry32(7);
  const def = block(key);
  let hits = 0;
  for (let i = 0; i < n; i++) if (rollDrops(def, rng).some((d) => d.item === item)) hits++;
  return hits / n;
}

function rig(day = 1) {
  const clock = { day };
  const world = new World(SEED, createBus());
  world.setDayProvider(() => clock.day);
  const spawn = findSpawn(SEED);
  world.ensureLoadedAround(spawn.x, spawn.z, 2);
  const advance = (days: number): void => {
    clock.day += days;
    world.update(spawn.x, spawn.z, 0, 0);
    world.finishGrowth();
  };
  return { world, clock, spawn, advance };
}

/** Top non-air y of a column. */
function top(world: World, x: number, z: number): number {
  for (let y = WORLD_HEIGHT - 1; y > 0; y--) if (world.getVoxel(x, y, z) !== AIR) return y;
  return 0;
}

/** Grass cells near the spawn with open sky over a 7x7 patch, so a tree can grow there. */
function openGrass(world: World, spawn: { x: number; z: number }, count: number, gap = 9): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (let r = 0; r < 24 && out.length < count; r++) {
    for (let dz = -r; dz <= r && out.length < count; dz++) {
      for (let dx = -r; dx <= r && out.length < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = Math.floor(spawn.x) + dx;
        const z = Math.floor(spawn.z) + dz;
        const y = top(world, x, z);
        if (voxelId(world.getVoxel(x, y, z)) !== GRASS) continue;
        if (out.some((c) => Math.abs(c.x - x) < gap && Math.abs(c.z - z) < gap)) continue;
        let open = true;
        for (let ox = -3; ox <= 3 && open; ox++) {
          for (let oz = -3; oz <= 3 && open; oz++) if (top(world, x + ox, z + oz) > y + 1) open = false;
        }
        if (open) out.push({ x, y: y + 1, z });
      }
    }
  }
  expect(out.length).toBe(count);
  return out;
}

describe('sapling drops', () => {
  it('leaves drop their own sapling about LEAF_SAPLING_CHANCE of the time', () => {
    const oak = dropShare('oak_leaves', 'oak_sapling', 20000);
    const pine = dropShare('pine_leaves', 'pine_sapling', 20000);
    expect(Math.abs(oak - LEAF_SAPLING_CHANCE)).toBeLessThan(0.01);
    expect(Math.abs(pine - LEAF_SAPLING_CHANCE)).toBeLessThan(0.01);
    expect(dropShare('oak_leaves', 'pine_sapling', 2000)).toBe(0);
  });

  it('a cut of a fallen log gives its species sapling about CUT_SAPLING_CHANCE of the time', () => {
    const logs = new FallenLogs(new FakeWorld(createBus()));
    const rng = mulberry32(11);
    let cuts = 0;
    let saplings = 0;
    for (let n = 0; n < 4000; n++) {
      const log = logs.add({ logKey: 'pine_log', length: 1, ox: 0, oy: 0.5, oz: 0, dx: 1, dz: 0, theta: Math.PI / 2 });
      const cut = logs.cut(log.id, rng)!;
      cuts++;
      saplings += cut.drops.find((d) => d.item === 'pine_sapling')?.count ?? 0;
      expect(cut.drops.some((d) => d.item === 'oak_sapling')).toBe(false);
    }
    expect(Math.abs(saplings / cuts - CUT_SAPLING_CHANCE)).toBeLessThan(0.025);
    // A roll under the chance always gives one.
    const log = logs.add({ logKey: 'oak_log', length: 2, ox: 0, oy: 0.5, oz: 0, dx: 1, dz: 0, theta: Math.PI / 2 });
    expect(logs.cut(log.id, () => 0.01)?.drops).toContainEqual({ item: 'oak_sapling', count: 1 });
  });
});

describe('the sapling block', () => {
  it('is a cross plant placed on grass or dirt that drops itself, one per species', () => {
    for (const key of ['oak_sapling', 'pine_sapling']) {
      const def = block(key);
      expect(def.shape).toBe('cross');
      expect(def.solid).toBe(false);
      expect(def.placeOn).toEqual(['grass', 'dirt']);
      expect(rollDrops(def, () => 0.5)).toEqual([{ item: key, count: 1 }]);
    }
  });
});

describe('planted trees', () => {
  it('the young tree starts at START_TRUNK after SAPLING_DAYS and grows by the species rule', () => {
    const p = { x: 3, y: 40, z: 5, species: 0, day: 4 };
    expect(plantedTree(p, 4)).toBeNull();
    expect(plantedTree(p, 4 + SAPLING_DAYS - 1)).toBeNull();
    const young = plantedTree(p, 4 + SAPLING_DAYS)!;
    expect(young).toMatchObject({ x: 3, z: 5, base: 39, kind: OAK, trunk: START_TRUNK });
    const grown = plantedTree(p, 4 + SAPLING_DAYS + 100)!;
    expect(grown.trunk).toBe(growthRule(OAK)!.cap);
    expect(plantedTree({ ...p, species: 1 }, 4 + SAPLING_DAYS)!.kind).toBe(PINE);
  });

  it('placing a sapling plants it; it grows into a tree; breaking a sapling forgets it', () => {
    const { world, clock, spawn, advance } = rig(3);
    const [a, b] = openGrass(world, spawn, 2);
    world.setVoxel(a.x, a.y, a.z, makeVoxel(OAK_SAPLING));
    world.setVoxel(b.x, b.y, b.z, makeVoxel(PINE_SAPLING));
    expect(world.saplings.plantingAt(a.x, a.y, a.z)).toEqual({ ...a, species: 0, day: 3 });
    world.setVoxel(b.x, b.y, b.z, AIR);
    expect(world.saplings.plantingAt(b.x, b.y, b.z)).toBeUndefined();

    advance(SAPLING_DAYS - 1);
    expect(voxelId(world.getVoxel(a.x, a.y, a.z))).toBe(OAK_SAPLING);
    expect(world.getVoxel(a.x, a.y + 1, a.z)).toBe(AIR);

    advance(1);
    expect(clock.day).toBe(3 + SAPLING_DAYS);
    for (let y = a.y; y < a.y + START_TRUNK; y++) expect(voxelId(world.getVoxel(a.x, y, a.z))).toBe(OAK_LOG);
    const leaves = (): number => {
      let n = 0;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let y = a.y; y < a.y + 16; y++) {
        if (voxelId(world.getVoxel(a.x + dx, y, a.z + dz)) === blockId('oak_leaves')) n++;
      }
      return n;
    };
    expect(leaves()).toBeGreaterThan(10);

    advance(10);
    const height = (): number => {
      let y = a.y;
      while (voxelId(world.getVoxel(a.x, y, a.z)) === OAK_LOG) y++;
      return y - a.y;
    };
    expect(height()).toBe(growthRule(OAK)!.cap);
  });

  it('a planted tree is the same after a save round trip, and old saves without saplings load', () => {
    const { world, spawn, advance } = rig(2);
    const [a] = openGrass(world, spawn, 1);
    world.setVoxel(a.x, a.y, a.z, makeVoxel(OAK_SAPLING));
    advance(SAPLING_DAYS + 2);
    const saved = JSON.parse(JSON.stringify(world.toJSON())) as WorldSnapshot & { extras: Record<string, unknown> };
    expect(saved.extras.saplings).toEqual({ plants: [a.x, a.y, a.z, 0, 2], stumps: [] });

    const reloaded = World.fromJSON(saved, createBus());
    reloaded.setDayProvider(() => 2 + SAPLING_DAYS + 2);
    reloaded.ensureLoadedAround(spawn.x, spawn.z, 2);
    expect(reloaded.saplings.plantingAt(a.x, a.y, a.z)).toEqual({ ...a, species: 0, day: 2 });
    for (let y = a.y - 1; y < a.y + 20; y++) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) expect(reloaded.getVoxel(a.x + dx, y, a.z + dz)).toBe(world.getVoxel(a.x + dx, y, a.z + dz));
      }
    }

    // Nothing planted: nothing saved under the key, and a save without it loads with no plantings.
    const empty = rig().world;
    expect('saplings' in (JSON.parse(JSON.stringify(empty.toJSON())).extras ?? {})).toBe(false);
    const old = World.fromJSON(JSON.parse(JSON.stringify(empty.toJSON())), createBus());
    expect(old.saplings.size).toBe(0);
  });

  it('damaged sapling data is kept aside and the world loads with none', () => {
    const { world } = rig();
    const snap = JSON.parse(JSON.stringify(world.toJSON())) as WorldSnapshot;
    snap.extras = { ...snap.extras, saplings: { plants: [1, 2, 3] } };
    const loaded = World.fromJSON(snap, createBus());
    expect(loaded.failedExtras()).toContain('saplings');
    expect(loaded.saplings.size).toBe(0);
  });
});

describe('stumps sprout', () => {
  it('some felling stumps sprout a sapling after STUMP_DAYS, and it grows into a tree', () => {
    const { world, spawn, advance } = rig(5);
    const cells = openGrass(world, spawn, 12, 4);
    const sprouting = cells.find((c) => stumpSprouts(SEED, c.x, c.y, c.z))!;
    const barren = cells.find((c) => !stumpSprouts(SEED, c.x, c.y, c.z))!;
    expect(sprouting && barren).toBeTruthy();
    for (const c of [sprouting, barren]) world.setVoxel(c.x, c.y, c.z, makeVoxel(OAK_STUMP));
    expect(world.saplings.stumpCount).toBe(2);

    advance(STUMP_DAYS - 1);
    expect(voxelId(world.getVoxel(sprouting.x, sprouting.y, sprouting.z))).toBe(OAK_STUMP);

    advance(1);
    expect(voxelId(world.getVoxel(sprouting.x, sprouting.y, sprouting.z))).toBe(OAK_SAPLING);
    expect(world.saplings.plantingAt(sprouting.x, sprouting.y, sprouting.z)?.day).toBe(5 + STUMP_DAYS);
    expect(voxelId(world.getVoxel(barren.x, barren.y, barren.z))).toBe(OAK_STUMP);
    expect(world.saplings.stumpCount).toBe(0);

    advance(SAPLING_DAYS);
    expect(voxelId(world.getVoxel(sprouting.x, sprouting.y + 1, sprouting.z))).toBe(OAK_LOG);
  });

  it('a stump chopped before its time is forgotten', () => {
    const { world, spawn } = rig();
    const [c] = openGrass(world, spawn, 1);
    world.setVoxel(c.x, c.y, c.z, makeVoxel(OAK_STUMP));
    world.setVoxel(c.x, c.y, c.z, AIR);
    expect(world.saplings.stumpCount).toBe(0);
  });

  it('the roll is fixed per cell and about STUMP_SPROUT_CHANCE of stumps sprout', () => {
    let n = 0;
    for (let i = 0; i < 4000; i++) if (stumpSprouts(SEED, i, 30, i * 7)) n++;
    expect(Math.abs(n / 4000 - 0.4)).toBeLessThan(0.03);
    expect(stumpSprouts(SEED, 5, 30, 9)).toBe(stumpSprouts(SEED, 5, 30, 9));
  });
});

describe('Saplings save data', () => {
  it('round-trips and rejects malformed lists', () => {
    const s = new Saplings();
    s.plant(-4, 33, 9, 1, 6);
    s.addStump(2, 30, -7, 0, 3);
    const copy = new Saplings();
    copy.load(JSON.parse(JSON.stringify(s.toJSON())));
    expect(copy.toJSON()).toEqual(s.toJSON());
    expect(() => copy.load({ plants: [1, 2, 3, 9, 0] })).toThrow();
    expect(copy.size).toBe(1);
  });
});
