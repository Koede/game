/**
 * The one-bit signal layer of the Bronze workshop (docs/OVERHAUL_PLAN.md A.6): crank levers, pressure plates and metronomes
 * are sources, signal wire carries a signal up to 15 blocks (it loses one step per wire), lamps and bells are sinks.
 * Machines read it by touching a signal cell: a clutch flips, an arm / deployer / drill / saw arm / vacuum works only while
 * it is signalled (when it touches no signal cell at all it just works). Not redstone: no logic, no memory, no big circuits.
 */
import type { GameBus } from '../core/context';
import { Facing, voxelFacing, type IWorld } from '../core/types';
import { LogicNet, type LogicKind } from './mech/logic';
import type { GroundItems } from '../game/groundItems';
import { CLOCK_TIMER_PRESETS, TOWER_RANGE, TOWER_SCHEDULES, clockTimerOn, scheduleText, striking } from './clockTower';

export const SIGNAL_KINDS = new Set(['signal_wire', 'crank_lever', 'pressure_plate', 'metronome', 'signal_lamp', 'bell', 'logic_gate', 'signal_relay', 'signal_timer', 'push_button', 'clock_tower']);
/** Modes of the relay (tap to cycle). It reads the cell behind it and drives the cell in front at full strength: it also renews a fading signal. */
export const RELAY_MODES: readonly { name: string; kind: 'repeat' | 'delay' | 'hold' | 'pulse'; s: number }[] = [
  { name: 'Repeater (full strength)', kind: 'repeat', s: 0 },
  { name: 'Delay 1 second', kind: 'delay', s: 1 },
  { name: 'Delay 3 seconds', kind: 'delay', s: 3 },
  { name: 'Hold 3 seconds after it ends', kind: 'hold', s: 3 },
  { name: 'One 1-second pulse when it starts', kind: 'pulse', s: 1 },
];
/** Presets of the timer (tap to cycle): a pulse of `on` seconds every `every` seconds. */
export const TIMER_PRESETS: readonly { every: number; on: number }[] = [
  { every: 2, on: 1 }, { every: 4, on: 1 }, { every: 8, on: 2 }, { every: 15, on: 3 }, { every: 30, on: 5 }, { every: 60, on: 10 },
];
/** The push button signals this long after a tap. */
export const BUTTON_PULSE_S = 2;
/** Modes of the logic gate (Use cycles them). The gate reads the cells on its left (A) and right (B) and drives the cell in front (src/workshop/mech/logic.ts). */
export const GATE_MODES: readonly { name: string; kind: LogicKind; arg?: number }[] = [
  { name: 'AND (both sides lit)', kind: 'and' },
  { name: 'OR (either side lit)', kind: 'or' },
  { name: 'XOR (exactly one side lit)', kind: 'xor' },
  { name: 'NOT (left lit turns it off)', kind: 'not' },
  { name: 'Latch (left sets, right resets)', kind: 'latch' },
  { name: 'Counter of 4 (left counts, right resets)', kind: 'counter', arg: 4 },
  { name: 'Counter of 8 (left counts, right resets)', kind: 'counter', arg: 8 },
  { name: 'Compare (left at least right)', kind: 'cmp' },
  { name: 'Delay (left, one second later)', kind: 'delay', arg: 20 },
];
const SOURCES = new Set(['crank_lever', 'pressure_plate', 'metronome', 'signal_timer', 'push_button', 'clock_tower']);
/** Settings of a timer: its beats in seconds, then the clock settings it has next to a clock tower (clockTower.ts). */
const TIMER_SETTINGS = TIMER_PRESETS.length + CLOCK_TIMER_PRESETS.length;
export const SIGNAL_RANGE = 15;
/** Metronome: one pulse every PERIOD seconds, on for PULSE of them. */
export const METRONOME_PERIOD_S = 4;
export const METRONOME_PULSE_S = 1;
/** Blocks within which a bell rings when a machine seizes or jams. */
export const BELL_RANGE = 12;

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;

const modeIndex = (v: unknown, n: number): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : 0);
const timerText = (i: number): string => {
  if (i >= TIMER_PRESETS.length) return CLOCK_TIMER_PRESETS[Math.min(i - TIMER_PRESETS.length, CLOCK_TIMER_PRESETS.length - 1)].name;
  const p = TIMER_PRESETS[i];
  return `${p.on} s on, every ${p.every} s`;
};
/** A 24-hour clock reading of time of day `tod` (0 = sunrise = 06:00). */
const hhmm = (tod: number): string => {
  const m = Math.floor((((6 * 60 + tod * 1440) % 1440) + 1440) % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

interface Cell { kind: string; x: number; y: number; z: number; s: number }

export interface SignalHost {
  readonly world: IWorld;
  readonly ground: GroundItems;
  readonly bus: GameBus;
  standingOn(): ((x: number, y: number, z: number) => boolean) | null;
  /** The sun's time of day (0..1, 0 = sunrise) for clock towers; null or absent: no sun to read, towers stand still. */
  timeOfDay?(): number | null;
}

export class Signals {
  private readonly cells = new Map<string, Cell>();
  /** Cells set on from outside (`Workshop.signal`). */
  private readonly external = new Set<string>();
  /** Signal strength per cell this tick (sources 15, wire 14..1). */
  private readonly level = new Map<string, number>();
  private readonly litCells = new Set<string>();
  private readonly rung = new Set<string>();
  /** Cells a drum or other part holds lit this tick (set by `drive`, cleared by `clearDriven`). */
  private readonly driven = new Set<string>();
  private readonly gateNet = new LogicNet();
  private readonly gateKnown = new Map<string, number>();
  /** Relay runtime: last input, the output now, when it changes next, and the hold deadline. Not saved (a relay restarts quiet). */
  private readonly relays = new Map<string, { input: boolean; out: boolean; pending: { at: number; on: boolean }[]; until: number }>();
  /** Push buttons: the clock time each stops signalling. */
  private readonly pushed = new Map<string, number>();
  private clock = 0;
  /** Clock towers that were striking last tick (their bell rings once as a strike starts). */
  private readonly striking = new Set<string>();

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
    if (c?.kind === 'push_button') {
      this.pushed.set(k3(x, y, z), this.clock + BUTTON_PULSE_S);
      this.host.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.5, volume: 0.5 });
      return 'worked';
    }
    if (!c || c.kind !== 'crank_lever') return null;
    c.s = c.s ? 0 : 1;
    this.host.bus.emit('sfx', { name: 'dig_metal', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: c.s ? 1.4 : 1, volume: 0.5 });
    return 'worked';
  }

  /** Use on a relay or a timer cycles its mode. Returns the toast text, or null when it is neither. */
  cycleSetting(x: number, y: number, z: number): string | null {
    const c = this.cells.get(k3(x, y, z));
    if (c?.kind === 'signal_relay') {
      c.s = (c.s + 1) % RELAY_MODES.length;
      this.relays.delete(k3(x, y, z));
      this.host.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.2 + c.s * 0.05, volume: 0.4 });
      return `Relay: ${RELAY_MODES[c.s].name}`;
    }
    if (c?.kind === 'clock_tower') {
      c.s = (c.s + 1) % TOWER_SCHEDULES.length;
      this.host.bus.emit('sfx', { name: 'tower_bell', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.5, volume: 0.3 });
      return `Clock tower: ${scheduleText(c.s)}`;
    }
    if (c?.kind === 'signal_timer') {
      // Next to a clock tower the timer also has the tower's clock settings.
      c.s = (c.s + 1) % (this.towerNear(c) ? TIMER_SETTINGS : TIMER_PRESETS.length);
      this.host.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.2 + c.s * 0.05, volume: 0.4 });
      return `Timer: ${timerText(c.s)}`;
    }
    return null;
  }

  /** Use on a logic gate cycles its mode. Returns the toast text, or null when it is not a gate. */
  cycleGate(x: number, y: number, z: number): string | null {
    const c = this.cells.get(k3(x, y, z));
    if (!c || c.kind !== 'logic_gate') return null;
    c.s = (c.s + 1) % GATE_MODES.length;
    this.host.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.2 + c.s * 0.05, volume: 0.4 });
    return `Logic gate: ${GATE_MODES[c.s].name}`;
  }

  /** Hold a cell lit for this tick (a cam drum track). */
  drive(x: number, y: number, z: number): void {
    this.driven.add(k3(x, y, z));
  }

  clearDriven(): void {
    this.driven.clear();
  }

  private sideCells(c: Cell): { a: string; b: string; front: string; back: string } {
    const f = voxelFacing(this.host.world.getVoxel(c.x, c.y, c.z));
    const [dx, dz] = f === Facing.North ? [0, -1] : f === Facing.East ? [1, 0] : f === Facing.South ? [0, 1] : [-1, 0];
    return { a: k3(c.x + dz, c.y, c.z - dx), b: k3(c.x - dz, c.y, c.z + dx), front: k3(c.x + dx, c.y, c.z + dz), back: k3(c.x - dx, c.y, c.z - dz) };
  }

  /** Keeps one logic net node trio per gate cell in step with the cells; returns the output level of each gate after a tick on last tick's levels. */
  private runGates(): Map<string, number> {
    for (const key of [...this.gateKnown.keys()]) {
      if (this.cells.get(key)?.kind !== 'logic_gate') {
        this.gateNet.remove(`${key}#a`);
        this.gateNet.remove(`${key}#b`);
        this.gateNet.remove(key);
        this.gateKnown.delete(key);
      }
    }
    const out = new Map<string, number>();
    for (const [key, c] of this.cells) {
      if (c.kind !== 'logic_gate') continue;
      const mode = Math.min(c.s, GATE_MODES.length - 1);
      if (this.gateKnown.get(key) !== mode) {
        const m = GATE_MODES[mode];
        this.gateNet.add({ id: `${key}#a`, kind: 'source', ins: [] });
        this.gateNet.add({ id: `${key}#b`, kind: 'source', ins: [] });
        this.gateNet.add({ id: key, kind: m.kind, ins: m.kind === 'not' ? [`${key}#a`] : [`${key}#a`, `${key}#b`], arg: m.arg });
        this.gateKnown.set(key, mode);
      }
      const side = this.sideCells(c);
      this.gateNet.set(`${key}#a`, this.level.get(side.a) ?? 0);
      this.gateNet.set(`${key}#b`, this.level.get(side.b) ?? 0);
    }
    if (this.gateKnown.size === 0) return out;
    this.gateNet.tick();
    for (const key of this.gateKnown.keys()) out.set(key, this.gateNet.level(key));
    return out;
  }

  /** One step of every relay on last tick's levels: the output level (15) of each relay that is on. */
  private runRelays(t: number): Map<string, number> {
    const out = new Map<string, number>();
    for (const key of [...this.relays.keys()]) if (this.cells.get(key)?.kind !== 'signal_relay') this.relays.delete(key);
    for (const [key, c] of this.cells) {
      if (c.kind !== 'signal_relay') continue;
      const mode = RELAY_MODES[Math.min(c.s, RELAY_MODES.length - 1)];
      let r = this.relays.get(key);
      if (!r) this.relays.set(key, (r = { input: false, out: false, pending: [], until: 0 }));
      const input = (this.level.get(this.sideCells(c).back) ?? 0) > 0;
      if (mode.kind === 'repeat') r.out = input;
      else if (mode.kind === 'hold') {
        if (input) r.until = t + mode.s;
        r.out = input || t < r.until;
      } else {
        if (mode.kind === 'delay' && input !== r.input) r.pending.push({ at: t + mode.s, on: input });
        if (mode.kind === 'pulse' && input && !r.input) r.until = t + mode.s;
        while (r.pending.length && r.pending[0].at <= t) {
          const p = r.pending.shift() as { at: number; on: boolean };
          r.out = p.on;
        }
        if (mode.kind === 'pulse') r.out = t < r.until;
      }
      r.input = input;
      if (r.out) out.set(key, SIGNAL_RANGE);
    }
    return out;
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

  /** Every clock tower: where it stands and the town hours it is set to (TOWER_SCHEDULES). */
  towers(): { x: number; y: number; z: number; schedule: number }[] {
    const out: { x: number; y: number; z: number; schedule: number }[] = [];
    for (const c of this.cells.values()) if (c.kind === 'clock_tower') out.push({ x: c.x, y: c.y, z: c.z, schedule: c.s });
    return out;
  }

  /** True when a clock tower stands within TOWER_RANGE blocks of the cell. */
  private towerNear(c: { x: number; y: number; z: number }): boolean {
    for (const o of this.cells.values()) if (o.kind === 'clock_tower' && Math.hypot(o.x - c.x, o.y - c.y, o.z - c.z) <= TOWER_RANGE) return true;
    return false;
  }

  private tod(): number | null {
    const v = this.host.timeOfDay?.();
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  private timerOn(c: Cell, t: number, tod: number | null): boolean {
    if (c.s < TIMER_PRESETS.length) return t % TIMER_PRESETS[c.s].every < TIMER_PRESETS[c.s].on;
    const p = CLOCK_TIMER_PRESETS[Math.min(c.s - TIMER_PRESETS.length, CLOCK_TIMER_PRESETS.length - 1)];
    return tod !== null && this.towerNear(c) && clockTimerOn(p.key, tod);
  }

  /** A tower lights while it strikes the hour, and its bell rings once as the strike starts. */
  private towerOn(key: string, c: Cell, tod: number | null): boolean {
    const on = tod !== null && striking(tod);
    if (on && !this.striking.has(key)) {
      this.striking.add(key);
      this.host.bus.emit('sfx', { name: 'tower_bell', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, volume: 0.7 });
    } else if (!on) this.striking.delete(key);
    return on;
  }

  tick(t: number): void {
    this.clock = t;
    const tod = this.tod();
    const gateOut = this.runGates();
    for (const [k, v] of this.runRelays(t)) gateOut.set(k, v);
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
            : c.kind === 'signal_timer' ? this.timerOn(c, t, tod)
              : c.kind === 'push_button' ? t < (this.pushed.get(key) ?? 0)
                : c.kind === 'clock_tower' ? this.towerOn(key, c, tod)
                  : false;
      if (SOURCES.has(c.kind) && on) {
        seed(key);
        this.litCells.add(key);
      }
    }
    for (const key of this.external) seed(key);
    for (const key of this.driven) {
      if (!this.cells.has(key)) continue;
      seed(key);
      this.litCells.add(key);
    }
    // Logic gates drive the cell in front of them (and read as lit to machines that touch them).
    for (const [key, out] of gateOut) {
      if (out <= 0) continue;
      this.level.set(key, out);
      this.litCells.add(key);
      const c = this.cells.get(key) as Cell;
      const front = this.sideCells(c).front;
      if (this.cells.get(front)?.kind === 'signal_wire' && (this.level.get(front) ?? 0) < out) {
        this.level.set(front, out);
        this.litCells.add(front);
        queue.push(front);
      }
    }
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
    if (c.kind === 'logic_gate') {
      const m = GATE_MODES[Math.min(c.s, GATE_MODES.length - 1)];
      const n = m.kind === 'counter' ? `, count ${this.gateNet.count(k3(x, y, z))}/${m.arg}` : '';
      return `Logic Gate - ${m.name}, ${this.lit(k3(x, y, z)) ? 'on' : 'off'}${n}`;
    }
    if (c.kind === 'signal_relay') return `Relay - ${RELAY_MODES[Math.min(c.s, RELAY_MODES.length - 1)].name}, ${this.lit(k3(x, y, z)) ? 'on' : 'off'}`;
    if (c.kind === 'signal_timer') {
      const idle = c.s >= TIMER_PRESETS.length && !this.towerNear(c) ? ` (idle: no clock tower within ${TOWER_RANGE} blocks)` : '';
      return `Timer - ${timerText(c.s)}${idle}, ${this.lit(k3(x, y, z)) ? 'on' : 'off'}`;
    }
    if (c.kind === 'clock_tower') {
      const tod = this.tod();
      const time = tod === null ? 'no sun to read' : hhmm(tod);
      return `Clock Tower - ${time}, ${TOWER_SCHEDULES[Math.min(c.s, TOWER_SCHEDULES.length - 1)].name}; strikes every hour. Tap it to change the town's hours`;
    }
    const names: Record<string, string> = { signal_wire: 'Signal Wire', crank_lever: 'Crank Lever', pressure_plate: 'Pressure Plate', metronome: 'Metronome', signal_lamp: 'Signal Lamp', bell: 'Bell', push_button: 'Push Button' };
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
      this.cells.set(k3(row[0], row[1], row[2]), { kind: row[3], x: row[0], y: row[1], z: row[2], s: row[3] === 'logic_gate' ? modeIndex(row[4], GATE_MODES.length) : row[3] === 'signal_relay' ? modeIndex(row[4], RELAY_MODES.length) : row[3] === 'signal_timer' ? modeIndex(row[4], TIMER_SETTINGS) : row[3] === 'clock_tower' ? modeIndex(row[4], TOWER_SCHEDULES.length) : row[4] ? 1 : 0 });
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
