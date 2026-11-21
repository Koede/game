/**
 * Everything an automaton adds beyond its model (spec 19.5), drawn in four draw calls (halos, cubes, particles, plus
 * the models themselves): the ember glow halos (hotter through a wind-up), a small smoke and spark emitter on each
 * active automaton, a drone's crackle and zap, the impact of a hammer or a slam, hit sparks, ember bolts with a spark
 * trail, and the break-apart (debris in its colours, sparks, a flash). It watches the render views frame to frame
 * (an attack ending from a full wind-up is a release, a rising hurt flash a hit, a view with `tip` a death) so it needs
 * no event bus; the one extra input is the bolt list (`setBolts`). Allocation-free per frame.
 */
import * as THREE from 'three';
import type { CreatureSpec, HostileAttack, IWorld } from '../../core/types';
import type { WorldUniforms } from '../materials';
import { Particles } from '../particles';
import { automatonAnchors, type Anchor, type AutomatonAnchors } from './anchors';
import { BoltTracker, type BoltView } from './bolts';
import { breakApart, piecesFor } from './burst';
import { CubeBatch } from './cubes';
import { DebrisField, type PieceDraw } from './debris';
import { Halos } from './halos';
import type { MobRenderView } from './mobRenderer';
import { automatonPose, newPose, newPoseMemory, poseStyle, type Pose, type PoseMemory, type PoseStyle, type PoseView } from './poses';
import { arcLine, arcSpark, dustPuff, emberSpark, smokePuff, sparkBurst } from './sparks';

/** The parts of the Renderer the effects draw into (the Renderer fits; `canvas` only sizes the sparks). */
export interface FxScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly uniforms: WorldUniforms;
  readonly canvas?: HTMLCanvasElement;
}

interface AutoMem {
  pose: PoseMemory;
  lastFrame: number;
  dead: boolean;
  prevAttack: HostileAttack | null;
  prevFlare: number;
  prevFlash: number;
  smoke: number;
  spark: number;
}

interface SpecFx {
  anchors: AutomatonAnchors;
  style: PoseStyle;
}

const FLASHES = 16;
/** A wind-up this far along counts as completed when the attack ends (an interrupted one ends earlier). */
const RELEASE_FLARE = 0.8;
/** Effects are skipped for automatons farther than this (blocks squared): smoke at the edge of the fog adds nothing. */
const FX_RANGE2 = 40 * 40;
const MAX_SMOKE_PER_FRAME = 3;
const MAX_SPARKS_PER_FRAME = 6;

export class AutomatonFx {
  readonly group = new THREE.Group();
  /** Counts for stats and tests. */
  get particleCount(): number {
    return this.particles.count;
  }
  get debrisCount(): number {
    return this.debris.count;
  }

  private readonly particles: Particles;
  private readonly halos: Halos;
  private readonly cubes: CubeBatch;
  private readonly debris = new DebrisField(128);
  private readonly bolts = new BoltTracker();
  private boltViews: readonly BoltView[] = [];
  private readonly specs = new Map<CreatureSpec, SpecFx>();
  private readonly mems = new Map<number, AutoMem>();
  private readonly out = { x: 0, y: 0, z: 0 };
  private readonly poseOut: Pose = newPose();
  private readonly poseView: PoseView = { id: 0, yaw: 0, stride: 0, glow: 0, flare: 0, attack: null, dormant: false };
  // Short flashes (a hit, a shot, a break-apart): position, diameter, colour, age, life.
  private flashN = 0;
  private readonly fPos = new Float32Array(FLASHES * 4);
  private readonly fCol = new Float32Array(FLASHES * 3);
  private readonly fAge = new Float32Array(FLASHES);
  private readonly fLife = new Float32Array(FLASHES);
  private readonly solid: (x: number, y: number, z: number) => boolean;
  private readonly drawPiece: (d: PieceDraw) => void;
  private dt = 0;
  private time = 0;
  private frame = 0;

  constructor(
    private readonly view: FxScene,
    world: IWorld,
  ) {
    this.particles = new Particles(view.uniforms, 640);
    this.halos = new Halos(view.uniforms, 64);
    this.cubes = new CubeBatch(view.uniforms, 160);
    this.solid = (x, y, z) => world.getBlock(x, y, z).solid;
    this.drawPiece = (d) => this.cubes.add(d.x, d.y, d.z, d.size, d.rx, d.ry, d.r, d.g, d.b, d.emissive, d.sky, d.block);
    this.group.name = 'automaton-fx';
    this.group.add(this.cubes.mesh, this.particles.points, this.halos.mesh);
    view.scene.add(this.group);
  }

  /** The model-space anchors and pose style of a species (cached). */
  private specFx(spec: CreatureSpec): SpecFx {
    let s = this.specs.get(spec);
    if (!s) {
      s = { anchors: automatonAnchors(spec), style: poseStyle(spec) };
      this.specs.set(spec, s);
    }
    return s;
  }

  setBolts(views: readonly BoltView[]): void {
    this.boltViews = views;
  }

  begin(dt: number): void {
    this.frame++;
    this.dt = dt;
    this.time += dt;
    this.halos.begin();
    this.cubes.begin();
  }

  private memOf(id: number): AutoMem {
    let m = this.mems.get(id);
    if (!m) {
      m = { pose: newPoseMemory(), lastFrame: -10, dead: false, prevAttack: null, prevFlare: 0, prevFlash: 0, smoke: Math.random(), spark: Math.random() };
      this.mems.set(id, m);
    }
    return m;
  }

  /**
   * The pose of a living automaton this frame (the returned object is reused). Also notices the end of a wind-up (the
   * release: swing, impact, zap) and a fresh hurt flash (hit sparks).
   */
  pose(v: MobRenderView, legSwing: number): Pose {
    const fx = this.specFx(v.spec);
    const m = this.memOf(v.id);
    // Not drawn last frame (culled, or just arrived): forget what the previous frame looked like.
    if (m.lastFrame !== this.frame - 1) {
      m.prevAttack = v.attack ?? null;
      m.prevFlare = v.flare ?? 0;
      m.prevFlash = v.flash;
      m.pose.sinceAttack = Infinity;
    }
    m.lastFrame = this.frame;
    const attack = v.attack ?? null;
    const flare = v.flare ?? 0;
    const pv = this.poseView;
    pv.id = v.id;
    pv.yaw = v.yaw;
    pv.stride = v.stride;
    pv.glow = v.glow ?? 0;
    pv.flare = flare;
    pv.attack = attack;
    pv.dormant = v.dormant ?? false;
    const released = m.prevAttack !== null && attack === null && m.prevFlare >= RELEASE_FLARE && m.prevAttack !== 'dash';
    if (released) m.pose.sinceAttack = 0;
    const p = automatonPose(fx.style, pv, m.pose, legSwing, this.time, this.dt, this.poseOut);
    if (released && this.dt > 0) this.onRelease(v, fx, p, m.prevAttack);
    if (v.flash - m.prevFlash > 0.3) this.hitSparks(v, fx);
    m.prevAttack = attack;
    m.prevFlare = flare;
    m.prevFlash = v.flash;
    return p;
  }

  /** World position of a model-space anchor on automaton `v` in `pose` (written to this.out). */
  private place(a: Anchor, v: MobRenderView, fx: SpecFx, pose: Pose): { x: number; y: number; z: number } {
    const yaw = a.head && fx.style === 'turret' ? pose.yaw + pose.headTurn : pose.yaw;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const k = v.scale;
    const o = this.out;
    o.x = v.x + c * a.x * k + s * a.z * k;
    o.z = v.z - s * a.x * k + c * a.z * k;
    o.y = v.y + pose.lift + a.y * k * pose.squash;
    return o;
  }

  /** The ground point `d` blocks ahead of the automaton (written to this.out). */
  private forward(v: MobRenderView, pose: Pose, d: number): { x: number; y: number; z: number } {
    const o = this.out;
    o.x = v.x - Math.sin(pose.yaw) * d * v.scale;
    o.z = v.z - Math.cos(pose.yaw) * d * v.scale;
    o.y = v.y + 0.1;
    return o;
  }

  private onRelease(v: MobRenderView, fx: SpecFx, pose: Pose, attack: HostileAttack | null): void {
    const k = v.scale;
    const p = this.particles;
    if (attack === 'melee' && fx.style === 'hammer') {
      const f = this.forward(v, pose, 1.3);
      sparkBurst(p, f.x, f.y + 0.1, f.z, 12, 4.2);
      for (let i = 0; i < 3; i++) dustPuff(p, f.x, f.y, f.z, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 0.4);
      this.flash(f.x, f.y + 0.2, f.z, 1.5, 0.9, 0.5, 0.2, 0.22);
    } else if (attack === 'slam') {
      const y = v.y + 0.1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
        const r = 1.1 * k;
        const ex = v.x + Math.cos(a) * r;
        const ez = v.z + Math.sin(a) * r;
        dustPuff(p, ex, y, ez, Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0.6);
        emberSpark(p, ex, y + 0.1, ez, Math.cos(a) * 4.5, 2 + Math.random() * 2, Math.sin(a) * 4.5, 0.5 + Math.random() * 0.4, 0.09);
      }
      const f = this.forward(v, pose, 1.6);
      this.flash(f.x, f.y + 0.2, f.z, 2.6, 1, 0.55, 0.2, 0.3);
    } else if (attack === 'zap') {
      const a = this.place(fx.anchors.arc, v, fx, pose);
      const ax = a.x;
      const ay = a.y;
      const az = a.z;
      const cam = this.view.camera.position;
      const d = Math.hypot(cam.x - ax, cam.z - az);
      const reach = d < 12;
      // The arc runs to the player's chest when the camera is close, else a few blocks ahead.
      const tx = reach ? cam.x : ax - Math.sin(pose.yaw) * 4;
      const tz = reach ? cam.z : az - Math.cos(pose.yaw) * 4;
      const ty = reach ? cam.y - 0.6 : ay - 1.2;
      arcLine(p, ax, ay, az, tx, ty, tz, Math.min(16, 5 + Math.round(d)));
      sparkBurst(p, ax, ay, az, 8, 3.5, true);
      this.flash(ax, ay, az, 1.3, 0.35, 0.65, 1, 0.16);
    }
  }

  private hitSparks(v: MobRenderView, fx: SpecFx): void {
    const mid = fx.anchors.middle * v.scale;
    sparkBurst(this.particles, v.x, v.y + mid, v.z, 9, 4);
    sparkBurst(this.particles, v.x, v.y + mid, v.z, 3, 3, true);
    this.flash(v.x, v.y + mid, v.z, 0.8, 0.7, 0.4, 0.15, 0.12);
  }

  /** Breaks a dead automaton apart (once: the caller skips drawing the corpse). */
  corpse(v: MobRenderView, sky: number, block: number): void {
    const m = this.memOf(v.id);
    m.lastFrame = this.frame;
    if (m.dead) return;
    m.dead = true;
    if (this.dt <= 0) return;
    const fx = this.specFx(v.spec);
    const a = fx.anchors;
    breakApart(a, this.debris, v.x, v.y, v.z, v.yaw, v.scale, sky, block, piecesFor(a.middle / 0.55), Math.random);
    sparkBurst(this.particles, v.x, v.y + a.middle * v.scale, v.z, 26, 6);
    for (let i = 0; i < 5; i++) smokePuff(this.particles, v.x + (Math.random() - 0.5) * 0.6, v.y + a.middle * v.scale * Math.random() * 1.4, v.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0.7, 0.4);
    this.flash(v.x, v.y + a.middle * v.scale, v.z, 2.8 * Math.max(0.6, a.middle / 0.9), 1, 0.55, 0.2, 0.35);
  }

  /** Halos and ambient particles of a drawn, living automaton. `pose` is the one `pose()` returned this frame. */
  emit(v: MobRenderView, pose: Pose, dx2: number): void {
    const glow = pose.ember;
    if (glow < 0.04) return;
    const fx = this.specFx(v.spec);
    const a = fx.anchors;
    const flare = pose.flare;
    const k = v.scale;
    const h = a.halo;
    const flick = 0.92 + 0.08 * Math.sin(this.time * 11 + v.id * 1.9);
    const o = this.place(h, v, fx, pose);
    const power = glow * (0.14 + 0.36 * flare) * flick;
    this.halos.add(o.x, o.y, o.z, h.size * k * (0.7 + 0.25 * glow + 0.8 * flare), h.r * power, h.g * power, h.b * power);
    if (flare > 0.05) {
      const w = this.place(a.arc, v, fx, pose);
      const f = flare * flare;
      if (fx.style === 'hover') this.halos.add(w.x, w.y, w.z, 0.9 * k * (0.6 + flare), 0.16 * f, 0.34 * f, 0.55 * f);
      else this.halos.add(w.x, w.y, w.z, 0.7 * k * (0.6 + flare), 0.4 * f, 0.22 * f, 0.07 * f);
    }
    if (this.dt <= 0 || dx2 > FX_RANGE2) return;

    const m = this.memOf(v.id);
    const smokeRate = a.smokes ? (v.spec.size.h < 0.6 ? 1.2 : 2.4 + 5 * flare) * glow : 0;
    const sparkRate = fx.style === 'hover' ? (1.2 + 55 * flare) * glow : (1.4 + 14 * flare) * glow;
    m.smoke += smokeRate * this.dt;
    m.spark += sparkRate * this.dt;
    const vent = this.place(a.vent, v, fx, pose);
    const vx = vent.x;
    const vy = vent.y;
    const vz = vent.z;
    let n = Math.min(MAX_SMOKE_PER_FRAME, Math.floor(m.smoke));
    m.smoke = Math.min(m.smoke - n, 1.5);
    const size = Math.max(0.22, a.middle * 0.35) * k;
    while (n-- > 0) smokePuff(this.particles, vx + (Math.random() - 0.5) * 0.12, vy, vz + (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, size);
    n = Math.min(MAX_SPARKS_PER_FRAME, Math.floor(m.spark));
    m.spark = Math.min(m.spark - n, 2);
    if (n <= 0) return;
    if (fx.style === 'hover') {
      const w = this.place(a.arc, v, fx, pose);
      const ax = w.x;
      const ay = w.y;
      const az = w.z;
      while (n-- > 0) {
        const s = 1.5 + flare * 3.5;
        arcSpark(this.particles, ax, ay, az, (Math.random() - 0.5) * s, (Math.random() - 0.3) * s, (Math.random() - 0.5) * s, 0.1 + Math.random() * 0.16);
      }
    } else {
      while (n-- > 0) emberSpark(this.particles, vx, vy, vz, (Math.random() - 0.5) * 1.2, 0.9 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2, 0.35 + Math.random() * 0.5, 0.06);
    }
  }

  private flash(x: number, y: number, z: number, size: number, r: number, g: number, b: number, life: number): void {
    const i = this.flashN < FLASHES ? this.flashN++ : 0;
    this.fPos[i * 4] = x;
    this.fPos[i * 4 + 1] = y;
    this.fPos[i * 4 + 2] = z;
    this.fPos[i * 4 + 3] = size;
    this.fCol[i * 3] = r;
    this.fCol[i * 3 + 1] = g;
    this.fCol[i * 3 + 2] = b;
    this.fAge[i] = 0;
    this.fLife[i] = life;
  }

  /** Bolts in flight, their trails and the bursts where they ended; then the debris, flashes and uploads. */
  end(): void {
    const dt = this.dt;
    const t = this.bolts;
    t.update(this.boltViews);
    const p = this.particles;
    for (let i = 0; i < t.count; i++) {
      const x = t.x[i];
      const y = t.y[i];
      const z = t.z[i];
      if (t.fresh[i] === 1 && dt > 0) {
        this.flash(x, y, z, 1.1, 1, 0.5, 0.15, 0.14);
        sparkBurst(p, x, y, z, 6, 2.2);
      }
      // A trail laid along the path since last frame: a spark every ~0.22 block, a puff every ~0.7.
      const fx = t.fromX[i];
      const fy = t.fromY[i];
      const fz = t.fromZ[i];
      const len = Math.hypot(x - fx, y - fy, z - fz);
      const steps = Math.min(8, Math.ceil(len / 0.22));
      if (dt > 0) {
        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          const px = fx + (x - fx) * u;
          const py = fy + (y - fy) * u;
          const pz = fz + (z - fz) * u;
          emberSpark(p, px, py, pz, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9 + 0.2, (Math.random() - 0.5) * 0.9, 0.3 + Math.random() * 0.3, 0.06);
          if (s % 3 === 0) smokePuff(p, px, py, pz, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.2, 0.22);
        }
      }
      const pulse = 0.92 + 0.08 * Math.sin(this.time * 30 + i * 2);
      this.halos.add(x, y, z, 1.05 * pulse, 0.55, 0.28, 0.08);
      this.cubes.add(x, y, z, 0.17, this.time * 9 + i, this.time * 13 + i * 2, 1, 0.82, 0.4, 1, 1, 1);
    }
    for (let i = 0; i < t.ended; i++) {
      if (dt <= 0) break;
      sparkBurst(p, t.endX[i], t.endY[i], t.endZ[i], 12, 4.5);
      this.flash(t.endX[i], t.endY[i], t.endZ[i], 1.5, 1, 0.55, 0.2, 0.18);
    }

    // Flashes fade quadratically and drop out (swap-remove).
    for (let i = 0; i < this.flashN; ) {
      this.fAge[i] += dt;
      const u = this.fAge[i] / this.fLife[i];
      if (u >= 1) {
        const l = --this.flashN;
        if (i !== l) {
          for (let c = 0; c < 4; c++) this.fPos[i * 4 + c] = this.fPos[l * 4 + c];
          for (let c = 0; c < 3; c++) this.fCol[i * 3 + c] = this.fCol[l * 3 + c];
          this.fAge[i] = this.fAge[l];
          this.fLife[i] = this.fLife[l];
        }
        continue;
      }
      const f = (1 - u) * (1 - u);
      this.halos.add(this.fPos[i * 4], this.fPos[i * 4 + 1], this.fPos[i * 4 + 2], this.fPos[i * 4 + 3] * (0.6 + 0.4 * u), this.fCol[i * 3] * f, this.fCol[i * 3 + 1] * f, this.fCol[i * 3 + 2] * f);
      i++;
    }

    this.debris.step(dt, this.solid);
    this.debris.forEach(this.drawPiece);
    this.halos.end();
    this.cubes.end();
    this.updateParticles(dt);
    if ((this.frame & 127) === 0) this.forget();
  }

  private updateParticles(dt: number): void {
    const cam = this.view.camera;
    const h = this.view.canvas?.height || 800;
    this.particles.setScale(h / (2 * Math.tan((cam.fov * Math.PI) / 360)));
    this.particles.update(dt, 0.6, 0.2);
  }

  /** Drops memories of automatons not drawn for a while (they are gone). */
  private forget(): void {
    for (const [id, m] of this.mems) if (this.frame - m.lastFrame > 240) this.mems.delete(id);
  }

  /** Counts for the stats: halos, cubes, live particles. */
  get drawn(): { halos: number; cubes: number; particles: number } {
    return { halos: this.halos.count, cubes: this.cubes.count, particles: this.particles.count };
  }

  dispose(): void {
    this.view.scene.remove(this.group);
    this.particles.dispose();
    this.halos.dispose();
    this.cubes.dispose();
  }
}
