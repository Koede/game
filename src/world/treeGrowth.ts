/**
 * Tree growth (docs/api/tree-growth.md). A tree is generated as before (flora.ts); on top of that, a tree that
 * has stood since day `planted` is drawn again at its grown height, and only the voxels that shape adds are
 * written: into air, or a log over one of the tree's own leaves where the trunk passes through the old crown.
 * Nothing the player changed (edits) is touched, and a tree that was felled, or is missing any part of its
 * trunk, stops growing where it stands.
 *
 * Growth is a pure function of (kind, generated trunk, age in days). The only saved state is the planting day
 * of each tree that has been seen (TreeAges); the voxels come back from the seed, so saves stay small.
 */
import { AIR, CHUNK_SIZE, CHUNK_VOLUME, type Voxel } from '../core/types';
import { ID } from './ids';
import { CANOPY, OAK, OAK_BROAD, OAK_BUSH, PINE, PINE_TALL, WILLOW, drawTree, forEachTree, type TreeSite } from './flora';
import type { Terrain } from './terrain';

export interface GrowthRule {
  /** Trunk height (blocks above the ground) the tree reaches. */
  cap: number;
  /** Days from planting to the cap; the trunk gains blocks evenly over these days. */
  days: number;
}

/** Species that grow. Snags are dead wood and never grow. */
const RULES: Partial<Record<number, GrowthRule>> = {
  [OAK]: { cap: 8, days: 6 },
  [OAK_BUSH]: { cap: 3, days: 4 },
  [OAK_BROAD]: { cap: 10, days: 10 },
  [PINE]: { cap: 12, days: 10 },
  [PINE_TALL]: { cap: 14, days: 10 },
  [WILLOW]: { cap: 8, days: 8 },
};

export const growthRule = (kind: number): GrowthRule | undefined => RULES[kind];

/**
 * Trunk height after `age` days: the generated `trunk` plus an even share of the gap to the cap, reached on day
 * `days`. Never shrinks, never passes the cap, and a tree already at the cap (or of a kind that does not grow)
 * keeps its height.
 */
export function grownTrunk(kind: number, trunk: number, age: number): number {
  const rule = RULES[kind];
  if (!rule || age <= 0 || trunk >= rule.cap) return trunk;
  const steps = Math.min(Math.floor(age), rule.days);
  return trunk + Math.floor(((rule.cap - trunk) * steps) / rule.days);
}

/** The tree as drawn at `age` days: the same tree, with its trunk (and crown, which hangs off the top) grown. */
export function grownSite(s: TreeSite, age: number): TreeSite {
  const trunk = grownTrunk(s.kind, s.trunk, age);
  const perLevel = s.kind === OAK_BROAD ? 4 : 1;
  return { ...s, trunk, logs: s.logs + (trunk - s.trunk) * perLevel };
}

/**
 * Age in days on clock day `day` (1-based, the first day is 1) of a tree planted on day `planted`. Trees that
 * existed at world creation are planted on day 0, so on day 1 they are 0 days old.
 */
export const treeAge = (planted: number, day: number): number => Math.max(0, day - 1 - planted);

const OFFSET = 0x1000000;
const SPAN = 0x2000000;
const keyOf = (x: number, z: number): number => (x + OFFSET) * SPAN + (z + OFFSET);

/** Planting day of every tree that has been seen standing. Saved as flat [x, z, planted, ...] numbers. */
export class TreeAges {
  private readonly plants = new Map<number, number>();

  get size(): number {
    return this.plants.size;
  }

  /** Planting day of the tree rooted at (x, z), or undefined when it has never been seen standing. */
  plantedOn(x: number, z: number): number | undefined {
    return this.plants.get(keyOf(x, z));
  }

  plant(x: number, z: number, day: number): void {
    this.plants.set(keyOf(x, z), day);
  }

  clear(): void {
    this.plants.clear();
  }

  toJSON(): number[] {
    const keys = [...this.plants.keys()].sort((a, b) => a - b);
    const out: number[] = [];
    for (const key of keys) {
      const x = Math.floor(key / SPAN) - OFFSET;
      const z = (key % SPAN) - OFFSET;
      out.push(x, z, this.plants.get(key) as number);
    }
    return out;
  }

  /** Replaces every entry with the saved ones. Throws on malformed data (nothing is changed then). */
  load(raw: unknown): void {
    if (!Array.isArray(raw) || raw.length % 3 !== 0) throw new Error('tree ages: malformed list');
    const next = new Map<number, number>();
    for (let i = 0; i < raw.length; i += 3) {
      const [x, z, day] = [raw[i], raw[i + 1], raw[i + 2]];
      if (![x, z, day].every(Number.isInteger) || Math.abs(x) >= OFFSET || Math.abs(z) >= OFFSET || day < 0) {
        throw new Error(`tree ages: bad entry at ${i}`);
      }
      next.set(keyOf(x, z), day);
    }
    this.plants.clear();
    for (const [k, v] of next) this.plants.set(k, v);
  }
}

export interface GrowthHooks {
  /** True while the tree still stands: no voxel of its trunk up to `top` has been edited (felled, cut, decayed). */
  standing(s: TreeSite, top: number): boolean;
  /** True when voxel `index` of the chunk was changed by the player or the world: growth leaves it alone. */
  blocked(index: number): boolean;
  /** Called after growth wrote voxel `index` (from -> to), so the chunk can be re-meshed. */
  changed(index: number, from: Voxel, to: Voxel): void;
}

/** Two scratch arrays of chunk size, reused between chunks (generation is single-threaded on the main thread). */
export interface GrowthScratch {
  base: Uint16Array;
  grown: Uint16Array;
}

export const createGrowthScratch = (): GrowthScratch => ({
  base: new Uint16Array(CHUNK_VOLUME),
  grown: new Uint16Array(CHUNK_VOLUME),
});

const isLeaf = (v: Voxel): boolean => v === ID.oakLeaves || v === ID.pineLeaves;
const isLog = (v: Voxel): boolean => v === ID.oakLog || v === ID.pineLog;

/**
 * Brings chunk (cx, cz) to the growth of `day`. First the voxels the previous growth wrote are put back (`record`,
 * flat [index, from, to] triples kept per loaded chunk; a voxel the player or the world changed since is left
 * alone). Then each tree that reaches the chunk is drawn twice into empty scratch arrays, once as generated and
 * once grown; the voxels that differ are written where the chunk is still air (or a leaf, for a trunk log), and
 * never where `hooks.blocked` says so. So the chunk always equals a fresh load on that day. Trees first seen here
 * are planted on the day before `day` unless they are already felled. Returns how many voxels growth wrote.
 */
export function growChunk(
  t: Terrain,
  cx: number,
  cz: number,
  voxels: Uint16Array,
  day: number,
  ages: TreeAges,
  hooks: GrowthHooks,
  scratch: GrowthScratch,
  record: number[],
): number {
  for (let k = 0; k < record.length; k += 3) {
    const i = record[k];
    const from = record[k + 1];
    const to = record[k + 2];
    if (voxels[i] !== to || hooks.blocked(i)) continue;
    voxels[i] = from;
    hooks.changed(i, to, from);
  }
  record.length = 0;

  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const { base, grown } = scratch;
  base.fill(AIR);
  grown.fill(AIR);
  let growing = false;
  forEachTree(t, x0, z0, x0 + CHUNK_SIZE - 1, z0 + CHUNK_SIZE - 1, CANOPY, (s) => {
    drawTree(base, x0, z0, s);
    if (!growthRule(s.kind)) {
      drawTree(grown, x0, z0, s);
      return;
    }
    const planted = ages.plantedOn(s.x, s.z) ?? day - 1;
    const g = grownSite(s, treeAge(planted, day));
    if (!hooks.standing(s, g.base + g.trunk)) {
      drawTree(grown, x0, z0, s);
      return;
    }
    if (ages.plantedOn(s.x, s.z) === undefined) ages.plant(s.x, s.z, planted);
    drawTree(grown, x0, z0, g);
    if (g.trunk !== s.trunk) growing = true;
  });
  if (!growing) return 0;

  let written = 0;
  for (let i = 0; i < CHUNK_VOLUME; i++) {
    const to = grown[i];
    if (to === AIR || to === base[i]) continue;
    const from = voxels[i];
    if (!(from === AIR || (isLeaf(from) && isLog(to)))) continue;
    if (hooks.blocked(i)) continue;
    voxels[i] = to;
    record.push(i, from, to);
    written++;
    hooks.changed(i, from, to);
  }
  return written;
}
