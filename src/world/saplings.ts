/**
 * Planted trees (docs/api/tree-growth.md, "Planted trees"). A sapling block placed on grass or dirt is a planting:
 * for SAPLING_DAYS it stays a sapling, then the tree growth draws a young tree of its species there (START_TRUNK
 * blocks) and grows it a day at a time with the same rule as the generated trees (grownTrunk). A stump left by
 * felling is remembered too: after STUMP_DAYS it sprouts a sapling of its species, for some stumps only (a fixed
 * roll per cell, STUMP_SPROUT_CHANCE), and the sapling grows like a planted one.
 *
 * The saved state is the plantings and the waiting stumps (world extras `saplings`); the tree's voxels are drawn
 * by growth like any other tree's, so they are not edits and come back from this list. DOM-free.
 */
import { hash32, hashFloat } from '../core/math';
import { blockId } from '../core/registry';
import { voxelId, type Voxel } from '../core/types';
import { OAK, PINE, newTreeSite, type TreeSite } from './flora';
import { grownSite } from './treeGrowth';

/** Days a planting stays a sapling before the young tree stands there. */
export const SAPLING_DAYS = 2;
/** Trunk of the young tree on the day it first stands (it then grows by the species' growth rule). */
export const START_TRUNK = 3;
/** Days after felling before a stump may sprout. */
export const STUMP_DAYS = 3;
/** Share of stumps that sprout a sapling (a fixed roll per stump cell and world seed). */
export const STUMP_SPROUT_CHANCE = 0.4;

export interface Species {
  sapling: string;
  log: string;
  stump: string;
  /** Tree kind (flora.ts) the sapling grows into. */
  kind: number;
}

/** Index = species number saved with each planting. */
export const SPECIES: readonly Species[] = [
  { sapling: 'oak_sapling', log: 'oak_log', stump: 'oak_stump', kind: OAK },
  { sapling: 'pine_sapling', log: 'pine_log', stump: 'pine_stump', kind: PINE },
];

let ids: { sapling: number; log: number; stump: number }[] | null = null;
const speciesIds = (): { sapling: number; log: number; stump: number }[] =>
  (ids ??= SPECIES.map((s) => ({ sapling: blockId(s.sapling), log: blockId(s.log), stump: blockId(s.stump) })));

/** Species of a sapling voxel, or -1. */
export const saplingSpecies = (v: Voxel): number => speciesIds().findIndex((s) => s.sapling === voxelId(v));
/** Species of a felling stump voxel, or -1. */
export const stumpSpecies = (v: Voxel): number => speciesIds().findIndex((s) => s.stump === voxelId(v));
export const saplingId = (species: number): number => speciesIds()[species].sapling;
export const logId = (species: number): number => speciesIds()[species].log;

/** A sapling placed (or sprouted) at (x, y, z) on clock day `day`. */
export interface Planting {
  x: number;
  y: number;
  z: number;
  species: number;
  day: number;
}

/** A felling stump waiting to sprout (or not) STUMP_DAYS after `day`. */
export type Stump = Planting;

/** Whole days since planting on clock day `day`. */
export const daysSince = (p: { day: number }, day: number): number => Math.max(0, day - p.day);

/** True once the planting is a tree rather than a sapling on clock day `day`. */
export const isTree = (p: Planting, day: number): boolean => daysSince(p, day) >= SAPLING_DAYS;

/**
 * The planting as a tree on clock day `day` (the root log sits in the sapling's cell), grown by the species' growth
 * rule from START_TRUNK, or null while it is still a sapling.
 */
export function plantedTree(p: Planting, day: number): TreeSite | null {
  if (!isTree(p, day)) return null;
  const s = newTreeSite();
  s.x = p.x;
  s.z = p.z;
  s.base = p.y - 1;
  s.kind = SPECIES[p.species].kind;
  s.trunk = START_TRUNK;
  s.logs = START_TRUNK;
  s.bits = hash32(p.x, p.z, p.y, 0x5a91) >>> 4;
  return grownSite(s, daysSince(p, day) - SAPLING_DAYS);
}

/** True when the stump at (x, y, z) of a world with `seed` is one that sprouts. */
export const stumpSprouts = (seed: number, x: number, y: number, z: number): boolean =>
  hashFloat(seed, x, z, y * 131 + 0x57b) < STUMP_SPROUT_CHANCE;

const OFFSET = 0x100000;
const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

function readList(raw: unknown, what: string): Planting[] {
  if (!Array.isArray(raw) || raw.length % 5 !== 0) throw new Error(`saplings: malformed ${what}`);
  const out: Planting[] = [];
  for (let i = 0; i < raw.length; i += 5) {
    const [x, y, z, species, day] = raw.slice(i, i + 5) as number[];
    if (![x, y, z, species, day].every(Number.isInteger) || Math.abs(x) >= OFFSET || Math.abs(z) >= OFFSET || y < 0
      || species < 0 || species >= SPECIES.length || day < 0) {
      throw new Error(`saplings: bad ${what} entry at ${i}`);
    }
    out.push({ x, y, z, species, day });
  }
  return out;
}

const flat = (list: Iterable<Planting>): number[] => {
  const sorted = [...list].sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
  return sorted.flatMap((p) => [p.x, p.y, p.z, p.species, p.day]);
};

export interface SaplingsSnapshot {
  /** Flat [x, y, z, species, day, ...]. */
  plants: number[];
  stumps: number[];
}

/** The plantings and the stumps still to sprout. Saved as flat number lists (SaplingsSnapshot). */
export class Saplings {
  private readonly plants = new Map<string, Planting>();
  private readonly stumps = new Map<string, Stump>();

  get size(): number {
    return this.plants.size;
  }

  get stumpCount(): number {
    return this.stumps.size;
  }

  plant(x: number, y: number, z: number, species: number, day: number): void {
    this.plants.set(keyOf(x, y, z), { x, y, z, species, day });
  }

  plantingAt(x: number, y: number, z: number): Planting | undefined {
    return this.plants.get(keyOf(x, y, z));
  }

  unplant(x: number, y: number, z: number): void {
    this.plants.delete(keyOf(x, y, z));
  }

  addStump(x: number, y: number, z: number, species: number, day: number): void {
    this.stumps.set(keyOf(x, y, z), { x, y, z, species, day });
  }

  stumpAt(x: number, y: number, z: number): Stump | undefined {
    return this.stumps.get(keyOf(x, y, z));
  }

  removeStump(x: number, y: number, z: number): void {
    this.stumps.delete(keyOf(x, y, z));
  }

  /** Plantings whose root lies within `reach` blocks of the box [xa..xb] x [za..zb]. */
  plantsNear(xa: number, za: number, xb: number, zb: number, reach: number): Planting[] {
    const out: Planting[] = [];
    for (const p of this.plants.values()) {
      if (p.x >= xa - reach && p.x <= xb + reach && p.z >= za - reach && p.z <= zb + reach) out.push(p);
    }
    return out;
  }

  /** Stumps whose cell lies in the box [xa..xb] x [za..zb]. */
  stumpsIn(xa: number, za: number, xb: number, zb: number): Stump[] {
    return [...this.stumps.values()].filter((s) => s.x >= xa && s.x <= xb && s.z >= za && s.z <= zb);
  }

  clear(): void {
    this.plants.clear();
    this.stumps.clear();
  }

  /** The saved form, or undefined when there is nothing to save (older saves stay as they were). */
  toJSON(): SaplingsSnapshot | undefined {
    if (this.plants.size === 0 && this.stumps.size === 0) return undefined;
    return { plants: flat(this.plants.values()), stumps: flat(this.stumps.values()) };
  }

  /** Replaces everything with the saved data. Throws on malformed data (nothing is changed then). */
  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') throw new Error('saplings: malformed snapshot');
    const s = raw as Partial<SaplingsSnapshot>;
    const plants = readList(s.plants ?? [], 'plants');
    const stumps = readList(s.stumps ?? [], 'stumps');
    this.clear();
    for (const p of plants) this.plants.set(keyOf(p.x, p.y, p.z), p);
    for (const p of stumps) this.stumps.set(keyOf(p.x, p.y, p.z), p);
  }
}
