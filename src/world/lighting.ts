/**
 * Stateless lighting of one chunk from the voxels of its 3x3 neighbourhood. Light travels at most 15
 * blocks and the neighbourhood reaches 16 blocks past the chunk, so the result is exact without keeping
 * any light data between calls.
 *
 * Sky light is 15 in every cell with nothing but clear blocks above it and loses 1 per block from there
 * (3 per block of water). Block light spreads from emitters the same way.
 */
import { CHUNK_SIZE, VOXEL_ID_MASK, WORLD_HEIGHT } from '../core/types';
import { EMIT, EMIT_ACTIVE, LIGHT_BLOCKED, LIGHT_CLASS, LIGHT_CLEAR, LIGHT_FILTER, LIGHT_HUE } from './blockTables';
import type { ChunkNeighborhood } from './chunk';

/** The light volume covers the chunk plus one cell on every side (also above and below). */
export const LIGHT_W = CHUNK_SIZE + 2;
export const LIGHT_H = WORLD_HEIGHT + 2;
export const LIGHT_VOLUME = LIGHT_W * LIGHT_W * LIGHT_H;
/** Index into a light volume (and the mesher's padded voxel volume). lx, lz: -1..16, y: -1..WORLD_HEIGHT. */
export const lightIndex = (lx: number, y: number, lz: number): number => ((y + 1) * LIGHT_W + lz + 1) * LIGHT_W + lx + 1;
/** One byte per cell: sky light in the high nibble, block light in the low one. */
export const skyLightOf = (cell: number): number => cell >> 4;
export const blockLightOf = (cell: number): number => cell & 15;

const W = CHUNK_SIZE * 3;
const AREA = W * W;
const VOLUME = AREA * WORLD_HEIGHT;
const ACTIVE_BIT = 1 << 12;
const cls = new Uint8Array(VOLUME);
const sky = new Uint8Array(VOLUME);
const blk = new Uint8Array(VOLUME);
/** Colour of the block light in each cell: the LIGHT_HUE of the emitter that lights it most (0 warm). */
const hue = new Uint8Array(VOLUME);
const skyFloor = new Int16Array(AREA);
const QUEUE_MASK = (1 << 20) - 1;
const queue = new Int32Array(QUEUE_MASK + 1);

/** Spreads light from the queued cells; with `colour`, each cell also takes the colour of the cell that lit it. */
function flood(light: Uint8Array, count: number, colour: Uint8Array | null): void {
  let head = 0;
  let tail = count;
  while (head < tail) {
    const i = queue[head++ & QUEUE_MASK];
    const level = light[i];
    if (level <= 1) continue;
    const y = (i / AREA) | 0;
    const rest = i - y * AREA;
    const z = (rest / W) | 0;
    const x = rest - z * W;
    for (let dir = 0; dir < 6; dir++) {
      let n: number;
      if (dir === 0) { if (x === W - 1) continue; n = i + 1; }
      else if (dir === 1) { if (x === 0) continue; n = i - 1; }
      else if (dir === 2) { if (y === WORLD_HEIGHT - 1) continue; n = i + AREA; }
      else if (dir === 3) { if (y === 0) continue; n = i - AREA; }
      else if (dir === 4) { if (z === W - 1) continue; n = i + W; }
      else { if (z === 0) continue; n = i - W; }
      const c = cls[n];
      if (c === LIGHT_BLOCKED) continue;
      const next = level - (c === LIGHT_FILTER ? 3 : 1);
      if (next > light[n]) {
        light[n] = next;
        if (colour) colour[n] = colour[i];
        queue[tail++ & QUEUE_MASK] = n;
      }
    }
  }
}

/**
 * Light of the centre chunk of `chunks` plus a one-cell border: a Uint8Array of LIGHT_VOLUME cells,
 * addressed with `lightIndex`. Missing neighbours count as open air. Cells above the world are fully
 * sky-lit, cells below it are dark. With `hueOut` (LIGHT_VOLUME bytes) it also writes the colour of each
 * cell's block light there: the LIGHT_HUE of the emitter that lights it most (0 warm, 1 cyan, 2 violet).
 */
export function computeLight(chunks: ChunkNeighborhood, hueOut?: Uint8Array): Uint8Array {
  cls.fill(LIGHT_CLEAR);
  sky.fill(0);
  blk.fill(0);
  hue.fill(0);
  let count = 0;
  for (let n = 0; n < 9; n++) {
    const voxels = chunks[n];
    if (!voxels) continue;
    const ox = (n % 3) * CHUNK_SIZE;
    const oz = Math.floor(n / 3) * CHUNK_SIZE;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const src = (y * CHUNK_SIZE + lz) * CHUNK_SIZE;
        const dst = y * AREA + (oz + lz) * W + ox;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const v = voxels[src + lx];
          if (v === 0) continue;
          const id = v & VOXEL_ID_MASK;
          cls[dst + lx] = LIGHT_CLASS[id];
          const emit = (v & ACTIVE_BIT) !== 0 ? EMIT_ACTIVE[id] : EMIT[id];
          if (emit > 0) {
            blk[dst + lx] = emit;
            hue[dst + lx] = LIGHT_HUE[id];
            queue[count++] = dst + lx;
          }
        }
      }
    }
  }
  flood(blk, count, hue);

  // Straight down from the sky: full light through clear cells, then fading through water.
  for (let c = 0; c < AREA; c++) {
    let y = WORLD_HEIGHT - 1;
    let i = c + y * AREA;
    while (y >= 0 && cls[i] === LIGHT_CLEAR) {
      sky[i] = 15;
      y--;
      i -= AREA;
    }
    skyFloor[c] = y + 1;
  }
  count = 0;
  for (let c = 0; c < AREA; c++) {
    const floor = skyFloor[c];
    let level = 12;
    for (let y = floor - 1, i = c + y * AREA; y >= 0 && level > 0 && cls[i] === LIGHT_FILTER; y--, i -= AREA, level -= 3) {
      sky[i] = level;
      queue[count++] = i;
    }
    // Sky-lit cells beside a column that is shaded at the same height light it sideways.
    const x = c % W;
    const z = (c / W) | 0;
    let top = floor;
    if (x > 0 && skyFloor[c - 1] > top) top = skyFloor[c - 1];
    if (x < W - 1 && skyFloor[c + 1] > top) top = skyFloor[c + 1];
    if (z > 0 && skyFloor[c - W] > top) top = skyFloor[c - W];
    if (z < W - 1 && skyFloor[c + W] > top) top = skyFloor[c + W];
    if (top > WORLD_HEIGHT) top = WORLD_HEIGHT;
    for (let y = floor; y < top; y++) queue[count++] = c + y * AREA;
  }
  flood(sky, count, null);

  const out = new Uint8Array(LIGHT_VOLUME);
  out.fill(0xf0, LIGHT_W * LIGHT_W * (LIGHT_H - 1));
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = -1; lz <= CHUNK_SIZE; lz++) {
      const src = y * AREA + (lz + CHUNK_SIZE) * W + CHUNK_SIZE - 1;
      const dst = lightIndex(-1, y, lz);
      for (let k = 0; k < LIGHT_W; k++) out[dst + k] = (sky[src + k] << 4) | blk[src + k];
      if (hueOut) for (let k = 0; k < LIGHT_W; k++) hueOut[dst + k] = hue[src + k];
    }
  }
  if (hueOut) {
    hueOut.fill(0, 0, LIGHT_W * LIGHT_W);
    hueOut.fill(0, LIGHT_W * LIGHT_W * (LIGHT_H - 1));
  }
  return out;
}

/**
 * A hash of the light on each side of a chunk, in the order +X, -X, +Z, -Z (SIDE_DX / SIDE_DZ of chunk.ts):
 * the last column of cells inside the chunk and the first one outside it, full height, walked in world
 * order. So a chunk's +X hash and its east neighbour's -X hash cover the same cells the same way and are
 * equal exactly when both meshes were built with the same light along that border (light within one cell
 * of a chunk is exact, see computeLight).
 */
export function borderHashes(light: Uint8Array): Uint32Array {
  const out = new Uint32Array(4);
  for (let side = 0; side < 4; side++) {
    const alongX = side >= 2;
    const first = side === 0 || side === 2 ? CHUNK_SIZE - 1 : -1;
    let h = 0x811c9dc5;
    for (let y = -1; y <= WORLD_HEIGHT; y++) {
      for (let a = -1; a <= CHUNK_SIZE; a++) {
        for (let b = first; b <= first + 1; b++) {
          h = Math.imul(h ^ light[alongX ? lightIndex(a, y, b) : lightIndex(b, y, a)], 0x01000193);
        }
      }
    }
    out[side] = h >>> 0;
  }
  return out;
}
