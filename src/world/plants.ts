/**
 * Surface life (spec 12.4, 14): grass, flowers, ferns, reeds, berry bushes and wild crop patches, cacti, frost
 * spires, basalt organ pipes and steam vents. Every decision is a pure function of the seed and world
 * position (patches and spires come from feature cells that never reach outside their cell), so the result
 * does not depend on the order chunks are generated in. Runs after the trees and only fills air.
 */
import { hash32, hashFloat } from '../core/math';
import { AIR, CHUNK_SIZE, WORLD_HEIGHT, voxelIndex } from '../core/types';
import { MARGIN, forEachCell, marginIndex, type ChunkColumns } from './columns';
import { ID } from './ids';
import {
  Column, DUNES, FROSTFELL, LIQUID_NONE, LIQUID_WATER, MARSH, SCAR, SURFACE_BASALT, SURFACE_GRASS, SURFACE_GRAVEL,
  SURFACE_SNOW, WATER_TOP, WOODLAND, caveMouth, forestDensity, sampleColumn, surfaceKind, type Terrain,
} from './terrain';

const Y = CHUNK_SIZE * CHUNK_SIZE;

/** A round patch of one plant (wild crops, berry bushes) or a single feature (spire, vent) centred in a cell. */
export interface Patch {
  x: number;
  z: number;
  /** Radius (patches) or height (spires). */
  size: number;
  block: number;
  bits: number;
}

export const newPatch = (): Patch => ({ x: 0, z: 0, size: 0, block: 0, bits: 0 });

/** Wild wheat, potatoes and carrots grow in small patches on Woodland grass. */
export const CROP_CELL = 12;
const BERRY_CELL = 16;
const SPIRE_CELL = 11;
const VENT_CELL = 9;

const col = new Column();

/** Centre of a patch of radius r inside cell (gx, gz) of `size`, so the patch never leaves its cell. */
function centre(out: Patch, gx: number, gz: number, size: number, r: number, h: number): void {
  const span = size - 2 * r;
  out.x = gx * size + r + ((h >>> 12) % span);
  out.z = gz * size + r + ((h >>> 20) % span);
}

function dryGround(t: Terrain, x: number, z: number, biome: number, surface: number): boolean {
  sampleColumn(t, x, z, col);
  return col.biome === biome && col.liquid === LIQUID_NONE && col.height > WATER_TOP && surfaceKind(t, col, x, z) === surface && !caveMouth(t, x, z);
}

export function cropPatch(t: Terrain, gx: number, gz: number, out: Patch): boolean {
  const h = hash32(t.seed, gx, gz, 0xc409);
  if ((h & 0x3ff) >= 440) return false;
  out.size = 2 + ((h >>> 10) & 1);
  centre(out, gx, gz, CROP_CELL, out.size, h);
  if (!dryGround(t, out.x, out.z, WOODLAND, SURFACE_GRASS) || col.height <= WATER_TOP + 1) return false;
  const kind = (h >>> 28) & 3;
  out.block = kind < 2 ? ID.wildWheat : kind === 2 ? ID.wildPotato : ID.wildCarrot;
  out.bits = h;
  return true;
}

function berryPatch(t: Terrain, gx: number, gz: number, out: Patch): boolean {
  const h = hash32(t.seed, gx, gz, 0xbe44);
  if ((h & 0x3ff) >= 330) return false;
  out.size = 2;
  centre(out, gx, gz, BERRY_CELL, 2, h);
  sampleColumn(t, out.x, out.z, col);
  if ((col.biome !== WOODLAND && col.biome !== MARSH) || col.liquid !== LIQUID_NONE || surfaceKind(t, col, out.x, out.z) !== SURFACE_GRASS) return false;
  out.block = ID.berryBush;
  out.bits = h;
  return true;
}

function spire(t: Terrain, gx: number, gz: number, out: Patch): boolean {
  const h = hash32(t.seed, gx, gz, 0x5917);
  if ((h & 0x3ff) >= 560) return false;
  centre(out, gx, gz, SPIRE_CELL, 1, h);
  if (!dryGround(t, out.x, out.z, FROSTFELL, SURFACE_SNOW) || col.wFrost < 0.85 || col.height > 74) return false;
  out.size = 5 + ((h >>> 26) % 9);
  out.block = ID.packedIce;
  out.bits = h;
  return true;
}

function vent(t: Terrain, gx: number, gz: number, out: Patch): boolean {
  const h = hash32(t.seed, gx, gz, 0x7e47);
  if ((h & 0x3ff) >= 600) return false;
  centre(out, gx, gz, VENT_CELL, 1, h);
  sampleColumn(t, out.x, out.z, col);
  if (col.biome !== SCAR || col.wScar < 0.8 || col.liquid !== LIQUID_NONE) return false;
  const kind = surfaceKind(t, col, out.x, out.z);
  if (kind !== SURFACE_BASALT && kind !== SURFACE_GRAVEL) return false;
  out.size = 1;
  out.block = ID.steamVent;
  // The centre always vents; bits pick up to two more of the eight cells around it.
  out.bits = (1 << 4) | (1 << [0, 1, 2, 3, 5, 6, 7, 8][(h >>> 26) & 7]) | ((h >>> 29) & 1 ? 1 << [0, 2, 6, 8][(h >>> 24) & 3] : 0);
  return true;
}

function collect(t: Terrain, size: number, x0: number, z0: number, find: (t: Terrain, gx: number, gz: number, out: Patch) => boolean): Patch[] {
  const found: Patch[] = [];
  forEachCell(size, x0, z0, x0 + CHUNK_SIZE - 1, z0 + CHUNK_SIZE - 1, (gx, gz) => {
    const p = newPatch();
    if (find(t, gx, gz, p)) found.push(p);
  });
  return found;
}

function inPatch(list: Patch[], x: number, z: number): Patch | null {
  for (const p of list) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz <= p.size * p.size + 1) return p;
  }
  return null;
}

/** Stacks `count` blocks of `id` on the column above index i (stops at anything that is not air). */
function stack(voxels: Uint16Array, i: number, y: number, count: number, id: number, tip: number): void {
  for (let n = 1; n <= count && y + n < WORLD_HEIGHT; n++) {
    const j = i + n * Y;
    if (voxels[j] !== AIR) return;
    voxels[j] = n === count ? tip : id;
  }
}

function shoreOf(cols: ChunkColumns, lx: number, lz: number): boolean {
  const m = marginIndex(lx, lz);
  return cols.liquids[m - 1] === LIQUID_WATER || cols.liquids[m + 1] === LIQUID_WATER
    || cols.liquids[m - MARGIN] === LIQUID_WATER || cols.liquids[m + MARGIN] === LIQUID_WATER;
}

function flowerAt(t: Terrain, x: number, z: number, r: number): number {
  const kind = t.flora.noise2(x / 45 + 211, z / 45 - 97) + (r - 0.5) * 0.5;
  return kind > 0.04 ? ID.emberPoppy : ID.skybell;
}

/** The plant (block id) for a column of Woodland grass, or AIR. */
function woodlandPlant(t: Terrain, cols: ChunkColumns, c: number, x: number, z: number, r: number, r2: number): number {
  if (cols.wFrost[c] > 0.12 && r2 < 0.05) return ID.frostLily;
  if (cols.wScar[c] > 0.04 && r2 < 0.07) return ID.emberPoppy;
  const forest = forestDensity(t, x, z);
  if (forest > 0.72 && r2 < 0.012) return ID.glowcap;
  if (forest > 0.45 && r2 < (forest - 0.45) * 0.5) return ID.fern;
  if (forest < 0.55) {
    const meadow = t.flora.noise2(x / 16, z / 16);
    if ((meadow > 0.28 && r2 < 0.34) || r2 < 0.006) return flowerAt(t, x, z, r);
  }
  if (r < 0.12) return ID.tallGrass;
  return r > 0.997 ? ID.dryShrub : AIR;
}

function marshPlant(shore: boolean, r: number, r2: number): number {
  if (shore) return r2 < 0.1 ? ID.skybell : r < 0.62 ? ID.reeds : AIR;
  if (r2 < 0.015) return ID.skybell;
  if (r2 < 0.05) return ID.fern;
  return r < 0.3 ? ID.tallGrass : AIR;
}

/** Plants and surface features for chunk (x0, z0). */
export function placeSurfaceLife(t: Terrain, voxels: Uint16Array, x0: number, z0: number, cols: ChunkColumns): void {
  const crops = collect(t, CROP_CELL, x0, z0, cropPatch);
  const berries = collect(t, BERRY_CELL, x0, z0, berryPatch);
  const spires = collect(t, SPIRE_CELL, x0, z0, spire);
  const vents = collect(t, VENT_CELL, x0, z0, vent);
  const seed = t.seed;
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const m = marginIndex(lx, lz);
      const h = cols.heights[m];
      if (cols.liquids[m] !== LIQUID_NONE || h + 2 >= WORLD_HEIGHT) continue;
      const i = voxelIndex(lx, h, lz);
      if (voxels[i + Y] !== AIR) continue;
      const x = x0 + lx;
      const z = z0 + lz;
      const c = lz * CHUNK_SIZE + lx;
      const biome = cols.biomes[c];
      const ground = voxels[i];
      const r = hashFloat(seed, x, z, 0x9a55);
      const r2 = hashFloat(seed, x, z, 0x61a7);
      let plant = AIR;

      if (ground === ID.grass) {
        const patch = biome === WOODLAND || biome === MARSH ? inPatch(crops, x, z) ?? inPatch(berries, x, z) : null;
        if (patch && r2 < (patch.block === ID.berryBush ? 0.45 : 0.62)) plant = patch.block;
        else if (biome === MARSH) plant = marshPlant(shoreOf(cols, lx, lz), r, r2);
        else if (shoreOf(cols, lx, lz) && h <= WATER_TOP + 1 && r2 < 0.4) plant = ID.reeds;
        else plant = woodlandPlant(t, cols, c, x, z, r, r2);
      } else if (ground === ID.sand) {
        if (biome === DUNES && r2 < 0.0055 && !shoreOf(cols, lx, lz)) {
          stack(voxels, i, h, 1 + Math.floor(r * 3.2), ID.cactus, ID.cactus);
          continue;
        }
        if (shoreOf(cols, lx, lz) && r2 < 0.35) plant = ID.reeds;
        else if (r < (biome === DUNES ? 0.014 : 0.03)) plant = ID.dryShrub;
      } else if (ground === ID.clay || ground === ID.dirt || ground === ID.peat) {
        if (shoreOf(cols, lx, lz) ? r2 < 0.5 : ground === ID.peat && r2 < 0.12) plant = ID.reeds;
        else if (ground === ID.dirt && r < 0.08) plant = ID.tallGrass;
      } else if (ground === ID.snow) {
        const s = inPatch(spires, x, z);
        if (s) {
          // A frost spire: a tall centre with shorter shoulders, all packed ice under a glassy point.
          const dx = x - s.x;
          const dz = z - s.z;
          const height = dx === 0 && dz === 0 ? s.size : dx * dz === 0 ? (s.size >> 1) - ((s.bits >>> (dx + 2 * dz + 3)) & 1) : s.size >= 10 ? s.size >> 2 : 0;
          if (height > 0) {
            stack(voxels, i, h, Math.max(2, height), ID.packedIce, ID.iceSpike);
            continue;
          }
        }
        if (biome === FROSTFELL && r2 < 0.003) {
          stack(voxels, i, h, 2 + Math.floor(r * 3), ID.packedIce, ID.iceSpike);
          continue;
        }
        if (r2 < 0.012 + (t.flora.noise2(x / 16, z / 16) > 0.3 ? 0.08 : 0)) plant = ID.frostLily;
        else if (r < 0.005) plant = ID.dryShrub;
      } else if (biome === SCAR && (ground === ID.basalt || ground === ID.gravel)) {
        const v = inPatch(vents, x, z);
        if (v && ((v.bits >> ((z - v.z + 1) * 3 + x - v.x + 1)) & 1)) {
          voxels[i] = ID.steamVent;
          continue;
        }
        if (ground === ID.basalt && cols.wScar[c] > 0.75 && t.flora.noise2(x / 11 + 300, z / 11 - 300) > 0.3 && r2 < 0.85) {
          // Basalt organ pipes: neighbouring columns stand at different heights.
          voxels[i] = ID.basaltColumn;
          stack(voxels, i, h, Math.floor(r * 6), ID.basaltColumn, ID.basaltColumn);
          continue;
        }
        if (r < 0.005) plant = ID.dryShrub;
      } else if (ground === ID.basalt && r < 0.005) {
        plant = ID.dryShrub;
      }
      if (plant !== AIR) voxels[i + Y] = plant;
    }
  }
}
