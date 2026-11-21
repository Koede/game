/**
 * Spark, smoke and arc helpers for the automatons' effects (spec 19.5): each call spawns into a Particles pool with a
 * shared scratch spec (no allocation). Colours are display space 0..1; chips are hard square sparks, puffs soft smoke.
 */
import { Particles, ParticleLook, type ParticleSpec } from '../particles';

const spec: ParticleSpec = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.05,
  r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Chip, fog: 0.3,
};

const rnd = (): number => Math.random();

// Chips right in front of the camera would fill the screen (a point's size grows as 1/distance): they are scaled down
// inside NEAR blocks of the eye.
const eye = { x: 0, y: 0, z: 0 };
const NEAR = 6;
export function setSparkEye(x: number, y: number, z: number): void {
  eye.x = x;
  eye.y = y;
  eye.z = z;
}
const near = (x: number, y: number, z: number): number => Math.min(1, Math.max(0.25, Math.hypot(x - eye.x, y - eye.y, z - eye.z) / NEAR));
const spread = (): number => rnd() * 2 - 1;

/** One glowing ember chip: orange-white cooling to dull red. */
export function emberSpark(p: Particles, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size = 0.07): void {
  spec.x = x; spec.y = y; spec.z = z; spec.vx = vx; spec.vy = vy; spec.vz = vz;
  spec.life = life; spec.size = size * near(x, y, z); spec.sizeEnd = spec.size * 0.35;
  // Colour settles within the first fifth of a particle's life (particles.ts), so the second colour is the one seen.
  spec.r = 1; spec.g = 0.85; spec.b = 0.5;
  spec.r2 = 1; spec.g2 = 0.42 + rnd() * 0.2; spec.b2 = 0.1;
  spec.alpha = 1; spec.gravity = 7; spec.drag = 0.6; spec.look = ParticleLook.Chip; spec.fog = 0.25;
  p.spawn(spec);
}

/** One blue-white arc chip (a drone's crackle): no gravity, gone in a blink. */
export function arcSpark(p: Particles, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size = 0.075): void {
  spec.x = x; spec.y = y; spec.z = z; spec.vx = vx; spec.vy = vy; spec.vz = vz;
  spec.life = life; spec.size = size * near(x, y, z); spec.sizeEnd = spec.size * 0.5;
  spec.r = 0.9; spec.g = 1; spec.b = 1;
  spec.r2 = 0.45; spec.g2 = 0.78; spec.b2 = 1;
  spec.alpha = 1; spec.gravity = 0; spec.drag = 2; spec.look = ParticleLook.Chip; spec.fog = 0.2;
  p.spawn(spec);
}

/** A soot puff that rises and spreads, lit orange at birth by the vent it leaves. */
export function smokePuff(p: Particles, x: number, y: number, z: number, vx: number, vz: number, size: number, alpha = 0.32): void {
  spec.x = x; spec.y = y; spec.z = z; spec.vx = vx; spec.vy = 0.7 + rnd() * 0.5; spec.vz = vz;
  spec.life = 1.2 + rnd() * 0.6; spec.size = size * 0.5; spec.sizeEnd = size * 1.6;
  spec.r = 0.95; spec.g = 0.5; spec.b = 0.2;
  spec.r2 = 0.2; spec.g2 = 0.19; spec.b2 = 0.18;
  spec.alpha = alpha; spec.gravity = -0.35; spec.drag = 0.7; spec.look = ParticleLook.Puff; spec.fog = 0.2;
  p.spawn(spec);
}

/** A grey dust puff low on the ground (a hammer or a slam landing). */
export function dustPuff(p: Particles, x: number, y: number, z: number, vx: number, vz: number, size: number): void {
  spec.x = x; spec.y = y; spec.z = z; spec.vx = vx; spec.vy = 0.5 + rnd() * 0.6; spec.vz = vz;
  spec.life = 0.7 + rnd() * 0.4; spec.size = size * 0.5; spec.sizeEnd = size * 1.5;
  spec.r = 0.55; spec.g = 0.5; spec.b = 0.45;
  spec.r2 = 0.35; spec.g2 = 0.33; spec.b2 = 0.31;
  spec.alpha = 0.4; spec.gravity = 0.2; spec.drag = 2.2; spec.look = ParticleLook.Puff; spec.fog = 0.3;
  p.spawn(spec);
}

/** `n` ember sparks flying out in every direction (up-biased) at about `speed` blocks per second. */
export function sparkBurst(p: Particles, x: number, y: number, z: number, n: number, speed: number, arc = false): void {
  for (let i = 0; i < n; i++) {
    const vx = spread();
    const vy = rnd() * 1.2 - 0.1;
    const vz = spread();
    const k = (speed * (0.45 + rnd() * 0.75)) / Math.max(0.3, Math.hypot(vx, vy, vz));
    if (arc) arcSpark(p, x, y, z, vx * k, vy * k, vz * k, 0.18 + rnd() * 0.18);
    else emberSpark(p, x, y, z, vx * k, vy * k + 1.2, vz * k, 0.4 + rnd() * 0.5);
  }
}

/** A jagged line of arc chips from a to b (the drone's zap): `n` points, each jittered sideways. */
export function arcLine(p: Particles, ax: number, ay: number, az: number, bx: number, by: number, bz: number, n: number): void {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const j = Math.min(0.35, len * 0.07);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const e = i === 0 || i === n ? 0 : 1;
    arcSpark(p, ax + (bx - ax) * t + spread() * j * e, ay + (by - ay) * t + spread() * j * e, az + (bz - az) * t + spread() * j * e, spread() * 0.6, spread() * 0.6, spread() * 0.6, 0.12 + rnd() * 0.1, 0.1);
  }
}
