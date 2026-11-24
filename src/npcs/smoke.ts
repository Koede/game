/**
 * Veyra's cigar (docs/api/npcs.md): pure schedule and particle pool for her signature idle flourish. She lights up for ~10 s about every
 * 46-70 s of idle time; the smoke she breathes is a pixel-art puff that curls up, gathers into a small skull and crumbles to dust. The renderer
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
/** Frames in one puff's pixel animation (src/render/npcs/smoke.ts has the art) and how fast it plays. */
export const SMOKE_FRAMES = 16;
export const PUFF_FPS = 10;
/** Seconds a puff lives: exactly its animation. */
export const PUFF_LIFE = SMOKE_FRAMES / PUFF_FPS;
/** Seconds between puffs while smoking (two or three overlap at different ages). */
export const PUFF_EVERY = 0.55;

export interface Puff {
  alive: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
  /** Rise speed (blocks per second), sideways drift, and the sway's rate and phase. */
  vy: number;
  vx: number;
  vz: number;
  sway: number;
  phase: number;
}

/** The animation frame of a puff at `age` seconds: a fixed timeline, curl -> skull -> dust. */
export const puffFrame = (age: number): number => Math.max(0, Math.min(SMOKE_FRAMES - 1, Math.floor(age * PUFF_FPS)));

/** A fixed set of puffs, recycled (no allocation after construction). */
export class SmokePool {
  readonly puffs: Puff[] = [];
  private clock = 0;
  private n = 0;

  constructor(readonly max = SMOKE_MAX) {
    for (let i = 0; i < max; i++) this.puffs.push({ alive: false, age: 0, x: 0, y: 0, z: 0, vy: 0, vx: 0, vz: 0, sway: 0, phase: 0 });
  }

  get alive(): number {
    let c = 0;
    for (const p of this.puffs) if (p.alive) c++;
    return c;
  }

  /** Starts one puff at the cigar tip; the oldest is recycled when the pool is full. */
  emit(x: number, y: number, z: number, seed = 0): Puff {
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
    p.age = 0;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vy = 0.1 + 0.04 * r2;
    p.vx = (r - 0.5) * 0.06;
    p.vz = (r2 - 0.5) * 0.06;
    p.sway = 1.5 + r;
    p.phase = r2 * 6.28;
    return p;
  }

  /** Advances every puff; while `smoking`, breathes out a puff every PUFF_EVERY at the tip. Not smoking: the rest finish and vanish. */
  step(dt: number, smoking: boolean, mx: number, my: number, mz: number, seed = 0): void {
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= PUFF_LIFE) {
        p.alive = false;
        continue;
      }
      p.x += (p.vx + Math.sin(p.age * p.sway + p.phase) * 0.04) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    if (!smoking) {
      this.clock = 0;
      return;
    }
    this.clock -= dt;
    // At most one puff per call, so a long frame cannot burst the pool.
    if (this.clock <= 0) {
      this.clock = Math.max(this.clock + PUFF_EVERY, 0.05);
      this.emit(mx, my, mz, seed);
    }
  }

  clear(): void {
    for (const p of this.puffs) p.alive = false;
    this.clock = 0;
  }
}
