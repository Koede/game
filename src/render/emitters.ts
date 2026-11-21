/**
 * Decides where particles come from: block debris when mining and breaking, smoke from every hot
 * fuel-burning furnace (so a base is visible from afar), sparks from the bellows and the forge, steam from
 * running machines, and the burst of an explosion. Listens to the bus; draws nothing itself.
 */
import { FURNACE_HOT_C } from '../core/constants';
import type { GameBus } from '../core/context';
import { hashFloat } from '../core/math';
import { blockOf, TEXTURE_NAMES } from '../core/registry';
import { Face, FACE_DIRS, FACING_TO_FACE, voxelActive, voxelFacing, type BlockDef, type IWorld, type Voxel } from '../core/types';
import { ParticleLook, type ParticleSpec, type Particles } from './particles';
import { tileColor } from './tiles';

/** Brightness 0..1 of the light at a point (supplied by the renderer). */
export type LightProbe = (x: number, y: number, z: number) => number;

interface Source {
  x: number;
  y: number;
  z: number;
  /** Particles per second. */
  rate: number;
  kind: 'smoke' | 'steam' | 'exhaust' | 'star';
  carry: number;
}

const SCAN_INTERVAL_S = 0.5;
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
      bus.on('explosion', (e) => this.explosion(e.x + 0.5, e.y + 0.5, e.z + 0.5, e.radius)),
    ];
  }

  /** Emits continuous smoke and steam; rescans the block entities twice a second. Allocation-free per frame. */
  update(dt: number, camX: number, camY: number, camZ: number): void {
    this.camX = camX;
    this.camY = camY;
    this.camZ = camZ;
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = SCAN_INTERVAL_S;
      this.scan();
    }
    for (let i = 0; i < this.sourceCount; i++) {
      const s = this.sources[i];
      s.carry += s.rate * dt;
      while (s.carry >= 1) {
        s.carry -= 1;
        this.puffs(s.x, s.y, s.z, s.kind, 1);
      }
    }
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
      if (e.kind === 'furnace') {
        if (d2 > SMOKE_RANGE * SMOKE_RANGE) continue;
        const tier = typeof e.tier === 'number' ? e.tier : 1;
        const temp = typeof e.tempC === 'number' ? e.tempC : 0;
        if (e.ignited === true) {
          kind = 'star';
          rate = 10;
        } else if (e.lit === true && temp >= FURNACE_HOT_C) {
          kind = 'smoke';
          const draft = typeof e.draft === 'number' ? e.draft : 0;
          rate = 2.2 + tier * 0.35 + draft * 2.5;
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
        s = { x: 0, y: 0, z: 0, rate: 0, kind, carry: rnd() };
        this.sources.push(s);
      }
      // Keep the carry of a source that stays at the same place so puffs do not bunch up every rescan.
      if (s.x !== e.x + 0.5 || s.y !== e.y + 1.02 || s.z !== e.z + 0.5) s.carry = rnd();
      s.x = e.x + 0.5;
      s.y = e.y + 1.02;
      s.z = e.z + 0.5;
      s.kind = kind;
      s.rate = rate;
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
    const light = this.light(x + 0.5, y + 0.5, z + 0.5);
    const p = this.spec;
    for (let i = 0; i < count; i++) {
      const c = colors[(rnd() * colors.length) | 0];
      const k = light * (0.8 + rnd() * 0.35);
      p.x = x + 0.15 + rnd() * 0.7;
      p.y = y + 0.15 + rnd() * 0.7;
      p.z = z + 0.15 + rnd() * 0.7;
      p.vx = spread(2.2) * speed;
      p.vy = (1.5 + rnd() * 3) * speed;
      p.vz = spread(2.2) * speed;
      this.chip(c[0] * k, c[1] * k, c[2] * k, 0.07 + rnd() * 0.07, 0.45 + rnd() * 0.5);
    }
  }

  /** A few chips flying off the face of the block being mined that looks at the camera. */
  private chips(x: number, y: number, z: number): void {
    const v = this.world.getVoxel(x, y, z);
    const def: BlockDef = blockOf(v);
    if (def.shape === 'none' || def.liquid) return;
    const colors = this.colorsOf(v);
    const light = this.light(x + 0.5, y + 0.5, z + 0.5);
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
      this.chip(c[0] * light, c[1] * light, c[2] * light, 0.05 + rnd() * 0.05, 0.35 + rnd() * 0.3);
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
    const p = this.spec;
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
    this.particles.spawn(p);
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
  private puffs(x: number, y: number, z: number, kind: Source['kind'] | 'blast', count: number): void {
    const p = this.spec;
    const day = this.day;
    for (let i = 0; i < count; i++) {
      p.look = ParticleLook.Puff;
      p.x = x + spread(0.18);
      p.y = y + rnd() * 0.1;
      p.z = z + spread(0.18);
      p.vx = spread(0.25);
      p.vz = spread(0.25);
      const jitter = hashFloat(i, count) * 0.08;
      if (kind === 'smoke') {
        // Lit from below by the fire at first, then plain soot grey (much lighter in daylight).
        p.vy = 1.3 + rnd() * 0.5;
        p.r = 0.62 - day * 0.12; p.g = 0.38 + day * 0.02; p.b = 0.24 + day * 0.08;
        const grey = 0.16 + day * 0.32 + jitter;
        p.r2 = grey; p.g2 = grey; p.b2 = grey * 1.06 + 0.02;
        p.size = 0.55; p.sizeEnd = 3.4 + rnd();
        p.life = 6.5 + rnd() * 2.5; p.alpha = 0.55 + day * 0.1;
        p.gravity = -0.06; p.drag = 0.12; p.fog = 0.35;
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
      this.particles.spawn(p);
    }
  }
}
