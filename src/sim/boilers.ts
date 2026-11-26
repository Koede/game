/**
 * The sealed boiler (docs/BRONZE_PLAN.md section 6, docs/advice/tech-spine.md 2.4-2.5), the first multiblock.
 *
 * A closed shell of Boiler Plate (with Safety Valves and a Gauge Glass in it) round at least two empty cells is a
 * vessel. The Gauge Glass holds the entity (water, steam, valve setting, over-pressure seconds); the shell is found by
 * flood fill from it once a second and on placing. Furnaces under the floor plates heat it (10 kW each, up to three):
 * steam is made at 6 L/s per kW from water (0.1 L per L of steam), pressure in bar is steam litres over the vessel's
 * steam volume (1000 L per cell). A Steam Rotor standing on the shell draws steam once the pressure is 2 bar. A Safety
 * Valve in the shell vents above its setting (2, 4, 6 or 8 bar); above 8 bar for 5 s the vessel bursts.
 * The entity is plain JSON in the world and never a machine node. Player actions: `use` (pour water, valve setting).
 */
import type { GameBus } from '../core/context';
import { blockOf, itemOrNull } from '../core/registry';
import type { BlockDef, BlockEntity, IWorld } from '../core/types';
import { voxelId } from '../core/types';
import { posKey, type FurnaceEntity } from './entities';

export const BOILER_MACHINE = 'boiler_vessel';
export const BOILER_PLATE = 'boiler_plate';
export const BOILER_GLASS = 'boiler_gauge_glass';
export const SAFETY_VALVE = 'safety_valve';
const SHELL = new Set([BOILER_PLATE, BOILER_GLASS, SAFETY_VALVE]);

/** Heat one furnace puts into the boiler, W (a Heat Port's 10 kW), and the most furnaces that feed one vessel. */
export const BOILER_HEAT_W = 10_000;
const MAX_FURNACES = 3;
/** Furnace temperature that counts as a fire under the boiler, C. */
const FIRE_C = 150;
/** Steam made per joule of heat: 1 kW makes 6 L/s (tech-spine ledger). */
const L_PER_J = 1 / 167;
/** Litres of water spent per litre of steam. */
const WATER_PER_STEAM = 0.1;
/** The vessel's rating, bar; the warning starts one bar below it and the burst comes after this many seconds over it. */
export const BOILER_RATED_BAR = 8;
export const BURST_AFTER_S = 5;
const SAG_PER_S = 0.002;
const VENT_MAX_L_S = 400;
/** What a steam rotor on the shell draws while its line has work, and the pressure it needs. */
export const ROTOR_STEAM_L_PER_S = 12;
const ROTOR_MIN_BAR = 2;
const ROTOR_STOP_BAR = 1.5;
export const VALVE_SETTINGS = [2, 4, 6, 8] as const;
const WATER_L_PER_CELL = 2000;
const STEAM_L_PER_CELL = 1000;
const POUR_L = 1000;
const MAX_SPAN = 9;
const MAX_SHELL = 400;
const MIN_CELLS = 2;
const MAX_CELLS = 100;

export interface BoilerEntity extends BlockEntity {
  kind: 'boiler_vessel';
  waterL: number;
  steamL: number;
  /** Safety valve setting, bar. */
  valve: number;
  /** Seconds spent above the rating. */
  overS: number;
}

interface Vessel {
  e: BoilerEntity;
  formed: boolean;
  /** Why it is not formed (the sentence on the glass). */
  why: string;
  cells: number;
  shell: string[];
  furnaces: FurnaceEntity[];
  rotors: [number, number, number][];
  rotorOn: boolean;
  warned: boolean;
  hissT: number;
}

export interface BoilerHost {
  furnaceUnder(x: number, y: number, z: number): FurnaceEntity | null;
}

const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

export class Boilers {
  private readonly vessels = new Map<string, Vessel>();
  /** Shell cell key -> its vessel. */
  private readonly owner = new Map<string, Vessel>();
  private since = 0;
  private dirty = true;
  /** Set by the game: whether the steam rotor at x,y,z has work to do. */
  steamDemand: ((x: number, y: number, z: number) => boolean) | null = null;

  constructor(readonly world: IWorld, readonly bus: GameBus, readonly host: BoilerHost) {}

  static handles(def: BlockDef): boolean {
    return def.machine === BOILER_MACHINE;
  }

  get count(): number {
    return this.vessels.size;
  }

  clear(): void {
    this.vessels.clear();
    this.owner.clear();
    this.dirty = true;
  }

  /** Follows an entity stored in the world (after loading): fields are repaired. */
  track(stored: BlockEntity): void {
    const e = stored as BoilerEntity;
    e.waterL = Math.max(0, finite(e.waterL, 0));
    e.steamL = Math.max(0, finite(e.steamL, 0));
    e.valve = (VALVE_SETTINGS as readonly number[]).includes(e.valve) ? e.valve : 6;
    e.overS = Math.max(0, finite(e.overS, 0));
    this.vessels.set(posKey(e.x, e.y, e.z), { e, formed: false, why: 'not scanned yet', cells: 0, shell: [], furnaces: [], rotors: [], rotorOn: false, warned: false, hissT: 0 });
    this.dirty = true;
  }

  /** A boiler block (gauge glass or valve) now stands at x,y,z. */
  place(x: number, y: number, z: number, def: BlockDef): void {
    this.dirty = true;
    if (def.key !== BOILER_GLASS || this.vessels.has(posKey(x, y, z))) return;
    const stored = this.world.getEntity(x, y, z);
    if (stored && stored.kind === BOILER_MACHINE) this.track(stored);
    else {
      const e: BoilerEntity = { kind: 'boiler_vessel', x, y, z, waterL: 0, steamL: 0, valve: 6, overS: 0 };
      this.world.setEntity(e);
      this.track(e);
    }
    this.scan(this.vessels.get(posKey(x, y, z)) as Vessel);
  }

  /** The boiler block at x,y,z is gone: a glass takes the vessel with it. */
  remove(x: number, y: number, z: number): void {
    this.dirty = true;
    const key = posKey(x, y, z);
    const v = this.vessels.get(key);
    if (!v) return;
    this.vessels.delete(key);
    if (this.world.getEntity(x, y, z) === v.e) this.world.removeEntity(x, y, z);
  }

  // ---- finding the vessel ----------------------------------------------------------------------------------------

  private isShell(x: number, y: number, z: number): boolean {
    return SHELL.has(this.world.getBlock(x, y, z).key);
  }

  private scan(v: Vessel): void {
    v.formed = false;
    v.cells = 0;
    v.shell = [];
    v.furnaces = [];
    v.rotors = [];
    const g = v.e;
    const seen = new Set<string>([posKey(g.x, g.y, g.z)]);
    const queue: [number, number, number][] = [[g.x, g.y, g.z]];
    let minX = g.x, maxX = g.x, minY = g.y, maxY = g.y, minZ = g.z, maxZ = g.z;
    for (let i = 0; i < queue.length; i++) {
      if (queue.length > MAX_SHELL) {
        v.why = 'The boiler wall runs on too far';
        return;
      }
      const [x, y, z] = queue[i];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const k = posKey(nx, ny, nz);
        if (seen.has(k) || !this.isShell(nx, ny, nz)) continue;
        seen.add(k);
        queue.push([nx, ny, nz]);
      }
    }
    if (maxX - minX + 1 > MAX_SPAN || maxY - minY + 1 > MAX_SPAN || maxZ - minZ + 1 > MAX_SPAN) {
      v.why = 'The boiler is too big (9 blocks at most each way)';
      return;
    }
    // Flood the outside through a one-block margin; whatever it cannot reach, and is not wall, is inside.
    const w = maxX - minX + 3, h = maxY - minY + 3, d = maxZ - minZ + 3;
    const idx = (x: number, y: number, z: number): number => (x - minX + 1) + w * ((y - minY + 1) + h * (z - minZ + 1));
    const wall = new Uint8Array(w * h * d);
    for (const q of queue) wall[idx(q[0], q[1], q[2])] = 1;
    const out = new Uint8Array(w * h * d);
    const stack: [number, number, number][] = [[minX - 1, minY - 1, minZ - 1]];
    out[idx(minX - 1, minY - 1, minZ - 1)] = 1;
    while (stack.length) {
      const [x, y, z] = stack.pop() as [number, number, number];
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < minX - 1 || nx > maxX + 1 || ny < minY - 1 || ny > maxY + 1 || nz < minZ - 1 || nz > maxZ + 1) continue;
        const i = idx(nx, ny, nz);
        if (wall[i] || out[i]) continue;
        out[i] = 1;
        stack.push([nx, ny, nz]);
      }
    }
    const inside: [number, number, number][] = [];
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const i = idx(x, y, z);
      if (!wall[i] && !out[i]) inside.push([x, y, z]);
    }
    if (inside.length === 0) {
      v.why = 'The wall has a gap: close every side';
      return;
    }
    if (inside.length < MIN_CELLS) {
      v.why = 'The inside is too small: two empty cells at least';
      return;
    }
    if (inside.length > MAX_CELLS) {
      v.why = 'The inside is too big';
      return;
    }
    for (const [x, y, z] of inside) {
      if (voxelId(this.world.getVoxel(x, y, z)) !== 0) {
        v.why = 'The inside must be empty';
        return;
      }
    }
    v.cells = inside.length;
    v.shell = queue.map((q) => posKey(q[0], q[1], q[2]));
    const furnaces = new Set<FurnaceEntity>();
    for (const [x, y, z] of inside) {
      if (!wall[idx(x, y - 1, z)]) continue;
      const f = this.host.furnaceUnder(x, y - 2, z);
      if (f && furnaces.size < MAX_FURNACES) furnaces.add(f);
    }
    v.furnaces = [...furnaces];
    for (const q of queue) if (this.world.getBlock(q[0], q[1] + 1, q[2]).key === 'steam_rotor') v.rotors.push([q[0], q[1] + 1, q[2]]);
    v.formed = true;
    v.why = '';
    for (const k of v.shell) this.owner.set(k, v);
    // The vessel holds no more than its cells allow.
    v.e.waterL = Math.min(v.e.waterL, WATER_L_PER_CELL * v.cells);
    v.e.steamL = Math.min(v.e.steamL, STEAM_L_PER_CELL * v.cells * 12);
  }

  private rescan(): void {
    this.owner.clear();
    for (const [key, v] of this.vessels) {
      if (blockOf(this.world.getVoxel(v.e.x, v.e.y, v.e.z)).key !== BOILER_GLASS) {
        this.remove(v.e.x, v.e.y, v.e.z);
        void key;
        continue;
      }
      const was = v.formed;
      this.scan(v);
      if (v.formed && !was) this.bus.emit('toast', { text: `Boiler sealed: ${v.cells} cells, ${v.cells * STEAM_L_PER_CELL} L of steam room`, kind: 'info' });
      if (!v.formed && was) this.bus.emit('toast', { text: `Boiler open: ${v.why}`, kind: 'warn' });
    }
    this.dirty = false;
  }

  // ---- numbers ---------------------------------------------------------------------------------------------------

  /** Pressure of a vessel, bar (gauge). */
  static bar(v: { e: BoilerEntity; cells: number }): number {
    return v.cells > 0 ? v.e.steamL / (STEAM_L_PER_CELL * v.cells) : 0;
  }

  /** Pressure as a share of the rating (the over-pressure hazard reads this), one entry per formed vessel. */
  pressures(): { x: number; y: number; z: number; bar: number; fill: number; valve: boolean }[] {
    const out = [];
    for (const v of this.vessels.values()) {
      if (!v.formed) continue;
      const bar = Boilers.bar(v);
      out.push({ x: v.e.x, y: v.e.y, z: v.e.z, bar, fill: bar / BOILER_RATED_BAR, valve: v.shell.some((k) => this.world.getBlock(...unkey(k)).key === SAFETY_VALVE) });
    }
    return out;
  }

  /** Whether the cell x,y,z is part of a formed boiler that has enough steam for a rotor standing on it. */
  steamReadyAt(x: number, y: number, z: number): boolean {
    const v = this.owner.get(posKey(x, y, z));
    return !!v && v.formed && v.rotorOn;
  }

  // ---- ticking ---------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    if (this.vessels.size === 0) return;
    this.since += dt;
    if (this.dirty || this.since >= 1) {
      this.since = 0;
      this.rescan();
    }
    for (const v of [...this.vessels.values()]) if (v.formed && this.world.isLoaded(v.e.x, v.e.z)) this.run(v, dt);
  }

  private run(v: Vessel, dt: number): void {
    const e = v.e;
    const volume = STEAM_L_PER_CELL * v.cells;
    // Heat in, steam made, water spent.
    let heatW = 0;
    for (const f of v.furnaces) {
      if (f.tempC >= FIRE_C) {
        heatW += BOILER_HEAT_W;
        f.extractW += BOILER_HEAT_W;
      }
    }
    if (heatW > 0 && e.waterL > 0) {
      const make = Math.min(heatW * L_PER_J * dt, e.waterL / WATER_PER_STEAM);
      e.steamL += make;
      e.waterL -= make * WATER_PER_STEAM;
    }
    e.steamL *= 1 - SAG_PER_S * dt;
    // Rotors on the shell take steam while their line has work.
    let bar = e.steamL / volume;
    v.rotorOn = v.rotorOn ? bar >= ROTOR_STOP_BAR : bar >= ROTOR_MIN_BAR;
    if (v.rotorOn) {
      for (const [x, y, z] of v.rotors) {
        if (this.world.getBlock(x, y, z).key !== 'steam_rotor') continue;
        if (this.steamDemand?.(x, y, z)) e.steamL = Math.max(0, e.steamL - ROTOR_STEAM_L_PER_S * dt);
      }
    }
    // A safety valve in the shell vents above its setting.
    bar = e.steamL / volume;
    const hasValve = v.shell.some((k) => this.world.getBlock(...unkey(k)).key === SAFETY_VALVE);
    if (hasValve && bar > e.valve) {
      const rate = Math.min(VENT_MAX_L_S, (bar - e.valve) * volume);
      e.steamL = Math.max(0, e.steamL - rate * dt);
      v.hissT -= dt;
      if (v.hissT <= 0) {
        v.hissT = 1;
        this.bus.emit('sfx', { name: 'steam_hiss', x: e.x + 0.5, y: e.y + 1, z: e.z + 0.5 });
      }
      bar = e.steamL / volume;
    }
    // Warning, then burst: never without five seconds of toast, hiss and gauge first.
    if (bar > BOILER_RATED_BAR) e.overS += dt;
    else e.overS = Math.max(0, e.overS - 2 * dt);
    if (bar > BOILER_RATED_BAR - 1) {
      if (!v.warned) {
        v.warned = true;
        this.bus.emit('toast', { text: 'Boiler pressure high - fit a Safety Valve or use the steam', kind: 'warn' });
      }
      v.hissT -= dt;
      if (v.hissT <= 0) {
        v.hissT = 0.8;
        this.bus.emit('sfx', { name: 'steam_hiss', x: e.x + 0.5, y: e.y + 1, z: e.z + 0.5 });
      }
    } else if (bar < BOILER_RATED_BAR - 2) v.warned = false;
    if (e.overS >= BURST_AFTER_S) this.burst(v);
  }

  private burst(v: Vessel): void {
    const { x, y, z } = v.e;
    for (const k of v.shell) this.world.setVoxel(...unkey(k), 0, 'sim');
    this.bus.emit('sfx', { name: 'explosion', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.bus.emit('toast', { text: 'The boiler burst!', kind: 'warn' });
    this.remove(x, y, z);
  }

  // ---- the player ------------------------------------------------------------------------------------------------

  /** The vessel a gauge glass or a valve at x,y,z belongs to. */
  private vesselAt(x: number, y: number, z: number): Vessel | undefined {
    return this.vessels.get(posKey(x, y, z)) ?? this.owner.get(posKey(x, y, z));
  }

  /** Words for the crosshair and the gauge glass. */
  text(x: number, y: number, z: number): string | null {
    const v = this.vesselAt(x, y, z);
    if (!v) return null;
    if (!v.formed) return `Boiler - ${v.why}`;
    const bar = Boilers.bar(v);
    const heat = v.furnaces.some((f) => f.tempC >= FIRE_C) ? '' : ', no heat';
    const water = v.e.waterL <= 0 ? ', no water: pour a bucket in' : '';
    const valve = v.shell.some((k) => this.world.getBlock(...unkey(k)).key === SAFETY_VALVE) ? `, valve ${v.e.valve} bar` : ', no safety valve';
    return `Boiler - ${fmt(bar)} bar (rated ${BOILER_RATED_BAR}), water ${Math.round(v.e.waterL)} L${valve}${heat}${water}`;
  }

  /** Use on a gauge glass (a full water container pours in) or a valve (cycles its setting). null: not a boiler block. */
  use(x: number, y: number, z: number, held: string | null): { ok: true; consume: boolean; give?: string; toast?: string } | { ok: false; reason: string } | null {
    const v = this.vesselAt(x, y, z);
    const key = this.world.getBlock(x, y, z).key;
    if (!v || (key !== BOILER_GLASS && key !== SAFETY_VALVE)) return null;
    if (key === SAFETY_VALVE) {
      const i = (VALVE_SETTINGS as readonly number[]).indexOf(v.e.valve);
      v.e.valve = VALVE_SETTINGS[(i + 1) % VALVE_SETTINGS.length];
      return { ok: true, consume: false, toast: `Safety valve set to ${v.e.valve} bar` };
    }
    const spec = held ? itemOrNull(held)?.container : undefined;
    if (spec && spec.holds === 'water') {
      if (!v.formed) return { ok: false, reason: `Boiler - ${v.why}` };
      if (v.e.waterL + POUR_L > WATER_L_PER_CELL * v.cells) return { ok: false, reason: 'The boiler is full of water' };
      v.e.waterL += POUR_L;
      return { ok: true, consume: true, give: spec.emptyTo };
    }
    return { ok: false, reason: this.text(x, y, z) ?? 'Boiler' };
  }
}

const DIRS: readonly (readonly [number, number, number])[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const unkey = (k: string): [number, number, number] => k.split(',').map(Number) as [number, number, number];
