/** Draws a hand station (stationShapes.ts) as its boxes, skipping faces that sit flush against an opaque neighbour. */
import { LIGHT_FLAG_EMISSIVE, VOXEL_ID_MASK, type Facing } from '../core/types';
import { textureLayer } from '../core/registry';
import { FACE_GLOW, FACE_LAYER, OPAQUE } from './blockTables';
import { boxCorners, FACE_NAMES, miniByIndex, type MiniBox, type MiniModel } from './miniModel';
import {
  box, cellCoolBits, CORNER_A, CORNER_B, D_FRONT, FACE_SHADE, lit, pushQuad, QBlock, QFlags, QShade, QSky, QU, QV, QX, QY, QZ, U_AXIS, V_AXIS, VX, VY, VZ, vol,
  type Builder,
} from './meshQuads';
import { MINI_BASE, stationBoxesByIndex, turnBox } from './stationShapes';

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const turned = [0, 0, 0, 0, 0, 0];

const MINI_CORNERS = new Array<number>(24);
const MINI_TURNED = new Array<number>(24);

/** Draws one miniblock model (miniModel.ts) in a cell: every box of it that is not a moving part. */
export function miniShape(b: Builder, slot: number, model: MiniModel, facing: Facing, p: number, x: number, y: number, z: number): void {
  for (const mb of model.boxes) if (!mb.part) miniBox(b, slot, mb, facing, p, x, y, z);
}

function miniBox(b: Builder, slot: number, mb: MiniBox, facing: Facing, p: number, x: number, y: number, z: number): void {
  const c = boxCorners(mb, MINI_CORNERS);
  // Turn every corner about the cell centre to the facing: (x, z) -> (16 - z, x) per quarter turn.
  for (let i = 0; i < 8; i++) {
    let px = c[i * 3], pz = c[i * 3 + 2];
    for (let k = 0; k < facing; k++) [px, pz] = [16 - pz, px];
    MINI_TURNED[i * 3] = px;
    MINI_TURNED[i * 3 + 1] = c[i * 3 + 1];
    MINI_TURNED[i * 3 + 2] = pz;
  }
  const t = MINI_TURNED;
  const aligned = !mb.rot || mb.rot.angle % 90 === 0;
  const cell = lit.light[p];
  const cool = cellCoolBits(p);
  const shade = mb.shade ?? 1;
  for (let f = 0; f < 6; f++) {
    const opt = mb.faces?.[FACE_NAMES[f]];
    if (opt?.hide) continue;
    // Which way the face points in the world: the turned corners' own geometry (corner 0 of the face, and two of its edges).
    const c0 = f * 4;
    const idx = (k: number): number => ((VX[c0 + k] ? 1 : 0) | (VY[c0 + k] ? 2 : 0) | (VZ[c0 + k] ? 4 : 0)) * 3;
    const a = idx(0), bb = idx(1), cc = idx(2);
    const ex = t[bb] - t[a], ey = t[bb + 1] - t[a + 1], ez = t[bb + 2] - t[a + 2];
    const fx = t[cc] - t[a], fy = t[cc + 1] - t[a + 1], fz = t[cc + 2] - t[a + 2];
    const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    // Winding of the face tables is outward when the box is not mirrored; the dominant axis and its sign give the world face.
    const sgn = (v: number, d: number): number => (v >= 0 ? d : d + 1);
    const wf = ax >= ay && ax >= az ? sgn(nx, 0) : ay >= az ? sgn(ny, 2) : sgn(nz, 4);
    if (aligned && !opt?.tex) {
      // A flush face against an opaque neighbour is never seen.
      let min = 16, max = 0;
      const axis = wf >> 1;
      for (let i = 0; i < 8; i++) { min = Math.min(min, t[i * 3 + axis]); max = Math.max(max, t[i * 3 + axis]); }
      const flush = (wf & 1) === 0 ? max === 16 : min === 0;
      if (flush && OPAQUE[vol[p + D_FRONT[wf]] & VOXEL_ID_MASK] === 1) continue;
    }
    const glow = mb.emissive ? LIGHT_FLAG_EMISSIVE : FACE_GLOW[slot + wf] === 1 ? 1 : 0;
    const u = U_AXIS[wf], v = V_AXIS[wf];
    for (let k = 0; k < 4; k++) {
      const o = idx(k);
      const px = t[o] / 16, py = t[o + 1] / 16, pz = t[o + 2] / 16;
      QX[k] = x + px;
      QY[k] = y + py;
      QZ[k] = z + pz;
      if (opt?.uv) {
        QU[k] = (opt.uv[0] + CORNER_A[k] * (opt.uv[2] - opt.uv[0])) / 16;
        QV[k] = (opt.uv[1] + CORNER_B[k] * (opt.uv[3] - opt.uv[1])) / 16;
      } else {
        QU[k] = 0.5 + (px - 0.5) * u[0] + (py - 0.5) * u[1] + (pz - 0.5) * u[2];
        QV[k] = 0.5 + (px - 0.5) * v[0] + (py - 0.5) * v[1] + (pz - 0.5) * v[2];
      }
      QSky[k] = (cell >> 4) * 17;
      QBlock[k] = (cell & 15) * 17;
      QShade[k] = Math.min(255, FACE_SHADE[wf] * shade * 255);
      QFlags[k] = glow | cool;
    }
    pushQuad(b, opt?.tex ? textureLayer(opt.tex) : FACE_LAYER[slot + wf]);
  }
}

export function stationShape(b: Builder, slot: number, index: number, facing: Facing, p: number, x: number, y: number, z: number): void {
  const mini = miniByIndex(index - MINI_BASE);
  if (mini) {
    miniShape(b, slot, mini, facing, p, x, y, z);
    return;
  }
  for (const raw of stationBoxesByIndex(index)) {
    turnBox(raw, facing, turned);
    let skip = 0;
    for (let f = 0; f < 6; f++) {
      const axis = f >> 1;
      const flush = (f & 1) === 0 ? turned[axis + 3] === 16 : turned[axis] === 0;
      if (flush && OPAQUE[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) skip |= 1 << f;
    }
    for (let a = 0; a < 3; a++) {
      lo[a] = turned[a] / 16;
      hi[a] = turned[a + 3] / 16;
    }
    box(b, slot, p, x, y, z, lo, hi, skip, 0);
  }
}
