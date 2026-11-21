/**
 * Turns the voxels of a chunk (with its 3x3 neighbourhood for culling, ambient occlusion and light) into
 * the three draw batches of `ChunkMeshData`.
 *
 * Conventions for the renderer: triangles are counter-clockwise seen from outside; uv (0,0) is the
 * bottom-left corner of a face seen from outside and v points up (on top and bottom faces u points
 * east); partial shapes (slab, torch, cable, lowered liquid) sample the matching part of the texture.
 */
import { CHUNK_SIZE, FACE_DIRS, Face, LIGHT_FLAG_EMISSIVE, LIGHT_FLAG_LIQUID, LIGHT_FLAG_SWAY, VOXEL_ID_MASK, WORLD_HEIGHT, type ChunkMeshData, type MeshBatch } from '../core/types';
import {
  BATCH, BATCH_CUTOUT, FACE_GLOW, FACE_LAYER, LIQUID, MERGES, OPAQUE, POWERED, SHAPE, SHAPE_CABLE, SHAPE_CROSS,
  SHAPE_CUBE, SHAPE_LIQUID, SHAPE_SLAB, SHAPE_TORCH, faceSlot,
} from './blockTables';
import type { ChunkNeighborhood } from './chunk';
import { ID } from './ids';
import { LIGHT_H, LIGHT_VOLUME, LIGHT_W, computeLight, lightIndex } from './lighting';

export interface MeshInput {
  cx: number;
  cz: number;
  /** Voxels of the chunk (entry 4) and its neighbours; see ChunkNeighborhood. */
  chunks: ChunkNeighborhood;
  /** Result of computeLight(chunks) when the caller already has it. */
  light?: Uint8Array;
}

/** Height of a liquid's surface inside its cell when nothing of the same liquid lies above. */
export const LIQUID_SURFACE = 14 / 16;
const FACE_SHADE = [0.65, 0.65, 1, 0.5, 0.8, 0.8];
const AO_CURVE = [0.5, 0.67, 0.84, 1];
const U_AXIS = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
const V_AXIS = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const CORNER_A = [0, 1, 1, 0];
const CORNER_B = [0, 0, 1, 1];
const SY = LIGHT_W * LIGHT_W;
const offset = (v: readonly number[]): number => v[0] + v[2] * LIGHT_W + v[1] * SY;

// Per face and corner: the corner's position inside the unit cube, and where (relative to the block)
// the two edge neighbours and the diagonal neighbour that shade and light that corner are.
const VX = new Float32Array(24);
const VY = new Float32Array(24);
const VZ = new Float32Array(24);
const D_FRONT = new Int32Array(6);
const D_SIDE1 = new Int32Array(24);
const D_SIDE2 = new Int32Array(24);
const D_CORNER = new Int32Array(24);
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

class Builder {
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

const builders = [new Builder(), new Builder(), new Builder()];
const vol = new Uint16Array(LIGHT_VOLUME);
let light: Uint8Array = new Uint8Array(0);
// The quad being assembled.
const QX = new Float32Array(4);
const QY = new Float32Array(4);
const QZ = new Float32Array(4);
const QU = new Float32Array(4);
const QV = new Float32Array(4);
const QSky = new Uint8Array(4);
const QBlock = new Uint8Array(4);
const QShade = new Uint8Array(4);
const QFlags = new Uint8Array(4);

function pushQuad(b: Builder, layer: number, reversed = false): void {
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

/** Faces of a full cube or a liquid cell, with ambient occlusion and smooth light. */
function cubeFaces(v: number, id: number, p: number, x: number, y: number, z: number, liquid: boolean): void {
  const b = builders[BATCH[id]];
  const slot = faceSlot(v);
  const height = liquid && (vol[p + SY] & VOXEL_ID_MASK) !== id ? LIQUID_SURFACE : 1;
  const merges = MERGES[id] === 1;
  for (let f = 0; f < 6; f++) {
    const pf = p + D_FRONT[f];
    const nid = vol[pf] & VOXEL_ID_MASK;
    if (OPAQUE[nid] === 1 || (merges && nid === id)) continue;
    let flags = 0;
    if (liquid) flags = (f === Face.PY ? LIGHT_FLAG_LIQUID : 0) | (LIQUID[id] === 2 ? LIGHT_FLAG_EMISSIVE : 0);
    else if (FACE_GLOW[slot + f] === 1) flags = LIGHT_FLAG_EMISSIVE;
    const front = light[pf];
    for (let k = 0; k < 4; k++) {
      const c = f * 4 + k;
      const p1 = p + D_SIDE1[c];
      const p2 = p + D_SIDE2[c];
      const o1 = OPAQUE[vol[p1] & VOXEL_ID_MASK];
      const o2 = OPAQUE[vol[p2] & VOXEL_ID_MASK];
      let skySum = front >> 4;
      let blockSum = front & 15;
      let cells = 1;
      let ao = 0;
      if (o1 === 0) { skySum += light[p1] >> 4; blockSum += light[p1] & 15; cells++; }
      if (o2 === 0) { skySum += light[p2] >> 4; blockSum += light[p2] & 15; cells++; }
      if (o1 === 0 || o2 === 0) {
        const pc = p + D_CORNER[c];
        const oc = OPAQUE[vol[pc] & VOXEL_ID_MASK];
        if (oc === 0) { skySum += light[pc] >> 4; blockSum += light[pc] & 15; cells++; }
        ao = 3 - o1 - o2 - oc;
      }
      QX[k] = x + VX[c];
      QY[k] = y + VY[c] * height;
      QZ[k] = z + VZ[c];
      QU[k] = CORNER_A[k];
      QV[k] = f === Face.PY || f === Face.NY ? CORNER_B[k] : CORNER_B[k] * height;
      QSky[k] = (skySum * 17) / cells;
      QBlock[k] = (blockSum * 17) / cells;
      QShade[k] = FACE_SHADE[f] * AO_CURVE[ao] * 255;
      QFlags[k] = flags;
    }
    pushQuad(b, FACE_LAYER[slot + f]);
  }
}

/**
 * An axis-aligned box inside a cell, lit flatly with the cell's own light. `skip` is a bit mask of faces
 * to leave out; `topFlags` is set on the vertices of the box's upper edge.
 */
function box(b: Builder, slot: number, p: number, x: number, y: number, z: number, lo: readonly number[], hi: readonly number[], skip: number, topFlags: number): void {
  const cell = light[p];
  for (let f = 0; f < 6; f++) {
    if ((skip >> f) & 1) continue;
    const u = U_AXIS[f];
    const v = V_AXIS[f];
    for (let k = 0; k < 4; k++) {
      const c = f * 4 + k;
      const px = VX[c] ? hi[0] : lo[0];
      const py = VY[c] ? hi[1] : lo[1];
      const pz = VZ[c] ? hi[2] : lo[2];
      QX[k] = x + px;
      QY[k] = y + py;
      QZ[k] = z + pz;
      QU[k] = 0.5 + (px - 0.5) * u[0] + (py - 0.5) * u[1] + (pz - 0.5) * u[2];
      QV[k] = 0.5 + (px - 0.5) * v[0] + (py - 0.5) * v[1] + (pz - 0.5) * v[2];
      QSky[k] = (cell >> 4) * 17;
      QBlock[k] = (cell & 15) * 17;
      QShade[k] = FACE_SHADE[f] * 255;
      QFlags[k] = VY[c] ? topFlags : 0;
    }
    pushQuad(b, FACE_LAYER[slot + f]);
  }
}

const CROSS_LO = 0.15;
const CROSS_HI = 0.85;
/** Two diagonal quads, each drawn from both sides so the cutout material can keep back-face culling. */
function cross(b: Builder, slot: number, p: number, x: number, y: number, z: number): void {
  const cell = light[p];
  for (let d = 0; d < 2; d++) {
    for (let k = 0; k < 4; k++) {
      const a = CORNER_A[k];
      QX[k] = x + (a ? CROSS_HI : CROSS_LO);
      QY[k] = y + CORNER_B[k];
      QZ[k] = z + ((d === 0 ? a : 1 - a) ? CROSS_HI : CROSS_LO);
      QU[k] = a;
      QV[k] = CORNER_B[k];
      QSky[k] = (cell >> 4) * 17;
      QBlock[k] = (cell & 15) * 17;
      QShade[k] = 255;
      QFlags[k] = CORNER_B[k] ? LIGHT_FLAG_SWAY : 0;
    }
    pushQuad(b, FACE_LAYER[slot]);
    pushQuad(b, FACE_LAYER[slot], true);
  }
}

const TORCH_LO = [7 / 16, 0, 7 / 16];
const TORCH_HI = [9 / 16, 10 / 16, 9 / 16];
const CORE_LO = 5 / 16;
const CORE_HI = 11 / 16;
const lo = [0, 0, 0];
const hi = [0, 0, 0];

/** A cable is a small core with an arm towards every neighbouring cable or device. */
function cable(b: Builder, slot: number, p: number, x: number, y: number, z: number): void {
  let arms = 0;
  for (let f = 0; f < 6; f++) if (POWERED[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) arms |= 1 << f;
  lo[0] = lo[1] = lo[2] = CORE_LO;
  hi[0] = hi[1] = hi[2] = CORE_HI;
  box(b, slot, p, x, y, z, lo, hi, arms, 0);
  for (let f = 0; f < 6; f++) {
    if (((arms >> f) & 1) === 0) continue;
    const axis = f >> 1;
    lo[0] = lo[1] = lo[2] = CORE_LO;
    hi[0] = hi[1] = hi[2] = CORE_HI;
    if ((f & 1) === 0) { lo[axis] = CORE_HI; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = CORE_LO; }
    // Both ends of an arm are hidden: one inside the core, one against the neighbour.
    box(b, slot, p, x, y, z, lo, hi, 3 << (axis * 2), 0);
  }
}

const SLAB_LO = [0, 0, 0];
const SLAB_HI = [1, 0.5, 1];
function slab(b: Builder, slot: number, p: number, x: number, y: number, z: number): void {
  let skip = 0;
  for (let f = 0; f < 6; f++) if (f !== Face.PY && OPAQUE[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) skip |= 1 << f;
  box(b, slot, p, x, y, z, SLAB_LO, SLAB_HI, skip, 0);
}

function fillVolume(chunks: ChunkNeighborhood): void {
  vol.fill(ID.corestone, 0, SY);
  vol.fill(0, SY);
  for (let pz = 0; pz < LIGHT_W; pz++) {
    const nz = pz === 0 ? 0 : pz === LIGHT_W - 1 ? 2 : 1;
    const lz = (pz - 1) & (CHUNK_SIZE - 1);
    for (let nx = 0; nx < 3; nx++) {
      const voxels = chunks[nz * 3 + nx];
      if (!voxels) continue;
      // The west and east neighbours contribute one column each, the centre all sixteen.
      const srcX = nx === 0 ? CHUNK_SIZE - 1 : 0;
      const dstX = nx === 0 ? 0 : nx === 1 ? 1 : LIGHT_W - 1;
      const width = nx === 1 ? CHUNK_SIZE : 1;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const src = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + srcX;
        const dst = ((y + 1) * LIGHT_W + pz) * LIGHT_W + dstX;
        for (let k = 0; k < width; k++) vol[dst + k] = voxels[src + k];
      }
    }
  }
}

export function meshChunk(input: MeshInput): ChunkMeshData {
  if (!input.chunks[4]) throw new Error(`meshChunk ${input.cx},${input.cz}: the centre chunk is missing`);
  fillVolume(input.chunks);
  light = input.light ?? computeLight(input.chunks);
  if (light.length !== LIGHT_VOLUME || LIGHT_H !== WORLD_HEIGHT + 2) throw new Error('meshChunk: light volume has the wrong size');
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      let p = lightIndex(0, y, z);
      for (let x = 0; x < CHUNK_SIZE; x++, p++) {
        const v = vol[p];
        if (v === 0) continue;
        const id = v & VOXEL_ID_MASK;
        switch (SHAPE[id]) {
          case SHAPE_CUBE: cubeFaces(v, id, p, x, y, z, false); break;
          case SHAPE_LIQUID: cubeFaces(v, id, p, x, y, z, true); break;
          case SHAPE_CROSS: cross(builders[BATCH[id]], faceSlot(v), p, x, y, z); break;
          case SHAPE_TORCH: box(builders[BATCH_CUTOUT], faceSlot(v), p, x, y, z, TORCH_LO, TORCH_HI, 0, LIGHT_FLAG_EMISSIVE); break;
          case SHAPE_CABLE: cable(builders[BATCH[id]], faceSlot(v), p, x, y, z); break;
          case SHAPE_SLAB: slab(builders[BATCH[id]], faceSlot(v), p, x, y, z); break;
          default: break;
        }
      }
    }
  }
  return { cx: input.cx, cz: input.cz, opaque: builders[0].finish(), cutout: builders[1].finish(), translucent: builders[2].finish() };
}

/** The buffers of a mesh, for handing it to another thread without copying. */
export function meshBuffers(mesh: ChunkMeshData): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const batch of [mesh.opaque, mesh.cutout, mesh.translucent]) {
    out.push(batch.positions.buffer as ArrayBuffer, batch.uvs.buffer as ArrayBuffer, batch.layers.buffer as ArrayBuffer, batch.light.buffer as ArrayBuffer, batch.indices.buffer as ArrayBuffer);
  }
  return out;
}
