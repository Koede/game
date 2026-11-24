/**
 * Veyra's cigar (docs/api/npcs.md): pure schedule and particle pool for her signature idle flourish. She lights up for ~10 s about every
 * 46-70 s of idle time; the smoke she breathes curls up and resolves into a small skull before it fades. The renderer
 * (src/render/npcs/smoke.ts) draws it; everything here is deterministic from time so it is testable without a canvas.
 */

/** Seconds of one smoke. */
export const SMOKE_DURATION = 10;
/** One slot of the schedule: a smoke starts at a jittered offset inside each slot, so starts are 46..70 s apart. */
const SLOT = 58;
const JITTER = 12;
/** Seconds the cigar takes to be raised / lowered at either end of a smoke. */
const RAISE = 0.6;

/** Who smokes. */
export const SMOKER = 'veyra';

/** What the view says about the person right now (the subset of NpcView the schedule reads). */
export interface SmokeContext {
  dancing?: boolean;
  hired?: boolean;
  /** Someone is talking to her (a conversation is on). */
  talking?: boolean;
  /** She is asleep (never true today: nobody sleeps in the tavern; kept for when they do). */
  asleep?: boolean;
}

export interface SmokeState {
  smoking: boolean;
  /** 0..1 how far the cigar is raised (ramps in and out). */
  raise: number;
  /** Seconds into this smoke. */
  into: number;
  /** Which smoke this is (stable id). */
  index: number;
}

export const NOT_SMOKING: SmokeState = { smoking: false, raise: 0, into: 0, index: -1 };

/** A stable 0..1 hash of an integer and a seed. */
export function hash01(n: number, seed = 0): number {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul((seed | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Start time (seconds) of the smoke in slot `k`. */
export const smokeStart = (k: number, seed = 0): number => k * SLOT + hash01(k, seed) * JITTER;

/** Is she smoking at time `t` (seconds of idle time)? Pure; never while dancing, hired, talking or asleep. */
export function smokeAt(t: number, seed = 0, ctx: SmokeContext = {}): SmokeState {
  if (ctx.dancing || ctx.hired || ctx.talking || ctx.asleep || !(t >= 0)) return NOT_SMOKING;
  const k = Math.floor(t / SLOT);
  const into = t - smokeStart(k, seed);
  if (into < 0 || into >= SMOKE_DURATION) return NOT_SMOKING;
  const raise = Math.min(1, into / RAISE, (SMOKE_DURATION - into) / RAISE);
  return { smoking: true, raise, into, index: k };
}

// ---- the particle pool ---------------------------------------------------------------------------------------------

/** Most smoke sprites alive at once. */
export const SMOKE_MAX = 8;
/** Seconds a puff lives. */
export const PUFF_LIFE = 3;
/** Seconds between skulls while smoking, and between plain curls (offset half a beat from the skulls). */
export const SKULL_EVERY = 0.6;
export const CURL_EVERY = 1.2;

/** Frames in the shared smoke atlas: 0 a plain curl, 1..4 a wisp that progressively reads as a skull (4 is the full skull). */
export const SMOKE_FRAMES = 5;

export interface Puff {
  alive: boolean;
  /** Skull puffs resolve through the atlas; curl puffs stay a plain curl. */
  skull: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Radians per second the wisp sways at, and its phase. */
  sway: number;
  phase: number;
}

/** Atlas frame for a puff at 0..1 of its life. */
export function puffFrame(skull: boolean, u: number): number {
  if (!skull) return 0;
  return u < 0.18 ? 1 : u < 0.4 ? 2 : u < 0.6 ? 3 : 4;
}

/** Opacity (0..1 of the sprite's full ~0.6) at 0..1 of life: a quick fade in, a long hold, a fade out. */
export function puffAlpha(u: number): number {
  return Math.max(0, Math.min(1, u / 0.12, (1 - u) / 0.35));
}

/** World size of a puff at 0..1 of life: it grows as it rises. */
export function puffSize(u: number): number {
  return 0.16 + 0.34 * Math.sqrt(Math.max(0, Math.min(1, u)));
}

/** A fixed set of puffs, recycled (no allocation after construction). */
export class SmokePool {
  readonly puffs: Puff[] = [];
  private skullClock = 0;
  private curlClock = CURL_EVERY / 2;
  private n = 0;

  constructor(readonly max = SMOKE_MAX) {
    for (let i = 0; i < max; i++) this.puffs.push({ alive: false, skull: false, age: 0, life: PUFF_LIFE, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sway: 0, phase: 0 });
  }

  get alive(): number {
    let c = 0;
    for (const p of this.puffs) if (p.alive) c++;
    return c;
  }

  /** Starts one puff at the mouth; the oldest is recycled when the pool is full. */
  emit(skull: boolean, x: number, y: number, z: number, seed = 0): Puff {
    let slot: Puff | null = null;
    for (const p of this.puffs) {
      if (!p.alive) {
        slot = p;
        break;
      }
    }
    if (!slot) for (const p of this.puffs) if (!slot || p.age > slot.age) slot = p;
    const p = slot!;
    const r = hash01(this.n++, seed);
    const r2 = hash01(this.n, seed + 7);
    p.alive = true;
    p.skull = skull;
    p.age = 0;
    p.life = PUFF_LIFE * (0.9 + 0.2 * r);
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = (r - 0.5) * 0.12;
    p.vz = (r2 - 0.5) * 0.12;
    p.vy = 0.3 + 0.08 * r2;
    p.sway = 1.2 + r;
    p.phase = r2 * 6.28;
    return p;
  }

  /** Advances every puff; while `smoking`, breathes out skulls and curls at the mouth. Not smoking: the rest drift away and fade. */
  step(dt: number, smoking: boolean, mx: number, my: number, mz: number, seed = 0): void {
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      p.x += (p.vx + Math.sin(p.age * p.sway + p.phase) * 0.05) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    if (!smoking) {
      this.skullClock = 0;
      this.curlClock = CURL_EVERY / 2;
      return;
    }
    this.skullClock -= dt;
    this.curlClock -= dt;
    // At most one puff of each kind per call, so a long frame cannot burst the pool.
    if (this.skullClock <= 0) {
      this.skullClock = Math.max(this.skullClock + SKULL_EVERY, 0.05);
      this.emit(true, mx, my, mz, seed);
    }
    if (this.curlClock <= 0) {
      this.curlClock = Math.max(this.curlClock + CURL_EVERY, 0.05);
      this.emit(false, mx, my, mz, seed + 1);
    }
  }

  clear(): void {
    for (const p of this.puffs) p.alive = false;
    this.skullClock = 0;
    this.curlClock = CURL_EVERY / 2;
  }
}
