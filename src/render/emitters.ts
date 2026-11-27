/**
 * Decides where particles come from: block debris when mining and breaking, smoke from every hot
 * fuel-burning furnace (so a base is visible from afar), sparks from the bellows and the forge, steam from
 * running machines, and the burst of an explosion. Listens to the bus; draws nothing itself.
 */
import { FURNACE_HOT_C } from '../core/constants';
import type { GameBus } from '../core/context';
import { hashFloat } from '../core/math';
import { blockOf, TEXTURE_NAMES } from '../core/registry';
import type { LegendaryEffect } from '../core/types';
import { Face, FACE_DIRS, FACING_TO_FACE, voxelActive, voxelFacing, type BlockDef, type IWorld, type Voxel } from '../core/types';
import type { Glows } from './glows';
import { ParticleLook, type ParticleSpec, type Particles } from './particles';
import { shapePuff, shapeSpark, type PuffKind } from './puffs';
import { hearthOpenTop } from './tech/hearthInfo';
import { tileColor } from './tiles';

/** Colour of the light at a point, 0..1 per channel, written into `out` (supplied by the renderer). */
export type LightProbe = (x: number, y: number, z: number, out: Float32Array) => Float32Array;

interface Source {
  x: number;
  y: number;
  z: number;
  /** Particles per second (0 = none, e.g. an electrically heated furnace glows but does not smoke). */
  rate: number;
  kind: 'smoke' | 'steam' | 'exhaust' | 'star';
  carry: number;
  /** Furnaces: tier (1-5) for the halo in front of the mouth, 0 for no halo; dx/dz point out of the mouth. */
  glowTier: number;
  dx: number;
  dz: number;
}

/** Halo colour per furnace tier (additive): dull red clay, amber bronze, orange blast, white-yellow arc, violet plasma, gold star. */
const GLOW_COLORS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.17, 0.04],
  [0.55, 0.22, 0.04],
  [0.55, 0.26, 0.05],
  [0.5, 0.48, 0.38],
  [0.45, 0.32, 0.55],
  [0.62, 0.5, 0.18],
];

const SCAN_INTERVAL_S = 0.5;
/** Colour (0..1 RGB) of each weapon's swing trail. */
const TRAIL_COLOUR: Readonly<Record<LegendaryEffect, readonly [number, number, number]>> = {
  burning_marks: [1, 0.45, 0.12],
  lunge: [0.75, 0.95, 0.9],
  lantern_burst: [1, 0.85, 0.45],
  still_blow: [0.55, 0.55, 0.6],
  pull: [0.45, 0.8, 1],
  root: [0.5, 1, 0.5],
  shock_arc: [0.8, 0.9, 1],
  veinseek: [0.9, 0.75, 0.4],
};
/** Sparks one legendary proc emits at most. */
export const PROC_SPARKS = 14;
/** Furnace smoke is emitted this far from the camera (horizontal blocks). */
const SMOKE_RANGE = 176;
const STEAM_RANGE = 64;
const STEAM_MACHINES = new Set(['steam_engine', 'still', 'geothermal_tap', 'fission_pile', 'electrolyzer']);
const EXHAUST_MACHINES = new Set(['combustion_engine', 'burner_generator']);

const rnd = Math.random;
const spread = (s: number): number => (rnd() * 2 - 1) * s;

export class Emitters {
  private readonly sources: Source[] = [];
  private sourceCount = 0;
  private scanTimer = 0;
  private readonly spec: ParticleSpec = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.1,
    r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Chip, fog: 1,
  };
  private readonly colorCache = new Map<number, [number, number, number][]>();
  private readonly lightRgb = new Float32Array(3);
  private readonly offs: (() => void)[];
  private camX = 0;
  private camY = 0;
  private camZ = 0;
  /** 0 at night .. 1 by day: smoke reads dark against a bright sky and ember-lit against a dark one. */
  day = 1;

  constructor(
    bus: GameBus,
    private readonly world: IWorld,
    private readonly particles: Particles,
    private readonly light: LightProbe,
  ) {
    this.offs = [
      bus.on('block:broken', (e) => this.debris(e.x, e.y, e.z, e.voxel, 18, 1)),
      bus.on('block:mining', (e) => {
        if (e.progress >= 0) this.chips(e.x, e.y, e.z);
      }),
      bus.on('block:placed', (e) => this.debris(e.x, e.y, e.z, e.voxel, 5, 0.4)),
      bus.on('furnace:pumped', (e) => this.bellows(e.x, e.y, e.z, e.draft)),
      bus.on('furnace:lit', (e) => this.bellows(e.x, e.y, e.z, 0.3)),
      bus.on('furnace:upgraded', (e) => this.burst(e.x + 0.5, e.y + 0.5, e.z + 0.5, 60, 1.6, false)),
      bus.on('furnace:ignition', (e) => {
        if (e.state === 'done') this.burst(e.x + 0.5, e.y + 0.5, e.z + 0.5, 220, 3.5, true);
      }),
      bus.on('item:made', (e) => {
        if (e.station === 'furnace') this.forgeSparks();
      }),
      bus.on('machine:job', (e) => this.puffs(e.x + 0.5, e.y + 1.05, e.z + 0.5, 'steam', 3)),
      bus.on('water:spray', (e) => this.spray(e.x, e.y, e.z)),
      bus.on('explosion', (e) => this.explosion(e.x + 0.5, e.y + 0.5, e.z + 0.5, e.radius)),
      bus.on('legendary:proc', (e) => this.legendaryProc(e.effect, e.x, e.y, e.z)),
      bus.on('legendary:swing', (e) => this.swingTrail(e.effect, e.x, e.y, e.z, e.yaw, e.pitch, e.count)),
    ];
  }

  /**
   * Emits continuous smoke and steam and lists the furnace halos; rescans the block entities twice a second.
   * Allocation-free per frame.
   */
  update(dt: number, camX: number, camY: number, camZ: number, glows: Glows, time: number): void {
    this.camX = camX;
    this.camY = camY;
    this.camZ = camZ;
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = SCAN_INTERVAL_S;
      this.scan();
    }
    glows.begin(time);
    const strength = 0.3 + 0.45 * (1 - this.day);
    for (let i = 0; i < this.sourceCount; i++) {
      const s = this.sources[i];
      s.carry += s.rate * dt;
      while (s.carry >= 1) {
        s.carry -= 1;
        this.puffs(s.x, s.y, s.z, s.kind, 1);
      }
      if (s.glowTier > 0) {
        const c = GLOW_COLORS[Math.min(GLOW_COLORS.length, s.glowTier) - 1];
        const k = strength * (s.kind === 'star' ? 1.4 : 1);
        glows.add(s.x + s.dx * 0.7, s.y - 0.66, s.z + s.dz * 0.7, 1.5 + s.glowTier * 0.35, c[0] * k, c[1] * k, c[2] * k);
      }
    }
    glows.end();
  }

  dispose(): void {
    for (const off of this.offs) off();
  }

  /** Number of active smoke/steam sources (for stats and tests). */
  get activeSources(): number {
    return this.sourceCount;
  }

  private scan(): void {
    let n = 0;
    for (const e of this.world.entities()) {
      const dx = e.x + 0.5 - this.camX;
      const dz = e.z + 0.5 - this.camZ;
      const d2 = dx * dx + dz * dz;
      let kind: Source['kind'] | null = null;
      let rate = 0;
      let glowTier = 0;
      if (e.kind === 'furnace') {
        if (d2 > SMOKE_RANGE * SMOKE_RANGE) continue;
        const tier = typeof e.tier === 'number' ? e.tier : 1;
        const temp = typeof e.tempC === 'number' ? e.tempC : 0;
        if (temp < FURNACE_HOT_C && e.ignited !== true) continue;
        glowTier = tier;
        if (e.ignited === true) {
          kind = 'star';
          rate = 10;
        } else {
          kind = 'smoke';
          const draft = typeof e.draft === 'number' ? e.draft : 0;
          rate = e.lit === true ? 5 + tier * 0.5 + draft * 4 : 0;
          // An open-topped hearth's smoke rises from its opening instead (src/render/tech/hearths.ts).
          if (hearthOpenTop(e)) rate = 0;
        }
      } else if (d2 <= STEAM_RANGE * STEAM_RANGE && voxelActive(this.world.getVoxel(e.x, e.y, e.z))) {
        if (STEAM_MACHINES.has(e.kind)) {
          kind = 'steam';
          rate = 3;
        } else if (EXHAUST_MACHINES.has(e.kind)) {
          kind = 'exhaust';
          rate = 2.5;
        }
      }
      if (!kind) continue;
      let s = this.sources[n];
      if (!s) {
        s = { x: 0, y: 0, z: 0, rate: 0, kind, carry: rnd(), glowTier: 0, dx: 0, dz: 0 };
        this.sources.push(s);
      }
      // Keep the carry of a source that stays at the same place so puffs do not bunch up every rescan.
      if (s.x !== e.x + 0.5 || s.y !== e.y + 1.02 || s.z !== e.z + 0.5) s.carry = rnd();
      s.x = e.x + 0.5;
      s.y = e.y + 1.02;
      s.z = e.z + 0.5;
      s.kind = kind;
      s.rate = rate;
      s.glowTier = glowTier;
      if (glowTier > 0) {
        const dir = FACE_DIRS[FACING_TO_FACE[voxelFacing(this.world.getVoxel(e.x, e.y, e.z))]];
        s.dx = dir[0];
        s.dz = dir[2];
      }
      n++;
    }
    this.sourceCount = n;
  }

  private colorsOf(v: Voxel): [number, number, number][] {
    const def = blockOf(v);
    let list = this.colorCache.get(def.id);
    if (!list) {
      list = [def.layers[Face.PX], def.layers[Face.PY], def.layers[Face.NZ]].map((layer) => {
        const c = tileColor(TEXTURE_NAMES[layer] ?? 'missing');
        return [c[0] / 255, c[1] / 255, c[2] / 255] as [number, number, number];
      });
      this.colorCache.set(def.id, list);
    }
    return list;
  }

  private debris(x: number, y: number, z: number, voxel: Voxel, count: number, speed: number): void {
    if (blockOf(voxel).shape === 'none') return;
    const colors = this.colorsOf(voxel);
    const light = this.light(x + 0.5, y + 0.5, z + 0.5, this.lightRgb);
    const p = this.spec;
    for (let i = 0; i < count; i++) {
      const c = colors[(rnd() * colors.length) | 0];
      const k = 0.8 + rnd() * 0.35;
      p.x = x + 0.15 + rnd() * 0.7;
      p.y = y + 0.15 + rnd() * 0.7;
      p.z = z + 0.15 + rnd() * 0.7;
      p.vx = spread(2.2) * speed;
      p.vy = (1.5 + rnd() * 3) * speed;
      p.vz = spread(2.2) * speed;
      this.chip(c[0] * light[0] * k, c[1] * light[1] * k, c[2] * light[2] * k, 0.07 + rnd() * 0.07, 0.45 + rnd() * 0.5);
    }
  }

  /** One puff of a sprinkler (twice a second): droplets thrown out in a ring that fall over the field around it. */
  private spray(x: number, y: number, z: number): void {
    const cx = x + 0.5;
    const cy = y + 0.6;
    const cz = z + 0.5;
    if (Math.abs(cx - this.camX) > STEAM_RANGE || Math.abs(cz - this.camZ) > STEAM_RANGE) return;
    const light = this.light(cx, cy, cz, this.lightRgb);
    const p = this.spec;
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const v = 1.6 + rnd() * 2.6;
      p.x = cx + Math.cos(a) * 0.2;
      p.y = cy;
      p.z = cz + Math.sin(a) * 0.2;
      p.vx = Math.cos(a) * v;
      p.vy = 2.4 + rnd() * 1.6;
      p.vz = Math.sin(a) * v;
      const k = 0.85 + rnd() * 0.3;
      this.chip(0.78 * light[0] * k + 0.1, 0.9 * light[1] * k + 0.1, light[2] * k + 0.12, 0.04 + rnd() * 0.035, 0.7 + rnd() * 0.5);
    }
  }

  /** A few chips flying off the face of the block being mined that looks at the camera. */
  private chips(x: number, y: number, z: number): void {
    const v = this.world.getVoxel(x, y, z);
    const def: BlockDef = blockOf(v);
    if (def.shape === 'none' || def.liquid) return;
    const colors = this.colorsOf(v);
    const light = this.light(x + 0.5, y + 0.5, z + 0.5, this.lightRgb);
    let dx = this.camX - (x + 0.5);
    let dy = this.camY - (y + 0.5);
    let dz = this.camZ - (z + 0.5);
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    const p = this.spec;
    for (let i = 0; i < 2; i++) {
      const c = colors[(rnd() * colors.length) | 0];
      p.x = x + 0.5 + dx * 0.55 + spread(0.3);
      p.y = y + 0.5 + dy * 0.55 + spread(0.3);
      p.z = z + 0.5 + dz * 0.55 + spread(0.3);
      p.vx = dx * 1.6 + spread(1.2);
      p.vy = 1.5 + rnd() * 1.5;
      p.vz = dz * 1.6 + spread(1.2);
      this.chip(c[0] * light[0], c[1] * light[1], c[2] * light[2], 0.05 + rnd() * 0.05, 0.35 + rnd() * 0.3);
    }
  }

  private chip(r: number, g: number, b: number, size: number, life: number): void {
    const p = this.spec;
    p.r = p.r2 = r;
    p.g = p.g2 = g;
    p.b = p.b2 = b;
    p.size = size;
    p.sizeEnd = size * 0.8;
    p.life = life;
    p.alpha = 1;
    p.gravity = 16;
    p.drag = 0.6;
    p.look = ParticleLook.Chip;
    p.fog = 1;
    this.particles.spawn(p);
  }

  private spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, gold: boolean): void {
    shapeSpark(this.spec, x, y, z, vx, vy, vz, gold);
    this.particles.spawn(this.spec);
  }

  /** Sparks blown out of the furnace mouth (its front face), plus a breath of smoke from the top. */
  private bellows(x: number, y: number, z: number, draft: number): void {
    const v = this.world.getVoxel(x, y, z);
    const dir = FACE_DIRS[FACING_TO_FACE[voxelFacing(v)]];
    const n = 10 + Math.round(draft * 18);
    for (let i = 0; i < n; i++) {
      const out = 2 + rnd() * 3;
      this.spark(
        x + 0.5 + dir[0] * 0.55 + spread(0.25),
        y + 0.35 + rnd() * 0.3,
        z + 0.5 + dir[2] * 0.55 + spread(0.25),
        dir[0] * out + spread(1.2),
        1.5 + rnd() * 2.5,
        dir[2] * out + spread(1.2),
        false,
      );
    }
    this.puffs(x + 0.5, y + 1.02, z + 0.5, 'smoke', 3);
  }

  /** Forging happens at the furnace whose screen is open: the hot furnace nearest to the camera. */
  private forgeSparks(): void {
    let best: Source | null = null;
    let bestD = 12 * 12;
    for (let i = 0; i < this.sourceCount; i++) {
      const s = this.sources[i];
      if (s.kind !== 'smoke' && s.kind !== 'star') continue;
      const d = (s.x - this.camX) ** 2 + (s.y - this.camY) ** 2 + (s.z - this.camZ) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best) this.burst(best.x, best.y - 0.2, best.z, 26, 0.8, false);
  }

  private burst(x: number, y: number, z: number, count: number, power: number, gold: boolean): void {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const s = (1.5 + rnd() * 3) * power;
      this.spark(x + spread(0.3), y + spread(0.3), z + spread(0.3), Math.cos(a) * s, 2 + rnd() * 3 * power, Math.sin(a) * s, gold);
    }
    this.puffs(x, y + 0.5, z, 'smoke', Math.round(count / 10));
  }

  /**
   * A legendary weapon's verb fired: a small, capped burst of sparks in its colour (never more than PROC_SPARKS per event, so a stress
   * scene of swings stays inside the particle budget). `gold` sparks are the pale ones; the rest are ember orange.
   */
  private legendaryProc(effect: LegendaryEffect, x: number, y: number, z: number): void {
    const count = effect === 'burning_marks' ? PROC_SPARKS : Math.round(PROC_SPARKS * 0.75);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const s = 1.2 + rnd() * 2.2;
      const rise = effect === 'lunge' ? 0.6 + rnd() : 1.5 + rnd() * 2;
      this.spark(x + spread(0.25), y + spread(0.25), z + spread(0.25), Math.cos(a) * s, rise, Math.sin(a) * s, effect !== 'burning_marks');
    }
  }

  /**
   * A thin ribbon of sparks along a swing, in the weapon's colour (TRAIL_COLOUR): `count` points on an arc from low right to high left
   * in front of the eye, each living a short moment. `count` is 0 under reduced motion and halved on low graphics (decided by the sender).
   */
  private swingTrail(effect: LegendaryEffect, x: number, y: number, z: number, yaw: number, pitch: number, count: number): void {
    if (!(count > 0)) return;
    const [r, g, b] = TRAIL_COLOUR[effect];
    const fx = -Math.sin(yaw) * Math.cos(pitch);
    const fz = -Math.cos(yaw) * Math.cos(pitch);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const side = 0.7 - 1.4 * t;
      const up = -0.5 + 0.9 * Math.sin(t * Math.PI);
      const p = this.spec;
      shapeSpark(p, x + fx * 1.3 + rx * side, y + up + Math.sin(pitch) * 1.3, z + fz * 1.3 + rz * side, spread(0.4), 0.3 + rnd() * 0.5, spread(0.4), false);
      p.r = p.r2 = r;
      p.g = p.g2 = g;
      p.b = p.b2 = b;
      p.life = 0.25 + rnd() * 0.2;
      p.gravity = 2;
      this.particles.spawn(p);
    }
  }

  private explosion(x: number, y: number, z: number, radius: number): void {
    const p = this.spec;
    for (let i = 0; i < 70; i++) {
      const k = 0.25 + rnd() * 0.35;
      p.x = x + spread(radius * 0.6);
      p.y = y + spread(radius * 0.6);
      p.z = z + spread(radius * 0.6);
      p.vx = spread(9);
      p.vy = 3 + rnd() * 9;
      p.vz = spread(9);
      this.chip(k * 1.1, k, k * 0.9, 0.12 + rnd() * 0.12, 0.8 + rnd() * 1.2);
    }
    this.burst(x, y, z, 90, 2.6, false);
    this.puffs(x, y, z, 'blast', 28);
  }

  /** Soft puffs: furnace smoke, machine steam, exhaust, the Starhearth's golden motes, explosion clouds. */
  private puffs(x: number, y: number, z: number, kind: PuffKind, count: number): void {
    const p = this.spec;
    for (let i = 0; i < count; i++) {
      shapePuff(p, kind, x, y, z, this.day, hashFloat(i, count) * 0.08);
      this.particles.spawn(p);
    }
  }
}
