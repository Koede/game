/**
 * Bees round a settled hive whose bees are out (src/sim/apiary.ts), drawn as tiny short-lived particles re-spawned every
 * frame (like the night critters): each bee loops out from the hive and back along its own wobbling path. DOM-free.
 */
import { ParticleLook, type ParticleSpec } from './particles';

/** A hive the bees fly round: its block position and how much forage it has. */
export interface BuzzingHive {
  x: number;
  y: number;
  z: number;
  forage: number;
}

/** Bees are drawn round hives within this many blocks of the player. */
export const BEE_DRAW_R = 28;
const MAX_BEES = 7;

const base: ParticleSpec = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.1, size: 0.06, sizeEnd: 0.06, r: 0.98, g: 0.78, b: 0.16, r2: 0.98, g2: 0.78, b2: 0.16, alpha: 1,
  gravity: 0, drag: 0, look: ParticleLook.Chip, fog: 1,
};

/** How many bees one hive shows. */
export const beesOf = (h: BuzzingHive): number => Math.max(2, Math.min(MAX_BEES, 2 + Math.floor(h.forage / 3)));

/** Where bee `i` of hive `h` is at time `t` (seconds): a loop out to ~2.5 blocks and back, bobbing. */
export function beeAt(h: BuzzingHive, i: number, t: number): { x: number; y: number; z: number } {
  const seed = (h.x * 73856093) ^ (h.z * 19349663) ^ (i * 83492791);
  const phase = ((seed >>> 0) % 1000) / 1000;
  const speed = 0.35 + (((seed >>> 10) % 100) / 100) * 0.3;
  const a = (t * speed + phase) * Math.PI * 2;
  const reach = 1.2 + (((seed >>> 4) % 100) / 100) * 1.4;
  // A petal loop: out and back twice per turn, the direction turning slowly.
  const r = reach * Math.abs(Math.sin(a));
  const dir = a * 0.5 + phase * 6.28;
  return {
    x: h.x + 0.5 + Math.cos(dir) * r + Math.sin(t * 9 + i) * 0.05,
    y: h.y + 0.6 + 0.45 * Math.sin(a * 1.7 + i) + Math.sin(t * 13 + i * 2) * 0.04,
    z: h.z + 0.5 + Math.sin(dir) * r + Math.cos(t * 11 + i) * 0.05,
  };
}

/** The particles of one hive's bees at time `t` (a yellow body, a dark tail beside it). */
export function hiveParticles(h: BuzzingHive, t: number, dt: number): ParticleSpec[] {
  const life = Math.max(0.05, dt * 1.6);
  const out: ParticleSpec[] = [];
  const n = beesOf(h);
  for (let i = 0; i < n; i++) {
    const p = beeAt(h, i, t);
    out.push({ ...base, x: p.x, y: p.y, z: p.z, life });
    out.push({ ...base, x: p.x + 0.04, y: p.y, z: p.z + 0.03, life, size: 0.05, sizeEnd: 0.05, r: 0.12, g: 0.09, b: 0.06, r2: 0.12, g2: 0.09, b2: 0.06 });
  }
  return out;
}

export class BeeFx {
  private t = 0;

  constructor(private readonly spawn: (p: ParticleSpec) => void) {}

  update(dt: number, hives: readonly BuzzingHive[], px: number, pz: number): void {
    if (dt <= 0) return;
    this.t += dt;
    const r2 = BEE_DRAW_R * BEE_DRAW_R;
    for (const h of hives) {
      if ((h.x - px) ** 2 + (h.z - pz) ** 2 > r2) continue;
      for (const p of hiveParticles(h, this.t, dt)) this.spawn(p);
    }
  }
}
