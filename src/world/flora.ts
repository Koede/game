/**
 * Trees. The world is divided into 5x5 cells; each cell holds at most one tree whose existence, place and
 * shape are pure functions of (seed, cell), so a chunk can draw the parts of its neighbours' trees that
 * reach into it without knowing what has been generated before.
 *
 * Broad old oaks (2x2 trunk, wide crown) grow only in "broad cells" (even cells picked by a hash); the eight
 * cells around a broad oak stay empty so its crown has room. Whether a cell is suppressed is itself a pure
 * function of the neighbouring broad cell, so the rule never depends on generation order.
 */
import { hash32 } from '../core/math';
import { AIR, CHUNK_SIZE, WORLD_HEIGHT, voxelIndex } from '../core/types';
import { ID } from './ids';
import {
  Column, FROSTFELL, LIQUID_NONE, MARSH, SCAR, SURFACE_BASALT, SURFACE_GRASS, SURFACE_SNOW, TREE_LINE, WATER_TOP, WOODLAND,
  caveMouth, forestDensity, sampleColumn, surfaceKind, type Terrain,
} from './terrain';

export const TREE_CELL = 5;
/** Widest reach of a crown from its root column: how far outside a chunk a tree can be and still reach into it. */
export const CANOPY = 6;
const MAX_DENSITY = 0.6;

export const OAK = 0;
export const OAK_BUSH = 1;
export const OAK_BROAD = 2;
export const PINE = 3;
export const PINE_TALL = 4;
export const WILLOW = 5;
export const SNAG = 6;

export interface TreeSite {
  /** Root column; a broad oak's trunk covers x..x+1, z..z+1. */
  x: number;
  z: number;
  /** y of the ground block the trunk stands on (the highest of a broad trunk's four). */
  base: number;
  kind: number;
  /** Height of the trunk above `base`. */
  trunk: number;
  /** Log blocks the tree is made of (what the spawn search counts as wood). */
  logs: number;
  bits: number;
}

export const newTreeSite = (): TreeSite => ({ x: 0, z: 0, base: 0, kind: OAK, trunk: 0, logs: 0, bits: 0 });

const col = new Column();
const wideCol = new Column();

const isBroadCell = (seed: number, gx: number, gz: number): boolean =>
  (gx & 1) === 0 && (gz & 1) === 0 && hash32(seed, gx, gz, 0xb0a4) % 1000 < 90;

/** Fills `out` when the broad cell (gx, gz) grows a broad old oak: Woodland grass, dry, nearly level. */
function broadOak(t: Terrain, gx: number, gz: number, out: TreeSite): boolean {
  if (!isBroadCell(t.seed, gx, gz)) return false;
  const h = hash32(t.seed, gx, gz, 0xb0a5);
  const x = gx * TREE_CELL + 1 + (h & 1);
  const z = gz * TREE_CELL + 1 + ((h >> 1) & 1);
  let lo = WORLD_HEIGHT;
  let hi = 0;
  for (let k = 0; k < 4; k++) {
    const c = sampleColumn(t, x + (k & 1), z + (k >> 1), wideCol);
    if (c.biome !== WOODLAND || c.liquid !== LIQUID_NONE || c.height <= WATER_TOP + 1) return false;
    if (surfaceKind(t, c, x + (k & 1), z + (k >> 1)) !== SURFACE_GRASS) return false;
    lo = Math.min(lo, c.height);
    hi = Math.max(hi, c.height);
  }
  if (hi - lo > 1 || caveMouth(t, x, z)) return false;
  out.x = x;
  out.z = z;
  out.base = hi;
  out.kind = OAK_BROAD;
  out.trunk = 6 + ((h >>> 8) % 3);
  out.logs = 4 * out.trunk + 8;
  out.bits = h >>> 4;
  return true;
}

const probe = newTreeSite();

/** True when a broad oak grows in one of the eight cells around (gx, gz). */
function crowdedByBroadOak(t: Terrain, gx: number, gz: number): boolean {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx !== 0 || dz !== 0) && isBroadCell(t.seed, gx + dx, gz + dz) && broadOak(t, gx + dx, gz + dz, probe)) return true;
    }
  }
  return false;
}

/** Fills `out` and returns true when the tree cell (gx, gz) holds a tree. */
export function treeInCell(t: Terrain, gx: number, gz: number, out: TreeSite): boolean {
  if (broadOak(t, gx, gz, out)) return true;
  const h = hash32(t.seed, gx, gz, 0x7a3e);
  const chance = ((h >>> 8) & 0xffff) / 65536;
  if (chance >= MAX_DENSITY) return false;
  const x = gx * TREE_CELL + (h & 3);
  const z = gz * TREE_CELL + ((h >> 2) & 3);
  sampleColumn(t, x, z, col);
  if (col.liquid !== LIQUID_NONE || col.height <= WATER_TOP - (col.biome === MARSH ? 1 : -1)) return false;
  const kind = surfaceKind(t, col, x, z);
  const pick = (h >>> 24) & 0xff;
  let density: number;
  let tree: number;
  if (col.biome === WOODLAND && kind === SURFACE_GRASS) {
    density = 0.04 + 0.56 * forestDensity(t, x, z);
    if (col.wFrost > 0.3) tree = PINE;
    else tree = pick < 40 ? OAK_BUSH : pick < 52 && density > 0.4 ? PINE_TALL : OAK;
  } else if (col.biome === MARSH && kind === SURFACE_GRASS) {
    density = 0.05 + 0.12 * forestDensity(t, x, z);
    tree = pick < 70 ? OAK_BUSH : WILLOW;
  } else if (col.biome === FROSTFELL && kind === SURFACE_SNOW && col.height <= TREE_LINE) {
    density = 0.03 + 0.3 * forestDensity(t, x, z);
    tree = col.height < 50 && pick < 150 ? PINE_TALL : PINE;
  } else if (col.biome === SCAR && kind === SURFACE_BASALT && col.wScar > 0.6) {
    density = 0.045;
    tree = SNAG;
  } else {
    return false;
  }
  if (chance >= density || caveMouth(t, x, z) || crowdedByBroadOak(t, gx, gz)) return false;
  out.x = x;
  out.z = z;
  out.base = col.height;
  out.kind = tree;
  const extra = pick % 3;
  out.trunk = tree === OAK ? 4 + extra
    : tree === OAK_BUSH ? 1 + (extra >> 1)
      : tree === PINE ? 5 + extra
        : tree === PINE_TALL ? 9 + extra + (pick & 1)
          : tree === WILLOW ? 4 + extra
            : 3 + extra + (pick & 1);
  out.logs = out.trunk + (tree === SNAG ? 1 : 0);
  out.bits = h >>> 4;
  return true;
}

const site = newTreeSite();

/** Writes into the chunk at (x0, z0) when the world position falls inside it. Leaves fill air only. */
function put(voxels: Uint16Array, x0: number, z0: number, x: number, y: number, z: number, id: number, log: boolean): void {
  const lx = x - x0;
  const lz = z - z0;
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT) return;
  const i = voxelIndex(lx, y, lz);
  const cur = voxels[i];
  if (cur === AIR || (log && (cur === ID.oakLeaves || cur === ID.pineLeaves))) voxels[i] = id;
}

/** True where a leaf at offset (dx, dy, dz) from a crown centre belongs to an ellipsoid with a ragged rim. */
function inCrown(dx: number, dy: number, dz: number, rx: number, ry: number, rim: number): boolean {
  const d = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
  return d <= 1 || (d <= 1.25 && rim < 0.5);
}

function drawRoundOak(voxels: Uint16Array, x0: number, z0: number, s: TreeSite, top: number): void {
  for (let y = top - 2; y <= top + 1; y++) {
    const k = top + 1 - y;
    const r = k < 2 ? 1 : 2;
    // A rounded two-layer crown under a small cap; the corners of the wide layers come and go.
    const limit = k === 0 ? 1 : r === 1 ? 2 : 5 + ((s.bits >> k) & 1) * 3;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= limit) put(voxels, x0, z0, s.x + dx, y, s.z + dz, ID.oakLeaves, false);
    }
  }
}

function drawBush(voxels: Uint16Array, x0: number, z0: number, s: TreeSite, top: number): void {
  for (let y = s.base + 1; y <= top + 1; y++) {
    const r = y === top + 1 ? 1 : 2;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dz * dz;
        if (d <= (r === 1 ? 1 : 4) && !(d === 4 && ((s.bits >> ((dx + 2) * 5 + dz + 2)) & 1))) put(voxels, x0, z0, s.x + dx, y, s.z + dz, ID.oakLeaves, false);
      }
    }
  }
}

function drawPine(voxels: Uint16Array, x0: number, z0: number, s: TreeSite, top: number, tall: boolean): void {
  for (let y = s.base + 3; y <= top + 1; y++) {
    const k = top + 1 - y;
    // A cone of alternating wide and narrow rings; tall pines widen further towards the ground.
    let r = k === 0 ? 0 : k < 3 ? 1 : k % 2 === 1 ? 2 : 1;
    if (tall && k >= 6) r = k % 3 === 0 ? 2 : 3;
    const limit = r === 3 ? 10 : r * r + (r > 1 ? 1 : 0);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= limit) put(voxels, x0, z0, s.x + dx, y, s.z + dz, ID.pineLeaves, false);
    }
  }
}

function drawWillow(voxels: Uint16Array, x0: number, z0: number, s: TreeSite, top: number): void {
  for (let y = top - 1; y <= top + 1; y++) {
    const r = y === top + 1 ? 2 : 3;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dz * dz;
        if (d > r * r + 1) continue;
        put(voxels, x0, z0, s.x + dx, y, s.z + dz, ID.oakLeaves, false);
        // Hanging curtains of leaves from the rim of the lower crown.
        if (y !== top - 1 || d < 5) continue;
        const hang = hash32(s.bits, dx, dz, 0x3111) % 5;
        for (let n = 1; n <= hang && top - 1 - n > s.base; n++) put(voxels, x0, z0, s.x + dx, top - 1 - n, s.z + dz, ID.oakLeaves, false);
      }
    }
  }
}

const DIR_X = [1, 1, 0, -1, -1, -1, 0, 1];
const DIR_Z = [0, 1, 1, 1, 0, -1, -1, -1];

function drawBroadOak(voxels: Uint16Array, x0: number, z0: number, s: TreeSite, top: number): void {
  const { x, z } = s;
  for (let k = 0; k < 4; k++) {
    const tx = x + (k & 1);
    const tz = z + (k >> 1);
    for (let y = s.base; y <= top; y++) put(voxels, x0, z0, tx, y, tz, ID.oakLog, true);
  }
  // Root flares on the ground around the trunk.
  for (let d = 0; d < 8; d++) {
    if (((s.bits >> d) & 3) !== 0) continue;
    const rx = DIR_X[d] > 0 ? x + 2 : DIR_X[d] < 0 ? x - 1 : x + (d & 1);
    const rz = DIR_Z[d] > 0 ? z + 2 : DIR_Z[d] < 0 ? z - 1 : z + ((d >> 1) & 1);
    put(voxels, x0, z0, rx, s.base + 1, rz, ID.oakLog, true);
  }
  // Three or four boughs climbing out of the trunk, each ending in a knot of leaves.
  const boughs = 3 + (s.bits & 1);
  const first = (s.bits >> 3) & 7;
  const cx = x + 0.5;
  const cz = z + 0.5;
  for (let b = 0; b < boughs; b++) {
    const d = (first + b * 2 + (b === 3 ? 1 : 0)) & 7;
    const len = 2 + ((s.bits >> (6 + b)) & 1);
    let bx = DIR_X[d] > 0 ? x + 1 : x;
    let bz = DIR_Z[d] > 0 ? z + 1 : z;
    let by = top - 2 + (b & 1);
    for (let n = 1; n <= len; n++) {
      bx += DIR_X[d];
      bz += DIR_Z[d];
      if (n % 2 === 0) by++;
      put(voxels, x0, z0, bx, by, bz, ID.oakLog, true);
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dz * dz + dy * dy * 2 <= 4) put(voxels, x0, z0, bx + dx, by + 1 + dy, bz + dz, ID.oakLeaves, false);
        }
      }
    }
  }
  // The great crown: a flattened dome over the trunk with a ragged rim.
  const cy = top + 1;
  for (let y = top - 1; y <= top + 3; y++) {
    for (let dz = -5; dz <= 5; dz++) {
      for (let dx = -5; dx <= 5; dx++) {
        const px = Math.round(cx + dx);
        const pz = Math.round(cz + dz);
        const rim = (hash32(s.bits, px, y, pz) & 0xff) / 256;
        if (inCrown(px + 0.5 - (cx + 0.5), y - cy, pz + 0.5 - (cz + 0.5), 4.4, 2.6, rim)) put(voxels, x0, z0, px, y, pz, ID.oakLeaves, false);
      }
    }
  }
}

function drawSnag(voxels: Uint16Array, x0: number, z0: number, s: TreeSite, top: number): void {
  for (let y = s.base + 1; y <= top; y++) put(voxels, x0, z0, s.x, y, s.z, ID.pineLog, true);
  // One bare stub of a branch near the top.
  const d = ((s.bits >> 2) & 3) * 2;
  put(voxels, x0, z0, s.x + DIR_X[d], top - 1, s.z + DIR_Z[d], ID.pineLog, true);
}

export function drawTree(voxels: Uint16Array, x0: number, z0: number, s: TreeSite): void {
  const top = s.base + s.trunk;
  if (s.kind === OAK_BROAD) {
    drawBroadOak(voxels, x0, z0, s, top);
    return;
  }
  if (s.kind === SNAG) {
    drawSnag(voxels, x0, z0, s, top);
    return;
  }
  const pine = s.kind === PINE || s.kind === PINE_TALL;
  const log = pine ? ID.pineLog : ID.oakLog;
  for (let y = s.base + 1; y <= top; y++) put(voxels, x0, z0, s.x, y, s.z, log, true);
  if (pine) drawPine(voxels, x0, z0, s, top, s.kind === PINE_TALL);
  else if (s.kind === OAK_BUSH) drawBush(voxels, x0, z0, s, top);
  else if (s.kind === WILLOW) drawWillow(voxels, x0, z0, s, top);
  else drawRoundOak(voxels, x0, z0, s, top);
}

/** Calls `fn` for every tree whose root lies within `reach` blocks of the box [xa..xb] x [za..zb]. */
export function forEachTree(t: Terrain, xa: number, za: number, xb: number, zb: number, reach: number, fn: (s: TreeSite) => void): void {
  const gx0 = Math.floor((xa - reach - 3) / TREE_CELL);
  const gx1 = Math.floor((xb + reach) / TREE_CELL);
  const gz0 = Math.floor((za - reach - 3) / TREE_CELL);
  const gz1 = Math.floor((zb + reach) / TREE_CELL);
  for (let gz = gz0; gz <= gz1; gz++) {
    for (let gx = gx0; gx <= gx1; gx++) if (treeInCell(t, gx, gz, site)) fn(site);
  }
}

/** Draws every tree that touches chunk (cx, cz), always in the same global order. */
export function placeTrees(t: Terrain, voxels: Uint16Array, cx: number, cz: number): void {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  forEachTree(t, x0, z0, x0 + CHUNK_SIZE - 1, z0 + CHUNK_SIZE - 1, CANOPY, (s) => drawTree(voxels, x0, z0, s));
}
