/**
 * Generated structures (docs/SYNERGY_PLAN.md): sixteen small camps, shrines, kilns and foundries, each built from the
 * blocks of one biome. Placed exactly like the Old Works ruins: at most one per square of STRUCTURE_GRID_CHUNKS chunks, the
 * site and every block a pure function of (seed, square), and a structure never leaves its square. The type is chosen among
 * those of the site's biome whose age the distance from spawn allows (ember anywhere, bronze farther out, forge farther still),
 * so the world teases the next age without skipping it. A structure never overlaps a ruin or the spawn's wild crops.
 */
import { hash32 } from '../core/math';
import { AIR, CHUNK_SIZE, WORLD_HEIGHT, voxelIndex } from '../core/types';
import { forEachCell } from './columns';
import { forEachTree } from './flora';
import { ID } from './ids';
import { CROP_CELL, cropPatch, newPatch } from './plants';
import { findSpawn } from './spawn';
import { Canvas, STRUCTURE_DEFS, type StructureDef } from './structureDefs';
import { Column, DUNES, FROSTFELL, LIQUID_NONE, LIQUID_WATER, MARSH, SCAR, WATER_TOP, caveMouth, sampleColumn, terrainFor, type Terrain } from './terrain';
import { LIGHTHOUSE, LIGHTHOUSE_CHANCE, LIGHTHOUSE_SPAWN_CLEAR, lighthouseFloor } from './lighthouses';
import { ruinsNear } from './ruins';

export const STRUCTURE_GRID_CHUNKS = 5;
const SQUARE = STRUCTURE_GRID_CHUNKS * CHUNK_SIZE;
/** Chance a square holds a structure at all. */
export const STRUCTURE_CHANCE = 0.55;
const SQUARE_MARGIN = 8;
const CLEAR = 12;
/** Blocks from the spawn point a structure keeps clear of; and the distance an age's structures need. */
const SPAWN_CLEAR = 20;
const AGE_DISTANCE = [0, 90, 220];

export interface StructureSite {
  def: StructureDef;
  x0: number;
  z0: number;
  floor: number;
  biome: number;
  bits: number;
  /** The loot crate's cell (y = floor + 1). */
  crateX: number;
  crateZ: number;
}

const col = new Column();
const patch = newPatch();
const cache = new Map<string, StructureSite | null>();

function eligible(biome: number, distance: number): StructureDef[] {
  return STRUCTURE_DEFS.filter((d) => d.biomes.includes(biome) && distance >= AGE_DISTANCE[d.age]);
}

function siteAt(t: Terrain, seed: number, cx: number, cz: number, bits: number): StructureSite | null {
  sampleColumn(t, cx, cz, col);
  const biome = col.biome;
  const spawn = findSpawn(seed);
  const distance = Math.hypot(cx - spawn.x, cz - spawn.z);
  if (distance < SPAWN_CLEAR) return null;
  const defs = eligible(biome, distance);
  if (defs.length === 0) return null;
  const def = defs[(bits >>> 4) % defs.length];
  const x0 = cx - (def.w >> 1);
  const z0 = cz - (def.d >> 1);
  const heights: number[] = [];
  for (let k = 0; k < 9; k++) {
    const x = k % 3 === 0 ? x0 - 1 : k % 3 === 1 ? cx : x0 + def.w;
    const z = k < 3 ? z0 - 1 : k < 6 ? cz : z0 + def.d;
    sampleColumn(t, x, z, col);
    if (col.liquid !== LIQUID_NONE || col.height <= WATER_TOP) return null;
    heights.push(col.height);
  }
  heights.sort((a, b) => a - b);
  if (heights[8] - heights[0] > 3 || caveMouth(t, cx, cz)) return null;
  let blocked = false;
  forEachTree(t, x0 - 1, z0 - 1, x0 + def.w, z0 + def.d, 1, (s) => {
    const wide = s.kind === 2 ? 1 : 0;
    if (s.x + wide >= x0 - 1 && s.x <= x0 + def.w && s.z + wide >= z0 - 1 && s.z <= z0 + def.d) blocked = true;
  });
  if (blocked) return null;
  forEachCell(CROP_CELL, x0 - 3, z0 - 3, x0 + def.w + 2, z0 + def.d + 2, (gx, gz) => {
    if (!blocked && cropPatch(t, gx, gz, patch)) {
      const r = patch.size + 1;
      blocked = patch.x + r >= x0 - 1 && patch.x - r < x0 + def.w + 1 && patch.z + r >= z0 - 1 && patch.z - r < z0 + def.d + 1;
    }
  });
  if (blocked) return null;
  // Never on a ruin of the Old Works.
  for (let rz = Math.floor((z0 - 4) / CHUNK_SIZE); rz <= Math.floor((z0 + def.d + 4) / CHUNK_SIZE) && !blocked; rz++) {
    for (let rx = Math.floor((x0 - 4) / CHUNK_SIZE); rx <= Math.floor((x0 + def.w + 4) / CHUNK_SIZE); rx++) {
      for (const r of ruinsNear(seed, rx, rz)) {
        if (r.x0 - 4 < x0 + def.w && r.x0 + r.w + 4 > x0 && r.z0 - 4 < z0 + def.d && r.z0 + r.d + 4 > z0) blocked = true;
      }
    }
  }
  if (blocked) return null;
  return { def, x0, z0, floor: heights[4], biome, bits, crateX: x0 + def.crate[0], crateZ: z0 + def.crate[1] };
}

/** The structure of grid square (sx, sz), if it has one. */
export function squareStructure(seed: number, sx: number, sz: number): StructureSite | null {
  const key = `${seed},${sx},${sz}`;
  const known = cache.get(key);
  if (known !== undefined) return known;
  let found: StructureSite | null = null;
  if ((hash32(seed, sx, sz, 0x57c7) & 0xffff) / 65536 < STRUCTURE_CHANCE) {
    const t = terrainFor(seed);
    const span = SQUARE - 2 * SQUARE_MARGIN;
    for (let attempt = 0; attempt < 6 && !found; attempt++) {
      const a = hash32(seed, sx, sz, 0x57c8 + attempt);
      found = siteAt(t, seed, sx * SQUARE + SQUARE_MARGIN + (a % span), sz * SQUARE + SQUARE_MARGIN + ((a >>> 12) % span), a >>> 3);
    }
  }
  // A square with no structure of its own may still hold a keeper's lighthouse on a shore (src/world/lighthouses.ts).
  if (!found && (hash32(seed, sx, sz, 0x11a7) & 0xffff) / 65536 < LIGHTHOUSE_CHANCE) found = lighthouseIn(seed, sx, sz);
  if (cache.size >= 512) cache.delete(cache.keys().next().value as string);
  cache.set(key, found);
  return found;
}

/** Spots tried per square: the shore is a thin line, so a lighthouse needs more tries than a structure. */
const LIGHTHOUSE_TRIES = 32;
const shoreCol = new Column();
const shore = { height: 0, wet: false, dry: false };

/** A lighthouse site in square (sx, sz): a few tries along the square's shore, never near spawn, in the Scar or on a ruin. */
function lighthouseIn(seed: number, sx: number, sz: number): StructureSite | null {
  const t = terrainFor(seed);
  const spawn = findSpawn(seed);
  const span = SQUARE - 2 * SQUARE_MARGIN;
  const column = (x: number, z: number) => {
    sampleColumn(t, x, z, shoreCol);
    shore.height = shoreCol.height;
    shore.wet = shoreCol.liquid === LIQUID_WATER;
    shore.dry = shoreCol.liquid === LIQUID_NONE;
    return shore;
  };
  for (let attempt = 0; attempt < LIGHTHOUSE_TRIES; attempt++) {
    const a = hash32(seed, sx, sz, 0x11a8 + attempt);
    const cx = sx * SQUARE + SQUARE_MARGIN + (a % span);
    const cz = sz * SQUARE + SQUARE_MARGIN + ((a >>> 12) % span);
    if (Math.hypot(cx - spawn.x, cz - spawn.z) < LIGHTHOUSE_SPAWN_CLEAR) continue;
    sampleColumn(t, cx, cz, shoreCol);
    if (shoreCol.biome === SCAR) continue;
    const biome = shoreCol.biome;
    const floor = lighthouseFloor(cx, cz, column);
    if (floor < 0 || caveMouth(t, cx, cz)) continue;
    const def = LIGHTHOUSE;
    const x0 = cx - (def.w >> 1);
    const z0 = cz - (def.d >> 1);
    let blocked = false;
    forEachTree(t, x0 - 1, z0 - 1, x0 + def.w, z0 + def.d, 1, (s) => {
      const wide = s.kind === 2 ? 1 : 0;
      if (s.x + wide >= x0 - 1 && s.x <= x0 + def.w && s.z + wide >= z0 - 1 && s.z <= z0 + def.d) blocked = true;
    });
    for (let rz = Math.floor((z0 - 4) / CHUNK_SIZE); rz <= Math.floor((z0 + def.d + 4) / CHUNK_SIZE) && !blocked; rz++) {
      for (let rx = Math.floor((x0 - 4) / CHUNK_SIZE); rx <= Math.floor((x0 + def.w + 4) / CHUNK_SIZE); rx++) {
        for (const r of ruinsNear(seed, rx, rz)) {
          if (r.x0 - 4 < x0 + def.w && r.x0 + r.w + 4 > x0 && r.z0 - 4 < z0 + def.d && r.z0 + r.d + 4 > z0) blocked = true;
        }
      }
    }
    if (blocked) continue;
    return { def, x0, z0, floor, biome, bits: a >>> 3, crateX: x0 + def.crate[0], crateZ: z0 + def.crate[1] };
  }
  return null;
}

/** Every structure whose blocks may fall inside chunk (cx, cz) (a structure stays inside its square, so at most one). */
export function structuresNear(seed: number, cx: number, cz: number): StructureSite[] {
  const s = squareStructure(seed, Math.floor(cx / STRUCTURE_GRID_CHUNKS), Math.floor(cz / STRUCTURE_GRID_CHUNKS));
  if (!s) return [];
  const x = cx * CHUNK_SIZE;
  const z = cz * CHUNK_SIZE;
  return s.x0 < x + CHUNK_SIZE && s.x0 + s.def.w > x && s.z0 < z + CHUNK_SIZE && s.z0 + s.def.d > z ? [s] : [];
}

/** Crate cells of the structures in chunk (cx, cz), with the structure's key (for its loot table). */
export function structureCrateCells(seed: number, cx: number, cz: number): Array<{ x: number; y: number; z: number; key: string }> {
  const out: Array<{ x: number; y: number; z: number; key: string }> = [];
  for (const s of structuresNear(seed, cx, cz)) {
    if (Math.floor(s.crateX / CHUNK_SIZE) === cx && Math.floor(s.crateZ / CHUNK_SIZE) === cz) out.push({ x: s.crateX, y: s.floor + 1, z: s.crateZ, key: s.def.key });
  }
  return out;
}

const biomeFloor: Record<number, number> = { 0: ID.grass, [DUNES]: ID.sand, [FROSTFELL]: ID.snow, [SCAR]: ID.basalt, [MARSH]: ID.peat };

/** Draws the parts of structure `s` that fall inside the chunk whose north-west corner is (x0, z0). */
export function drawStructure(voxels: Uint16Array, x0: number, z0: number, s: StructureSite): void {
  const { def } = s;
  const f = s.floor;
  const ground = def.floor === 'biome' ? biomeFloor[s.biome] ?? ID.grass : def.floor;
  for (let z = s.z0; z < s.z0 + def.d; z++) {
    const lz = z - z0;
    if (lz < 0 || lz >= CHUNK_SIZE) continue;
    for (let x = s.x0; x < s.x0 + def.w; x++) {
      const lx = x - x0;
      if (lx < 0 || lx >= CHUNK_SIZE) continue;
      for (let y = f - 1, n = 0; y > 0 && n < 6; y--, n++) {
        const i = voxelIndex(lx, y, lz);
        const v = voxels[i];
        if (v !== AIR && v !== ID.oakLeaves && v !== ID.pineLeaves && v !== ID.tallGrass) break;
        voxels[i] = n < 2 ? ID.dirt : ID.stone;
      }
      for (let y = f + 1; y <= f + CLEAR && y < WORLD_HEIGHT; y++) {
        const i = voxelIndex(lx, y, lz);
        const v = voxels[i];
        if (y > f + 6 && (v === ID.oakLeaves || v === ID.pineLeaves)) continue;
        voxels[i] = AIR;
      }
      voxels[voxelIndex(lx, f, lz)] = ground;
    }
  }
  const canvas = new Canvas(voxels, x0, z0, s.x0, s.z0, f, s.bits, def.w, def.d, def.crate, voxelIndex, WORLD_HEIGHT);
  def.build(canvas);
}

/** Where a structure's guardians stand, as the mob manager needs it (same shape of home as a ruin's). */
export interface StructureGuardPlan {
  /** Stable id ("s:x0,z0"), distinct from the ruins' keys. */
  key: string;
  x: number;
  z: number;
  floor: number;
  /** Block bounds of everything the structure drew, inclusive. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  slots: Array<{ species: string; x: number; z: number; up: number; role: 'guard' | 'turret' }>;
}

export function structureGuardPlan(s: StructureSite): StructureGuardPlan {
  return {
    key: `s:${s.x0},${s.z0}`,
    x: s.x0 + s.def.w / 2,
    z: s.z0 + s.def.d / 2,
    floor: s.floor,
    x0: s.x0,
    z0: s.z0,
    x1: s.x0 + s.def.w - 1,
    z1: s.z0 + s.def.d - 1,
    slots: s.def.guards.map((g) => ({ species: g.species, x: s.x0 + g.x, z: s.z0 + g.z, up: g.up ?? 0, role: g.role ?? 'guard' })),
  };
}

/** Guard plans of every structure inside chunk (cx, cz). */
export function structureGuardPlans(seed: number, cx: number, cz: number): StructureGuardPlan[] {
  return structuresNear(seed, cx, cz).filter((s) => s.def.guards.length > 0).map(structureGuardPlan);
}
