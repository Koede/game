/** Loose leaves drifting down from the trees around the player while the leaves are turning (src/render/seasonTint.ts). */
import { block } from '../core/registry';
import type { IWorld } from '../core/types';
import { ParticleLook, type ParticleSpec } from './particles';

/** Scan radius around the player and how high above the ground a crown is searched for. */
const RADIUS = 14;
const CROWN = 14;
/** Tries per second at full leaf fall; each finds a crown above a random column or nothing. */
const TRIES_PER_S = 28;

export class SeasonFx {
  private acc = 0;
  private readonly oak = block('oak_leaves').id;
  constructor(
    private readonly world: Pick<IWorld, 'getBlock' | 'surfaceY' | 'isLoaded'>,
    private readonly spawn: (p: ParticleSpec) => void,
    private readonly rng: () => number = Math.random,
  ) {}

  update(dt: number, fall: number, px: number, py: number, pz: number): void {
    if (dt <= 0 || fall <= 0) return;
    this.acc += dt * TRIES_PER_S * fall;
    let n = Math.min(6, Math.floor(this.acc));
    this.acc -= Math.floor(this.acc);
    while (n-- > 0) {
      const x = Math.floor(px + (this.rng() * 2 - 1) * RADIUS);
      const z = Math.floor(pz + (this.rng() * 2 - 1) * RADIUS);
      if (!this.world.isLoaded(x, z)) continue;
      const top = Math.min(Math.floor(py) + CROWN, this.world.surfaceY(x, z) + CROWN);
      for (let y = top; y > top - CROWN; y--) {
        if (this.world.getBlock(x, y, z).id !== this.oak) continue;
        if (this.world.getBlock(x, y - 1, z).id === this.oak) continue; // only the underside of a crown sheds
        const warm = this.rng();
        this.spawn({
          x: x + this.rng(), y: y - 0.05, z: z + this.rng(), vx: (this.rng() - 0.3) * 0.8, vy: -0.3, vz: (this.rng() - 0.5) * 0.8,
          life: 4 + this.rng() * 3, size: 0.12, sizeEnd: 0.1, r: 0.85 + warm * 0.15, g: 0.35 + warm * 0.35, b: 0.08, r2: 0.55, g2: 0.3, b2: 0.08,
          alpha: 0.95, gravity: 0.5, drag: 1.6, look: ParticleLook.Chip, fog: 1,
        });
        break;
      }
    }
  }
}
