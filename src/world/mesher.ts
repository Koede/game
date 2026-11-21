/**
 * Turns the voxels of a chunk (with its 3x3 neighbourhood for culling, ambient occlusion and light) into
 * the three draw batches of `ChunkMeshData`.
 *
 * Conventions for the renderer: triangles are counter-clockwise seen from outside; uv (0,0) is the
 * bottom-left corner of a face seen from outside and v points up (on top and bottom faces u points
 * east); partial shapes (slab, torch, cable, lowered liquid) sample the matching part of the texture.
 */
import { CHUNK_SIZE, Face, LIGHT_FLAG_EMISSIVE, LIGHT_FLAG_LIQUID, LIGHT_FLAG_SWAY, VOXEL_ID_MASK, WORLD_HEIGHT, type ChunkMeshData } from '../core/types';
import {
  BATCH, BATCH_CUTOUT, FACE_GLOW, FACE_LAYER, GLOWS, LIQUID, MERGES, OPAQUE, POWERED, SHAPE, SHAPE_CABLE, SHAPE_CROSS,
  SHAPE_CUBE, SHAPE_LIQUID, SHAPE_PIPE, SHAPE_SLAB, SHAPE_TORCH, faceSlot,
} from './blockTables';
import type { ChunkNeighborhood } from './chunk';
import { ID } from './ids';
import { LIGHT_H, LIGHT_VOLUME, LIGHT_W, computeLight, lightIndex } from './lighting';
import {
  AO_CURVE, CORNER_A, CORNER_B, D_CORNER, D_FRONT, D_SIDE1, D_SIDE2, FACE_SHADE, QBlock, QFlags, QShade, QSky, QU, QV, QX, QY, QZ,
  SY, VX, VY, VZ, box, builders, cellCoolBits, coolBits, lit, noHue, pushQuad, vol, type Builder,
} from './meshQuads';
import { LIQ, liquidShape } from './meshLiquid';
import { pipe } from './meshPipe';

export { LIGHT_COOL_MAX, LIGHT_COOL_SHIFT, LIGHT_FLAG_VIOLET } from './meshQuads';

export interface MeshInput {
  cx: number;
  cz: number;
  /** Voxels of the chunk (entry 4) and its neighbours; see ChunkNeighborhood. */
  chunks: ChunkNeighborhood;
  /** Result of computeLight(chunks) when the caller already has it. */
  light?: Uint8Array;
  /** The light colour computeLight wrote alongside `light` (its hueOut); all firelight when missing. */
  hue?: Uint8Array;
}

export { LIQUID_SURFACE } from './meshLiquid';
/** Side faces of moving water sample the tile stretched this much vertically: long streaks that run down fast. */
export const FALL_STRETCH = 0.5;

/** Light summed over the cells around one vertex (smooth lighting). */
const sums = { sky: 0, block: 0, cool: 0, violet: 0, cells: 0 };
function addCell(q: number): void {
  const l = lit.light[q];
  const block = l & 15;
  const h = lit.hue[q];
  sums.sky += l >> 4;
  sums.block += block;
  if (h !== 0) sums.cool += block;
  if (h === 2) sums.violet += block;
  sums.cells++;
}

/**
 * Faces of a full cube or a liquid cell, with ambient occlusion and smooth light. A liquid's top corners follow
 * meshLiquid's heights; moving water carries its flow in the texture coordinates and the flowing flag (liquid + sway
 * bits): its top face's v axis points along the flow and its side faces' v axis points down, so the shader only has
 * to scroll v (spec 18.4).
 */
function cubeFaces(v: number, id: number, p: number, x: number, y: number, z: number, liquid: boolean): void {
  const b = builders[BATCH[id]];
  const slot = faceSlot(v);
  const merges = MERGES[id] === 1;
  if (liquid) liquidShape(v, id, p, x, y, z);
  const scrollsTop = liquid && (LIQ.fx !== 0 || LIQ.fz !== 0);
  for (let f = 0; f < 6; f++) {
    const pf = p + D_FRONT[f];
    const nid = vol[pf] & VOXEL_ID_MASK;
    if (OPAQUE[nid] === 1 || (merges && nid === id)) continue;
    const side = f !== Face.PY && f !== Face.NY;
    let flags = 0;
    if (liquid) {
      flags = LIQUID[id] === 2 ? LIGHT_FLAG_EMISSIVE : 0;
      if (f === Face.PY) flags |= LIGHT_FLAG_LIQUID | (scrollsTop ? LIGHT_FLAG_SWAY : 0);
      else if (side && LIQ.moving) flags |= LIGHT_FLAG_LIQUID | LIGHT_FLAG_SWAY;
    } else if (FACE_GLOW[slot + f] === 1) flags = LIGHT_FLAG_EMISSIVE;
    for (let k = 0; k < 4; k++) {
      const c = f * 4 + k;
      const p1 = p + D_SIDE1[c];
      const p2 = p + D_SIDE2[c];
      const o1 = OPAQUE[vol[p1] & VOXEL_ID_MASK];
      const o2 = OPAQUE[vol[p2] & VOXEL_ID_MASK];
      sums.sky = sums.block = sums.cool = sums.violet = sums.cells = 0;
      addCell(pf);
      let ao = 0;
      if (o1 === 0) addCell(p1);
      if (o2 === 0) addCell(p2);
      if (o1 === 0 || o2 === 0) {
        const pc = p + D_CORNER[c];
        const oc = OPAQUE[vol[pc] & VOXEL_ID_MASK];
        if (oc === 0) addCell(pc);
        ao = 3 - o1 - o2 - oc;
      }
      const cells = sums.cells;
      const vy = liquid && VY[c] === 1 ? LIQ.h[VX[c] + 2 * VZ[c]] : VY[c];
      QX[k] = x + VX[c];
      QY[k] = y + vy;
      QZ[k] = z + VZ[c];
      if (scrollsTop && f === Face.PY) {
        const px = x + VX[c];
        const pz = z + VZ[c];
        QU[k] = px * LIQ.fz - pz * LIQ.fx;
        QV[k] = px * LIQ.fx + pz * LIQ.fz;
      } else {
        QU[k] = CORNER_A[k];
        QV[k] = !side ? CORNER_B[k] : liquid && LIQ.moving ? -vy * FALL_STRETCH : vy;
      }
      QSky[k] = (sums.sky * 17) / cells + 0.5;
      QBlock[k] = (sums.block * 17) / cells + 0.5;
      QShade[k] = FACE_SHADE[f] * AO_CURVE[ao] * 255;
      QFlags[k] = flags | coolBits(sums.block, sums.cool, sums.violet);
    }
    pushQuad(b, FACE_LAYER[slot + f]);
  }
}

const CROSS_LO = 0.15;
const CROSS_HI = 0.85;
/** Two diagonal quads, each drawn from both sides so the cutout material can keep back-face culling. */
function cross(b: Builder, slot: number, p: number, x: number, y: number, z: number, id: number): void {
  const cell = lit.light[p];
  // Glowcaps and crystals shine with their own (cool) light: drawn full-bright.
  const flags = GLOWS[id] === 1 ? LIGHT_FLAG_EMISSIVE : cellCoolBits(p);
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
      QFlags[k] = (CORNER_B[k] ? LIGHT_FLAG_SWAY : 0) | flags;
    }
    pushQuad(b, FACE_LAYER[slot]);
    pushQuad(b, FACE_LAYER[slot], true);
  }
}

// A torch is a post with a separate glowing tip, so the flame is crisply emissive and the stick is not.
const TORCH_TIP = 8 / 16;
const POST_LO = [7 / 16, 0, 7 / 16];
const POST_HI = [9 / 16, TORCH_TIP, 9 / 16];
const TIP_LO = [7 / 16, TORCH_TIP, 7 / 16];
const TIP_HI = [9 / 16, 10 / 16, 9 / 16];
const SKIP_TOP = 1 << Face.PY;
const SKIP_BOTTOM = 1 << Face.NY;
function torch(b: Builder, slot: number, p: number, x: number, y: number, z: number): void {
  box(b, slot, p, x, y, z, POST_LO, POST_HI, SKIP_TOP, 0);
  box(b, slot, p, x, y, z, TIP_LO, TIP_HI, SKIP_BOTTOM, LIGHT_FLAG_EMISSIVE);
}

const CORE_LO = 5 / 16;
const CORE_HI = 11 / 16;
const lo = [0, 0, 0];
const hi = [0, 0, 0];

/**
 * A cable is a small core with an arm towards every neighbouring cable or device. An arm's inner end is
 * hidden in the core; its outer end is capped unless it meets another cable's arm or an opaque block.
 */
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
    const nid = vol[p + D_FRONT[f]] & VOXEL_ID_MASK;
    const closed = OPAQUE[nid] === 1 || SHAPE[nid] === SHAPE_CABLE;
    box(b, slot, p, x, y, z, lo, hi, closed ? 3 << (axis * 2) : 1 << (f ^ 1), 0);
  }
}

const SLAB_LO = [0, 0, 0];
const SLAB_HI = [1, 0.5, 1];
function slab(b: Builder, slot: number, p: number, x: number, y: number, z: number): void {
  let skip = 0;
  for (let f = 0; f < 6; f++) if (f !== Face.PY && OPAQUE[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) skip |= 1 << f;
  box(b, slot, p, x, y, z, SLAB_LO, SLAB_HI, skip, 0);
}

const ownHue = new Uint8Array(LIGHT_VOLUME);

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
  if (input.light) {
    lit.light = input.light;
    lit.hue = input.hue ?? noHue();
  } else {
    lit.hue = ownHue;
    lit.light = computeLight(input.chunks, ownHue);
  }
  if (lit.light.length !== LIGHT_VOLUME || lit.hue.length !== LIGHT_VOLUME || LIGHT_H !== WORLD_HEIGHT + 2) {
    throw new Error('meshChunk: light volume has the wrong size');
  }
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
          case SHAPE_CROSS: cross(builders[BATCH[id]], faceSlot(v), p, x, y, z, id); break;
          case SHAPE_TORCH: torch(builders[BATCH_CUTOUT], faceSlot(v), p, x, y, z); break;
          case SHAPE_CABLE: cable(builders[BATCH[id]], faceSlot(v), p, x, y, z); break;
          case SHAPE_SLAB: slab(builders[BATCH[id]], faceSlot(v), p, x, y, z); break;
          case SHAPE_PIPE: pipe(builders[BATCH[id]], faceSlot(v), id, p, x, y, z); break;
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
