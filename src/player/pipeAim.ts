/**
 * Which side of a pipe the crosshair is on (spec 16.3): the wrench works on the ARM the player aims at (an arm towards
 * a block switches that pipe end, an arm towards a pipe parts the two), and on the CORE it works on the side of the core
 * facing the player (so a parted joint, which may show no arm, can be joined again by aiming at the core from that
 * side). Pure geometry on the pipe shape of src/world/meshPipe.ts: a core of PIPE_CORE_MIN..PIPE_CORE_MAX on every axis
 * and an arm of the same cross-section to every neighbour the pipe joins (registry.pipeJoins).
 */
import { PIPE_CORE_MAX, PIPE_CORE_MIN } from '../core/constants';
import { blockOf, pipeJoins } from '../core/registry';
import { FACE_DIRS, Face, type IWorld } from '../core/types';

/** Extra width around the core and arms, so a thumb that is slightly off still picks the part it meant. */
export const PIPE_AIM_MARGIN = 0.06;

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const hitFace = { face: Face.PY as Face };

/**
 * Slab test of the ray o + t*d against the box lo..hi (cell-local). Returns the entry t (>= 0) or Infinity, and the
 * face of the box the ray enters through in `hitFace`.
 */
function enter(o: readonly number[], d: readonly number[]): number {
  let tNear = -Infinity;
  let tFar = Infinity;
  let axisNear = 1;
  for (let a = 0; a < 3; a++) {
    if (d[a] === 0) {
      if (o[a] < lo[a] || o[a] > hi[a]) return Infinity;
      continue;
    }
    let t1 = (lo[a] - o[a]) / d[a];
    let t2 = (hi[a] - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tNear) {
      tNear = t1;
      axisNear = a;
    }
    tFar = Math.min(tFar, t2);
  }
  if (tNear > tFar || tFar < 0) return Infinity;
  // Entering through the negative side of the axis when moving along +axis, and vice versa (Face order PX NX PY NY PZ NZ).
  hitFace.face = (axisNear * 2 + (d[axisNear] > 0 ? 1 : 0)) as Face;
  return Math.max(0, tNear);
}

function setCross(m: number): void {
  lo[0] = lo[1] = lo[2] = PIPE_CORE_MIN - m;
  hi[0] = hi[1] = hi[2] = PIPE_CORE_MAX + m;
}

/** Bit mask (Face order) of the arms the pipe at x, y, z grows: towards every neighbour it joins. */
export function pipeArmMask(world: IWorld, x: number, y: number, z: number): number {
  const self = blockOf(world.getVoxel(x, y, z));
  let mask = 0;
  for (let f = 0; f < 6; f++) {
    const [dx, dy, dz] = FACE_DIRS[f];
    if (pipeJoins(self, blockOf(world.getVoxel(x + dx, y + dy, z + dz)))) mask |= 1 << f;
  }
  return mask;
}

/**
 * The side (Face of the pipe at x, y, z) a ray from (ox, oy, oz) along (dx, dy, dz) aims at. An arm hit first gives
 * that arm's direction; the core gives the core face the ray enters; a ray that misses both (the whole cell is
 * targetable) gives the side nearest to where it passes; `entered` (the cell face the ray came in through) only for a
 * ray through the very centre.
 */
export function pipeSideAt(
  world: IWorld, x: number, y: number, z: number,
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  entered: Face,
): Face {
  const o = [ox - x, oy - y, oz - z];
  const len = Math.hypot(dx, dy, dz) || 1;
  const d = [dx / len, dy / len, dz / len];
  const arms = pipeArmMask(world, x, y, z);
  let best = Infinity;
  let side: Face = entered;

  for (let f = 0; f < 6; f++) {
    if (((arms >> f) & 1) === 0) continue;
    const axis = f >> 1;
    setCross(PIPE_AIM_MARGIN);
    if ((f & 1) === 0) {
      lo[axis] = PIPE_CORE_MAX;
      hi[axis] = 1;
    } else {
      lo[axis] = 0;
      hi[axis] = PIPE_CORE_MIN;
    }
    const t = enter(o, d);
    if (t < best) {
      best = t;
      side = f as Face;
    }
  }
  setCross(0);
  const tCore = enter(o, d);
  if (tCore < best) return hitFace.face;
  if (best < Infinity) return side;

  // A miss: the point of the ray nearest to the cell centre decides.
  const t = (0.5 - o[0]) * d[0] + (0.5 - o[1]) * d[1] + (0.5 - o[2]) * d[2];
  let axis = -1;
  let off = 0;
  for (let a = 0; a < 3; a++) {
    const v = o[a] + d[a] * t - 0.5;
    if (Math.abs(v) > Math.abs(off)) {
      off = v;
      axis = a;
    }
  }
  return axis < 0 ? entered : ((axis * 2 + (off > 0 ? 0 : 1)) as Face);
}
