/**
 * The one-bit signal layer of the Bronze workshop (docs/OVERHAUL_PLAN.md A.6): crank levers, pressure plates and metronomes
 * are sources, signal wire carries a signal up to 15 blocks (it loses one step per wire), lamps and bells are sinks.
 * Machines read it by touching a signal cell: a clutch flips, an arm / deployer / drill / saw arm / vacuum works only while
 * it is signalled (when it touches no signal cell at all it just works). Not redstone: no logic, no memory, no big circuits.
 */
import type { GameBus } from '../core/context';
import type { IWorld } from '../core/types';
import type { GroundItems } from '../game/groundItems';

export const SIGNAL_KINDS = new Set(['signal_wire', 'crank_lever', 'pressure_plate', 'metronome', 'signal_lamp', 'bell']);
const SOURCES = new Set(['crank_lever', 'pressure_plate', 'metronome']);
export const SIGNAL_RANGE = 15;
/** Metronome: one pulse every PERIOD seconds, on for PULSE of them. */
export const METRONOME_PERIOD_S = 4;
export const METRONOME_PULSE_S = 1;
/** Blocks within which a bell rings when a machine seizes or jams. */
export const BELL_RANGE = 12;

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;

interface Cell { kind: string; x: number; y: number; z: number; s: number }

export interface SignalHost {
  readonly world: IWorld;
  readonly ground: GroundItems;
  readonly bus: GameBus;
  standingOn(): ((x: number, y: number, z: number) => boolean) | null;
}

export class Signals {
  private readonly cells = new Map<string, Cell>();
  /** Cells set on from outside (`Workshop.signal`). */
  private readonly external = new Set<string>();
  /** Signal strength per cell this tick (sources 15, wire 14..1). */
  private readonly level = new Map<string, number>();
  private readonly litCells = new Set<string>();
  private readonly rung = new Set<string>();

  constructor(private readonly host: SignalHost) {}

  noteBlock(x: number, y: number, z: number, kind: string): void {
    const key = k3(x, y, z);
    if (SIGNAL_KINDS.has(kind)) {
      if (this.cells.get(key)?.kind !== kind) this.cells.set(key, { kind, x, y, z, s: 0 });
    } else this.cells.delete(key);
  }

  relocate(map: ReadonlyMap<string, [number, number, number]>): void {
    const moved: [string, Cell][] = [];
    for (const [from, to] of map) {
      const c = this.cells.get(from);
      if (!c) continue;
      this.cells.delete(from);
      [c.x, c.y, c.z] = to;
      moved.push([k3(...to), c]);
    }
    for (const [k, c] of moved) this.cells.set(k, c);
  }

  /** Use on a lever flips it. Null = not ours. */
  use(x: number, y: number, z: number): 'worked' | null {
    const c = this.cells.get(k3(x, y, z));
    if (!c || c.kind !== 'crank_lever') return null;
    c.s = c.s ? 0 : 1;
    this.host.bus.emit('sfx', { name: 'dig_metal', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: c.s ? 1.4 : 1, volume: 0.5 });
    return 'worked';
  }

  setExternal(x: number, y: number, z: number, on: boolean): void {
    if (on) this.external.add(k3(x, y, z));
    else this.external.delete(k3(x, y, z));
  }

  private pressed(c: Cell): boolean {
    if (this.host.standingOn()?.(c.x, c.y, c.z)) return true;
    for (const e of this.host.ground.items) {
      if (e.count > 0 && Math.floor(e.x) === c.x && Math.floor(e.z) === c.z && e.y >= c.y + 0.3 && e.y <= c.y + 1.3) return true;
    }
    return false;
  }

  tick(t: number): void {
    this.level.clear();
    this.litCells.clear();
    const queue: string[] = [];
    const seed = (key: string): void => {
      this.level.set(key, SIGNAL_RANGE);
      queue.push(key);
    };
    for (const [key, c] of this.cells) {
      const on = c.kind === 'crank_lever' ? c.s === 1
        : c.kind === 'pressure_plate' ? this.pressed(c)
          : c.kind === 'metronome' ? t % METRONOME_PERIOD_S < METRONOME_PULSE_S
            : false;
      if (SOURCES.has(c.kind) && on) {
        seed(key);
        this.litCells.add(key);
      }
    }
    for (const key of this.external) seed(key);
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(',').map(Number);
      const lv = this.level.get(queue[i]) as number;
      if (lv <= 1) continue;
      for (const [dx, dy, dz] of DIRS) {
        const n = k3(x + dx, y + dy, z + dz);
        const c = this.cells.get(n);
        if (c?.kind !== 'signal_wire' || (this.level.get(n) ?? 0) >= lv - 1) continue;
        this.level.set(n, lv - 1);
        this.litCells.add(n);
        queue.push(n);
      }
    }
    // Sinks light and ring while a powered cell touches them.
    for (const [key, c] of this.cells) {
      if (c.kind !== 'signal_lamp' && c.kind !== 'bell') continue;
      const powered = this.near(c.x, c.y, c.z);
      if (powered && c.kind === 'signal_lamp') this.litCells.add(key);
      if (powered && c.kind === 'bell' && !this.rung.has(key)) {
        this.rung.add(key);
        this.ring(c);
      } else if (!powered) this.rung.delete(key);
    }
  }

  /** True when a powered cell touches (x, y, z). */
  near(x: number, y: number, z: number): boolean {
    for (const [dx, dy, dz] of DIRS) if ((this.level.get(k3(x + dx, y + dy, z + dz)) ?? 0) > 0) return true;
    return false;
  }

  /** Machines: true when allowed to work. A machine touching no signal cell is always allowed. */
  gate(x: number, y: number, z: number): boolean {
    let touches = false;
    for (const [dx, dy, dz] of DIRS) {
      const c = this.cells.get(k3(x + dx, y + dy, z + dz));
      if (c && c.kind !== 'signal_lamp' && c.kind !== 'bell') {
        touches = true;
        if ((this.level.get(k3(x + dx, y + dy, z + dz)) ?? 0) > 0) return true;
      }
    }
    return !touches;
  }

  /** The clutch's view: true when a powered cell touches it. */
  flips(x: number, y: number, z: number): boolean {
    return this.near(x, y, z);
  }

  /** Every signal cell with whether it is lit (the Workshop mirrors it into the voxel's active bit). */
  states(): { x: number; y: number; z: number; on: boolean }[] {
    return [...this.cells.entries()].map(([k, c]) => ({ x: c.x, y: c.y, z: c.z, on: this.litCells.has(k) }));
  }

  lit(key: string): boolean {
    return this.litCells.has(key);
  }

  has(key: string): boolean {
    return this.cells.has(key);
  }

  private ring(c: Cell): void {
    this.host.bus.emit('sfx', { name: 'alarm', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, pitch: 1.6, volume: 0.35 });
  }

  /** A machine at (x, y, z) seized or jammed: every bell within range rings. */
  ringNear(x: number, y: number, z: number): number {
    let n = 0;
    for (const c of this.cells.values()) {
      if (c.kind !== 'bell' || Math.hypot(c.x - x, c.y - y, c.z - z) > BELL_RANGE) continue;
      this.ring(c);
      n++;
    }
    return n;
  }

  describe(x: number, y: number, z: number): string | null {
    const c = this.cells.get(k3(x, y, z));
    if (!c) return null;
    const names: Record<string, string> = { signal_wire: 'Signal Wire', crank_lever: 'Crank Lever', pressure_plate: 'Pressure Plate', metronome: 'Metronome', signal_lamp: 'Signal Lamp', bell: 'Bell' };
    const state = c.kind === 'bell' ? (this.near(x, y, z) ? 'ringing' : 'quiet, rings when a machine seizes within 12 blocks')
      : c.kind === 'signal_wire' ? `strength ${this.level.get(k3(x, y, z)) ?? 0}`
        : this.lit(k3(x, y, z)) ? 'on' : 'off';
    return `${names[c.kind] ?? c.kind} - ${state}`;
  }

  toJSON(): [number, number, number, string, number][] {
    return [...this.cells.values()].map((c) => [c.x, c.y, c.z, c.kind, c.s]);
  }

  load(raw: unknown): void {
    this.cells.clear();
    for (const row of Array.isArray(raw) ? raw : []) {
      if (!Array.isArray(row) || row.length !== 5 || ![row[0], row[1], row[2]].every(Number.isInteger) || !SIGNAL_KINDS.has(row[3])) continue;
      this.cells.set(k3(row[0], row[1], row[2]), { kind: row[3], x: row[0], y: row[1], z: row[2], s: row[4] ? 1 : 0 });
    }
  }

  /** Drops cells whose block is gone (called from the Workshop's verify). */
  verify(): void {
    for (const [key, c] of [...this.cells]) {
      if (!this.host.world.isLoaded(c.x, c.z)) continue;
      if (this.host.world.getBlock(c.x, c.y, c.z).key !== c.kind) this.cells.delete(key);
    }
  }
}
