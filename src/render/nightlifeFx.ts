/** Draws the ambient night critters (src/sim/nightlife.ts) as short-lived light particles, re-spawned every frame. */
import type { Critter } from '../sim/nightlife';
import { ParticleLook, type ParticleSpec } from './particles';

const base: ParticleSpec = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.1, size: 0.1, sizeEnd: 0.1, r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1,
  gravity: 0, drag: 0, look: ParticleLook.Puff, fog: 1,
};

/** The particles one critter makes this frame (a firefly: one glowing puff; a bat: a dark chip; an owl: a pair of eyes). */
export function critterParticles(c: Critter, dt: number): ParticleSpec[] {
  const life = Math.max(0.05, dt * 1.6);
  if (c.kind === 'firefly') {
    if (c.glow < 0.15) return [];
    return [{ ...base, x: c.x, y: c.y, z: c.z, life, size: 0.12 + c.glow * 0.1, sizeEnd: 0.1, r: 0.85, g: 1, b: 0.35, r2: 0.6, g2: 0.9, b2: 0.2, alpha: 0.35 + c.glow * 0.6, look: ParticleLook.Puff, fog: 0.6 }];
  }
  if (c.kind === 'bat') {
    return [{ ...base, x: c.x, y: c.y, z: c.z, life, size: 0.28, sizeEnd: 0.28, r: 0.08, g: 0.07, b: 0.1, r2: 0.08, g2: 0.07, b2: 0.1, alpha: 0.95, look: ParticleLook.Chip, fog: 1 }];
  }
  if (c.glow <= 0) return [];
  return [-0.14, 0.14].map((dx) => ({ ...base, x: c.x + dx, y: c.y, z: c.z, life, size: 0.07, sizeEnd: 0.07, r: 1, g: 0.85, b: 0.3, r2: 1, g2: 0.85, b2: 0.3, alpha: 0.95, look: ParticleLook.Puff, fog: 0.5 }));
}

export class NightlifeFx {
  constructor(private readonly spawn: (p: ParticleSpec) => void) {}

  update(dt: number, list: readonly Critter[]): void {
    if (dt <= 0) return;
    for (const c of list) for (const p of critterParticles(c, dt)) this.spawn(p);
  }
}
