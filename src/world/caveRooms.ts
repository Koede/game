/**
 * Cave rooms (docs/plans/caves-and-depths.md): a feature stamped into a chunk's own cave air, so a room is always reached by the
 * caves that already carve the rock. Everything here is a pure function of (seed, chunk) and stays inside its chunk, so nothing
 * depends on generation order.
 *
 * - camp: an old miner's camp: a crate with a depth-band loot table, a lit torch, a fallen log and rubble.
 * - lode: a rich cluster of the band's rarer ores showing on a cave wall.
 * - sinkhole: a sheer shaft in the floor, its rim ringed with glowcaps so it can be seen from afar; ore waits at the bottom.
 * - gas: a pocket of foul air (it hurts to stand in) low in the rock, guarding a lode of deep ore.
 *
 * Hooks for what builds on the caves (the cave boss, enchanted finds): `caveBandAt` and `caveCampTable` name the depth band and
 * its loot table (`cave_camp_<band>`, a named table in src/content/loot.ts - add a NAMED_FINDS entry to put a fixed item in one);
 * `caveRoomPlan` says which room a chunk will try to build and where; `findCaveCamp` finds the camp's crate in a loaded chunk.
 */
import { hash32, mulberry32 } from '../core/math';
import { ORE_VEINS, blockId } from '../core/registry';
import { AIR, CHUNK_SIZE, voxelIndex } from '../core/types';
import type { ChunkColumns } from './columns';
import { ID } from './ids';
import { CAVE_LAVA_TOP, type Terrain } from './terrain';

export type CaveBand = 'shallow' | 'middle' | 'deep';
export type CaveRoomKind = 'camp' | 'lode' | 'sinkhole' | 'gas';

/** Depth bands, by the y of a cave floor: ores and loot get richer the lower you go. */
export const CAVE_BANDS: ReadonlyArray<{ band: CaveBand; minY: number; maxY: number }> = [
  { band: 'deep', minY: 0, maxY: 19 },
  { band: 'middle', minY: 20, maxY: 35 },
  { band: 'shallow', minY: 36, maxY: 255 },
];

export function caveBandAt(y: number): CaveBand {
  return y <= 19 ? 'deep' : y <= 35 ? 'middle' : 'shallow';
}

/** The loot table id of a camp in a band. */
export const caveCampTable = (band: CaveBand): string => `cave_camp_${band}`;

/** Chance a chunk tries to build a room, and the relative weight of each kind. */
export const CAVE_ROOM_CHANCE = 0.3;
const KIND_WEIGHTS: ReadonlyArray<[CaveRoomKind, number]> = [['camp', 35], ['lode', 30], ['sinkhole', 20], ['gas', 15]];
const ATTEMPTS = 20;
/** Candidate columns stay clear of the chunk edge so a room's stamp (radius 2 round its centre) fits in the chunk. */
const EDGE = 3;
/** Floor-level ranges each kind looks in. The lowest floor ever used is above the lava (CAVE_LAVA_TOP). */
const FLOOR_MIN = CAVE_LAVA_TOP + 3;
const RANGE: Record<CaveRoomKind, [number, number]> = { camp: [FLOOR_MIN, 50], lode: [FLOOR_MIN, 50], sinkhole: [FLOOR_MIN + 5, 48], gas: [FLOOR_MIN, 22] };

const Y = CHUNK_SIZE * CHUNK_SIZE;
const FLOORS = new Set<number>([ID.stone, ID.gravel, ID.clay, ID.basalt, ID.rubble, ID.dirt]);
const ROCK = new Set<number>([ID.stone, ID.basalt]);

export interface CaveRoomPlan {
  kind: CaveRoomKind;
  /** World columns tried in order; the first with a suitable floor gets the room. */
  columns: Array<{ x: number; z: number }>;
}

/** Which room chunk (cx, cz) will try to build, and the columns it tries. Null for most chunks. Pure of the seed. */
export function caveRoomPlan(seed: number, cx: number, cz: number): CaveRoomPlan | null {
  const rng = mulberry32(hash32(seed, cx, cz, 0xca7e));
  if (rng() >= CAVE_ROOM_CHANCE) return null;
  let total = 0;
  for (const [, w] of KIND_WEIGHTS) total += w;
  let pick = rng() * total;
  let kind = KIND_WEIGHTS[0][0];
  for (const [k, w] of KIND_WEIGHTS) {
    pick -= w;
    if (pick < 0) { kind = k; break; }
  }
  const columns: Array<{ x: number; z: number }> = [];
  const span = CHUNK_SIZE - 2 * EDGE;
  for (let n = 0; n < ATTEMPTS; n++) {
    columns.push({ x: cx * CHUNK_SIZE + EDGE + Math.floor(rng() * span), z: cz * CHUNK_SIZE + EDGE + Math.floor(rng() * span) });
  }
  return { kind, columns };
}

/**
 * The ore a lode shows at height y: any ore whose vein band covers y, rarer ores favoured (weight 1 / veins per chunk), so lower
 * means richer and a lode never holds an ore the depth could not. -1 when none fits.
 */
const LODE_ORES = ORE_VEINS.filter((v) => v.block !== 'limestone' && v.block !== 'oil_shale').map((v) => ({ ...v, id: blockId(v.block), weight: 1 / v.veinsPerChunk }));
export function lodeOre(y: number, roll: number): number {
  return lodeVein(y, roll)?.id ?? -1;
}

/** The vein spec (ore and its band) a lode at height y shows, or null. */
export function lodeVein(y: number, roll: number): (typeof LODE_ORES)[number] | null {
  let total = 0;
  for (const v of LODE_ORES) if (y >= v.minY && y <= v.maxY) total += v.weight;
  if (total <= 0) return null;
  let pick = roll * total;
  for (const v of LODE_ORES) {
    if (y < v.minY || y > v.maxY) continue;
    pick -= v.weight;
    if (pick < 0) return v;
  }
  return null;
}

/** Is (lx, y, lz) a floor cell: air with room to stand, on ordinary floor, with no liquid or glowing growth about. */
function openFloor(voxels: Uint16Array, lx: number, y: number, lz: number, ceiling: number, need: number): boolean {
  if (y + 3 > ceiling) return false;
  const i = voxelIndex(lx, y, lz);
  if (voxels[i] !== AIR || !FLOORS.has(voxels[i - Y]) || voxels[i + Y] !== AIR || voxels[i + 2 * Y] !== AIR) return false;
  let air = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = 0; dy <= 2; dy++) {
        const v = voxels[voxelIndex(lx + dx, y + dy, lz + dz)];
        if (v === ID.lava || v === ID.water || v === ID.oil) return false;
        if (v === AIR || v === ID.glowcap) air++;
      }
    }
  }
  return air >= need;
}

/** Finds a floor for a room in column (lx, lz): the scan starts at a hash-chosen height so camps spread over every band. */
function findFloor(voxels: Uint16Array, lx: number, lz: number, kind: CaveRoomKind, ceiling: number, start: number, need: number): number {
  const [lo, hi] = RANGE[kind];
  const top = Math.min(hi, ceiling - 3);
  if (top < lo) return -1;
  const span = top - lo + 1;
  for (let k = 0; k < span; k++) {
    const y = lo + ((start % span) + k) % span;
    if (openFloor(voxels, lx, y, lz, ceiling, need)) return y;
  }
  return -1;
}

const DX4 = [1, -1, 0, 0];
const DZ4 = [0, 0, 1, -1];

/** A cluster of ore on the nearest wall round (lx, y, lz), `count` blocks at least when the rock allows. Returns blocks placed. */
function stampLode(t: Terrain, voxels: Uint16Array, lx: number, y: number, lz: number, rng: () => number): number {
  const vein = lodeVein(y + 1, rng());
  if (!vein) return 0;
  const ore = vein.id;
  // The nearest rock wall at head height, up to 4 blocks out along an axis.
  let best = -1;
  let bestD = 99;
  for (let d4 = 0; d4 < 4; d4++) {
    for (let d = 1; d <= 4; d++) {
      const x = lx + DX4[d4] * d;
      const z = lz + DZ4[d4] * d;
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) break;
      if (voxels[voxelIndex(x, y + 1, z)] !== AIR && voxels[voxelIndex(x, y + 1, z)] !== ID.glowcap) {
        if (d < bestD) { bestD = d; best = d4; }
        break;
      }
    }
  }
  if (best < 0) return 0;
  const wx = lx + DX4[best] * bestD;
  const wz = lz + DZ4[best] * bestD;
  let placed = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = wx + dx;
        const z = wz + dz;
        const yy = y + 1 + dy;
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || yy < vein.minY || yy > vein.maxY) continue;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 5 || (d2 > 2 && rng() < 0.35)) continue;
        const i = voxelIndex(x, yy, z);
        if (ROCK.has(voxels[i])) { voxels[i] = ore; placed++; }
      }
    }
  }
  return placed;
}

function stampCamp(voxels: Uint16Array, lx: number, y: number, lz: number, rng: () => number): void {
  // A clear 3x3 pad, head height and a little over.
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        const i = voxelIndex(lx + dx, y + dy, lz + dz);
        if (voxels[i] === ID.glowcap) voxels[i] = AIR;
      }
    }
  }
  const at = (dx: number, dz: number): number => voxelIndex(lx + dx, y, lz + dz);
  voxels[at(0, 0)] = ID.crate;
  voxels[at(-1, 0)] = ID.torch;
  voxels[at(1, 0)] = ID.oakLog;
  if (rng() < 0.7) voxels[at(0, 1)] = ID.rubble;
  if (rng() < 0.5) voxels[at(1, -1)] = ID.rubble;
}

/** A shaft 3 wide, 5 to 7 deep, with a ring of glowcaps on the rim and ore in one wall at the bottom. Returns false when it does not fit. */
function stampSinkhole(t: Terrain, voxels: Uint16Array, lx: number, y: number, lz: number, rng: () => number): boolean {
  const depth = Math.min(5 + Math.floor(rng() * 3), y - FLOOR_MIN);
  if (depth < 4) return false;
  const bottom = y - depth;
  // Solid all round and below: the shaft must not open into water, lava or another cave.
  for (let yy = bottom - 1; yy < y; yy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const v = voxels[voxelIndex(lx + dx, yy, lz + dz)];
        const wall = yy === bottom - 1 || (yy <= y - 2 && (Math.abs(dx) === 2 || Math.abs(dz) === 2));
        if (v === ID.lava || v === ID.water || v === ID.oil || (wall && (v === AIR || v === ID.foulAir))) return false;
      }
    }
  }
  for (let yy = bottom; yy < y; yy++) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) voxels[voxelIndex(lx + dx, yy, lz + dz)] = AIR;
  }
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2 || (dx + dz) % 2 !== 0) continue;
      for (let yy = y + 1; yy >= y - 1; yy--) {
        const i = voxelIndex(lx + dx, yy, lz + dz);
        if (voxels[i] === AIR && FLOORS.has(voxels[i - Y])) { voxels[i] = ID.glowcap; break; }
      }
    }
  }
  stampLode(t, voxels, lx, bottom, lz, rng);
  return true;
}

/** Foul air in the open cells round (lx, y, lz), up to 3 high: a pocket, not a flood. Returns cells filled. */
function stampGas(voxels: Uint16Array, lx: number, y: number, lz: number): number {
  let n = 0;
  for (let dy = 1; dy <= 3; dy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dz * dz > 5) continue;
        const i = voxelIndex(lx + dx, y + dy - 1, lz + dz);
        if (voxels[i] === AIR || voxels[i] === ID.glowcap) { voxels[i] = ID.foulAir; n++; }
      }
    }
  }
  return n;
}

/** A room stamped into a generated chunk (what `placeCaveRoom` reports; tests and the boss read it). */
export interface CaveRoom {
  kind: CaveRoomKind;
  /** World coordinates of the standing cell: the first air cell above the floor. */
  x: number;
  y: number;
  z: number;
  band: CaveBand;
}

/** Builds the chunk's planned room, if some candidate column has a floor for it. `cols.caveLimit` keeps it under the surface. */
export function placeCaveRoom(t: Terrain, voxels: Uint16Array, cx: number, cz: number, cols: ChunkColumns): CaveRoom | null {
  const plan = caveRoomPlan(t.seed, cx, cz);
  if (!plan) return null;
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const rng = mulberry32(hash32(t.seed, cx, cz, 0xca7f));
  const start = Math.floor(rng() * 64);
  for (const c of plan.columns) {
    const lx = c.x - x0;
    const lz = c.z - z0;
    const ceiling = cols.caveLimit[lz * CHUNK_SIZE + lx];
    const y = findFloor(voxels, lx, lz, plan.kind, ceiling - 1, start + lx * 5 + lz * 3, plan.kind === 'camp' ? 48 : plan.kind === 'sinkhole' ? 42 : 40);
    if (y < 0) continue;
    let built = true;
    switch (plan.kind) {
      case 'camp': stampCamp(voxels, lx, y, lz, rng); break;
      case 'lode': built = stampLode(t, voxels, lx, y, lz, rng) >= 4; break;
      case 'sinkhole': built = stampSinkhole(t, voxels, lx, y, lz, rng); break;
      case 'gas': stampGas(voxels, lx, y, lz); stampLode(t, voxels, lx, y, lz, rng); break;
    }
    if (built) return { kind: plan.kind, x: c.x, y: y, z: c.z, band: caveBandAt(y) };
  }
  return null;
}

/** The generated camp crate of chunk (cx, cz) in a loaded world: its cell, if the plan is a camp and the crate voxel is still there. */
export function findCaveCamp(seed: number, cx: number, cz: number, voxelAt: (x: number, y: number, z: number) => number): { x: number; y: number; z: number } | null {
  const plan = caveRoomPlan(seed, cx, cz);
  if (!plan || plan.kind !== 'camp') return null;
  const [lo, hi] = RANGE.camp;
  for (const c of plan.columns) {
    for (let y = lo; y <= hi; y++) if (voxelAt(c.x, y, c.z) === ID.crate) return { x: c.x, y, z: c.z };
  }
  return null;
}
