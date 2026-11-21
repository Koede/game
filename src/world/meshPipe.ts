/**
 * The pipe shape (spec 16.1): a square core with an arm to every neighbour of the same transport family - another
 * pipe of that family, or an endpoint that takes or gives what the family carries (registry.pipeJoins, precomputed
 * as PIPE_JOINS). Where an arm meets an endpoint it ends in a slightly wider collar flush against the block.
 * Core and arms span PIPE_CORE_MIN..PIPE_CORE_MAX on both cross axes and sample the matching part of the plus tile.
 */
import { PIPE_CORE_MAX, PIPE_CORE_MIN } from '../core/constants';
import { VOXEL_ID_MASK } from '../core/types';
import { OPAQUE, PIPE_ENDPOINT, PIPE_FAMILY, PIPE_JOINS } from './blockTables';
import { box, D_FRONT, vol, type Builder } from './meshQuads';

/** The collar: 1/16 wider than the arm on every side, 2/16 deep. */
export const PIPE_COLLAR_MIN = PIPE_CORE_MIN - 1 / 16;
export const PIPE_COLLAR_MAX = PIPE_CORE_MAX + 1 / 16;
export const PIPE_COLLAR_DEPTH = 2 / 16;

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const uvLo = [0, 0, 0];
const uvHi = [0, 0, 0];

function crossSection(min: number, max: number): void {
  lo[0] = lo[1] = lo[2] = min;
  hi[0] = hi[1] = hi[2] = max;
}

/** Bit mask of the faces (Face order) towards which the pipe at volume index `p` grows an arm. */
export function pipeArms(id: number, p: number): number {
  const family = PIPE_FAMILY[id];
  let arms = 0;
  for (let f = 0; f < 6; f++) if ((PIPE_JOINS[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] & family) !== 0) arms |= 1 << f;
  return arms;
}

export function pipe(b: Builder, slot: number, id: number, p: number, x: number, y: number, z: number): void {
  const arms = pipeArms(id, p);
  crossSection(PIPE_CORE_MIN, PIPE_CORE_MAX);
  box(b, slot, p, x, y, z, lo, hi, arms, 0);
  for (let f = 0; f < 6; f++) {
    if (((arms >> f) & 1) === 0) continue;
    const axis = f >> 1;
    const positive = (f & 1) === 0;
    const n = vol[p + D_FRONT[f]] & VOXEL_ID_MASK;
    const collar = PIPE_ENDPOINT[n] === 1;
    // The arm runs from the core to the cell face (or to the collar); both of its ends are hidden.
    const reach = collar ? 1 - PIPE_COLLAR_DEPTH : 1;
    crossSection(PIPE_CORE_MIN, PIPE_CORE_MAX);
    if (positive) { lo[axis] = PIPE_CORE_MAX; hi[axis] = reach; } else { lo[axis] = 1 - reach; hi[axis] = PIPE_CORE_MIN; }
    box(b, slot, p, x, y, z, lo, hi, 3 << (axis * 2), 0);
    if (!collar) continue;
    crossSection(PIPE_COLLAR_MIN, PIPE_COLLAR_MAX);
    if (positive) { lo[axis] = reach; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = 1 - reach; }
    // The collar samples the arm's band of the tile (its extra width would reach the tile's clear corners).
    for (let a = 0; a < 3; a++) {
      uvLo[a] = a === axis ? lo[a] : PIPE_CORE_MIN;
      uvHi[a] = a === axis ? hi[a] : PIPE_CORE_MAX;
    }
    const against = OPAQUE[n] === 1 ? 1 << f : 0;
    box(b, slot, p, x, y, z, lo, hi, against, 0, uvLo, uvHi);
  }
}
