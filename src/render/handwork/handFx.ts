/**
 * The particles of the hand stations: sparks off the anvil, wood chips off the chopping block, flour and ore dust at
 * the quern and mortar, a puff when a job finishes. Driven by the stroke events; nothing runs on its own.
 */
import { ParticleLook, type ParticleSpec, type Particles } from '../particles';
import { shapePuff, shapeSpark } from '../puffs';

const rnd = Math.random;
const spread = (s: number): number => (rnd() * 2 - 1) * s;

function newSpec(): ParticleSpec {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.1, r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 9, drag: 0.5, look: ParticleLook.Chip, fog: 1 };
}

/** Where on the block a station's work happens (above the cell's floor), and its colour of dust. */
const WORK_Y: Readonly<Record<string, number>> = {
  chopping_block: 0.75, chopping_block_pine: 0.75, hand_quern: 0.62, stone_anvil: 0.8, mortar: 0.55, clay_table: 0.85, loom: 0.5,
};
const DUST: Readonly<Record<string, readonly [number, number, number]>> = {
  hand_quern: [0.95, 0.92, 0.82], mortar: [0.55, 0.48, 0.42], chopping_block: [0.8, 0.6, 0.36], chopping_block_pine: [0.85, 0.7, 0.45],
};

export class HandFx {
  private readonly spec = newSpec();

  constructor(private readonly particles: Particles) {}

  /** A counted stroke at the station block (x, y, z); `strong` when it counted double. */
  stroke(station: string, x: number, y: number, z: number, strong: boolean): void {
    const cx = x + 0.5;
    const cz = z + 0.5;
    const cy = y + (WORK_Y[station] ?? 0.7);
    if (station === 'stone_anvil') {
      const n = strong ? 9 : 5;
      for (let i = 0; i < n; i++) {
        shapeSpark(this.spec, cx + spread(0.12), cy, cz + spread(0.1), spread(1.8), 1.2 + rnd() * 2, spread(1.4), false);
        this.particles.spawn(this.spec);
      }
      return;
    }
    const dust = DUST[station];
    if (!dust) return;
    if (station === 'chopping_block' || station === 'chopping_block_pine') {
      for (let i = 0; i < 6; i++) this.chip(cx + spread(0.15), cy + 0.2, cz + spread(0.2), dust);
      return;
    }
    for (let i = 0; i < 3; i++) this.dust(cx + spread(0.15), cy, cz + spread(0.15), dust);
  }

  /** A finished job: a soft puff over the station. */
  done(x: number, y: number, z: number): void {
    for (let i = 0; i < 4; i++) {
      shapePuff(this.spec, 'steam', x + 0.5, y + 0.8, z + 0.5, 1, 0);
      this.spec.size = 0.2;
      this.spec.sizeEnd = 0.7;
      this.spec.life = 0.8 + rnd() * 0.4;
      this.spec.alpha = 0.35;
      this.particles.spawn(this.spec);
    }
  }

  private chip(x: number, y: number, z: number, c: readonly [number, number, number]): void {
    const p = this.spec;
    p.x = x; p.y = y; p.z = z;
    p.vx = spread(1.6); p.vy = 1.5 + rnd() * 1.8; p.vz = spread(1.6);
    p.r = p.r2 = c[0]; p.g = p.g2 = c[1]; p.b = p.b2 = c[2];
    p.size = 0.07 + rnd() * 0.03; p.sizeEnd = 0.05;
    p.life = 0.5 + rnd() * 0.3; p.alpha = 1;
    p.gravity = 12; p.drag = 0.4; p.look = ParticleLook.Chip; p.fog = 1;
    this.particles.spawn(p);
  }

  private dust(x: number, y: number, z: number, c: readonly [number, number, number]): void {
    const p = this.spec;
    p.x = x; p.y = y; p.z = z;
    p.vx = spread(0.3); p.vy = 0.5 + rnd() * 0.5; p.vz = spread(0.3);
    p.r = p.r2 = c[0]; p.g = p.g2 = c[1]; p.b = p.b2 = c[2];
    p.size = 0.12; p.sizeEnd = 0.4;
    p.life = 0.6 + rnd() * 0.4; p.alpha = 0.5;
    p.gravity = -0.1; p.drag = 0.9; p.look = ParticleLook.Puff; p.fog = 0.8;
    this.particles.spawn(p);
  }
}
