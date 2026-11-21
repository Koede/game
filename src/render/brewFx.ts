/**
 * Brewing's particles (BREWING_PLAN 6): steam wisps over a boiling bucket, over a boiling kettle and over a finished
 * cup while it is hot (the sim's `steamS`), and drips (1-pixel particles) falling from the cone into the cup while it
 * brews. It reads the brewing block entities twice a second into a fixed pool of sources, so nothing is allocated per
 * frame; the particles themselves are the renderer's shared Particles pool. Draws nothing itself.
 */
import { BOIL_BUCKET_MACHINE, BREW_CUP_MACHINE, KETTLE_MACHINE } from '../core/brewing';
import { itemOrNull } from '../core/registry';
import { voxelActive, type IWorld } from '../core/types';
import { CUP_RIM_Y } from '../world/meshCup';
import { ParticleLook, type ParticleSpec, type Particles } from './particles';
import { shapePuff } from './puffs';

export const BREW_FX_RANGE = 48;
/** Capacity of the source pool: more brewing blocks than this in range simply do not all show. */
export const BREW_SOURCES = 48;
const SCAN_INTERVAL_S = 0.5;

export type BrewSourceKind = 'bucket' | 'kettle' | 'cup' | 'drip';
/** Puffs (or drips) per second of each kind. */
const RATE: Readonly<Record<BrewSourceKind, number>> = { bucket: 4, kettle: 3, cup: 1.8, drip: 9 };
/** Where above the cell's floor the particles start, in blocks. */
const HEIGHT: Readonly<Record<BrewSourceKind, number>> = { bucket: 0.55, kettle: 0.66, cup: 0.7, drip: CUP_RIM_Y + 0.18 };

interface Source {
  x: number;
  y: number;
  z: number;
  kind: BrewSourceKind;
  carry: number;
  /** Tint of a drip (0..1 per channel). */
  r: number;
  g: number;
  b: number;
}

const rnd = Math.random;
const spread = (s: number): number => (rnd() * 2 - 1) * s;

export class BrewFx {
  private readonly sources: Source[] = Array.from({ length: BREW_SOURCES }, () => ({ x: 0, y: 0, z: 0, kind: 'bucket' as BrewSourceKind, carry: 0, r: 0.5, g: 0.5, b: 0.5 }));
  private count = 0;
  private scanTimer = 0;
  private readonly spec: ParticleSpec = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.1,
    r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Puff, fog: 1,
  };
  /** 0 at night .. 1 by day (steam is whiter by day). */
  day = 1;

  constructor(private readonly world: IWorld, private readonly particles: Particles) {}

  /** Sources in range at the last scan (for stats and tests). */
  get activeSources(): number {
    return this.count;
  }

  update(dt: number, camX: number, camZ: number): void {
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = SCAN_INTERVAL_S;
      this.scan(camX, camZ);
    }
    for (let i = 0; i < this.count; i++) {
      const s = this.sources[i];
      s.carry += RATE[s.kind] * dt;
      while (s.carry >= 1) {
        s.carry -= 1;
        if (s.kind === 'drip') this.drip(s);
        else this.wisp(s);
      }
    }
  }

  /** Steam from a bucket is a full wisp; a cup's is a thinner, smaller one. */
  private wisp(s: Source): void {
    const p = this.spec;
    shapePuff(p, 'steam', s.x, s.y, s.z, this.day, 0);
    const small = s.kind === 'cup';
    p.size = small ? 0.16 : 0.26;
    p.sizeEnd = small ? 0.7 : 1.1;
    p.alpha = small ? 0.4 : 0.5;
    p.life = small ? 1.1 + rnd() * 0.5 : 1.3 + rnd() * 0.7;
    p.vy = small ? 0.7 + rnd() * 0.3 : 1 + rnd() * 0.4;
    p.x = s.x + spread(small ? 0.06 : 0.16);
    p.z = s.z + spread(small ? 0.06 : 0.16);
    this.particles.spawn(p);
  }

  private drip(s: Source): void {
    const p = this.spec;
    // A ring just inside the cup's rim, round the cone's spout.
    const a = rnd() * Math.PI * 2;
    p.x = s.x + Math.cos(a) * 0.17;
    p.z = s.z + Math.sin(a) * 0.17;
    p.y = s.y;
    p.vx = p.vz = 0;
    p.vy = 0;
    p.r = p.r2 = s.r;
    p.g = p.g2 = s.g;
    p.b = p.b2 = s.b;
    p.size = 0.045;
    p.sizeEnd = 0.04;
    p.life = 0.2;
    p.alpha = 1;
    p.gravity = 9;
    p.drag = 0;
    p.look = ParticleLook.Chip;
    p.fog = 1;
    this.particles.spawn(p);
  }

  private scan(camX: number, camZ: number): void {
    let n = 0;
    for (const e of this.world.entities()) {
      if (n >= BREW_SOURCES) break;
      let kind: BrewSourceKind | null = null;
      if (e.kind === BOIL_BUCKET_MACHINE) kind = e.boiling === true ? 'bucket' : null;
      else if (e.kind === KETTLE_MACHINE) kind = voxelActive(this.world.getVoxel(e.x, e.y, e.z)) ? 'kettle' : null;
      else if (e.kind === BREW_CUP_MACHINE) kind = e.stage === 'brewing' ? 'drip' : e.stage === 'done' && typeof e.steamS === 'number' && e.steamS > 0 ? 'cup' : null;
      if (!kind) continue;
      const dx = e.x + 0.5 - camX;
      const dz = e.z + 0.5 - camZ;
      if (dx * dx + dz * dz > BREW_FX_RANGE * BREW_FX_RANGE) continue;
      const s = this.sources[n++];
      if (s.x !== e.x + 0.5 || s.y !== e.y + HEIGHT[kind] || s.z !== e.z + 0.5 || s.kind !== kind) s.carry = rnd();
      s.x = e.x + 0.5;
      s.y = e.y + HEIGHT[kind];
      s.z = e.z + 0.5;
      s.kind = kind;
      if (kind === 'drip') this.tint(s, e.drink);
    }
    this.count = n;
  }

  /** A drip is the colour of the drink it makes, brightened a little so a 1-pixel speck reads. */
  private tint(s: Source, drink: unknown): void {
    const c = typeof drink === 'string' ? itemOrNull(drink)?.drink?.colour : undefined;
    const v = c ?? 0x6b4423;
    s.r = Math.min(1, ((v >> 16) & 255) / 255 + 0.12);
    s.g = Math.min(1, ((v >> 8) & 255) / 255 + 0.12);
    s.b = Math.min(1, (v & 255) / 255 + 0.12);
  }
}
