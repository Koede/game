/**
 * Where groups of animals appear (spec 12.5): the deterministic first-load roll of a chunk column, and the
 * placement of a group around an anchor column for the spawn-area guarantee and keep-alive spawns. Pure
 * functions of the world, the seed and the random source passed in.
 */
import { MOB_CHUNK_SPAWN_CHANCE } from '../core/constants';
import { hash32, hashFloat } from '../core/math';
import { CREATURES } from '../core/registry';
import { CHUNK_SIZE, type BiomeKey, type CreatureSpec, type IWorld } from '../core/types';
import { clearanceOf, spawnCell } from './terrain';
import type { BiomeLookup } from './types';

export interface SpawnSpot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface GroupPlan {
  species: CreatureSpec;
  spots: SpawnSpot[];
}

// Salts keep the different rolls of one chunk independent of each other.
const SALT_ROLL = 0x6d6f6231;
const SALT_SPECIES = 0x6d6f6232;
const SALT_ANCHOR = 0x6d6f6233;
const SALT_MEMBER = 0x6d6f6234;
/** How far group members stand from their anchor, in blocks (either way). */
const GROUP_SPREAD = 3;

/** Species that live in a biome, in registry order. */
export function speciesOf(biome: BiomeKey): CreatureSpec[] {
  return CREATURES.filter((c) => c.biomes.includes(biome));
}

/** Group size for a pick in [0, 1). */
export const groupSize = (spec: CreatureSpec, pick: number): number =>
  spec.group[0] + Math.min(spec.group[1] - spec.group[0], Math.floor(pick * (spec.group[1] - spec.group[0] + 1)));

/**
 * Places up to `count` members around an anchor column (whose spawn cell must be valid): each member on a valid
 * spawn cell within GROUP_SPREAD of the anchor and at most two blocks above or below it, never two on one cell.
 */
export function placeGroup(world: IWorld, spec: CreatureSpec, ax: number, az: number, count: number, rand: () => number): SpawnSpot[] {
  const clearance = clearanceOf(spec.size.h);
  const ay = spawnCell(world, ax, az, clearance);
  if (ay < 0) return [];
  const spots: SpawnSpot[] = [{ x: ax + 0.5, y: ay, z: az + 0.5, yaw: rand() * Math.PI * 2 }];
  for (let k = 1; k < count; k++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = ax + Math.floor(rand() * (GROUP_SPREAD * 2 + 1)) - GROUP_SPREAD;
      const z = az + Math.floor(rand() * (GROUP_SPREAD * 2 + 1)) - GROUP_SPREAD;
      if (spots.some((s) => Math.floor(s.x) === x && Math.floor(s.z) === z)) continue;
      const y = spawnCell(world, x, z, clearance);
      if (y < 0 || Math.abs(y - ay) > 2) continue;
      spots.push({ x: x + 0.5, y, z: z + 0.5, yaw: rand() * Math.PI * 2 });
      break;
    }
  }
  return spots;
}

/** A deterministic random source for one roll of one chunk. */
function chunkRand(seed: number, cx: number, cz: number, salt: number): () => number {
  let i = 0;
  return () => hashFloat(seed ^ salt, cx, cz, i++);
}

/**
 * The first-load roll of chunk column (cx, cz): MOB_CHUNK_SPAWN_CHANCE of one group of a species living in the
 * chunk's biome, on an open natural surface inside the chunk. Same seed and terrain -> same result, whatever
 * order chunks load in. Null when the roll fails or the chunk has nowhere to stand.
 */
export function rollChunk(world: IWorld, seed: number, cx: number, cz: number, biomeAt: BiomeLookup): GroupPlan | null {
  if (hashFloat(seed ^ SALT_ROLL, cx, cz) >= MOB_CHUNK_SPAWN_CHANCE) return null;
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const candidates = speciesOf(biomeAt(x0 + 8, z0 + 8));
  if (candidates.length === 0) return null;
  const spec = candidates[hash32(seed ^ SALT_SPECIES, cx, cz) % candidates.length];
  const clearance = clearanceOf(spec.size.h);
  for (let i = 0; i < 16; i++) {
    const h = hash32(seed ^ SALT_ANCHOR, cx, cz, i);
    const x = x0 + (h & 15);
    const z = z0 + ((h >>> 4) & 15);
    if (!spec.biomes.includes(biomeAt(x, z))) continue;
    if (spawnCell(world, x, z, clearance) < 0) continue;
    const rand = chunkRand(seed, cx, cz, SALT_MEMBER);
    const spots = placeGroup(world, spec, x, z, groupSize(spec, rand()), rand);
    if (spots.length > 0) return { species: spec, spots };
  }
  return null;
}

/**
 * A group anchor between `minR` and `maxR` blocks from (x, z) whose column suits a species of `choices`
 * (its biome and a valid spawn cell), avoiding directions for which `blocked(dx, dz)` is true. Tries `tries`
 * random spots; null when none fits.
 */
export function findAnchor(
  world: IWorld,
  x: number,
  z: number,
  minR: number,
  maxR: number,
  choices: readonly CreatureSpec[],
  biomeAt: BiomeLookup,
  rand: () => number,
  tries: number,
  blocked?: (dx: number, dz: number) => boolean,
): { spec: CreatureSpec; x: number; z: number } | null {
  for (let i = 0; i < tries; i++) {
    const a = rand() * Math.PI * 2;
    const r = minR + Math.sqrt(rand()) * (maxR - minR);
    const dx = Math.cos(a) * r;
    const dz = Math.sin(a) * r;
    if (blocked && blocked(dx, dz)) continue;
    const ax = Math.floor(x + dx);
    const az = Math.floor(z + dz);
    if (!world.isLoaded(ax, az)) continue;
    const biome = biomeAt(ax, az);
    const fitting = choices.filter((c) => c.biomes.includes(biome));
    if (fitting.length === 0) continue;
    const spec = fitting[Math.floor(rand() * fitting.length)];
    if (spawnCell(world, ax, az, clearanceOf(spec.size.h)) < 0) continue;
    return { spec, x: ax, z: az };
  }
  return null;
}
