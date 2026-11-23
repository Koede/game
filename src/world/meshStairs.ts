/**
 * Stairs and slopes (docs/api/stairs.md). Both are oriented: the front (the voxel's Facing) is the low side, so a stair faces the
 * player who placed it and rises away from them. `stairs` is a half-height step plus a half-height riser over the back half;
 * `slope` is a wedge from nothing at the front edge to a full-height back wall. Collision uses the stair boxes for both
 * (src/core/stairShape.ts).
 */
import { turn } from '../core/stairShape';
import { Face, voxelFacing, type Facing } from '../core/types';
import { FACE_LAYER } from './blockTables';
import {
  FACE_SHADE, QBlock, QFlags, QShade, QSky, QU, QV, QX, QY, QZ, box, cellCoolBits, lit, pushQuad, type Builder,
} from './meshQuads';

const lo = [0, 0, 0];
const hi = [0, 0, 0];

export function stairs(b: Builder, slot: number, v: number, p: number, x: number, y: number, z: number): void {
  const facing = voxelFacing(v);
  // The step: the whole cell, half height.
  lo[0] = 0; lo[1] = 0; lo[2] = 0;
  hi[0] = 1; hi[1] = 0.5; hi[2] = 1;
  box(b, slot, p, x, y, z, lo, hi, 0, 0);
  // The riser: the back half, from the top of the step to the top of the cell (its underside is inside the step).
  const [ax, az] = turn(0, 0.5, facing);
  const [bx, bz] = turn(1, 1, facing);
  lo[0] = Math.min(ax, bx); hi[0] = Math.max(ax, bx);
  lo[2] = Math.min(az, bz); hi[2] = Math.max(az, bz);
  lo[1] = 0.5; hi[1] = 1;
  box(b, slot, p, x, y, z, lo, hi, 1 << Face.NY, 0);
}

type Pt = readonly [number, number, number];

/** One four-cornered face (CCW seen from outside; a triangle repeats its last corner), cell-local points turned for `facing`. */
function face(
  b: Builder, layer: number, p: number, x: number, y: number, z: number, facing: Facing, shade: number,
  pts: readonly Pt[], uv: readonly (readonly [number, number])[],
): void {
  const cell = lit.light[p];
  const cool = cellCoolBits(p);
  for (let k = 0; k < 4; k++) {
    const [px, py, pz] = pts[k];
    const [tx, tz] = turn(px, pz, facing);
    QX[k] = x + tx;
    QY[k] = y + py;
    QZ[k] = z + tz;
    QU[k] = uv[k][0];
    QV[k] = uv[k][1];
    QSky[k] = (cell >> 4) * 17;
    QBlock[k] = (cell & 15) * 17;
    QShade[k] = shade * 255;
    QFlags[k] = cool;
  }
  pushQuad(b, layer);
}

export function slope(b: Builder, slot: number, v: number, p: number, x: number, y: number, z: number): void {
  const f = voxelFacing(v);
  const top = FACE_LAYER[slot + Face.PY];
  const side = FACE_LAYER[slot + Face.PX];
  const bottom = FACE_LAYER[slot + Face.NY];
  // Canonical (facing North): low edge at z = 0, high back wall at z = 1.
  const F0: Pt = [0, 0, 0];
  const F1: Pt = [1, 0, 0];
  const B0: Pt = [0, 0, 1];
  const B1: Pt = [1, 0, 1];
  const T0: Pt = [0, 1, 1];
  const T1: Pt = [1, 1, 1];
  const sh = FACE_SHADE;
  face(b, top, p, x, y, z, f, sh[Face.PY] * 0.9, [F0, T0, T1, F1], [[0, 0], [0, 1], [1, 1], [1, 0]]);
  face(b, side, p, x, y, z, f, sh[Face.PZ], [B0, B1, T1, T0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  face(b, side, p, x, y, z, f, sh[Face.NX], [F0, B0, T0, T0], [[0, 0], [1, 0], [1, 1], [1, 1]]);
  face(b, side, p, x, y, z, f, sh[Face.PX], [F1, T1, B1, B1], [[0, 0], [1, 1], [1, 0], [1, 0]]);
  face(b, bottom, p, x, y, z, f, sh[Face.NY], [F0, F1, B1, B0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}
