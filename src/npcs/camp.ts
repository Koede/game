/**
 * The camp a NEW world starts in (docs/plans/just-you-and-orrin.md, phase 1): Gruk's cart, a campfire and two bedrolls on a flat
 * patch near the spawn point. Camp-local block coordinates: x 0..CAMP_W-1, z 0..CAMP_D-1, y 0 is the floor block (the origin's
 * height), people stand at y 1. `campLayout` is pure; `buildCamp` places it; `pickCampSite` chooses the flat patch.
 */
import { blockId } from '../core/registry';
import { Facing, makeVoxel, type IWorld } from '../core/types';
import { footingHeights, type SurfaceFn } from './townPlan';
import type { Placement } from './tavern';
import type { Spot } from './routines';

export const CAMP_W = 9;
export const CAMP_D = 5;
/** Where the player stands when the world opens (and respawns): beside the cart, a step from the fire. */
export const CAMP_START: readonly [number, number, number] = [3, 1, 4];
/** The campfire (a clay furnace the game keeps lit, like the hall's fireplace). */
export const CAMP_FIRES: readonly (readonly [number, number, number])[] = [[5, 1, 2]];
/** How far (blocks) from the spawn point the camp may be put, to find flat ground. */
export const CAMP_SEARCH = 16;

/** The camp's blocks. Pure. */
export function campLayout(): Placement[] {
  const out: Placement[] = [];
  const put = (x: number, y: number, z: number, block: string, facing?: Facing): void => {
    out.push({ x, y, z, block, facing });
  };
  // The floor: packed dirt under the whole camp, so the ground is level for walking.
  for (let x = 0; x < CAMP_W; x++) for (let z = 0; z < CAMP_D; z++) put(x, 0, z, 'dirt');
  // The cart: a plank bed on four log posts, with plank rails and two log wheels under its sides.
  for (let x = 0; x <= 3; x++) for (let z = 0; z <= 2; z++) put(x, 2, z, 'plank');
  for (const [x, z] of [[0, 0], [3, 0], [0, 2], [3, 2]] as const) put(x, 3, z, 'oak_log');
  for (const x of [1, 2]) for (const z of [0, 2]) put(x, 3, z, 'plank');
  put(0, 1, 1, 'oak_log');
  put(3, 1, 1, 'oak_log');
  // The campfire: a lit clay furnace ringed by stone.
  put(5, 1, 2, 'furnace_clay', Facing.North);
  for (const [x, z] of [[4, 2], [6, 2], [5, 1], [5, 3]] as const) put(x, 1, z, 'stone_brick');
  // Two bedrolls (wool bedding) by the fire, headboards to the east.
  put(7, 1, 1, 'wool_bedding', Facing.West);
  put(7, 1, 3, 'wool_bedding', Facing.West);
  return out;
}

/** Where Gruk (the builder, the camp's only person) stands in each part of the day, camp-local. */
export const CAMP_ROUTINES: Readonly<Record<string, Readonly<Record<'morning' | 'day' | 'evening' | 'night', Spot>>>> = {
  gruk: { morning: [2, 1, 4], day: [1, 1, 4], evening: [5, 1, 4], night: [6, 1, 1] },
};

/**
 * Finds a flat, buildable patch for the camp near the spawn cell (sx, sz): the camp's start cell lands on the spawn. Prefers ground
 * that is level to within one block, then any ground the town plan accepts (relief up to three), and otherwise the spawn's own
 * ground. Returns the origin (floor block height oy, so people stand at oy + 1), or null when the spawn stands in water or lava.
 */
export function pickCampSite(surface: SurfaceFn, sx: number, sz: number): [number, number, number] | null {
  for (const maxRelief of [1, 3]) {
    for (let r = 0; r <= CAMP_SEARCH; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ox = sx + dx - CAMP_START[0];
          const oz = sz + dz - CAMP_START[2];
          const hs = footingHeights(surface, ox, oz, CAMP_W, CAMP_D);
          if (!hs) continue;
          const lo = Math.min(...hs);
          const hi = Math.max(...hs);
          if (hi - lo > maxRelief) continue;
          return [ox, hi, oz];
        }
      }
    }
  }
  // No flat patch near the spawn (forest, lakes): the camp goes on the spawn's own ground, clearing what stands above it.
  const here = surface(sx, sz);
  if (!here || here.key === 'water' || here.key === 'lava') return null;
  return [sx - CAMP_START[0], here.y, sz - CAMP_START[2]];
}

/** Places the camp at origin (ox, oy, oz): fills the footing under it with dirt, clears the air above, then the blocks. False when not loaded. */
export function buildCamp(world: IWorld, ox: number, oy: number, oz: number): boolean {
  if (!world.isLoaded(ox, oz) || !world.isLoaded(ox + CAMP_W - 1, oz + CAMP_D - 1)) return false;
  const air = makeVoxel(blockId('air'));
  const dirt = makeVoxel(blockId('dirt'));
  for (let x = 0; x < CAMP_W; x++) {
    for (let z = 0; z < CAMP_D; z++) {
      for (let y = oy - 3; y <= oy; y++) if (world.getVoxel(ox + x, y, oz + z) === air) world.setVoxel(ox + x, y, oz + z, dirt, 'sim');
      for (let y = oy + 1; y <= oy + 4; y++) world.setVoxel(ox + x, y, oz + z, air, 'sim');
    }
  }
  for (const p of campLayout()) world.setVoxel(ox + p.x, oy + p.y, oz + p.z, makeVoxel(blockId(p.block), p.facing ?? Facing.North), 'sim');
  return true;
}
