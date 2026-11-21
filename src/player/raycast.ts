/**
 * Exact voxel traversal (Amanatides-Woo DDA) from the eye along the view. Thin shapes (plants, torches, cables,
 * slabs) are always targeted through their whole cell, which is easier to hit with a thumb. Air is skipped,
 * liquids are skipped unless asked for, and the ray stops at unloaded chunks and the bottom of the world.
 */
import { blockOf } from '../core/registry';
import { Face, WORLD_HEIGHT, type BlockDef, type IWorld, type Voxel } from '../core/types';

export interface RayHit {
  /** The targeted cell. */
  x: number;
  y: number;
  z: number;
  /** Face of the targeted cell the ray entered through. */
  face: Face;
  /** The empty-side neighbour across that face: where a block placed against it goes. */
  px: number;
  py: number;
  pz: number;
  voxel: Voxel;
  block: BlockDef;
  /** Distance from the origin to the entry point. */
  distance: number;
}

export const createRayHit = (): RayHit => ({ x: 0, y: 0, z: 0, face: Face.PY, px: 0, py: 0, pz: 0, voxel: 0, block: blockOf(0), distance: 0 });

/**
 * Casts from (ox, oy, oz) along (dx, dy, dz) (need not be normalised) for at most `maxDist`. Writes the first
 * targetable cell into `out` and returns it, or returns null. The cell containing the origin is not tested.
 */
export function raycast(
  world: IWorld,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  includeLiquids: boolean,
  out: RayHit,
): RayHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0)) return null;
  dx /= len;
  dy /= len;
  dz /= len;
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = stepX > 0 ? (x + 1 - ox) * tDeltaX : stepX < 0 ? (ox - x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - oy) * tDeltaY : stepY < 0 ? (oy - y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - oz) * tDeltaZ : stepZ < 0 ? (oz - z) * tDeltaZ : Infinity;

  for (;;) {
    let t: number;
    let face: Face;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX;
      x += stepX;
      tMaxX += tDeltaX;
      face = stepX > 0 ? Face.NX : Face.PX;
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
      face = stepY > 0 ? Face.NY : Face.PY;
    } else {
      t = tMaxZ;
      z += stepZ;
      tMaxZ += tDeltaZ;
      face = stepZ > 0 ? Face.NZ : Face.PZ;
    }
    if (t > maxDist) return null;
    if (y < 0) return null;
    if (y >= WORLD_HEIGHT) {
      if (stepY >= 0) return null;
      continue;
    }
    if (!world.isLoaded(x, z)) return null;
    const voxel = world.getVoxel(x, y, z);
    const def = blockOf(voxel);
    if (def.shape === 'none') continue;
    if (def.liquid !== null && !includeLiquids) continue;
    out.x = x;
    out.y = y;
    out.z = z;
    out.face = face;
    out.px = x + (face === Face.PX ? 1 : face === Face.NX ? -1 : 0);
    out.py = y + (face === Face.PY ? 1 : face === Face.NY ? -1 : 0);
    out.pz = z + (face === Face.PZ ? 1 : face === Face.NZ ? -1 : 0);
    out.voxel = voxel;
    out.block = def;
    out.distance = t;
    return out;
  }
}
