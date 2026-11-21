/** What stands between the camera and a block cell: nothing, only leaves, or something solid. Pure, node-testable. */
import { BLOCKS } from '../../core/registry';
import { VOXEL_ID_MASK, type IWorld } from '../../core/types';

export const CLEAR = 0;
export const LEAVES_ONLY = 1;
export const BLOCKED = 2;
export type Sight = typeof CLEAR | typeof LEAVES_ONLY | typeof BLOCKED;

/** Leaves (foliage you can make out shapes through): opaque cubes in this game, but they should not hide a ghost. */
const LEAF = new Uint8Array(1024);
/** Blocks that hide what is behind them. */
const HIDES = new Uint8Array(1024);
for (const b of BLOCKS) {
  if (b.key.endsWith('_leaves')) LEAF[b.id] = 1;
  else if (b.opaque && b.shape === 'cube') HIDES[b.id] = 1;
}

/** Steps a line from the eye towards a cell at most this many cells (beyond it, assume clear: fog hides it anyway). */
const MAX_STEPS = 96;

/**
 * Walks the voxels from the eye (ox, oy, oz) to the centre of cell (tx, ty, tz), skipping the eye's own cell and the
 * target. BLOCKED when an opaque non-leaf cube is in the way, LEAVES_ONLY when only leaves are, else CLEAR.
 */
export function sightTo(world: IWorld, ox: number, oy: number, oz: number, tx: number, ty: number, tz: number): Sight {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const dx = tx + 0.5 - ox;
  const dy = ty + 0.5 - oy;
  const dz = tz + 0.5 - oz;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const sz = Math.sign(dz);
  const ix = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const iy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const iz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let mx = dx !== 0 ? (sx > 0 ? x + 1 - ox : ox - x) * ix : Infinity;
  let my = dy !== 0 ? (sy > 0 ? y + 1 - oy : oy - y) * iy : Infinity;
  let mz = dz !== 0 ? (sz > 0 ? z + 1 - oz : oz - z) * iz : Infinity;
  let leaves = false;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (mx < my && mx < mz) {
      if (mx > 1) break;
      x += sx;
      mx += ix;
    } else if (my < mz) {
      if (my > 1) break;
      y += sy;
      my += iy;
    } else {
      if (mz > 1) break;
      z += sz;
      mz += iz;
    }
    if (x === tx && y === ty && z === tz) break;
    const id = world.getVoxel(x, y, z) & VOXEL_ID_MASK;
    if (HIDES[id] === 1) return BLOCKED;
    if (LEAF[id] === 1) leaves = true;
  }
  return leaves ? LEAVES_ONLY : CLEAR;
}
