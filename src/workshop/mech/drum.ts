/**
 * Time programming (docs/MECHANICS_PLAN.md 2.4). Pure. A cam drum is a turning cylinder of `DRUM_STEPS` steps and `DRUM_TRACKS` tracks with pegs;
 * a track is "on" while a peg sits under its follower. An escapement meters a spring into fixed ticks; a spring gives less as it unwinds.
 */

export const DRUM_STEPS = 16;
export const DRUM_TRACKS = 4;
/** Steps a drum advances per second at 16 rpm. */
export const DRUM_STEPS_PER_S = 2;

export interface Drum {
  /** One bit mask per track: bit i = a peg at step i. */
  pegs: number[];
  /** Position in steps, 0 <= pos < DRUM_STEPS. */
  pos: number;
}

export function makeDrum(pegs?: readonly number[]): Drum {
  const p: number[] = [];
  for (let t = 0; t < DRUM_TRACKS; t++) p.push(((pegs?.[t] ?? 0) | 0) & 0xffff);
  return { pegs: p, pos: 0 };
}

/** A drum from text rows, one per track: `x` = peg, anything else = none (rows are padded or cut to 16). */
export function drumFromRows(rows: readonly string[]): Drum {
  const pegs: number[] = [];
  for (let t = 0; t < DRUM_TRACKS; t++) {
    const row = rows[t] ?? '';
    let m = 0;
    for (let i = 0; i < DRUM_STEPS; i++) if (row[i] === 'x') m |= 1 << i;
    pegs.push(m);
  }
  return makeDrum(pegs);
}

export const hasPeg = (d: Drum, track: number, step: number): boolean => ((d.pegs[track] >> (((step % DRUM_STEPS) + DRUM_STEPS) % DRUM_STEPS)) & 1) === 1;

/** Toggle one peg (the UI / a punched card). */
export function setPeg(d: Drum, track: number, step: number, on: boolean): void {
  if (track < 0 || track >= DRUM_TRACKS || step < 0 || step >= DRUM_STEPS) return;
  d.pegs[track] = on ? d.pegs[track] | (1 << step) : d.pegs[track] & ~(1 << step);
}

export interface DrumEdge { track: number; step: number; on: boolean }

/**
 * Turn the drum by `rpm` (signed: backwards runs the program backwards) for `dt` seconds. Returns every on/off edge crossed, in order, so a fast
 * drum never swallows a peg. `speed` is the network speed factor w.
 */
export function advanceDrum(d: Drum, rpm: number, dt: number, speed = 1): DrumEdge[] {
  const edges: DrumEdge[] = [];
  const delta = (rpm / 16) * DRUM_STEPS_PER_S * dt * speed;
  if (delta === 0) return edges;
  const start = d.pos;
  const end = start + delta;
  const dir = delta > 0 ? 1 : -1;
  // Walk the integer step boundaries crossed.
  let cur = Math.floor(start);
  const last = Math.floor(end);
  const before = (s: number): boolean[] => d.pegs.map((_, t) => hasPeg(d, t, s));
  let prev = before(cur);
  while (cur !== last) {
    cur += dir;
    const now = before(cur);
    for (let t = 0; t < DRUM_TRACKS; t++) if (now[t] !== prev[t]) edges.push({ track: t, step: ((cur % DRUM_STEPS) + DRUM_STEPS) % DRUM_STEPS, on: now[t] });
    prev = now;
  }
  d.pos = ((end % DRUM_STEPS) + DRUM_STEPS) % DRUM_STEPS;
  return edges;
}

/** Which tracks are on right now. */
export function outputs(d: Drum): boolean[] {
  const s = Math.floor(d.pos);
  return d.pegs.map((_, t) => hasPeg(d, t, s));
}

/**
 * Cam follower lift 0..1 for a track: rises over the half step before a peg, holds on it, falls over the half step after (smoothstep).
 * This is the position output a lever or a linkage reads.
 */
export function follower(d: Drum, track: number): number {
  const s = Math.floor(d.pos);
  const f = d.pos - s;
  const now = hasPeg(d, track, s) ? 1 : 0;
  const next = hasPeg(d, track, s + 1) ? 1 : 0;
  const prev = hasPeg(d, track, s - 1) ? 1 : 0;
  const ss = (t: number): number => t * t * (3 - 2 * t);
  if (f >= 0.5 && next > now) return ss((f - 0.5) * 2);
  if (f < 0.5 && prev > now && now === 0) return 1 - ss(f * 2);
  return now;
}

/** Save shape: four 16-bit numbers and the position. */
export function drumToJSON(d: Drum): [number[], number] {
  return [d.pegs.slice(), d.pos];
}
export function drumFromJSON(raw: unknown): Drum {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return makeDrum();
  const d = makeDrum(raw[0].map((n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)));
  const pos = typeof raw[1] === 'number' && Number.isFinite(raw[1]) ? raw[1] : 0;
  d.pos = ((pos % DRUM_STEPS) + DRUM_STEPS) % DRUM_STEPS;
  return d;
}

/** Pulses a 16-slot encoder emits when a shaft angle (in turns) goes from `from` to `to`: the number of slot boundaries crossed (signed). */
export function encoderPulses(from: number, to: number, slots = 16): number {
  return Math.floor(to * slots) - Math.floor(from * slots);
}

/* ---------- Spring and escapement ---------- */

/** A wound spring: `wound` seconds left of `max`. It gives full torque down to 25 % wind, then tapers to 40 % at empty. */
export interface Spring { wound: number; max: number }
export function springTorque(s: Spring): number {
  if (s.wound <= 0) return 0;
  const f = s.wound / s.max;
  return f >= 0.25 ? 1 : 0.4 + 0.6 * (f / 0.25);
}
export function windSpring(s: Spring, seconds: number): number {
  const before = s.wound;
  s.wound = Math.min(s.max, s.wound + seconds);
  return s.wound - before;
}
export function unwindSpring(s: Spring, dt: number): void {
  s.wound = Math.max(0, s.wound - dt);
}

/** An escapement: while the spring is wound it ticks every `period` seconds whatever the load, so it keeps time. Returns ticks this step. */
export interface Escapement { acc: number; period: number }
export function stepEscapement(e: Escapement, spring: Spring, dt: number): number {
  if (spring.wound <= 0) return 0;
  e.acc += dt * Math.min(1, springTorque(spring) + 0.2);
  let ticks = 0;
  while (e.acc >= e.period) {
    e.acc -= e.period;
    ticks++;
  }
  return ticks;
}
