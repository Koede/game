/**
 * Exact voxel traversal (Amanatides-Woo DDA) from the eye along the view. Thin shapes (plants, torches, cables,
 * slabs) are always targeted through their whole cell, which is easier to hit with a thumb. Air is skipped,
 * liquids are skipped unless asked for, and the ray stops at unloaded chunks and the bottom of the world.
 * An empty bucket's ray asks for liquid SOURCES only (spec 18.3): it looks through flowing water as if it were not
 * there, and when it finds nothing behind the flow it hands back the first flowing cell it crossed.
 * Use looks past a thin block without a screen when the ray misses its real shape and a screen block stands behind
 * it (`screenBehindThin`): a cable in a furnace mouth must not hide the furnace. Mining keeps the whole cell.
 */
import { blockOf } from '../core/registry';
import { Face, WORLD_HEIGHT, type BlockDef, type BlockShape, type IWorld, type Voxel } from '../core/types';
import { isLiquidSource } from '../world/water';
import { screenFor } from './blockRules';

/** Which liquid cells stop the ray: none, every one, or only sources (an empty bucket). */
export type LiquidAim = boolean | 'sources';

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
  /** With `liquids: 'sources'`: the ray crossed flowing water before this hit (or this hit is that flowing water). */
  throughFlow?: boolean;
}

export const createRayHit = (): RayHit => ({
  x: 0, y: 0, z: 0, face: Face.PY, px: 0, py: 0, pz: 0, voxel: 0, block: blockOf(0), distance: 0, throughFlow: false,
});

/** The first flowing cell a 'sources' ray crossed (copied into the hit when nothing lies behind it). */
const flow = createRayHit();

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
  liquids: LiquidAim,
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
  let crossed = false;

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
    if (t > maxDist || y < 0) return crossed ? copyFlow(out) : null;
    if (y >= WORLD_HEIGHT) {
      if (stepY >= 0) return crossed ? copyFlow(out) : null;
      continue;
    }
    if (!world.isLoaded(x, z)) return crossed ? copyFlow(out) : null;
    const voxel = world.getVoxel(x, y, z);
    const def = blockOf(voxel);
    if (def.shape === 'none') continue;
    if (def.liquid !== null) {
      if (liquids === false) continue;
      if (liquids === 'sources' && !isLiquidSource(voxel)) {
        if (!crossed) fill(flow, x, y, z, face, voxel, def, t);
        crossed = true;
        continue;
      }
    }
    out.throughFlow = crossed;
    fill(out, x, y, z, face, voxel, def, t);
    return out;
  }
}

function fill(out: RayHit, x: number, y: number, z: number, face: Face, voxel: Voxel, def: BlockDef, t: number): void {
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
}

function copyFlow(out: RayHit): RayHit {
  fill(out, flow.x, flow.y, flow.z, flow.face, flow.voxel, flow.block, flow.distance);
  out.throughFlow = true;
  return out;
}

/** Real boxes of the thin shapes inside their cell, in sixteenths: min x, y, z, max x, y, z (a cable's core only). */
const THIN_BOX: Partial<Record<BlockShape, readonly number[]>> = {
  cable: [5, 5, 5, 11, 11, 11],
  torch: [6, 0, 6, 10, 11, 10],
  slab: [0, 0, 0, 16, 8, 16],
};
/** How far into the thin cell the second ray starts (it never tests its own cell). */
const NUDGE = 1e-4;

/**
 * For Use: when `hit` (from `raycast` with the same arguments) is a thin block that has no screen - a cable, a torch,
 * a slab - and the ray passes beside its real shape (or `anyAim`: nothing placeable is held, so Use could do nothing
 * with the thin block), the next block along the ray is returned in `out` if it has a screen. Otherwise null, and
 * `hit` stays the target.
 */
export function screenBehindThin(
  world: IWorld,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  liquids: LiquidAim,
  hit: RayHit,
  out: RayHit,
  anyAim = false,
): RayHit | null {
  const box = THIN_BOX[hit.block.shape];
  if (!box || screenFor(hit.block, hit.x, hit.y, hit.z)) return null;
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0)) return null;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  if (!anyAim && rayHitsBox(ox - hit.x, oy - hit.y, oz - hit.z, ux, uy, uz, box)) return null;
  const t0 = hit.distance + NUDGE;
  const behind = raycast(world, ox + ux * t0, oy + uy * t0, oz + uz * t0, ux, uy, uz, maxDist - t0, liquids, out);
  if (!behind || behind.block.liquid !== null || !screenFor(behind.block, behind.x, behind.y, behind.z)) return null;
  behind.distance += t0;
  return behind;
}

/** Slab test of a ray (origin relative to the cell, unit direction) against a box given in sixteenths. */
function rayHitsBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, box: readonly number[]): boolean {
  let near = 0;
  let far = Infinity;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    const lo = box[a] / 16;
    const hi = box[a + 3] / 16;
    if (d[a] === 0) {
      if (o[a] < lo || o[a] > hi) return false;
      continue;
    }
    let t1 = (lo - o[a]) / d[a];
    let t2 = (hi - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return false;
  }
  return true;
}
