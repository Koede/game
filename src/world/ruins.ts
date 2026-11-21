/**
 * The Old Works (spec 14): ruined workshops of someone who tamed fire before the player. At most one per
 * square of RUIN_GRID_CHUNKS x RUIN_GRID_CHUNKS chunks (RUIN_CHANCE), plus one always placed 30-78 blocks from
 * the world spawn. A ruin's site, size and every block of it are pure functions of (seed, square), and a ruin
 * never leaves its square, so a chunk only ever asks its own square (and the spawn ruin) what to draw.
 *
 * The loot crate is NOT part of the generated voxels: its cell is left empty and the World places the crate
 * with its block entity when the chunk first loads (see ruinCrates.ts), so the simulation sees a normal crate.
 */
import { RUIN_CHANCE, RUIN_GRID_CHUNKS } from '../core/constants';
import { hash32 } from '../core/math';
import { AIR, CHUNK_SIZE, WORLD_HEIGHT, makeVoxel, voxelIndex, type Facing } from '../core/types';
import { forEachCell } from './columns';
import { forEachTree } from './flora';
import { ID } from './ids';
import { CROP_CELL, cropPatch, newPatch } from './plants';
import { Column, DUNES, FROSTFELL, LIQUID_NONE, MARSH, SCAR, WATER_TOP, WOODLAND, caveMouth, sampleColumn, terrainFor, type Terrain } from './terrain';
import { findSpawn } from './spawn';

const SQUARE = RUIN_GRID_CHUNKS * CHUNK_SIZE;
/** Ruin centres keep this far from the edges of their square, so a ruin and its rubble never leave it. */
const SQUARE_MARGIN = 10;
/** Fallen blocks lie up to this far outside the walls. */
const SKIRT = 2;
/** How high above the floor a ruin clears the ground, trees' trunks excluded (sites never hold a trunk). */
const CLEAR = 14;
/** Spawn ruin: centre distance from the spawn point. */
const SPAWN_RUIN_MIN = 30;
const SPAWN_RUIN_MAX = 78;
/** Grid ruins keep this far from the spawn point and from the spawn ruin. */
const SPAWN_CLEAR = 24;
const RUIN_SPACING = 40;
/** Beyond this distance from the origin no chunk can be near the spawn ruin (spawn search stays within ~730). */
const SPAWN_AREA = 900;

export interface RuinSite {
  /** North-west outer corner of the walls and the outer size along x and z. */
  x0: number;
  z0: number;
  w: number;
  d: number;
  /** y of the floor blocks; the room's air starts at floor + 1. */
  floor: number;
  biome: number;
  bits: number;
  /** Wall the doorway is in: 0 north, 1 east, 2 south, 3 west. The cold furnace sits in the opposite wall. */
  door: number;
  /** The cell where the World places the loot crate (y = floor + 1). */
  crateX: number;
  crateZ: number;
}

const col = new Column();
const patch = newPatch();

/** Pure check and layout of a ruin centred near (cx, cz); null when the ground there is unsuitable. */
function siteAt(t: Terrain, cx: number, cz: number, bits: number, slope: number): RuinSite | null {
  const w = 5 + (bits & 3) + ((bits >>> 2) & 1);
  const d = 5 + ((bits >>> 3) & 3) + ((bits >>> 5) & 1);
  const x0 = cx - (w >> 1);
  const z0 = cz - (d >> 1);
  const heights: number[] = [];
  let biome = WOODLAND;
  for (let k = 0; k < 9; k++) {
    const x = k % 3 === 0 ? x0 - 1 : k % 3 === 1 ? cx : x0 + w;
    const z = k < 3 ? z0 - 1 : k < 6 ? cz : z0 + d;
    sampleColumn(t, x, z, col);
    if (col.liquid !== LIQUID_NONE || col.height <= WATER_TOP) return null;
    heights.push(col.height);
    if (k === 4) biome = col.biome;
  }
  heights.sort((a, b) => a - b);
  if (heights[8] - heights[0] > slope || caveMouth(t, cx, cz)) return null;
  let blocked = false;
  forEachTree(t, x0 - 1, z0 - 1, x0 + w, z0 + d, 1, (s) => {
    const wide = s.kind === 2 ? 1 : 0;
    if (s.x + wide >= x0 - 1 && s.x <= x0 + w && s.z + wide >= z0 - 1 && s.z <= z0 + d) blocked = true;
  });
  if (blocked) return null;
  // Never on top of a patch of wild crops (the spawn guarantee counts on its wild wheat).
  forEachCell(CROP_CELL, x0 - SKIRT - 3, z0 - SKIRT - 3, x0 + w + SKIRT + 2, z0 + d + SKIRT + 2, (gx, gz) => {
    if (!blocked && cropPatch(t, gx, gz, patch)) {
      const r = patch.size + 1;
      blocked = patch.x + r >= x0 - SKIRT && patch.x - r < x0 + w + SKIRT && patch.z + r >= z0 - SKIRT && patch.z - r < z0 + d + SKIRT;
    }
  });
  if (blocked) return null;
  const door = (bits >>> 6) & 3;
  // The crate stands in an inner corner on the cold furnace's side of the room, across from the doorway.
  const left = (bits >>> 8) & 1;
  let crateX: number;
  let crateZ: number;
  if (door === 0 || door === 2) {
    crateX = left ? x0 + 1 : x0 + w - 2;
    crateZ = door === 0 ? z0 + d - 2 : z0 + 1;
  } else {
    crateX = door === 1 ? x0 + 1 : x0 + w - 2;
    crateZ = left ? z0 + 1 : z0 + d - 2;
  }
  return { x0, z0, w, d, floor: heights[4], biome, bits, door, crateX, crateZ };
}

const squareCache = new Map<string, RuinSite | null>();
const spawnCache = new Map<number, RuinSite | null>();

function remember<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): V {
  if (cache.size >= limit) cache.delete(cache.keys().next().value as K);
  cache.set(key, value);
  return value;
}

/** The ruin always found 30-78 blocks from the world spawn (null only if no dry, level ground exists there). */
export function spawnRuin(seed: number): RuinSite | null {
  if (spawnCache.has(seed)) return spawnCache.get(seed) ?? null;
  const t = terrainFor(seed);
  const spawn = findSpawn(seed);
  const turn = hash32(seed, 0x5a11) / 4294967296;
  let found: RuinSite | null = null;
  for (let slope = 3; slope <= 5 && !found; slope++) {
    for (let r = SPAWN_RUIN_MIN; r <= SPAWN_RUIN_MAX && !found; r += 8) {
      for (let a = 0; a < 16 && !found; a++) {
        const angle = (turn + a / 16) * Math.PI * 2;
        const x = Math.round(spawn.x + Math.cos(angle) * r);
        const z = Math.round(spawn.z + Math.sin(angle) * r);
        found = siteAt(t, x, z, hash32(seed, x, z, 0x5a12), slope);
      }
    }
  }
  return remember(spawnCache, seed, found, 8);
}

/** The ruin of grid square (sx, sz), if it has one. */
export function squareRuin(seed: number, sx: number, sz: number): RuinSite | null {
  const key = `${seed},${sx},${sz}`;
  const known = squareCache.get(key);
  if (known !== undefined) return known;
  const h = hash32(seed, sx, sz, 0x2a1d);
  let found: RuinSite | null = null;
  if ((h & 0xffff) / 65536 < RUIN_CHANCE) {
    const t = terrainFor(seed);
    const span = SQUARE - 2 * SQUARE_MARGIN;
    for (let attempt = 0; attempt < 4 && !found; attempt++) {
      const a = hash32(seed, sx, sz, 0x2a1e + attempt);
      found = siteAt(t, sx * SQUARE + SQUARE_MARGIN + (a % span), sz * SQUARE + SQUARE_MARGIN + ((a >>> 12) % span), a >>> 3, 3);
    }
    if (found && Math.max(Math.abs(sx * SQUARE), Math.abs(sz * SQUARE)) < SPAWN_AREA + SQUARE) {
      const spawn = findSpawn(seed);
      const near = spawnRuin(seed);
      const mx = found.x0 + (found.w >> 1);
      const mz = found.z0 + (found.d >> 1);
      if (Math.hypot(mx - spawn.x, mz - spawn.z) < SPAWN_CLEAR) found = null;
      else if (near && Math.hypot(mx - near.x0 - (near.w >> 1), mz - near.z0 - (near.d >> 1)) < RUIN_SPACING) found = null;
    }
  }
  return remember(squareCache, key, found, 512);
}

/** Every ruin whose blocks may fall inside chunk (cx, cz). */
export function ruinsNear(seed: number, cx: number, cz: number): RuinSite[] {
  const out: RuinSite[] = [];
  const own = squareRuin(seed, Math.floor(cx / RUIN_GRID_CHUNKS), Math.floor(cz / RUIN_GRID_CHUNKS));
  if (own) out.push(own);
  const x = cx * CHUNK_SIZE;
  const z = cz * CHUNK_SIZE;
  if (Math.abs(x) < SPAWN_AREA && Math.abs(z) < SPAWN_AREA) {
    const near = spawnRuin(seed);
    if (near && touches(near, cx, cz)) out.push(near);
  }
  return out.filter((r) => touches(r, cx, cz));
}

function touches(r: RuinSite, cx: number, cz: number): boolean {
  const x = cx * CHUNK_SIZE;
  const z = cz * CHUNK_SIZE;
  return r.x0 - SKIRT < x + CHUNK_SIZE && r.x0 + r.w + SKIRT > x && r.z0 - SKIRT < z + CHUNK_SIZE && r.z0 + r.d + SKIRT > z;
}

// ---- drawing ------------------------------------------------------------------------------------------------

const roll = (r: RuinSite, x: number, y: number, z: number): number => hash32(r.bits, x, y, z) & 0xff;

function wallBlock(r: RuinSite, x: number, y: number, z: number): number {
  const n = roll(r, x, y, z);
  const wet = r.biome === WOODLAND || r.biome === MARSH;
  if ((r.bits >>> 9) & 1) return n < 150 ? ID.brick : n < 215 ? ID.crackedStoneBrick : ID.stoneBrick;
  if (n < 100) return ID.stoneBrick;
  if (n < 170) return ID.crackedStoneBrick;
  return n < (wet ? 256 : 215) ? ID.mossyStoneBrick : ID.brick;
}

function floorBlock(r: RuinSite, x: number, z: number): number {
  const n = roll(r, x, 0, z);
  if (n < 110) return ID.stoneBrick;
  if (n < 165) return ID.crackedStoneBrick;
  if (n < 200) return r.biome === MARSH || r.biome === WOODLAND ? ID.mossyStoneBrick : ID.stoneBrick;
  if (n < 228) return ID.gravel;
  return r.biome === DUNES ? ID.sand : r.biome === SCAR ? ID.basalt : r.biome === FROSTFELL ? ID.snow : ID.grass;
}

/** Height of the wall at a perimeter cell: corners stand tallest, one side has mostly fallen. */
function wallHeight(r: RuinSite, x: number, z: number, side: number): number {
  const full = 2 + ((r.bits >>> 10) & 1) + ((r.bits >>> 11) & 1);
  const corner = (x === r.x0 || x === r.x0 + r.w - 1) && (z === r.z0 || z === r.z0 + r.d - 1);
  const fallen = side === ((r.bits >>> 12) & 3) && side !== r.door;
  const n = roll(r, x, 1, z);
  let h = corner ? full + 1 : full - (n < 90 ? 0 : n < 190 ? 1 : 2);
  if (fallen) h = Math.min(h, n & 1);
  return Math.max(0, h);
}

function sideOf(r: RuinSite, x: number, z: number): number {
  if (z === r.z0) return 0;
  if (x === r.x0 + r.w - 1) return 1;
  if (z === r.z0 + r.d - 1) return 2;
  return x === r.x0 ? 3 : -1;
}

/** The door cell and the furnace cell (in the opposite wall), both at the middle of their wall. */
function doorAndFurnace(r: RuinSite): [number, number, number, number] {
  const mx = r.x0 + (r.w >> 1);
  const mz = r.z0 + (r.d >> 1);
  switch (r.door) {
    case 0: return [mx, r.z0, mx, r.z0 + r.d - 1];
    case 1: return [r.x0 + r.w - 1, mz, r.x0, mz];
    case 2: return [mx, r.z0 + r.d - 1, mx, r.z0];
    default: return [r.x0, mz, r.x0 + r.w - 1, mz];
  }
}

/** Draws the parts of ruin `r` that fall inside the chunk whose north-west corner is (x0, z0). */
export function drawRuin(voxels: Uint16Array, x0: number, z0: number, r: RuinSite): void {
  const [doorX, doorZ, furnX, furnZ] = doorAndFurnace(r);
  const yard = (r.bits >>> 14) & 1;
  const f = r.floor;
  for (let z = r.z0 - SKIRT; z < r.z0 + r.d + SKIRT; z++) {
    const lz = z - z0;
    if (lz < 0 || lz >= CHUNK_SIZE) continue;
    for (let x = r.x0 - SKIRT; x < r.x0 + r.w + SKIRT; x++) {
      const lx = x - x0;
      if (lx < 0 || lx >= CHUNK_SIZE) continue;
      const inside = x >= r.x0 && x < r.x0 + r.w && z >= r.z0 && z < r.z0 + r.d;
      if (!inside) {
        skirt(voxels, lx, lz, r, x, z, yard);
        continue;
      }
      // Level the site: solid ground under the floor, open air above it (leaves high up may stay).
      for (let y = f - 1, n = 0; y > 0 && n < 6; y--, n++) {
        const i = voxelIndex(lx, y, lz);
        const v = voxels[i];
        if (v !== AIR && v !== ID.oakLeaves && v !== ID.pineLeaves && v !== ID.tallGrass) break;
        voxels[i] = n < 2 ? ID.dirt : ID.stone;
      }
      for (let y = f + 1; y <= f + CLEAR && y < WORLD_HEIGHT; y++) {
        const i = voxelIndex(lx, y, lz);
        const v = voxels[i];
        if (y > f + 4 && (v === ID.oakLeaves || v === ID.pineLeaves)) continue;
        voxels[i] = AIR;
      }
      voxels[voxelIndex(lx, f, lz)] = floorBlock(r, x, z);
      const side = sideOf(r, x, z);
      if (side >= 0) {
        if (x === furnX && z === furnZ) {
          voxels[voxelIndex(lx, f + 1, lz)] = makeVoxel(ID.collapsedFurnace, r.door as Facing);
          const flue = 1 + ((r.bits >>> 15) & 1);
          for (let n = 1; n <= flue; n++) voxels[voxelIndex(lx, f + 1 + n, lz)] = ID.brick;
          continue;
        }
        if (x === doorX && z === doorZ) continue;
        const height = wallHeight(r, x, z, side);
        for (let n = 1; n <= height; n++) voxels[voxelIndex(lx, f + n, lz)] = wallBlock(r, x, f + n, z);
        continue;
      }
      interior(voxels, lx, lz, r, x, z, doorX, doorZ, furnX, furnZ);
    }
  }
}

function interior(voxels: Uint16Array, lx: number, lz: number, r: RuinSite, x: number, z: number, doorX: number, doorZ: number, furnX: number, furnZ: number): void {
  if (x === r.crateX && z === r.crateZ) return;
  // Keep the way in and the cold furnace's mouth clear.
  if (Math.abs(x - doorX) + Math.abs(z - doorZ) <= 1 || Math.abs(x - furnX) + Math.abs(z - furnZ) <= 1) return;
  const i = voxelIndex(lx, r.floor + 1, lz);
  const n = roll(r, x, 2, z);
  const byWall = x === r.x0 + 1 || x === r.x0 + r.w - 2 || z === r.z0 + 1 || z === r.z0 + r.d - 2;
  if (byWall && n < 34) voxels[i] = ID.rustedShell;
  else if (n > 226) voxels[i] = r.biome === DUNES ? ID.sand : ID.rubble;
}

/** Outside the walls: fallen stones on the ground, and on some sites a row of rusted machines in the yard. */
function skirt(voxels: Uint16Array, lx: number, lz: number, r: RuinSite, x: number, z: number, yard: number): void {
  let top = -1;
  for (let y = Math.min(WORLD_HEIGHT - 2, r.floor + 3); y >= r.floor - 3; y--) {
    const v = voxels[voxelIndex(lx, y, lz)];
    if (v !== AIR && v !== ID.tallGrass && v !== ID.oakLeaves && v !== ID.pineLeaves) {
      top = y;
      break;
    }
  }
  if (top < 0 || voxels[voxelIndex(lx, top, lz)] === ID.water) return;
  const i = voxelIndex(lx, top + 1, lz);
  const n = roll(r, x, 3, z);
  const yardRow = yard && ((r.door === 0 || r.door === 2) ? x === r.x0 - 1 : z === r.z0 - 1);
  if (yardRow && n < 110 && top === r.floor) voxels[i] = ID.rustedShell;
  else if (n < 30) voxels[i] = wallBlock(r, x, top + 1, z);
  else if (n < 44) voxels[i] = ID.rubble;
}

/** Crate cells of the ruins in chunk (cx, cz), in world coordinates. */
export function ruinCrateCells(seed: number, cx: number, cz: number): Array<{ x: number; y: number; z: number }> {
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (const r of ruinsNear(seed, cx, cz)) {
    if (Math.floor(r.crateX / CHUNK_SIZE) === cx && Math.floor(r.crateZ / CHUNK_SIZE) === cz) out.push({ x: r.crateX, y: r.floor + 1, z: r.crateZ });
  }
  return out;
}
