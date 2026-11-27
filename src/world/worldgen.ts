/**
 * World generation. `generateChunk` is a pure function of (seed, cx, cz): it keeps no state between calls
 * and can run in any order and in any thread. The stages are terrain columns, caves, ore veins, the deeper
 * underground (geodes, lakes, lava falls), cliff outcrops, trees, surface life, cave glowcaps, one cave room (camp, lode, sinkhole or foul-air pocket) and ruins.
 */
import { hash32 } from '../core/math';
import { CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT, voxelIndex, type BiomeKey } from '../core/types';
import { carveCaves } from './caves';
import { placeCaveRoom, type CaveRoom } from './caveRooms';
import { MARGIN, createColumns } from './columns';
import { placeTrees } from './flora';
import { ID } from './ids';
import { placeOutcrops, placeVeins } from './ores';
import { placeSurfaceLife } from './plants';
import { placeHotSprings } from './springs';
import { drawRuin, ruinsNear } from './ruins';
import { drawStructure, structuresNear } from './structures';
import {
  BIOME_KEYS, Column, DUNES, FROSTFELL, LIQUID_LAVA, LIQUID_NONE, LIQUID_WATER, MARSH, SCAR,
  SURFACE_CLAY, SURFACE_DIRT, SURFACE_GRASS, SURFACE_GRAVEL, SURFACE_PEAT, SURFACE_SAND, SURFACE_SNOW, TREE_LINE,
  caveMouth, sampleColumn, surfaceKind, terrainFor, type Terrain,
} from './terrain';
import { fillUndergroundLake, placeCaveGlowcaps, placeGeodes, placeLavaFall } from './underground';

export { findSpawn } from './spawn';

const Y_STRIDE = CHUNK_SIZE * CHUNK_SIZE;
// Scratch: generation is synchronous, so one set per thread is enough.
const cols = createColumns();
const col = new Column();

function layer(voxels: Uint16Array, top: number, count: number, id: number): void {
  for (let n = 0, i = top; n < count && i >= Y_STRIDE; n++, i -= Y_STRIDE) voxels[i] = id;
}

/** Marsh ground: under the surface lie layers of peat, then clay, before the stone. */
function marshSoil(voxels: Uint16Array, top: number, r: number): void {
  const peat = 2 + (r & 1);
  layer(voxels, top - Y_STRIDE * 2, peat, ID.peat);
  layer(voxels, top - Y_STRIDE * (2 + peat), 2, ID.clay);
}

function fillColumn(t: Terrain, voxels: Uint16Array, c: Column, lx: number, lz: number, x: number, z: number): void {
  const h = c.height;
  const r = hash32(t.seed, x, z, 0x51ab);
  const deepBasalt = 3 + (r & 3);
  const crust = c.biome === SCAR ? h - 6 - ((r >> 2) & 3) : WORLD_HEIGHT;
  const base = voxelIndex(lx, 0, lz);
  voxels[base] = ID.corestone;
  for (let y = 1, i = base + Y_STRIDE; y <= h; y++, i += Y_STRIDE) voxels[i] = y <= deepBasalt || y > crust ? ID.basalt : ID.stone;
  if (((r >> 4) & 7) < 3) voxels[base + Y_STRIDE] = ID.corestone;

  const top = base + h * Y_STRIDE;
  const extra = (r >> 7) & 1;
  const marsh = c.biome === MARSH;
  switch (surfaceKind(t, c, x, z)) {
    case SURFACE_GRASS:
      voxels[top] = ID.grass;
      layer(voxels, top - Y_STRIDE, 3, ID.dirt);
      if (marsh) marshSoil(voxels, top, r >> 8);
      break;
    case SURFACE_DIRT:
      layer(voxels, top, 3, ID.dirt);
      break;
    case SURFACE_SAND:
      layer(voxels, top, (c.biome === DUNES ? 4 : 3) + extra, ID.sand);
      break;
    case SURFACE_GRAVEL:
      layer(voxels, top, 2 + extra, ID.gravel);
      break;
    case SURFACE_CLAY:
      layer(voxels, top, 2 + extra, ID.clay);
      if (marsh) layer(voxels, top - Y_STRIDE * (2 + extra), 2, ID.peat);
      break;
    case SURFACE_PEAT:
      layer(voxels, top, 3 + extra, ID.peat);
      layer(voxels, top - Y_STRIDE * (3 + extra), 2, ID.clay);
      break;
    case SURFACE_SNOW:
      voxels[top] = ID.snow;
      if (h <= TREE_LINE) layer(voxels, top - Y_STRIDE, 3, ID.dirt);
      break;
    default:
      break;
  }

  if (c.liquid !== LIQUID_NONE) {
    const id = c.liquid === LIQUID_WATER ? ID.water : c.liquid === LIQUID_LAVA ? ID.lava : ID.oil;
    for (let y = h + 1, i = top + Y_STRIDE; y <= c.liquidTop; y++, i += Y_STRIDE) voxels[i] = id;
    if (c.liquid === LIQUID_WATER && c.biome === FROSTFELL) voxels[base + c.liquidTop * Y_STRIDE] = ID.ice;
  }
}

/** The room the latest `generateChunk` stamped (null for none): read it right after the call, as `caveRoomOf` does. */
let lastRoom: CaveRoom | null = null;

/** The cave room chunk (cx, cz) holds, if any: what a hook (the cave boss, a map note) asks without keeping the voxels. */
export function caveRoomOf(seed: number, cx: number, cz: number): CaveRoom | null {
  generateChunk(seed, cx, cz);
  return lastRoom;
}

export function generateChunk(seed: number, cx: number, cz: number): Uint16Array {
  const t = terrainFor(seed);
  const voxels = new Uint16Array(CHUNK_VOLUME);
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const { heights, liquids, biomes, wScar, wFrost, caveLimit } = cols;
  for (let mz = 0; mz < MARGIN; mz++) {
    for (let mx = 0; mx < MARGIN; mx++) {
      const x = x0 + mx - 1;
      const z = z0 + mz - 1;
      sampleColumn(t, x, z, col);
      heights[mz * MARGIN + mx] = col.height;
      liquids[mz * MARGIN + mx] = col.liquid;
      if (mx >= 1 && mx <= CHUNK_SIZE && mz >= 1 && mz <= CHUNK_SIZE) {
        const c = (mz - 1) * CHUNK_SIZE + mx - 1;
        biomes[c] = col.biome;
        wScar[c] = col.wScar;
        wFrost[c] = col.wFrost;
        fillColumn(t, voxels, col, mx - 1, mz - 1, x, z);
      }
    }
  }

  // Caves stop 3 blocks under any liquid column and under its neighbours, so no liquid ever hangs over air.
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const m = (lz + 1) * MARGIN + lx + 1;
      let limit = liquids[m] !== LIQUID_NONE ? heights[m] - 3 : caveMouth(t, x0 + lx, z0 + lz) ? heights[m] : heights[m] - 4;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const n = m + dz * MARGIN + dx;
          if (liquids[n] !== LIQUID_NONE && heights[n] - 3 < limit) limit = heights[n] - 3;
        }
      }
      caveLimit[lz * CHUNK_SIZE + lx] = limit;
    }
  }
  carveCaves(t, voxels, x0, z0, caveLimit);
  placeVeins(t, voxels, cx, cz);
  placeGeodes(t, voxels, cx, cz);
  fillUndergroundLake(t, voxels, cx, cz, cols);
  placeLavaFall(t, voxels, cx, cz);
  placeOutcrops(t, voxels, x0, z0, cols);
  placeTrees(t, voxels, cx, cz);
  placeSurfaceLife(t, voxels, x0, z0, cols);
  placeCaveGlowcaps(t, voxels, x0, z0, cols);
  lastRoom = placeCaveRoom(t, voxels, cx, cz, cols);
  for (const ruin of ruinsNear(seed, cx, cz)) drawRuin(voxels, x0, z0, ruin);
  for (const s of structuresNear(seed, cx, cz)) drawStructure(voxels, x0, z0, s);
  placeHotSprings(t, voxels, cx, cz, cols);
  return voxels;
}

const biomeColumn = new Column();
export function biomeAt(seed: number, x: number, z: number): BiomeKey {
  return BIOME_KEYS[sampleColumn(terrainFor(seed), Math.floor(x), Math.floor(z), biomeColumn).biome];
}
