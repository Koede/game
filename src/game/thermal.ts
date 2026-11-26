/**
 * Heat as a resource you can see (docs/api/thermal.md). One temperature API for the whole game: `Thermal.temperatureAt(x, y, z)`
 * in degrees C. It reuses the heat the game already has, the warmth radius of every fire, torch, furnace and heater block
 * (`voxelWarmth`, lit furnaces scaled by their `tempC`), and adds the two things that were missing: what the sky is doing
 * (night, frost, weather, a season's offset) and walls.
 *
 *  - Outdoors a source warms the air around it over its radius, unless a wall stands in the line.
 *  - Inside an enclosed room (a flood fill that never reaches open sky) the room's sources share one temperature:
 *    rise = POWER_TO_C * power / (leak + LEAK_FLOOR), where `leak` is the sum over the room's wall faces of how much heat
 *    that wall lets out (1 - insulation). A wool-lined room keeps a torch warm; a glass box loses a furnace's heat.
 *  - Deep caves that never meet the sky settle at CAVE_C.
 *
 * Pure over IWorld, DOM-free. Rooms are cached and dropped when a block changes (`bus` 'block:changed') or after
 * CACHE_S seconds. The seasons feature feeds `climate.seasonOffsetC`; difficulty is the caller's business (survival.ts).
 */
import { clamp } from '../core/math';
import { blockOf, voxelWarmth } from '../core/registry';
import type { GameBus } from '../core/context';
import { WORLD_HEIGHT, type BiomeKey, type IWorld } from '../core/types';

/** At or above this a person is comfortable indoors; below COLD_C they are cold; at or below FREEZING_C it hurts. */
export const COMFORT_C = 15;
export const COLD_C = 5;
export const FREEZING_C = -5;
/** Deep underground air that never meets the sky. */
export const CAVE_C = 9;
/** A room never gets more than this far above the outdoors, however well it is sealed. */
export const MAX_RISE_C = 40;
/** Outdoor air next to a source: C added at the source itself per block of its radius (falls off with distance squared). */
export const OPEN_C_PER_BLOCK = 4;
/** Extra warmth right beside a source inside a room (fades to nothing at its radius). */
export const ROOM_LOCAL_C = 6;
export const POWER_TO_C = 28;
export const LEAK_FLOOR = 8;
/** A flood fill that grows past this many cells is a cave or a hall, not a room. */
export const ROOM_CAP = 600;
export const CACHE_S = 2;
/** Furthest a source's heat reaches in any direction (blocks). */
const MAX_RADIUS = 12;

/** What the sky is doing at a spot. Supplied by the session (survival.ts, the clock, the weather, the seasons). */
export interface Climate {
  isNight(): boolean;
  biomeAt(x: number, z: number): BiomeKey;
  /** 'rain' | 'snow' | 'dust' | 'none', and how hard it falls 0..1. Null = no weather. */
  weather?(): { precipitation: string; intensity: number } | null;
  /** Added to every outdoor temperature (winter is negative). The seasons thread sets this. */
  seasonOffsetC?(): number;
}

/** Fraction of heat a wall block keeps in (0 = none, 1 = all). Unlisted solids use DEFAULT_INSULATION. */
export const INSULATION: Readonly<Record<string, number>> = {
  insulated_wall: 0.95,
  snow: 0.8,
  wool_bedding: 0.7,
  dirt: 0.55,
  grass: 0.55,
  clay: 0.55,
  brick: 0.55,
  plank: 0.5,
  oak_log: 0.5,
  pine_log: 0.5,
  bookshelf: 0.5,
  wooden_door: 0.4,
  oak_leaves: 0.3,
  pine_leaves: 0.3,
  stone_brick: 0.35,
  stone: 0.3,
  concrete: 0.35,
  sand: 0.3,
  gravel: 0.3,
  ice: 0.15,
  glass: 0.12,
};
export const DEFAULT_INSULATION = 0.3;

/** Blocks that shut a room like a wall although they may not be solid (a closed door). */
const SEALS: ReadonlySet<string> = new Set(['wooden_door']);

export const insulationOf = (key: string): number => INSULATION[key] ?? DEFAULT_INSULATION;

/** The outdoor temperature in C: the day is mild, the night, frost, rain and snow each take some. Pure, for tests and the HUD. */
export function outdoorTempC(night: boolean, biome: BiomeKey | string, precipitation: string | null, intensity: number, seasonOffsetC = 0): number {
  let c = 12;
  if (night) c -= 12;
  if (biome === 'frostfell') c -= night ? 10 : 12;
  else if (biome === 'dunes') c += night ? 4 : 8;
  if (precipitation === 'snow') c -= 5 * clamp(intensity, 0, 1);
  else if (precipitation === 'rain') c -= 3 * clamp(intensity, 0, 1);
  return c + seasonOffsetC;
}

export type ZoneKind = 'outdoors' | 'room' | 'cave';

export interface Zone {
  kind: ZoneKind;
  /** Degrees C at the queried cell. */
  tempC: number;
  /** Rooms only: open cells, wall faces and how much heat the walls let out (sum of 1 - insulation). */
  cells: number;
  faces: number;
  leak: number;
  /** Rooms only: how many heat sources warm it, and their summed power. */
  sources: number;
  power: number;
}

interface Source {
  x: number;
  y: number;
  z: number;
  radius: number;
  power: number;
}

interface OpenSource {
  x: number;
  y: number;
  z: number;
  radius: number;
}

interface Room {
  kind: 'room' | 'cave' | 'outdoors';
  cells: number;
  faces: number;
  leak: number;
  sources: Source[];
  power: number;
  /** Rise over the outdoor temperature (rooms). */
  rise: number;
}

const DIRS: readonly (readonly [number, number, number])[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export class Thermal {
  private rooms = new Map<string, Room>();
  private ageS = 0;
  private offs: (() => void)[] = [];
  /** Test and tuning counters. */
  floods = 0;

  constructor(private readonly world: IWorld, private readonly climate: Climate, bus?: GameBus) {
    if (bus) this.offs.push(bus.on('block:changed', () => this.invalidate()));
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  /** Forget every cached room (a block changed, or a fire went out). */
  invalidate(): void {
    this.rooms.clear();
    this.ageS = 0;
  }

  /** Call every tick: the cache expires on its own so lit and doused fires are noticed. */
  tick(dt: number): void {
    this.ageS += dt;
    if (this.ageS >= CACHE_S) this.invalidate();
  }

  /** What the sky gives at x, z (no walls, no fires). */
  outdoorC(x: number, z: number): number {
    const c = this.climate;
    const w = c.weather?.() ?? null;
    return outdoorTempC(c.isNight(), c.biomeAt(Math.floor(x), Math.floor(z)), w ? w.precipitation : null, w ? w.intensity : 0, c.seasonOffsetC?.() ?? 0);
  }

  /** The temperature in C of the air at a cell (or of the nearest air next to a solid block). THE temperature API. */
  temperatureAt(x: number, y: number, z: number): number {
    return this.zoneAt(x, y, z).tempC;
  }

  /** Whether the spot is warm enough to be comfortable. */
  isWarm(x: number, y: number, z: number): boolean {
    return this.temperatureAt(x, y, z) >= COMFORT_C;
  }

  /** The zone a cell is in and its temperature. Coordinates may be fractional (they are floored). */
  zoneAt(fx: number, fy: number, fz: number, gathered?: readonly OpenSource[]): Zone {
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    const z = Math.floor(fz);
    const out = this.outdoorC(x, z);
    if (!this.world.isLoaded(x, z) || y < 0 || y >= WORLD_HEIGHT) return { kind: 'outdoors', tempC: out, cells: 0, faces: 0, leak: 0, sources: 0, power: 0 };
    const cx = x, cy = y, cz = z;
    if (this.world.getBlock(cx, cy, cz).solid) {
      // Inside a block: read the air beside it (the warmest, so a furnace's own cell reads as its room).
      let best: Zone | null = null;
      for (const [dx, dy, dz] of DIRS) {
        if (this.world.getBlock(x + dx, y + dy, z + dz).solid) continue;
        const z2 = this.zoneAt(x + dx, y + dy, z + dz, gathered);
        if (!best || z2.tempC > best.tempC) best = z2;
      }
      return best ?? { kind: 'outdoors', tempC: out, cells: 0, faces: 0, leak: 0, sources: 0, power: 0 };
    }
    const room = this.roomAt(cx, cy, cz);
    if (room.kind === 'room') {
      const local = this.localBoost(room.sources, cx + 0.5, cy + 0.5, cz + 0.5, ROOM_LOCAL_C);
      return { kind: 'room', tempC: out + room.rise + local, cells: room.cells, faces: room.faces, leak: room.leak, sources: room.sources.length, power: room.power };
    }
    const base = room.kind === 'cave' ? Math.max(out, CAVE_C) : out;
    const fires = this.openBoost(cx + 0.5, cy + 0.5, cz + 0.5, gathered);
    return { kind: room.kind, tempC: base + fires, cells: 0, faces: 0, leak: 0, sources: 0, power: 0 };
  }

  /**
   * Temperatures of the floor cells around (cx, cz) for the heat view: a (2r+1)^2 array, row = z, plus the floor y of every
   * cell (or -1 where there is no floor within reach of `y`). Rooms are looked up once each, so it costs a few hundred
   * cache hits, not a few hundred flood fills.
   */
  grid(cx: number, y: number, cz: number, r: number): { temps: Float32Array; floors: Int16Array; size: number } {
    const size = 2 * r + 1;
    const temps = new Float32Array(size * size);
    const floors = new Int16Array(size * size).fill(-1);
    const gathered = this.gather(cx - r - MAX_RADIUS, cx + r + MAX_RADIUS, Math.max(0, y - 6 - MAX_RADIUS), Math.min(WORLD_HEIGHT - 1, y + 3 + MAX_RADIUS), cz - r - MAX_RADIUS, cz + r + MAX_RADIUS);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = cx - r + i;
        const z = cz - r + j;
        if (!this.world.isLoaded(x, z)) continue;
        let fy = -1;
        for (let yy = Math.min(WORLD_HEIGHT - 1, y + 2); yy >= Math.max(1, y - 4); yy--) {
          if (!this.world.getBlock(x, yy, z).solid && this.world.getBlock(x, yy - 1, z).solid) {
            fy = yy;
            break;
          }
        }
        if (fy < 0) continue;
        floors[j * size + i] = fy;
        temps[j * size + i] = this.zoneAt(x, fy, z, gathered).tempC;
      }
    }
    return { temps, floors, size };
  }

  // ---- internals ----

  /** The room (or the open air / cave) a non-solid cell belongs to, cached for every cell the fill reached. */
  private roomAt(x: number, y: number, z: number): Room {
    const hit = this.rooms.get(key(x, y, z));
    if (hit) return hit;
    this.floods++;
    const world = this.world;
    const seen = new Set<string>([key(x, y, z)]);
    const queue: [number, number, number][] = [[x, y, z]];
    const sources = new Map<string, Source>();
    let faces = 0;
    let leak = 0;
    let open = false; // reached the sky or an unloaded column
    let kind: Room['kind'] = 'room';
    for (let head = 0; head < queue.length; head++) {
      const [cx, cy, cz] = queue[head];
      if (!world.isLoaded(cx, cz) || this.skyAbove(cx, cy, cz)) {
        open = true;
        break;
      }
      if (queue.length > ROOM_CAP) {
        kind = 'cave';
        break;
      }
      for (const [dx, dy, dz] of DIRS) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const v = world.getVoxel(nx, ny, nz);
        const warm = voxelWarmth(v);
        const def = blockOf(v);
        if (warm > 0) this.addSource(sources, nx, ny, nz, warm);
        if (def.solid || SEALS.has(def.key)) {
          faces++;
          leak += 1 - insulationOf(def.key);
          continue;
        }
        const k = key(nx, ny, nz);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nx, ny, nz]);
      }
    }
    let room: Room;
    if (open) room = { kind: 'outdoors', cells: 0, faces: 0, leak: 0, sources: [], power: 0, rise: 0 };
    else if (kind === 'cave') room = { kind: 'cave', cells: 0, faces: 0, leak: 0, sources: [], power: 0, rise: 0 };
    else {
      const list = [...sources.values()];
      const power = list.reduce((s, o) => s + o.power, 0);
      room = { kind: 'room', cells: queue.length, faces, leak, sources: list, power, rise: Math.min(MAX_RISE_C, (POWER_TO_C * power) / (leak + LEAK_FLOOR)) };
    }
    for (const [cx, cy, cz] of queue) this.rooms.set(key(cx, cy, cz), room);
    this.rooms.set(key(x, y, z), room);
    return room;
  }

  private addSource(into: Map<string, Source>, x: number, y: number, z: number, radius: number): void {
    const k = key(x, y, z);
    if (into.has(k)) return;
    let power = radius * radius;
    const e = this.world.getEntity(x, y, z);
    // A lit furnace gives what it is, not what it could be: a hotter one warms more, a barely lit one less.
    if (e && e.kind === 'furnace' && typeof e.tempC === 'number') power *= clamp(e.tempC / 300, 0.5, 1.5);
    into.set(k, { x, y, z, radius, power });
  }

  /** Whether the column above (x, y, z) is open to the sky. */
  private skyAbove(x: number, y: number, z: number): boolean {
    for (let yy = y + 1; yy < WORLD_HEIGHT; yy++) if (this.world.getBlock(x, yy, z).solid) return false;
    return true;
  }

  private localBoost(sources: readonly Source[], px: number, py: number, pz: number, scale: number): number {
    let c = 0;
    for (const s of sources) {
      const d = Math.hypot(px - (s.x + 0.5), py - (s.y + 0.5), pz - (s.z + 0.5));
      if (d < s.radius) c += scale * (1 - d / s.radius);
    }
    return c;
  }

  /** Every warm block in a box (a cheap scan of the voxels; the grid does it once for all its cells). */
  private gather(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): OpenSource[] {
    const out: OpenSource[] = [];
    const world = this.world;
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        if (!world.isLoaded(x0, z)) continue;
        for (let x = x0; x <= x1; x++) {
          const r = voxelWarmth(world.getVoxel(x, y, z));
          if (r > 0) out.push({ x, y, z, radius: r });
        }
      }
    }
    return out;
  }

  /** Warmth added by fires in the open (or a cave) around a point: they need a clear line to the point. */
  private openBoost(px: number, py: number, pz: number, gathered?: readonly OpenSource[]): number {
    const R = MAX_RADIUS;
    const x0 = Math.floor(px), y0 = Math.floor(py), z0 = Math.floor(pz);
    const list = gathered ?? this.gather(x0 - R, x0 + R, Math.max(0, y0 - R), Math.min(WORLD_HEIGHT - 1, y0 + R), z0 - R, z0 + R);
    let total = 0;
    for (const s of list) {
      const d = Math.hypot(px - (s.x + 0.5), py - (s.y + 0.5), pz - (s.z + 0.5));
      if (d >= s.radius || !this.clearLine(s.x, s.y, s.z, px, py, pz)) continue;
      const f = 1 - d / s.radius;
      total += OPEN_C_PER_BLOCK * s.radius * f * f;
    }
    return total;
  }

  /** No solid block between a source cell and a point (the source's own cell and the point's cell do not count). */
  private clearLine(sx: number, sy: number, sz: number, px: number, py: number, pz: number): boolean {
    const ax = sx + 0.5, ay = sy + 0.5, az = sz + 0.5;
    const d = Math.hypot(px - ax, py - ay, pz - az);
    const steps = Math.ceil(d * 2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = Math.floor(ax + (px - ax) * t), y = Math.floor(ay + (py - ay) * t), z = Math.floor(az + (pz - az) * t);
      if ((x === sx && y === sy && z === sz) || (x === Math.floor(px) && y === Math.floor(py) && z === Math.floor(pz))) continue;
      if (this.world.getBlock(x, y, z).solid) return false;
    }
    return true;
  }
}

/** One word for how a temperature feels, for the HUD and the heat view's legend. */
export function feelOf(tempC: number): 'freezing' | 'cold' | 'cool' | 'comfortable' | 'warm' | 'hot' {
  if (tempC <= FREEZING_C) return 'freezing';
  if (tempC < COLD_C) return 'cold';
  if (tempC < COMFORT_C) return 'cool';
  if (tempC < 28) return 'comfortable';
  if (tempC < 38) return 'warm';
  return 'hot';
}

/**
 * The heat view colour of a temperature: deep blue below freezing through pale blue, clear at comfort, to orange and red. Returns
 * [r, g, b, a] in 0..1; alpha 0 where nothing needs showing (comfortable air).
 */
export function heatColor(tempC: number): [number, number, number, number] {
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp(t, 0, 1);
  if (tempC < COMFORT_C) {
    const t = clamp((COMFORT_C - tempC) / (COMFORT_C - FREEZING_C - 10), 0, 1); // 0 at comfort, 1 at -5-ish and below
    return [lerp(0.55, 0.15, t), lerp(0.8, 0.35, t), lerp(0.95, 0.95, t), lerp(0.0, 0.5, t)];
  }
  if (tempC < 24) return [0.55, 0.85, 0.5, 0.12];
  const t = clamp((tempC - 24) / 20, 0, 1);
  return [lerp(0.98, 0.9, t), lerp(0.75, 0.2, t), lerp(0.25, 0.1, t), lerp(0.3, 0.55, t)];
}
