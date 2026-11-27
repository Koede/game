/**
 * The few curved shapes in the glassware (docs/api/glass.md "Curves"): most glass is still boxes, in keeping with the voxel
 * style. Only a helix tube (the condenser coil winding round its rod) is curved. It emits quads into the same Builder as
 * the boxes, with the cell's light and per-vertex shading from each vertex's normal, so it lights like the rest of the piece.
 */
import { FACE_GLOW, FACE_LAYER } from './blockTables';
import { cellCoolBits, lit, pushQuad, QBlock, QFlags, QShade, QSky, QU, QV, QX, QY, QZ, type Builder } from './meshQuads';

/** A helix tube in cell units (0..1): the centre line winds round the vertical axis through (cx, cz) from y0 to y1. */
export interface Helix {
  readonly cx: number;
  readonly cz: number;
  /** Radius of the centre line about the axis. */
  readonly radius: number;
  /** Radius of the tube itself. */
  readonly tube: number;
  readonly y0: number;
  readonly y1: number;
  readonly turns: number;
}

/** Sides of the tube's cross-section and steps per turn along the centre line. */
export const HELIX_SIDES = 8;
export const HELIX_STEPS_PER_TURN = 8;

/** Number of quads a helix tube emits, for a budget check. */
export function helixQuads(turns: number): number {
  return Math.ceil(turns * HELIX_STEPS_PER_TURN) * HELIX_SIDES;
}

/** Shade of a vertex from its outward normal, matching the box faces' FACE_SHADE (up 1, down 0.5, sides 0.65-0.8). */
function shadeOf(nx: number, ny: number): number {
  const base = 0.8 + (ny >= 0 ? 0.2 : 0.3) * ny;
  return Math.min(1, Math.max(0, base - 0.075 * Math.abs(nx)));
}

/** The Face-order index (PX, NX, PY, NY, PZ, NZ) of a normal's dominant axis, for the face's tile layer. */
function faceOfNormal(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ax >= ay && ax >= az) return nx >= 0 ? 0 : 1;
  if (ay >= az) return ny >= 0 ? 2 : 3;
  return nz >= 0 ? 4 : 5;
}

/**
 * Emits a helix tube at cell (x, y, z) with `slot`'s glass tiles. The tube is a sweep of a circle of radius `tube` along the
 * helix; its frame is exact (the radial direction is always normal to the helix), so the surface is smooth without
 * parallel transport. Open at both ends: the brass caps of the piece hide them.
 */
export function helixTube(b: Builder, slot: number, p: number, x: number, y: number, z: number, h: Helix): void {
  const steps = Math.ceil(h.turns * HELIX_STEPS_PER_TURN);
  const pitch = (h.y1 - h.y0) / (2 * Math.PI * h.turns); // dy per radian
  const cell = lit.light[p];
  const cool = cellCoolBits(p);
  // Vertex grid, (steps + 1) rings of HELIX_SIDES points, computed once.
  const pos: number[][] = [];
  const nor: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const th = 2 * Math.PI * h.turns * t;
    const c = Math.cos(th);
    const s = Math.sin(th);
    // Radial normal (c, 0, s); tangent of the centre line is (-s * R, pitch, c * R) before normalising.
    const tx = -s * h.radius;
    const ty = pitch;
    const tz = c * h.radius;
    const tl = Math.hypot(tx, ty, tz);
    const ux = tx / tl;
    const uy = ty / tl;
    const uz = tz / tl;
    // Binormal B = tangent x radial (already unit: the radial is perpendicular to the tangent).
    const bx = uy * s;
    const by = uz * c - ux * s;
    const bz = -uy * c;
    const cx = h.cx + h.radius * c;
    const cy = h.y0 + (h.y1 - h.y0) * t;
    const cz = h.cz + h.radius * s;
    for (let j = 0; j < HELIX_SIDES; j++) {
      const phi = (2 * Math.PI * j) / HELIX_SIDES;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const nx = cp * c + sp * bx;
      const ny = sp * by;
      const nz = cp * s + sp * bz;
      pos.push([cx + h.tube * nx, cy + h.tube * ny, cz + h.tube * nz]);
      nor.push([nx, ny, nz]);
    }
  }
  const at = (i: number, j: number): number => i * HELIX_SIDES + (j % HELIX_SIDES);
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < HELIX_SIDES; j++) {
      const quad = [at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)];
      const avg = [0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const n = nor[quad[k]];
        avg[0] += n[0]; avg[1] += n[1]; avg[2] += n[2];
      }
      const face = faceOfNormal(avg[0], avg[1], avg[2]);
      const glow = FACE_GLOW[slot + face] === 1 ? 1 : 0;
      // Geometric normal of the quad (corner 0 -> 1 -> 2), to choose the winding that faces outward.
      const a = pos[quad[0]];
      const bb = pos[quad[1]];
      const c3 = pos[quad[2]];
      const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
      const e2 = [c3[0] - a[0], c3[1] - a[1], c3[2] - a[2]];
      const gx = e1[1] * e2[2] - e1[2] * e2[1];
      const gy = e1[2] * e2[0] - e1[0] * e2[2];
      const gz = e1[0] * e2[1] - e1[1] * e2[0];
      const reversed = gx * avg[0] + gy * avg[1] + gz * avg[2] < 0;
      for (let k = 0; k < 4; k++) {
        const v = quad[k];
        const q = pos[v];
        const n = nor[v];
        QX[k] = x + q[0];
        QY[k] = y + q[1];
        QZ[k] = z + q[2];
        QU[k] = i / steps;
        QV[k] = (j % HELIX_SIDES) / HELIX_SIDES;
        QSky[k] = (cell >> 4) * 17;
        QBlock[k] = (cell & 15) * 17;
        QShade[k] = shadeOf(n[0], n[1]) * 255;
        QFlags[k] = glow | cool;
      }
      pushQuad(b, FACE_LAYER[slot + face], reversed);
    }
  }
}
