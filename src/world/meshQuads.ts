/**
 * The quad machinery shared by the mesher's shapes: growable per-batch vertex builders, the padded voxel
 * volume and light of the chunk being meshed, per-face corner tables, and `box` (an axis-aligned box inside a
 * cell, lit flatly with the cell's light). Module state: one chunk is meshed at a time per thread.
 */
import { FACE_DIRS, type MeshBatch } from '../core/types';
import { FACE_GLOW, FACE_LAYER } from './blockTables';
import { LIGHT_VOLUME, LIGHT_W } from './lighting';

/** Per-vertex light flags beyond the core's three: the block light is partly a cool glow (spec 14). */
export const LIGHT_FLAG_VIOLET = 8;
/** Bits 4-7 of the flags byte: the share (0..15 of 15) of the block light that comes from cool emitters. */
export const LIGHT_COOL_SHIFT = 4;
export const LIGHT_COOL_MAX = 15;

export const FACE_SHADE = [0.65, 0.65, 1, 0.5, 0.8, 0.8];
export const AO_CURVE = [0.5, 0.67, 0.84, 1];
export const U_AXIS = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
export const V_AXIS = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
export const CORNER_A = [0, 1, 1, 0];
export const CORNER_B = [0, 0, 1, 1];
export const SY = LIGHT_W * LIGHT_W;
const offset = (v: readonly number[]): number => v[0] + v[2] * LIGHT_W + v[1] * SY;

// Per face and corner: the corner's position inside the unit cube, and where (relative to the block)
// the two edge neighbours and the diagonal neighbour that shade and light that corner are.
export const VX = new Float32Array(24);
export const VY = new Float32Array(24);
export const VZ = new Float32Array(24);
export const D_FRONT = new Int32Array(6);
export const D_SIDE1 = new Int32Array(24);
export const D_SIDE2 = new Int32Array(24);
export const D_CORNER = new Int32Array(24);
for (let f = 0; f < 6; f++) {
  const n = FACE_DIRS[f];
  const u = U_AXIS[f];
  const v = V_AXIS[f];
  D_FRONT[f] = offset(n);
  for (let k = 0; k < 4; k++) {
    const a = CORNER_A[k] - 0.5;
    const b = CORNER_B[k] - 0.5;
    VX[f * 4 + k] = 0.5 + 0.5 * n[0] + a * u[0] + b * v[0];
    VY[f * 4 + k] = 0.5 + 0.5 * n[1] + a * u[1] + b * v[1];
    VZ[f * 4 + k] = 0.5 + 0.5 * n[2] + a * u[2] + b * v[2];
    D_SIDE1[f * 4 + k] = D_FRONT[f] + offset(u) * (a > 0 ? 1 : -1);
    D_SIDE2[f * 4 + k] = D_FRONT[f] + offset(v) * (b > 0 ? 1 : -1);
    D_CORNER[f * 4 + k] = D_SIDE1[f * 4 + k] + offset(v) * (b > 0 ? 1 : -1);
  }
}

export class Builder {
  positions = new Float32Array(3 * 2048);
  uvs = new Float32Array(2 * 2048);
  layers = new Float32Array(2048);
  light = new Uint8Array(4 * 2048);
  indices = new Uint32Array(3072);
  verts = 0;
  count = 0;

  reserveQuad(): void {
    if (this.verts + 4 <= this.layers.length) return;
    const grow = <T extends Float32Array | Uint8Array | Uint32Array>(old: T): T => {
      const next = new (old.constructor as new (n: number) => T)(old.length * 2);
      next.set(old);
      return next;
    };
    this.positions = grow(this.positions);
    this.uvs = grow(this.uvs);
    this.layers = grow(this.layers);
    this.light = grow(this.light);
    this.indices = grow(this.indices);
  }

  /** Exactly-sized copies, ready to be transferred to another thread. */
  finish(): MeshBatch {
    const batch = {
      positions: this.positions.slice(0, this.verts * 3),
      uvs: this.uvs.slice(0, this.verts * 2),
      layers: this.layers.slice(0, this.verts),
      light: this.light.slice(0, this.verts * 4),
      indices: this.indices.slice(0, this.count),
    };
    this.verts = 0;
    this.count = 0;
    return batch;
  }
}

/** One builder per batch: opaque, cutout, translucent (the BATCH_* codes). */
export const builders = [new Builder(), new Builder(), new Builder()];
/** The chunk's voxels plus a one-cell border, addressed like the light volume (lighting.lightIndex). */
export const vol = new Uint16Array(LIGHT_VOLUME);
const NO_HUE = new Uint8Array(LIGHT_VOLUME);
/** Light and light colour (lighting.computeLight's hue: 0 warm, 1 cyan, 2 violet) of the chunk being meshed. */
export const lit = { light: new Uint8Array(0), hue: NO_HUE };
export const noHue = (): Uint8Array => NO_HUE;

// The quad being assembled.
export const QX = new Float32Array(4);
export const QY = new Float32Array(4);
export const QZ = new Float32Array(4);
export const QU = new Float32Array(4);
export const QV = new Float32Array(4);
export const QSky = new Uint8Array(4);
export const QBlock = new Uint8Array(4);
export const QShade = new Uint8Array(4);
export const QFlags = new Uint8Array(4);

/**
 * Flag bits for a vertex whose block light (summed over the cells averaged at it) has `cool` from cyan or violet
 * emitters, `violet` of that from violet ones.
 */
export function coolBits(block: number, cool: number, violet: number): number {
  if (cool <= 0 || block <= 0) return 0;
  const share = Math.round((cool * LIGHT_COOL_MAX) / block);
  if (share === 0) return 0;
  return (share << LIGHT_COOL_SHIFT) | (violet * 2 > cool ? LIGHT_FLAG_VIOLET : 0);
}

/** Cool-light flag bits of a single cell's light. */
export function cellCoolBits(p: number): number {
  const h = lit.hue[p];
  return h === 0 || (lit.light[p] & 15) === 0 ? 0 : (LIGHT_COOL_MAX << LIGHT_COOL_SHIFT) | (h === 2 ? LIGHT_FLAG_VIOLET : 0);
}

export function pushQuad(b: Builder, layer: number, reversed = false): void {
  b.reserveQuad();
  const first = b.verts;
  for (let k = 0; k < 4; k++) {
    const v = first + k;
    b.positions[v * 3] = QX[k];
    b.positions[v * 3 + 1] = QY[k];
    b.positions[v * 3 + 2] = QZ[k];
    b.uvs[v * 2] = QU[k];
    b.uvs[v * 2 + 1] = QV[k];
    b.layers[v] = layer;
    b.light[v * 4] = QSky[k];
    b.light[v * 4 + 1] = QBlock[k];
    b.light[v * 4 + 2] = QShade[k];
    b.light[v * 4 + 3] = QFlags[k];
  }
  // Split along the brighter diagonal, so a single dark corner shades the same way in every orientation.
  const m = (k: number): number => QShade[k] + Math.max(QSky[k], QBlock[k]);
  const s = m(0) + m(2) >= m(1) + m(3) ? 0 : 1;
  const i = b.count;
  const mid = reversed ? 3 : 1;
  const end = reversed ? 1 : 3;
  b.indices[i] = first + s;
  b.indices[i + 1] = first + ((s + mid) & 3);
  b.indices[i + 2] = first + ((s + 2) & 3);
  b.indices[i + 3] = first + s;
  b.indices[i + 4] = first + ((s + 2) & 3);
  b.indices[i + 5] = first + ((s + end) & 3);
  b.verts += 4;
  b.count += 6;
}

/**
 * An axis-aligned box inside a cell, lit flatly with the cell's own light. `skip` is a bit mask of faces
 * to leave out; `flags` go on every vertex. Faces showing the block's glowing active texture are
 * emissive, as on full cubes. Texture coordinates follow the box's position in the cell, or the box
 * `uvLo`..`uvHi` when given (a part that must sample a different region of the tile than it covers).
 */
export function box(
  b: Builder, slot: number, p: number, x: number, y: number, z: number,
  lo: readonly number[], hi: readonly number[], skip: number, flags: number,
  uvLo: readonly number[] = lo, uvHi: readonly number[] = hi,
): void {
  const cell = lit.light[p];
  const cool = cellCoolBits(p);
  for (let f = 0; f < 6; f++) {
    if ((skip >> f) & 1) continue;
    const u = U_AXIS[f];
    const v = V_AXIS[f];
    const glow = FACE_GLOW[slot + f] === 1 ? 1 : 0;
    for (let k = 0; k < 4; k++) {
      const c = f * 4 + k;
      QX[k] = x + (VX[c] ? hi[0] : lo[0]);
      QY[k] = y + (VY[c] ? hi[1] : lo[1]);
      QZ[k] = z + (VZ[c] ? hi[2] : lo[2]);
      const px = VX[c] ? uvHi[0] : uvLo[0];
      const py = VY[c] ? uvHi[1] : uvLo[1];
      const pz = VZ[c] ? uvHi[2] : uvLo[2];
      QU[k] = 0.5 + (px - 0.5) * u[0] + (py - 0.5) * u[1] + (pz - 0.5) * u[2];
      QV[k] = 0.5 + (px - 0.5) * v[0] + (py - 0.5) * v[1] + (pz - 0.5) * v[2];
      QSky[k] = (cell >> 4) * 17;
      QBlock[k] = (cell & 15) * 17;
      QShade[k] = FACE_SHADE[f] * 255;
      QFlags[k] = glow | flags | cool;
    }
    pushQuad(b, FACE_LAYER[slot + f]);
  }
}
