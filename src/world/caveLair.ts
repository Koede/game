/**
 * The cave boss's lair (docs/plans/caves-and-depths.md, Wave 4): a few chunks hold a Slag Colossus in a big open cave room, and a
 * reward crate appears where it falls. Reads the LIVE chunk (the first open room found), not the cave noise, so it works with
 * whatever shapes the caves thread gives the underground: when caves grow their own rooms, `caveLairSite` is the one place that
 * should prefer those rooms. Chosen once per chunk from the seed; the guard set remembers it, so it is never created twice.
 */
import { hashFloat, hash32 } from '../core/math';
import { CHUNK_SIZE, voxelId, type IWorld } from '../core/types';
import { blockId } from '../core/registry';
import { caveBandAt, findCaveCamp } from './caveRooms';

export const LAIR_CHANCE = 0.05;
const SALT = 0x6c616972;
/** The room the boss needs: a floor this wide (odd) with this much air over it, between these heights. */
export const LAIR_W = 5;
export const LAIR_HEADROOM = 4;
const Y_MIN = 6;
const Y_MAX = 42;
const TRIES = 14;

export interface CaveLair {
  /** 'lair:cx,cz', the guard set's key. */
  key: string;
  /** Room centre (block centre), the y of its floor blocks. */
  x: number;
  z: number;
  floor: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Of the deep cave camps (src/world/caveRooms.ts), this share is held by the boss. */
export const DEEP_CAMP_LAIR_CHANCE = 0.5;
const SALT_CAMP = 0x63616d70;

export const lairKey = (cx: number, cz: number): string => `lair:${cx},${cz}`;
export const isLairKey = (key: string): boolean => key.startsWith('lair:');

/** A cave room has a roof: solid rock within this many blocks over the middle of the floor (an open clearing or a hilltop does not count). */
const ROOF_WITHIN = 14;

function roofed(world: IWorld, x: number, z: number, floor: number): boolean {
  for (let h = LAIR_HEADROOM + 1; h <= LAIR_HEADROOM + ROOF_WITHIN; h++) if (world.getBlock(x, floor + h, z).solid) return true;
  return false;
}

function roomOk(world: IWorld, x0: number, z0: number, floor: number): boolean {
  if (!roofed(world, x0 + (LAIR_W >> 1), z0 + (LAIR_W >> 1), floor)) return false;
  for (let dz = 0; dz < LAIR_W; dz++) {
    for (let dx = 0; dx < LAIR_W; dx++) {
      const below = world.getBlock(x0 + dx, floor, z0 + dz);
      if (!below.solid || below.liquid !== null) return false;
      for (let h = 1; h <= LAIR_HEADROOM; h++) {
        const b = world.getBlock(x0 + dx, floor + h, z0 + dz);
        if (b.solid || b.liquid !== null) return false;
      }
    }
  }
  return true;
}

/** True when this chunk is one of the few that may hold a lair in an open roofed room (a pure function of the seed). */
export const chunkHasLair = (seed: number, cx: number, cz: number): boolean => hashFloat(seed ^ SALT, cx, cz) < LAIR_CHANCE;
/** True when the boss holds this chunk's deep camp, if it has one (a pure function of the seed). */
export const chunkHoldsCamp = (seed: number, cx: number, cz: number): boolean => hashFloat(seed ^ SALT_CAMP, cx, cz) < DEEP_CAMP_LAIR_CHANCE;

/**
 * The real cave rooms of the caves work: a deep band camp (its crate stands in the loaded chunk) kept by the boss. The boss stands
 * beside the camp's crate; the camp's own loot stays where it is for whoever gets past.
 */
function campSite(world: IWorld, seed: number, cx: number, cz: number): CaveLair | null {
  if (!chunkHoldsCamp(seed, cx, cz)) return null;
  const crate = blockId('crate');
  const camp = findCaveCamp(seed, cx, cz, (x, y, z) => voxelId(world.getVoxel(x, y, z)));
  if (!camp || caveBandAt(camp.y) !== 'deep' || voxelId(world.getVoxel(camp.x, camp.y, camp.z)) !== crate) return null;
  return {
    key: lairKey(cx, cz), x: camp.x + 0.5, z: camp.z + 0.5, floor: camp.y - 1,
    x0: camp.x - 2, z0: camp.z - 2, x1: camp.x + 2, z1: camp.z + 2,
  };
}

/** The lair of chunk (cx, cz), or null: not a lair chunk, not loaded, or no room big enough in it. Deterministic for an untouched chunk. */
export function caveLairSite(world: IWorld, seed: number, cx: number, cz: number): CaveLair | null {
  const bx = cx * CHUNK_SIZE;
  const bz = cz * CHUNK_SIZE;
  if (!world.isLoaded(bx, bz)) return null;
  const camp = campSite(world, seed, cx, cz);
  if (camp) return camp;
  if (!chunkHasLair(seed, cx, cz)) return null;
  const span = CHUNK_SIZE - LAIR_W;
  for (let t = 0; t < TRIES; t++) {
    const x0 = bx + (hash32(seed ^ SALT, cx, cz, t * 2) % (span + 1));
    const z0 = bz + (hash32(seed ^ SALT, cx, cz, t * 2 + 1) % (span + 1));
    for (let floor = Y_MIN; floor <= Y_MAX; floor++) {
      if (!roomOk(world, x0, z0, floor)) continue;
      return {
        key: lairKey(cx, cz), x: x0 + LAIR_W / 2, z: z0 + LAIR_W / 2, floor,
        x0, z0, x1: x0 + LAIR_W - 1, z1: z0 + LAIR_W - 1,
      };
    }
  }
  return null;
}
