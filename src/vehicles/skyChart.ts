/**
 * The airship's sky chart (docs/api/airship.md): what the pilot has spotted from the air, and the course they steer by.
 * Pure state and rules; the world is read through the seed alone (where structures, ruins and biomes are is a function
 * of the seed), so nothing needs to be loaded to be seen from far off.
 *
 *  - Spotting: the higher the ship, the further the pilot sees (`spotRadius`); every landmark structure, ruin and region
 *    whose middle falls inside that circle goes on the chart, once.
 *  - Regions: the land is cut into REGION_SIZE squares, each named for the biome at its middle ("the Amber Weald"), so a
 *    long flight keeps finding new country to name.
 *  - Course: one chart entry the HUD points at. Coming within ARRIVE_R of an entry marks it reached and moves the
 *    course on to the nearest entry not yet reached.
 */
import { CHUNK_SIZE, type BiomeKey } from '../core/types';
import { RUIN_GRID_CHUNKS } from '../core/constants';
import { hash32 } from '../core/math';
import { squareRuin } from '../world/ruins';
import { STRUCTURE_GRID_CHUNKS, squareStructure } from '../world/structures';
import { ruinName } from '../game/exploration';

/** Below this height (feet) the trees and hills are in the way: nothing new is spotted. */
export const SPOT_FLOOR_Y = 56;
/** Blocks of sight gained per block of height above SPOT_FLOOR_Y - 8, and the most anyone sees. */
export const SIGHT_PER_BLOCK = 4;
export const MAX_SIGHT = 240;
/** Side of a named region, in blocks. */
export const REGION_SIZE = 192;
/** Coming this close (horizontally) to an entry reaches it. */
export const ARRIVE_R = 40;
/** Most entries one chart keeps (oldest regions go first beyond it). */
export const MAX_ENTRIES = 160;

export type ChartKind = 'landmark' | 'ruin' | 'region';

export interface ChartEntry {
  id: string;
  kind: ChartKind;
  name: string;
  x: number;
  z: number;
  /** Biome of a region. */
  biome?: BiomeKey;
  reached: boolean;
}

export interface ChartSave { entries: ChartEntry[]; course: string | null }

/** How far the pilot sees with the ship's feet at height y (0 when too low). */
export function spotRadius(y: number): number {
  if (y < SPOT_FLOOR_Y) return 0;
  return Math.min(MAX_SIGHT, (y - (SPOT_FLOOR_Y - 8)) * SIGHT_PER_BLOCK);
}

const ADJECTIVES = ['Amber', 'Hollow', 'Grey', 'Windy', 'Silent', 'Copper', 'Ashen', 'Misty', 'Long', 'Broken', 'Old', 'Red', 'Bright', 'Lonely', 'Golden', 'Iron'];
const NOUNS: Readonly<Record<BiomeKey, readonly string[]>> = {
  woodland: ['Weald', 'Wood', 'Glades', 'Copse'],
  dunes: ['Dunes', 'Sands', 'Wastes', 'Barrens'],
  frostfell: ['Fells', 'Drifts', 'Peaks', 'Snows'],
  scar: ['Scar', 'Cinders', 'Ashlands', 'Burn'],
  marsh: ['Marsh', 'Fen', 'Mires', 'Reedlands'],
};

/** The name of region (rx, rz) of a world, for its biome. */
export function regionName(seed: number, rx: number, rz: number, biome: BiomeKey): string {
  const h = hash32(seed, rx, rz, 0x5ca1);
  const nouns = NOUNS[biome];
  return `the ${ADJECTIVES[h % ADJECTIVES.length]} ${nouns[(h >>> 8) % nouns.length]}`;
}

/** Everything worth charting whose middle is within `r` of (x, z). Pure in the seed. */
export function sightsAround(seed: number, x: number, z: number, r: number, biomeAt: (x: number, z: number) => BiomeKey): Omit<ChartEntry, 'reached'>[] {
  const out: Omit<ChartEntry, 'reached'>[] = [];
  if (r <= 0) return out;
  const inside = (px: number, pz: number): boolean => Math.hypot(px - x, pz - z) <= r;
  const SS = STRUCTURE_GRID_CHUNKS * CHUNK_SIZE;
  for (let sx = Math.floor((x - r) / SS); sx <= Math.floor((x + r) / SS); sx++) {
    for (let sz = Math.floor((z - r) / SS); sz <= Math.floor((z + r) / SS); sz++) {
      const st = squareStructure(seed, sx, sz);
      if (!st) continue;
      const cx = st.x0 + (st.def.w >> 1);
      const cz = st.z0 + (st.def.d >> 1);
      if (inside(cx, cz)) out.push({ id: `s:${st.def.key}:${st.x0},${st.z0}`, kind: 'landmark', name: `the ${st.def.name}`, x: cx, z: cz });
    }
  }
  const RS = RUIN_GRID_CHUNKS * CHUNK_SIZE;
  for (let sx = Math.floor((x - r) / RS); sx <= Math.floor((x + r) / RS); sx++) {
    for (let sz = Math.floor((z - r) / RS); sz <= Math.floor((z + r) / RS); sz++) {
      const ru = squareRuin(seed, sx, sz);
      if (!ru) continue;
      const cx = ru.x0 + (ru.w >> 1);
      const cz = ru.z0 + (ru.d >> 1);
      if (inside(cx, cz)) out.push({ id: `r:${cx},${cz}`, kind: 'ruin', name: ruinName(seed, cx, cz), x: cx, z: cz });
    }
  }
  for (let rx = Math.floor((x - r) / REGION_SIZE); rx <= Math.floor((x + r) / REGION_SIZE); rx++) {
    for (let rz = Math.floor((z - r) / REGION_SIZE); rz <= Math.floor((z + r) / REGION_SIZE); rz++) {
      const cx = rx * REGION_SIZE + REGION_SIZE / 2;
      const cz = rz * REGION_SIZE + REGION_SIZE / 2;
      if (!inside(cx, cz)) continue;
      const biome = biomeAt(cx, cz);
      out.push({ id: `g:${rx},${rz}`, kind: 'region', name: regionName(seed, rx, rz, biome), x: cx, z: cz, biome });
    }
  }
  return out;
}

/** Compass point of a direction (dx east, dz south): N, NE, E ... */
export function compassOf(dx: number, dz: number): string {
  const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const a = Math.atan2(dx, -dz);
  return POINTS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

export class SkyChart {
  private readonly entries = new Map<string, ChartEntry>();
  /** Id of the entry the course points at, or null. */
  course: string | null = null;

  get size(): number {
    return this.entries.size;
  }

  all(): ChartEntry[] {
    return [...this.entries.values()];
  }

  get(id: string): ChartEntry | null {
    return this.entries.get(id) ?? null;
  }

  /** Adds what is new among `sights`; returns the new entries (in the order given). */
  spot(sights: readonly Omit<ChartEntry, 'reached'>[]): ChartEntry[] {
    const fresh: ChartEntry[] = [];
    for (const s of sights) {
      if (this.entries.has(s.id)) continue;
      const e: ChartEntry = { ...s, reached: false };
      this.entries.set(e.id, e);
      fresh.push(e);
    }
    while (this.entries.size > MAX_ENTRIES) {
      const old = [...this.entries.values()].find((e) => e.kind === 'region' && e.id !== this.course) ?? this.entries.values().next().value!;
      this.entries.delete(old.id);
    }
    return fresh;
  }

  /** Marks what is within ARRIVE_R of (x, z) reached; returns those entries. Moves the course on if it was reached. */
  arrive(x: number, z: number): ChartEntry[] {
    const got: ChartEntry[] = [];
    for (const e of this.entries.values()) {
      if (!e.reached && Math.hypot(e.x - x, e.z - z) <= ARRIVE_R) {
        e.reached = true;
        got.push(e);
      }
    }
    if (this.course && this.entries.get(this.course)?.reached) this.course = this.nearestOpen(x, z)?.id ?? null;
    return got;
  }

  /** Entries not reached yet, nearest to (x, z) first. */
  open(x: number, z: number): ChartEntry[] {
    return [...this.entries.values()].filter((e) => !e.reached).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }

  nearestOpen(x: number, z: number): ChartEntry | null {
    return this.open(x, z)[0] ?? null;
  }

  /** Moves the course to the next entry not reached (by distance from (x, z), wrapping round). Returns it. */
  nextCourse(x: number, z: number): ChartEntry | null {
    const list = this.open(x, z);
    if (list.length === 0) {
      this.course = null;
      return null;
    }
    const at = list.findIndex((e) => e.id === this.course);
    const next = list[(at + 1) % list.length];
    this.course = next.id;
    return next;
  }

  courseEntry(): ChartEntry | null {
    return this.course ? this.entries.get(this.course) ?? null : null;
  }

  toJSON(): ChartSave {
    return { entries: this.all().map((e) => ({ ...e })), course: this.course };
  }

  load(raw: unknown): void {
    this.entries.clear();
    this.course = null;
    const o = raw && typeof raw === 'object' ? (raw as Partial<ChartSave>) : null;
    if (!o || !Array.isArray(o.entries)) return;
    for (const r of o.entries) {
      if (!r || typeof r !== 'object') continue;
      const e = r as Partial<ChartEntry>;
      if (typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.x !== 'number' || typeof e.z !== 'number') continue;
      if (e.kind !== 'landmark' && e.kind !== 'ruin' && e.kind !== 'region') continue;
      this.entries.set(e.id, { id: e.id, kind: e.kind, name: e.name, x: e.x, z: e.z, reached: e.reached === true, ...(e.biome ? { biome: e.biome } : {}) });
    }
    if (typeof o.course === 'string' && this.entries.has(o.course)) this.course = o.course;
  }
}
