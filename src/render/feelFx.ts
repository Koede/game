/**
 * Small, capped particle bursts that give actions a visible answer: a splash, a dust puff, hearts, a sparkle, a hit spark.
 * Anything may request one with the 'fx:burst' event (see gameEvents.ts); this file only decides what each kind looks like.
 * Counts are capped per event so a crowd of them stays inside the particle budget, and reduced motion drops them to a token few.
 */
import type { GameBus } from '../core/context';
import { prefersReducedMotion } from '../core/context';
import type { FxKind } from '../core/gameEvents';
import { ParticleLook, type ParticleSpec, type Particles } from './particles';
import { shapePuff } from './puffs';

/** Most particles one 'fx:burst' makes. */
export const FX_MAX = 24;
const rnd = Math.random;
const spread = (s: number): number => (rnd() * 2 - 1) * s;

/** Default particle counts per kind. */
const DEFAULT_COUNT: Readonly<Record<FxKind, number>> = {
  splash: 14, dust: 6, snow: 8, hearts: 5, sparkle: 8, steam: 4, poof: 5, hit: 7, glow: 6, bobber: 1, bobber_dip: 1, ripple: 6,
};

export class FeelFx {
  private readonly spec: ParticleSpec = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.1,
    r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Chip, fog: 1,
  };
  private readonly off: () => void;

  constructor(bus: GameBus, private readonly particles: Particles, private readonly reduced: () => boolean = prefersReducedMotion) {
    this.off = bus.on('fx:burst', (e) => this.burst(e.kind, e.x, e.y, e.z, e.count));
  }

  dispose(): void {
    this.off();
  }

  /** `count` defaults per kind and is capped at FX_MAX; reduced motion keeps at most two particles (the cue is still there). */
  burst(kind: FxKind, x: number, y: number, z: number, count?: number): void {
    let n = Math.min(FX_MAX, Math.max(0, Math.round(count ?? DEFAULT_COUNT[kind])));
    if (this.reduced() && kind !== 'bobber' && kind !== 'bobber_dip') n = Math.min(n, 2);
    for (let i = 0; i < n; i++) this.one(kind, x, y, z);
  }

  private set(life: number, size: number, sizeEnd: number, alpha: number, gravity: number, drag: number, look: ParticleLook, fog = 1): void {
    const p = this.spec;
    p.life = life; p.size = size; p.sizeEnd = sizeEnd; p.alpha = alpha; p.gravity = gravity; p.drag = drag; p.look = look; p.fog = fog;
  }

  private colour(r: number, g: number, b: number, r2 = r, g2 = g, b2 = b): void {
    const p = this.spec;
    p.r = r; p.g = g; p.b = b; p.r2 = r2; p.g2 = g2; p.b2 = b2;
  }

  private one(kind: FxKind, x: number, y: number, z: number): void {
    const p = this.spec;
    p.x = x + spread(0.2); p.y = y; p.z = z + spread(0.2);
    p.vx = spread(0.4); p.vy = 0; p.vz = spread(0.4);
    switch (kind) {
      case 'splash': {
        const a = rnd() * Math.PI * 2;
        const s = 0.8 + rnd() * 1.6;
        p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 2.4 + rnd() * 2.2;
        this.colour(0.75, 0.88, 1, 0.5, 0.7, 0.95);
        this.set(0.6 + rnd() * 0.3, 0.09 + rnd() * 0.05, 0.05, 0.9, 12, 0.3, ParticleLook.Chip);
        break;
      }
      case 'ripple': {
        const a = rnd() * Math.PI * 2;
        p.vx = Math.cos(a) * 0.7; p.vz = Math.sin(a) * 0.7; p.vy = 0;
        this.colour(0.85, 0.95, 1, 0.6, 0.8, 1);
        this.set(0.7, 0.08, 0.04, 0.7, 0, 1.2, ParticleLook.Chip);
        break;
      }
      case 'dust': {
        p.vx = spread(1.2); p.vz = spread(1.2); p.vy = 0.3 + rnd() * 0.6;
        this.colour(0.62, 0.55, 0.42, 0.5, 0.46, 0.38);
        this.set(0.5 + rnd() * 0.3, 0.12, 0.45, 0.45, -0.1, 2.2, ParticleLook.Puff, 0.8);
        break;
      }
      case 'snow': {
        p.vx = spread(1.4); p.vz = spread(1.4); p.vy = 0.8 + rnd() * 1.2;
        this.colour(0.95, 0.97, 1, 0.85, 0.9, 1);
        this.set(0.5 + rnd() * 0.3, 0.07, 0.04, 0.9, 7, 0.8, ParticleLook.Chip);
        break;
      }
      case 'hearts': {
        p.vx = spread(0.5); p.vz = spread(0.5); p.vy = 0.9 + rnd() * 0.5;
        this.colour(1, 0.4, 0.55, 1, 0.55, 0.65);
        this.set(1 + rnd() * 0.5, 0.2, 0.12, 1, -0.3, 0.8, ParticleLook.Chip);
        break;
      }
      case 'sparkle': {
        p.vx = spread(0.35); p.vz = spread(0.35); p.vy = 0.5 + rnd() * 0.8;
        this.colour(1, 0.95, 0.5, 1, 0.8, 0.3);
        this.set(0.8 + rnd() * 0.5, 0.09, 0.03, 1, -0.4, 0.7, ParticleLook.Chip);
        break;
      }
      case 'glow': {
        p.vx = spread(0.8); p.vz = spread(0.8); p.vy = 0.6 + rnd() * 1.2;
        this.colour(0.7, 0.9, 1, 0.4, 0.6, 1);
        this.set(0.9, 0.12, 0.04, 0.95, -0.6, 0.6, ParticleLook.Chip);
        break;
      }
      case 'hit': {
        const a = rnd() * Math.PI * 2;
        const s = 1.2 + rnd() * 2;
        p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 1 + rnd() * 2.4;
        this.colour(1, 0.9, 0.7, 0.9, 0.3, 0.2);
        this.set(0.3 + rnd() * 0.2, 0.08, 0.03, 1, 14, 1, ParticleLook.Chip);
        break;
      }
      case 'bobber': case 'bobber_dip': {
        // A small red float that sits on the surface for a moment; it is re-sent while the line waits, and dips low on a bite.
        p.x = x; p.z = z; p.vx = 0; p.vz = 0; p.vy = 0;
        p.y = kind === 'bobber_dip' ? y - 0.12 : y;
        this.colour(0.95, 0.18, 0.12);
        this.set(kind === 'bobber_dip' ? 0.5 : 1.3, 0.16, 0.16, 1, 0, 0, ParticleLook.Chip);
        break;
      }
      default: {
        // 'steam' and 'poof': the shared soft puffs.
        shapePuff(p, 'steam', x, y, z, 1, 0);
        if (kind === 'poof') { this.colour(0.95, 0.95, 0.95, 0.75, 0.75, 0.78); p.size = 0.2; p.sizeEnd = 0.9; p.life = 0.8; p.vy = 0.5; }
        break;
      }
    }
    this.particles.spawn(p);
  }
}
