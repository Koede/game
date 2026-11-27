/**
 * The fence shape (docs/api/fence.md): a slim square post that grows an arm to each of the six neighbours that is another
 * fence or a solid block (FENCE_JOINS). Posts and arms span FENCE_MIN..FENCE_MAX on both cross axes and sample the matching
 * part of the block's tile. Arms reach the cell face, so a row of fences is one continuous rail.
 */
import { VOXEL_ID_MASK } from '../core/types';
import { FENCE_JOINS } from './blockTables';
import { box, D_FRONT, vol, type Builder } from './meshQuads';

export const FENCE_MIN = 6 / 16;
export const FENCE_MAX = 10 / 16;

const lo = [0, 0, 0];
const hi = [0, 0, 0];

/** Bit mask of the faces (Face order) towards which the fence at volume index `p` grows an arm. */
export function fenceArms(p: number): number {
  let arms = 0;
  for (let f = 0; f < 6; f++) if (FENCE_JOINS[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) arms |= 1 << f;
  return arms;
}

export function fence(b: Builder, slot: number, p: number, x: number, y: number, z: number): void {
  const arms = fenceArms(p);
  lo[0] = lo[1] = lo[2] = FENCE_MIN;
  hi[0] = hi[1] = hi[2] = FENCE_MAX;
  box(b, slot, p, x, y, z, lo, hi, arms, 0);
  for (let f = 0; f < 6; f++) {
    if (((arms >> f) & 1) === 0) continue;
    const axis = f >> 1;
    const positive = (f & 1) === 0;
    lo[0] = lo[1] = lo[2] = FENCE_MIN;
    hi[0] = hi[1] = hi[2] = FENCE_MAX;
    if (positive) { lo[axis] = FENCE_MAX; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = FENCE_MIN; }
    box(b, slot, p, x, y, z, lo, hi, 3 << (axis * 2), 0);
  }
}
