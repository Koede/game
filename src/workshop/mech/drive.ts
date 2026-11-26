/**
 * Drivetrain dynamics (docs/MECHANICS_PLAN.md section 1). Pure. `kinetics.ts#solveNetwork` decides who turns which way at what rpm and what the
 * steady load and rated torque of a network are; this layer adds the physics on top: momentum (flywheels), engine torque curves, pulsed loads,
 * brakes, torque fuses, whip (critical speed), heat, a diagnosis the goggles read and a load graph.
 *
 * Units: torque in su (the workshop's stress unit), speed as a factor `w` of the solved rpm (1 = as solved), momentum `M` in su*s per unit w.
 * With default parts M is tiny, so w jumps to its steady value in a tick and a network behaves as it did before this layer existed.
 */

/** Smallest momentum any network has (keeps the integrator well posed). */
export const M_BASE = 0.05;
/** Idle friction of a line with no engine (su at w = 1) plus this much per part: a coasting flywheel does not turn for ever. */
export const IDLE_DRAG = 1;
export const IDLE_DRAG_PER_PART = 0.02;
/** Torque a fully engaged brake takes, su. */
export const BRAKE_TORQUE = 24;
/** A network below this speed factor with a load on it counts as stalled. */
export const STALL_W = 0.05;
/** Seconds a fuse may carry more than its rating before it snaps. */
export const FUSE_GRACE_S = 0.4;
/** Capacity lost while a shaft run whips. */
export const WHIP_LOSS = 0.35;
/** How close to critical speed (fraction) a run starts to whip. */
export const WHIP_BAND = 0.15;
/** Heat at which a slipping or braking part scorches (seizes). */
export const HEAT_SEIZE = 100;

/** Engine torque as a multiple of the rated torque at speed factor w. All are speed regulated: they never push w above 1 on their own. */
export type EngineKind = 'flat' | 'steam' | 'human' | 'spring';
export const ENGINE_CURVES: Record<EngineKind, (w: number) => number> = {
  /** Cranks, wheels, motors: the same torque at any speed up to rated. */
  flat: (w) => (w <= 1 ? 1 : Math.max(0, 1 - (w - 1) * 4)),
  /** A piston engine: strong when it lugs (x1.5 stalled), so it starts loads a crank could not. */
  steam: (w) => (w <= 1 ? 1 + 0.5 * (1 - Math.max(0, w)) : Math.max(0, 1 - (w - 1) * 4)),
  /** A person or animal pushes harder when it sticks (x1.5 stalled): a cranked press lurches through its stroke instead of jamming. */
  human: (w) => (w <= 1 ? 1 + 0.5 * (1 - Math.max(0, w)) : Math.max(0, 1 - (w - 1) * 4)),
  /** A spring: flat in speed (its unwinding is the wind state). */
  spring: (w) => (w <= 1 ? 1 : 0),
};
export const ENGINE_KIND_OF: Record<string, EngineKind> = { steam_engine: 'steam', steam_rotor: 'steam', clockwork_motor: 'spring', hand_crank: 'human', treadwheel: 'human' };
export const engineKindOf = (partKind: string): EngineKind => ENGINE_KIND_OF[partKind] ?? 'flat';

/** Momentum each part kind adds at its own speed (su*s), scaled by the square of its speed ratio to the network. */
export const PART_MOMENTUM: Record<string, number> = {
  flywheel: 16, mech_millstone: 0.4, treadwheel: 1, clockwork_motor: 0.3, bearing: 2, mech_press: 0.5, mech_hammer: 0.5, differential: 0.2,
};
/** Momentum of one part kind. */
export const partMomentum = (kind: string): number => PART_MOMENTUM[kind] ?? 0.02;

/** Network momentum: parts as `{kind, ratio}` where ratio = the part's rpm over the network reference rpm. */
export function networkMomentum(parts: Iterable<{ kind: string; ratio: number }>): number {
  let m = M_BASE;
  for (const p of parts) m += partMomentum(p.kind) * Math.min(16, p.ratio * p.ratio);
  return m;
}

export interface Engine { rated: number; curve: EngineKind }
export interface DriveInput {
  engines: readonly Engine[];
  /** Steady load, su (kinetics `stress`). */
  load: number;
  /** Extra load as a fraction of `load` right now (a press stroke is about +2). */
  pulse?: number;
  /** Network momentum, su*s (`networkMomentum`). */
  momentum: number;
  /** Engaged brake torque fraction 0..1 of BRAKE_TORQUE per brake (sum, may exceed 1). */
  brake?: number;
  /** Friction torque at w = 1, su (grows linearly with speed; lubricant lowers it). */
  drag?: number;
}
export interface DriveState { w: number }
export interface DriveOut {
  w: number;
  /** Torque the engines give and the load takes at the new speed, su. */
  drive: number;
  demand: number;
  stalled: boolean;
  /** Stored kinetic energy, 1/2 M w^2 (su*s). */
  energy: number;
}

export const fresh = (w = 1): DriveState => ({ w });

/** Engine torque at speed factor w. */
export function driveTorque(engines: readonly Engine[], w: number): number {
  let t = 0;
  for (const e of engines) t += e.rated * ENGINE_CURVES[e.curve](w);
  return t;
}

/** Torque the load, brakes and friction ask at speed factor w. */
export function demandTorque(input: DriveInput, w: number): number {
  const load = input.load * (1 + Math.max(0, input.pulse ?? 0));
  return load + (input.brake ?? 0) * BRAKE_TORQUE + (input.drag ?? 0) * Math.max(0, w);
}

/**
 * One implicit step of `M dw/dt = drive(w) - demand(w)` from `state.w` over `dt`: the root of `x = w + dt/M (drive(x) - demand(x))`, found by bisection
 * (the right side is monotone because engines give less and friction more as the speed rises), so even a tiny M cannot oscillate.
 * w stays in [0, 1]: engines are speed regulated. With no engine at all the speed just coasts down.
 */
export function stepDrive(state: DriveState, input: DriveInput, dt: number): DriveOut {
  const M = Math.max(M_BASE, input.momentum);
  const k = dt / M;
  const f = (x: number): number => x - state.w - k * (driveTorque(input.engines, x) - demandTorque(input, x));
  let lo = 0;
  let hi = 1;
  let w: number;
  if (f(0) >= 0) w = 0;
  else if (f(1) <= 0) w = 1;
  else {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    w = (lo + hi) / 2;
  }
  // A line that can hold full speed reaches it (the root only approaches 1 when drive equals demand there).
  if (w > 0.995 && driveTorque(input.engines, 1) >= demandTorque(input, 1)) w = 1;
  state.w = w;
  const drive = driveTorque(input.engines, w);
  const demand = demandTorque(input, w);
  return { w, drive, demand, stalled: w < STALL_W && input.load > 0 && input.engines.length > 0, energy: 0.5 * M * w * w };
}

/** Seconds a charged flywheel line (w = 1) coasts against `load` and `drag` with no engine, to w 0. */
export function coastSeconds(momentum: number, load: number, drag = 0, brake = 0): number {
  const t = load + drag + brake * BRAKE_TORQUE;
  return t <= 0 ? Infinity : Math.max(M_BASE, momentum) / t;
}

/**
 * How big a pulse (fraction of the steady load) a line rides through for `pulseS` seconds on `rated` torque while the speed drops by at most half:
 * the rule of thumb the goggles quote. Infinity when there is no load.
 */
export function rideThrough(momentum: number, rated: number, load: number, pulseS: number): number {
  if (load <= 0) return Infinity;
  return Math.max(0, rated / load - 1 + (0.5 * momentum) / (load * Math.max(0.01, pulseS)));
}

/* ---------- Whip: critical speed of unsupported shaft runs ---------- */

/** Critical rpm of a straight run of `length` blocks without a support. */
export const criticalRpm = (length: number): number => 160 / Math.max(1, length);

/** Capacity factor from whip for one run at `rpm`: 1 outside the band (and for runs shorter than 3), `1 - WHIP_LOSS` inside it. */
export function whipFactor(length: number, rpm: number): number {
  if (length < 3) return 1;
  const c = criticalRpm(length);
  return Math.abs(Math.abs(rpm) - c) <= c * WHIP_BAND ? 1 - WHIP_LOSS : 1;
}

export type Cell = readonly [number, number, number];
const ck = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/**
 * Straight runs of shaft cells along one axis. A `supports` cell (a pillow block that is part of the line) ends a run after itself, so a support
 * splits a long run in two. Returns `{ length, cells, axis }` per run of length >= 2.
 */
export function shaftRuns(shafts: readonly Cell[], supports: ReadonlySet<string> = new Set()): { length: number; cells: Cell[]; axis: 0 | 1 | 2 }[] {
  const set = new Set(shafts.map((c) => ck(c[0], c[1], c[2])));
  for (const s of supports) set.add(s);
  const out: { length: number; cells: Cell[]; axis: 0 | 1 | 2 }[] = [];
  const shaftSet = new Set(shafts.map((c) => ck(c[0], c[1], c[2])));
  for (const c of shafts) {
    for (const axis of [0, 1, 2] as const) {
      const back = [c[0], c[1], c[2]];
      back[axis]--;
      const bk = ck(back[0], back[1], back[2]);
      // A run starts at a shaft whose back neighbour is not in the line, or is a support (which ends the run before it).
      if (set.has(bk) && !supports.has(bk)) continue;
      const cells: Cell[] = [];
      const p = [c[0], c[1], c[2]];
      while (set.has(ck(p[0], p[1], p[2]))) {
        const here = ck(p[0], p[1], p[2]);
        if (shaftSet.has(here) || supports.has(here)) cells.push([p[0], p[1], p[2]]);
        if (supports.has(here) && cells.length > 1) break;
        p[axis]++;
      }
      if (cells.length >= 2) out.push({ length: cells.length, cells, axis });
    }
  }
  return out;
}

/** The worst whip factor among runs at one rpm (1 = none). */
export function worstWhip(runs: readonly { length: number }[], rpm: number): number {
  let f = 1;
  for (const r of runs) f = Math.min(f, whipFactor(r.length, rpm));
  return f;
}

/* ---------- Torque through a position and fuses ---------- */

/**
 * Torque through each part: its own stress plus everything downstream of it (children in the solve tree). `order` lists keys parents-first
 * (the order the solver reached them); `parent` maps a key to the part it received its speed from.
 */
export function throughTorque(order: readonly string[], parent: ReadonlyMap<string, string | null | undefined>, own: ReadonlyMap<string, number>): Map<string, number> {
  const t = new Map<string, number>();
  for (const k of order) t.set(k, own.get(k) ?? 0);
  for (let i = order.length - 1; i >= 0; i--) {
    const p = parent.get(order[i]);
    if (p) t.set(p, (t.get(p) ?? 0) + (t.get(order[i]) ?? 0));
  }
  return t;
}

/** Fuse materials: the torque each carries, in the order Use cycles them (setting 0 = the legacy pin, no rating). */
export const FUSE_RATINGS = [0, 6, 12, 24] as const;
export const FUSE_NAMES = ['Legacy pin', 'Copper', 'Bronze', 'Iron'] as const;

export interface FuseState { over: number }
/** Advance a fuse; true = it snaps now. `rating` 0 never snaps here (the legacy rule belongs to the workshop). */
export function stepFuse(state: FuseState, rating: number, torque: number, dt: number): boolean {
  if (rating <= 0 || torque <= rating) {
    state.over = Math.max(0, state.over - dt);
    return false;
  }
  state.over += dt * Math.min(4, torque / rating - 0.5);
  return state.over >= FUSE_GRACE_S;
}

/* ---------- Heat ---------- */

/** Heat of a part after `dt`: it gains `power` (slip or brake torque x speed) and cools towards 0 (hotter parts cool faster). */
export function stepHeat(heat: number, power: number, dt: number, coolPerS = 4): number {
  const h = heat + power * dt - coolPerS * dt * (heat / HEAT_SEIZE + 0.25);
  return Math.max(0, Math.min(HEAT_SEIZE * 1.5, h));
}

/** Heat power of a brake stopping a line: engaged fraction x torque x speed (w x rpm), scaled to heat units. */
export const brakePower = (engaged: number, w: number, rpm: number): number => (engaged * BRAKE_TORQUE * w * Math.abs(rpm)) / 160;

/* ---------- Diagnosis the goggles read ---------- */

export interface Finding { code: 'stall' | 'ripple' | 'whip' | 'overload' | 'idle' | 'brake' | 'ok'; text: string; fix: string }
export interface DiagnoseInput {
  rated: number;
  load: number;
  pulse: number;
  momentum: number;
  w: number;
  whip: boolean;
  hasFlywheel: boolean;
  brake: number;
  hasFuse: boolean;
}
const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();
export function diagnose(d: DiagnoseInput): Finding[] {
  const out: Finding[] = [];
  if (d.brake > 0 && d.w < 0.5) out.push({ code: 'brake', text: 'A brake is holding the line', fix: 'Release the brake or let the signal drop' });
  if (d.rated <= 0) {
    out.push({ code: 'idle', text: 'No engine is turning this line', fix: 'Crank it, wind the motor, or start the engine' });
    return out;
  }
  if (d.load > d.rated) {
    out.push({
      code: d.w < STALL_W ? 'stall' : 'overload',
      text: `Load ${fmt(d.load)} su is more than the ${fmt(d.rated)} su the engines carry`,
      fix: d.hasFuse ? 'Take a machine off, or add an engine' : 'Add an engine, take a machine off, or put a fuse in so the weak link breaks first',
    });
  } else if (d.load * (1 + d.pulse) > d.rated) {
    out.push({
      code: 'ripple',
      text: `Pulses reach ${fmt(d.load * (1 + d.pulse))} su on ${fmt(d.rated)} su: the line slows with every stroke`,
      fix: d.hasFlywheel ? 'A heavier flywheel or a second one smooths it more' : 'Add a flywheel: it rides through the peaks',
    });
  }
  if (d.whip) out.push({ code: 'whip', text: 'A long shaft is whipping at its critical speed', fix: 'Put a pillow block in the run, or change the speed with a ratio dial' });
  if (out.length === 0) out.push({ code: 'ok', text: `Running: load ${fmt(d.load)} of ${fmt(d.rated)} su`, fix: '' });
  return out;
}

/* ---------- Load graph ---------- */

/** Fixed-size ring of load/capacity/speed samples for the goggles' spark-line. */
export class LoadGraph {
  readonly load: Float32Array;
  readonly cap: Float32Array;
  readonly w: Float32Array;
  private n = 0;
  private head = 0;
  constructor(readonly size = 120) {
    this.load = new Float32Array(size);
    this.cap = new Float32Array(size);
    this.w = new Float32Array(size);
  }
  push(load: number, cap: number, w: number): void {
    this.load[this.head] = load;
    this.cap[this.head] = cap;
    this.w[this.head] = w;
    this.head = (this.head + 1) % this.size;
    this.n = Math.min(this.size, this.n + 1);
  }
  get length(): number {
    return this.n;
  }
  /** Samples oldest first. */
  series(): { load: number[]; cap: number[]; w: number[] } {
    const out = { load: [] as number[], cap: [] as number[], w: [] as number[] };
    for (let i = 0; i < this.n; i++) {
      const j = (this.head - this.n + i + this.size) % this.size;
      out.load.push(this.load[j]);
      out.cap.push(this.cap[j]);
      out.w.push(this.w[j]);
    }
    return out;
  }
  /** The highest load seen over the highest capacity seen (the spark-line's scale). */
  peakRatio(): number {
    let l = 0;
    let c = 0;
    for (let i = 0; i < this.n; i++) {
      l = Math.max(l, this.load[i]);
      c = Math.max(c, this.cap[i]);
    }
    return c > 0 ? l / c : 0;
  }
}
