/**
 * Trees. The world is divided into 5x5 cells; each cell holds at most one tree whose existence, place and
 * shape are pure functions of (seed, cell), so a chunk can draw the parts of its neighbours' trees that
 * reach into it without knowing what has been generated before.
 */
import { hash32 } from '../core/math';
import { AIR, CHUNK_SIZE, WORLD_HEIGHT, voxelIndex } from '../core/types';
import { ID } from './ids';
import {
  Column, FROSTFELL, LIQUID_NONE, SURFACE_GRASS, SURFACE_SNOW, TREE_LINE, WATER_TOP, WOODLAND,
  caveMouth, forestDensity, sampleColumn, surfaceKind, type Terrain,
} from './terrain';

export const TREE_CELL = 5;
/** Widest canopy radius: how far outside a chunk a tree root can be and still reach into it. */
const CANOPY = 2;
const MAX_DENSITY = 0.6;

export interface TreeSite {
  x: number;
  z: number;
  /** y of the ground block the trunk stands on. */
  base: number;
  pine: boolean;
  /** Number of log blocks. */
  trunk: number;
  bits: number;
}

const col = new Column();

/** Fills `out` and returns true when the tree cell (gx, gz) holds a tree. */
export function treeInCell(t: Terrain, gx: number, gz: number, out: TreeSite): boolean {
  const h = hash32(t.seed, gx, gz, 0x7a3e);
  const chance = ((h >>> 8) & 0xffff) / 65536;
  if (chance >= MAX_DENSITY) return false;
  const x = gx * TREE_CELL + (h & 3);
  const z = gz * TREE_CELL + ((h >> 2) & 3);
  sampleColumn(t, x, z, col);
  if (col.liquid !== LIQUID_NONE || col.height <= WATER_TOP + 1) return false;
  const kind = surfaceKind(t, col, x, z);
  let density: number;
  if (col.biome === WOODLAND && kind === SURFACE_GRASS) density = 0.04 + 0.56 * forestDensity(t, x, z);
  else if (col.biome === FROSTFELL && kind === SURFACE_SNOW && col.height <= TREE_LINE) density = 0.03 + 0.3 * forestDensity(t, x, z);
  else return false;
  if (chance >= density || caveMouth(t, x, z)) return false;
  out.x = x;
  out.z = z;
  out.base = col.height;
  out.pine = col.biome === FROSTFELL || col.wFrost > 0.3;
  out.trunk = (out.pine ? 6 : 5) + ((h >>> 24) % 3);
  out.bits = h >>> 4;
  return true;
}

const site: TreeSite = { x: 0, z: 0, base: 0, pine: false, trunk: 0, bits: 0 };

function put(voxels: Uint16Array, lx: number, y: number, lz: number, id: number, log: boolean): void {
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y >= WORLD_HEIGHT) return;
  const i = voxelIndex(lx, y, lz);
  const cur = voxels[i];
  if (cur === AIR || (log && (cur === ID.oakLeaves || cur === ID.pineLeaves))) voxels[i] = id;
}

function drawTree(voxels: Uint16Array, x0: number, z0: number, tree: TreeSite): void {
  const lx = tree.x - x0;
  const lz = tree.z - z0;
  const top = tree.base + tree.trunk;
  const log = tree.pine ? ID.pineLog : ID.oakLog;
  const leaves = tree.pine ? ID.pineLeaves : ID.oakLeaves;
  for (let y = tree.base + 1; y <= top; y++) put(voxels, lx, y, lz, log, true);
  const first = tree.pine ? tree.base + 3 : top - 2;
  for (let y = first; y <= top + 1; y++) {
    const k = top + 1 - y;
    let r: number;
    if (tree.pine) r = k === 0 ? 0 : k < 3 ? 1 : k % 2 === 1 ? 2 : 1;
    else r = k < 2 ? 1 : 2;
    // Oak: a rounded two-layer crown under a small cap. Pine: a cone of alternating wide and narrow rings.
    const limit = tree.pine ? r * r + (r > 1 ? 1 : 0) : k === 0 ? 1 : r === 1 ? 2 : 5 + ((tree.bits >> k) & 1) * 3;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz <= limit) put(voxels, lx + dx, y, lz + dz, leaves, false);
      }
    }
  }
}

/** Draws every tree that touches chunk (cx, cz), always in the same global order. */
export function placeTrees(t: Terrain, voxels: Uint16Array, cx: number, cz: number): void {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const gx0 = Math.floor((x0 - CANOPY - 3) / TREE_CELL);
  const gx1 = Math.floor((x0 + CHUNK_SIZE - 1 + CANOPY) / TREE_CELL);
  const gz0 = Math.floor((z0 - CANOPY - 3) / TREE_CELL);
  const gz1 = Math.floor((z0 + CHUNK_SIZE - 1 + CANOPY) / TREE_CELL);
  for (let gz = gz0; gz <= gz1; gz++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      if (treeInCell(t, gx, gz, site)) drawTree(voxels, x0, z0, site);
    }
  }
}
