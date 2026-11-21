/**
 * World generation. `generateChunk` is a pure function of (seed, cx, cz): it keeps no state between calls
 * and can run in any order and in any thread. The stages are terrain columns, caves, ore veins, trees,
 * small plants.
 */
import { hash32, hashFloat } from '../core/math';
import { AIR, CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT, voxelIndex, type BiomeKey } from '../core/types';
import { carveCaves } from './caves';
import { placeTrees } from './flora';
import { ID } from './ids';
import { placeVeins } from './ores';
import {
  BIOME_KEYS, Column, DUNES, FROSTFELL, LAVA_POOL_TOP, LIQUID_LAVA, LIQUID_NONE, LIQUID_WATER, SCAR,
  SURFACE_CLAY, SURFACE_DIRT, SURFACE_GRASS, SURFACE_GRAVEL, SURFACE_SAND, SURFACE_SNOW, TREE_LINE, WATER_TOP,
  caveMouth, sampleColumn, surfaceKind, terrainFor, type Terrain,
} from './terrain';

export { findSpawn } from './spawn';

const MARGIN = CHUNK_SIZE + 2;
const Y_STRIDE = CHUNK_SIZE * CHUNK_SIZE;
// Scratch buffers: generation is synchronous, so one set per thread is enough.
const heights = new Int16Array(MARGIN * MARGIN);
const liquids = new Uint8Array(MARGIN * MARGIN);
const biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
const caveLimit = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
const col = new Column();

function layer(voxels: Uint16Array, top: number, count: number, id: number): void {
  for (let n = 0, i = top; n < count && i >= Y_STRIDE; n++, i -= Y_STRIDE) voxels[i] = id;
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
  switch (surfaceKind(t, c, x, z)) {
    case SURFACE_GRASS:
      voxels[top] = ID.grass;
      layer(voxels, top - Y_STRIDE, 3, ID.dirt);
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
      break;
    case SURFACE_SNOW:
      voxels[top] = ID.snow;
      if (h <= TREE_LINE) layer(voxels, top - Y_STRIDE, 3, ID.dirt);
      break;
    default:
      break;
  }

  if (c.liquid === LIQUID_WATER) {
    for (let y = h + 1, i = top + Y_STRIDE; y <= WATER_TOP; y++, i += Y_STRIDE) voxels[i] = ID.water;
    if (c.biome === FROSTFELL) voxels[base + WATER_TOP * Y_STRIDE] = ID.ice;
  } else if (c.liquid === LIQUID_LAVA) {
    for (let y = h + 1, i = top + Y_STRIDE; y <= LAVA_POOL_TOP; y++, i += Y_STRIDE) voxels[i] = ID.lava;
  }
}

/** Tall grass and shrubs on untouched ground. Runs last, so it never grows into a tree or over a cave mouth. */
function placePlants(seed: number, voxels: Uint16Array, x0: number, z0: number): void {
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const m = (lz + 1) * MARGIN + lx + 1;
      const h = heights[m];
      if (liquids[m] !== LIQUID_NONE || h + 1 >= WORLD_HEIGHT) continue;
      const i = voxelIndex(lx, h, lz);
      if (voxels[i + Y_STRIDE] !== AIR) continue;
      const ground = voxels[i];
      const r = hashFloat(seed, x0 + lx, z0 + lz, 0x9a55);
      if (ground === ID.grass) {
        if (r < 0.1) voxels[i + Y_STRIDE] = ID.tallGrass;
        else if (r > 0.996) voxels[i + Y_STRIDE] = ID.dryShrub;
      } else if (ground === ID.sand) {
        if (r < (biomes[lz * CHUNK_SIZE + lx] === DUNES ? 0.014 : 0.03)) voxels[i + Y_STRIDE] = ID.dryShrub;
      } else if (ground === ID.basalt || ground === ID.snow) {
        if (r < 0.005) voxels[i + Y_STRIDE] = ID.dryShrub;
      }
    }
  }
}

export function generateChunk(seed: number, cx: number, cz: number): Uint16Array {
  const t = terrainFor(seed);
  const voxels = new Uint16Array(CHUNK_VOLUME);
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let mz = 0; mz < MARGIN; mz++) {
    for (let mx = 0; mx < MARGIN; mx++) {
      const x = x0 + mx - 1;
      const z = z0 + mz - 1;
      sampleColumn(t, x, z, col);
      heights[mz * MARGIN + mx] = col.height;
      liquids[mz * MARGIN + mx] = col.liquid;
      if (mx >= 1 && mx <= CHUNK_SIZE && mz >= 1 && mz <= CHUNK_SIZE) {
        biomes[(mz - 1) * CHUNK_SIZE + mx - 1] = col.biome;
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
  placeTrees(t, voxels, cx, cz);
  placePlants(seed, voxels, x0, z0);
  return voxels;
}

const biomeColumn = new Column();
export function biomeAt(seed: number, x: number, z: number): BiomeKey {
  return BIOME_KEYS[sampleColumn(terrainFor(seed), Math.floor(x), Math.floor(z), biomeColumn).biome];
}
