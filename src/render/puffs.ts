/**
 * Particle recipes: how each kind of puff and spark looks and moves. Each fills a reusable ParticleSpec in
 * place (no allocation), with a little randomness so no two are alike.
 */
import { ParticleLook, type ParticleSpec } from './particles';

export type PuffKind = 'smoke' | 'steam' | 'exhaust' | 'star' | 'blast';

const rnd = Math.random;
const spread = (s: number): number => (rnd() * 2 - 1) * s;

/** Fills `p` with one puff of `kind` rising from (x, y, z). `day` is 0 at night .. 1 by day. */
export function shapePuff(p: ParticleSpec, kind: PuffKind, x: number, y: number, z: number, day: number, jitter: number): void {
  p.look = ParticleLook.Puff;
  p.x = x + spread(0.18);
  p.y = y + rnd() * 0.1;
  p.z = z + spread(0.18);
  p.vx = spread(0.25);
  p.vz = spread(0.25);
  if (kind === 'smoke') {
    // Lit from below by the fire at first, then soot.
    p.vy = 1.4 + rnd() * 0.5;
    p.r = 0.78 - day * 0.2; p.g = 0.46 + day * 0.02; p.b = 0.26 + day * 0.12;
    // Soot: dark against a bright sky, a lighter grey at night so the column still shows.
    const grey = 0.3 + day * 0.04 + jitter;
    p.r2 = grey; p.g2 = grey * 0.98; p.b2 = grey * 1.04 + 0.02;
    p.size = 0.8; p.sizeEnd = 4 + rnd() * 1.4;
    p.life = 7 + rnd() * 3; p.alpha = 0.45 + day * 0.2;
    p.gravity = -0.05; p.drag = 0.1; p.fog = 0.25;
  } else if (kind === 'steam') {
    p.vy = 1.6 + rnd() * 0.6;
    const w = 0.55 + day * 0.4;
    p.r = p.r2 = w; p.g = p.g2 = w; p.b = p.b2 = w * 1.04;
    p.size = 0.3; p.sizeEnd = 1.5;
    p.life = 1.6 + rnd(); p.alpha = 0.5;
    p.gravity = -0.2; p.drag = 0.5; p.fog = 0.8;
  } else if (kind === 'exhaust') {
    p.vy = 1.2 + rnd() * 0.4;
    const g = 0.12 + day * 0.18;
    p.r = p.r2 = g; p.g = p.g2 = g; p.b = p.b2 = g * 1.05;
    p.size = 0.35; p.sizeEnd = 2;
    p.life = 3 + rnd(); p.alpha = 0.5;
    p.gravity = -0.05; p.drag = 0.2; p.fog = 0.6;
  } else if (kind === 'star') {
    p.vy = 0.8 + rnd() * 1.2;
    p.vx = spread(0.8); p.vz = spread(0.8);
    p.r = 1; p.g = 0.92; p.b = 0.55; p.r2 = 1; p.g2 = 0.7; p.b2 = 0.25;
    p.size = 0.35; p.sizeEnd = 0.1;
    p.life = 2 + rnd() * 1.5; p.alpha = 0.95;
    p.gravity = -0.3; p.drag = 0.3; p.fog = 0.3;
  } else {
    p.x = x + spread(1.5); p.y = y + spread(1.5); p.z = z + spread(1.5);
    p.vx = spread(2.5); p.vy = 1 + rnd() * 2.5; p.vz = spread(2.5);
    p.r = 1; p.g = 0.62; p.b = 0.25;
    const g = 0.2 + day * 0.25;
    p.r2 = g; p.g2 = g; p.b2 = g;
    p.size = 1.4; p.sizeEnd = 5 + rnd() * 2;
    p.life = 3 + rnd() * 2; p.alpha = 0.75;
    p.gravity = -0.2; p.drag = 0.9; p.fog = 0.5;
  }
}

/** Fills `p` with one spark: a bright chip that cools from yellow to red as it falls (gold for the Starhearth). */
export function shapeSpark(p: ParticleSpec, x: number, y: number, z: number, vx: number, vy: number, vz: number, gold: boolean): void {
  p.x = x;
  p.y = y;
  p.z = z;
  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.r = 1;
  p.g = gold ? 0.92 : 0.85;
  p.b = gold ? 0.55 : 0.35;
  p.r2 = gold ? 1 : 0.9;
  p.g2 = gold ? 0.6 : 0.25;
  p.b2 = gold ? 0.15 : 0.05;
  p.size = 0.06 + rnd() * 0.04;
  p.sizeEnd = 0.03;
  p.life = 0.45 + rnd() * 0.6;
  p.alpha = 1;
  p.gravity = 9;
  p.drag = 0.9;
  p.look = ParticleLook.Chip;
  p.fog = 0.6;
}
