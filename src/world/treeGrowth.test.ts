import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { AIR, CHUNK_SIZE, type Voxel } from '../core/types';
import { chunkCoord } from './chunk';
import { CANOPY, OAK, OAK_BROAD, OAK_BUSH, PINE, PINE_TALL, SNAG, WILLOW, forEachTree, type TreeSite } from './flora';
import { ID } from './ids';
import { terrainFor } from './terrain';
import { TreeAges, createGrowthScratch, growChunk, growthRule, grownTrunk, treeAge, type GrowthHooks } from './treeGrowth';
import { World, type WorldSnapshot } from './world';
import { findSpawn, generateChunk } from './worldgen';

const SEED = 20261121;
const isLeaf = (v: Voxel): boolean => v === ID.oakLeaves || v === ID.pineLeaves;
const isLog = (v: Voxel): boolean => v === ID.oakLog || v === ID.pineLog;
const hooks = (over: Partial<GrowthHooks> = {}): GrowthHooks => ({ standing: () => true, blocked: () => false, changed: () => {}, ...over });

/** Every tree that touches chunk (cx, cz). */
function treesIn(cx: number, cz: number): TreeSite[] {
  const out: TreeSite[] = [];
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  forEachTree(terrainFor(SEED), x0, z0, x0 + CHUNK_SIZE - 1, z0 + CHUNK_SIZE - 1, CANOPY, (s) => out.push({ ...s }));
  return out;
}

/** A chunk near the spawn (within `maxR` chunks) that holds a plain oak whose root lies in it. */
function oakChunk(maxR = 2): { cx: number; cz: number; tree: TreeSite } {
  const spawn = findSpawn(SEED);
  const sx = chunkCoord(spawn.x);
  const sz = chunkCoord(spawn.z);
  for (let r = 0; r <= maxR; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = sx + dx;
        const cz = sz + dz;
        const tree = treesIn(cx, cz).find((s) => s.kind === OAK && chunkCoord(s.x) === cx && chunkCoord(s.z) === cz);
        if (tree) return { cx, cz, tree };
      }
    }
  }
  throw new Error('no oak near the spawn');
}

describe('growth table', () => {
  it('an oak gains blocks by age, reaches its cap on the rule day, and never passes it', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((age) => grownTrunk(OAK, 4, age))).toEqual([4, 4, 5, 6, 6, 7, 8, 8]);
    expect(grownTrunk(OAK, 6, 5)).toBe(7);
    expect(grownTrunk(OAK, 6, 6)).toBe(8);
    expect(grownTrunk(OAK, 4, 1000)).toBe(8);
  });

  it('a tree already at or past the cap keeps its height; a negative age is no age', () => {
    expect(grownTrunk(OAK, 9, 3)).toBe(9);
    expect(grownTrunk(OAK, 4, -3)).toBe(4);
    expect(grownTrunk(PINE, 5, 10)).toBe(12);
    expect(grownTrunk(PINE_TALL, 9, 10)).toBe(14);
  });

  it('snags never grow', () => {
    expect(growthRule(SNAG)).toBeUndefined();
    expect(grownTrunk(SNAG, 4, 10)).toBe(4);
  });

  it('for every growing kind the trunk never shrinks, rises by age and stops at its cap', () => {
    for (const kind of [OAK, OAK_BUSH, OAK_BROAD, PINE, PINE_TALL, WILLOW]) {
      const cap = growthRule(kind)?.cap ?? 0;
      for (let trunk = 1; trunk <= 14; trunk++) {
        let last = trunk;
        for (let age = 0; age <= 40; age++) {
          const h = grownTrunk(kind, trunk, age);
          expect(h, `kind ${kind} trunk ${trunk} age ${age}`).toBeGreaterThanOrEqual(last);
          expect(h).toBeLessThanOrEqual(Math.max(trunk, cap));
          last = h;
        }
      }
    }
  });

  it('a tree planted on day 0 (world creation) is 0 days old on day 1 and one day older each day', () => {
    expect(treeAge(0, 1)).toBe(0);
    expect(treeAge(0, 2)).toBe(1);
    expect(treeAge(0, 10)).toBe(9);
    expect(treeAge(3, 2)).toBe(0);
  });
});

describe('TreeAges', () => {
  it('saves and loads the planting days, and refuses malformed data without losing what it had', () => {
    const ages = new TreeAges();
    ages.plant(10, -4, 0);
    ages.plant(-300, 7, 5);
    const saved = ages.toJSON();
    expect(saved).toEqual([-300, 7, 5, 10, -4, 0]);
    const copy = new TreeAges();
    copy.load(JSON.parse(JSON.stringify(saved)));
    expect(copy.plantedOn(10, -4)).toBe(0);
    expect(copy.plantedOn(-300, 7)).toBe(5);
    expect(copy.plantedOn(1, 1)).toBeUndefined();
    for (const bad of ['x', [1, 2], [1, 2, -1], [1.5, 2, 3], [1, 2, '3']]) {
      expect(() => copy.load(bad)).toThrow();
    }
    expect(copy.size).toBe(2);
  });
});

describe('growChunk on generated terrain', () => {
  it('writes only into air or over the tree\'s own leaves, on the trees it grows', () => {
    const { cx, cz } = oakChunk();
    const base = generateChunk(SEED, cx, cz);
    const scratch = createGrowthScratch();
    const ages = new TreeAges();
    const v = base.slice();
    expect(growChunk(terrainFor(SEED), cx, cz, v, 1, ages, hooks(), scratch, [])).toBe(0);
    expect(v).toEqual(base);

    const written = growChunk(terrainFor(SEED), cx, cz, v, 7, ages, hooks(), scratch, []);
    expect(written).toBeGreaterThan(0);
    let changed = 0;
    for (let i = 0; i < v.length; i++) {
      if (v[i] === base[i]) continue;
      changed++;
      if (base[i] === AIR) expect(isLog(v[i]) || isLeaf(v[i])).toBe(true);
      else {
        expect(isLeaf(base[i])).toBe(true);
        expect(isLog(v[i])).toBe(true);
      }
    }
    expect(changed).toBe(written);
  });

  it('a day-by-day walk ends exactly where a single growth to the same day does', () => {
    const { cx, cz } = oakChunk();
    const base = generateChunk(SEED, cx, cz);
    const scratch = createGrowthScratch();
    const ages = new TreeAges();
    const walk = base.slice();
    const walkRecord: number[] = [];
    for (let day = 1; day <= 9; day++) growChunk(terrainFor(SEED), cx, cz, walk, day, ages, hooks(), scratch, walkRecord);

    // The same ages as a saved world would hold them (planted on day 0), grown straight to day 9.
    const jump = base.slice();
    growChunk(terrainFor(SEED), cx, cz, base.slice(), 1, ages, hooks(), scratch, []);
    growChunk(terrainFor(SEED), cx, cz, jump, 9, ages, hooks(), scratch, []);
    expect(walk).toEqual(jump);
  });

  it('a felled tree, or a cell the player changed, is never grown into', () => {
    const { cx, cz } = oakChunk();
    const base = generateChunk(SEED, cx, cz);
    const scratch = createGrowthScratch();
    const felled = base.slice();
    expect(growChunk(terrainFor(SEED), cx, cz, felled, 7, new TreeAges(), hooks({ standing: () => false }), scratch, [])).toBe(0);
    expect(felled).toEqual(base);
    const owned = base.slice();
    expect(growChunk(terrainFor(SEED), cx, cz, owned, 7, new TreeAges(), hooks({ blocked: () => true }), scratch, [])).toBe(0);
    expect(owned).toEqual(base);
  });

  it('going back a day puts the grown voxels back: the record restores the chunk to its generated state', () => {
    const { cx, cz } = oakChunk();
    const base = generateChunk(SEED, cx, cz);
    const scratch = createGrowthScratch();
    const ages = new TreeAges();
    const v = base.slice();
    const record: number[] = [];
    growChunk(terrainFor(SEED), cx, cz, v, 1, ages, hooks(), scratch, record);
    growChunk(terrainFor(SEED), cx, cz, v, 7, ages, hooks(), scratch, record);
    expect(v).not.toEqual(base);
    // Back to day 1: the record undoes the growth, and the trees are age 0 again.
    growChunk(terrainFor(SEED), cx, cz, v, 1, ages, hooks(), scratch, record);
    expect(v).toEqual(base);
  });
});

describe('tree growth in the world', () => {
  it('grows the trees of loaded chunks when the day changes, records no edits, and the save reloads the same voxels', () => {
    let day = 1;
    const world = new World(SEED, createBus());
    world.setDayProvider(() => day);
    const spawn = findSpawn(SEED);
    world.ensureLoadedAround(spawn.x, spawn.z, 2);
    const { cx, cz, tree } = oakChunk();
    const before = world.chunkVoxels(cx, cz)!.slice();
    const editsBefore = JSON.stringify(world.toJSON().edits);

    day = 9;
    world.update(spawn.x, spawn.z, 0, 0);
    const after = world.chunkVoxels(cx, cz)!;
    let changed = 0;
    for (let i = 0; i < before.length; i++) if (after[i] !== before[i]) changed++;
    expect(changed).toBeGreaterThan(0);
    expect(JSON.stringify(world.toJSON().edits)).toBe(editsBefore);

    // The trunk of a 4..6 block oak has grown by day 9: the block just above its old top is a log now.
    const topY = tree.base + tree.trunk + 1;
    expect(isLog(after[(topY * CHUNK_SIZE + (tree.z & 15)) * CHUNK_SIZE + (tree.x & 15)])).toBe(true);

    const saved = JSON.parse(JSON.stringify(world.toJSON())) as WorldSnapshot & { extras: Record<string, unknown> };
    expect((saved.extras.treeAges as number[]).length).toBeGreaterThan(0);
    const reloaded = World.fromJSON(saved, createBus());
    reloaded.setDayProvider(() => 9);
    reloaded.ensureLoadedAround(spawn.x, spawn.z, 2);
    expect(reloaded.chunkVoxels(cx, cz)).toEqual(world.chunkVoxels(cx, cz));
  });

  it('a tree whose trunk was cut stops growing', () => {
    let day = 1;
    const world = new World(SEED, createBus());
    world.setDayProvider(() => day);
    const spawn = findSpawn(SEED);
    world.ensureLoadedAround(spawn.x, spawn.z, 2);
    const { cx, cz, tree } = oakChunk();
    world.setVoxel(tree.x, tree.base + 1, tree.z, AIR);
    const column = (): Voxel[] => {
      const v = world.chunkVoxels(cx, cz)!;
      const out: Voxel[] = [];
      for (let y = tree.base + 1; y <= tree.base + 10; y++) out.push(v[(y * CHUNK_SIZE + (tree.z & 15)) * CHUNK_SIZE + (tree.x & 15)]);
      return out;
    };
    const felledColumn = column();
    day = 9;
    world.update(spawn.x, spawn.z, 0, 0);
    expect(column()).toEqual(felledColumn);
  });
});
