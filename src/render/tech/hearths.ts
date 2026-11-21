/**
 * Formed hearths in the world (spec 17.4): a light-emitting molten pool on the interior floor whose colour follows the
 * furnace temperature on the heat ramp (crusted while merely hot, churning as it climbs), the chamber's glow on its
 * inner walls (seen through an open top or a window), a warm halo over the opening and outside each window, smoke and
 * heat shimmer rising from an open top, and a light sweep up the shell when it forms ('hearth:formed').
 *
 * Twice a second it scans the block entities for furnaces with a formed hearth (like the emitters); every frame it
 * reads each one's live temperature. Four instanced draw calls and one halo draw, only while something is shown.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import { blockOf as blockDefOf } from '../../core/registry';
import type { BlockEntity, IWorld } from '../../core/types';
import { Glows } from '../glows';
import type { WorldUniforms } from '../materials';
import { ParticleLook, type ParticleSpec, type Particles } from '../particles';
import { shapePuff } from '../puffs';
import { BoxBatch, unitQuadUp, unitQuadUpright } from './boxBatch';
import { BOX_VERTEX, HAZE_FRAGMENT, POOL_FRAGMENT, SHIMMER_FRAGMENT, SHIMMER_VERTEX, SWEEP_FRAGMENT } from './hearthShaders';
import { heatColor, heatGlow } from './heat';
import { hearthBox, shellNormal, type HearthBox } from './hearthInfo';
import { unitCubeGeometry } from './pipeOverlay';

/** Hearths drawn at most, and how far from the camera (horizontal blocks) they are tracked. */
export const HEARTH_CAP = 16;
export const HEARTH_RANGE = 160;
const SCAN_INTERVAL_S = 0.5;
/** Seconds the formation sweep takes to climb the shell. */
export const SWEEP_S = 1.7;
const SWEEP_CAP = 4;
/** Windows that get a halo outside them, per hearth. */
const WINDOW_HALOS = 6;
/** The Starhearth after ignition burns gold whatever its temperature reads. */
const STAR_GOLD = [1, 0.82, 0.42] as const;

interface Tracked {
  e: BlockEntity;
  box: HearthBox;
  /** Window cells (glass in the shell): x, y, z and the outward normal, 6 numbers each. */
  windows: number[];
  smoke: number;
}

interface Sweep {
  min: [number, number, number];
  max: [number, number, number];
  t: number;
}

const rnd = Math.random;

function material(name: string, uniforms: WorldUniforms, vertex: string, fragment: string, opts: Partial<THREE.ShaderMaterialParameters>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name,
    glslVersion: THREE.GLSL3,
    uniforms: { uTime: uniforms.uTime, uFog: uniforms.uFog, uFogColor: uniforms.uFogColor },
    vertexShader: vertex,
    fragmentShader: fragment,
    ...opts,
  });
}

export class HearthLights {
  readonly group = new THREE.Group();
  /** Hearths with something drawn last frame. */
  shown = 0;
  private readonly pool: BoxBatch;
  private readonly haze: BoxBatch;
  private readonly shimmer: BoxBatch;
  private readonly sweep: BoxBatch;
  readonly halos = new Glows(HEARTH_CAP * (WINDOW_HALOS + 1));
  private readonly tracked: Tracked[] = [];
  private trackedCount = 0;
  private readonly sweeps: Sweep[] = [];
  private readonly heat = new Float32Array(3);
  private readonly spec: ParticleSpec = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.1,
    r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Puff, fog: 1,
  };
  private readonly off: () => void;
  private scanTimer = 0;
  private camX = 0;
  private camZ = 0;

  constructor(private readonly world: IWorld, bus: GameBus, uniforms: WorldUniforms, private readonly particles: Particles) {
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    this.pool = new BoxBatch(HEARTH_CAP, unitQuadUp(), material('hearth-pool', uniforms, BOX_VERTEX, POOL_FRAGMENT, {}), 'hearth-pool');
    this.haze = new BoxBatch(HEARTH_CAP, unitCubeGeometry(), material('hearth-haze', uniforms, BOX_VERTEX, HAZE_FRAGMENT, { ...additive, side: THREE.BackSide }), 'hearth-haze');
    this.shimmer = new BoxBatch(HEARTH_CAP, unitQuadUpright(), material('hearth-shimmer', uniforms, SHIMMER_VERTEX, SHIMMER_FRAGMENT, { ...additive, side: THREE.DoubleSide }), 'hearth-shimmer');
    this.sweep = new BoxBatch(SWEEP_CAP, unitCubeGeometry(), material('hearth-sweep', uniforms, BOX_VERTEX, SWEEP_FRAGMENT, additive), 'hearth-sweep');
    // Glows after the chunks' blended batch, so a halo is not painted over by water or glass in front of it twice.
    this.haze.mesh.renderOrder = 2;
    this.shimmer.mesh.renderOrder = 4;
    this.sweep.mesh.renderOrder = 4;
    this.group.add(this.pool.mesh, this.haze.mesh, this.shimmer.mesh, this.sweep.mesh, this.halos.points);
    this.group.name = 'hearths';
    this.off = bus.on('hearth:formed', ({ min, max }) => this.startSweep(min, max));
  }

  /** Sets the halo size scale (pixels per world unit at distance 1), like the renderer's furnace halos. */
  setScale(pixelsPerUnit: number): void {
    this.halos.setScale(pixelsPerUnit);
  }

  /** `day` 0 at night .. 1 by day (halos are stronger at night, smoke darker by day). */
  update(dt: number, time: number, camX: number, camZ: number, day: number): void {
    this.camX = camX;
    this.camZ = camZ;
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = SCAN_INTERVAL_S;
      this.scan();
    }
    this.pool.begin();
    this.haze.begin();
    this.shimmer.begin();
    this.halos.begin(time);
    const halo = 0.08 + 0.5 * (1 - day);
    const heat = this.heat;
    let shown = 0;
    for (let i = 0; i < this.trackedCount; i++) {
      const h = this.tracked[i];
      const e = h.e;
      const temp = typeof e.tempC === 'number' ? e.tempC : 0;
      const ignited = e.ignited === true;
      const k = ignited ? 1 : heatGlow(temp);
      if (k <= 0.001) continue;
      shown++;
      if (ignited) heat.set(STAR_GOLD);
      else heatColor(temp, heat);
      const [x0, y0, z0, x1, y1, z1] = h.box.inner;
      // The pool's heat (0..1 over 300..1400 C) melts its crust away.
      const melt = ignited ? 1 : Math.min(1, Math.max(0, (temp - 300) / 1100));
      this.pool.push(x0 + 0.001, y0 + 0.03, z0 + 0.001, x1 + 0.999, y0 + 0.03, z1 + 0.999, heat[0], heat[1], heat[2], melt);
      this.haze.push(x0 + 0.015, y0 + 0.015, z0 + 0.015, x1 + 0.985, y1 + 0.985, z1 + 0.985, heat[0], heat[1], heat[2], (h.box.closed ? 0.5 : 0.34) * k);
      const cx = (x0 + x1 + 1) / 2;
      const cz = (z0 + z1 + 1) / 2;
      const across = Math.max(x1 - x0, z1 - z0) + 1;
      if (!h.box.closed) {
        const top = y1 + 1;
        this.shimmer.push(cx, top, cz, across + 0.3, 1.6 + across * 0.5, (x0 * 13 + z0 * 7) % 17, heat[0], heat[1], heat[2], 0.16 * k);
        this.halos.add(cx, top + 0.2, cz, 2.2 + across * 1.1, heat[0] * halo * k, heat[1] * halo * k, heat[2] * halo * k);
        this.smoke(h, dt, x0, z0, x1, z1, top, day, e.lit === true, k);
      }
      const w = h.windows;
      const wk = halo * k * 0.9;
      for (let j = 0; j < w.length; j += 6) {
        this.halos.add(w[j] + 0.5 + w[j + 3] * 0.75, w[j + 1] + 0.5 + w[j + 4] * 0.75, w[j + 2] + 0.5 + w[j + 5] * 0.75, 1.5, heat[0] * wk, heat[1] * wk, heat[2] * wk);
      }
    }
    this.shown = shown;
    this.pool.end();
    this.haze.end();
    this.shimmer.end();
    this.halos.end();
    this.updateSweeps(dt);
  }

  dispose(): void {
    this.off();
    this.pool.dispose();
    this.haze.dispose();
    this.shimmer.dispose();
    this.sweep.dispose();
    this.halos.dispose();
  }

  private startSweep(min: readonly number[], max: readonly number[]): void {
    let s = this.sweeps.find((w) => w.t >= SWEEP_S);
    if (!s) {
      if (this.sweeps.length >= SWEEP_CAP) return;
      s = { min: [0, 0, 0], max: [0, 0, 0], t: 0 };
      this.sweeps.push(s);
    }
    for (let i = 0; i < 3; i++) {
      s.min[i] = min[i];
      s.max[i] = max[i];
    }
    s.t = 0;
  }

  private updateSweeps(dt: number): void {
    this.sweep.begin();
    for (const s of this.sweeps) {
      if (s.t >= SWEEP_S) continue;
      s.t += dt;
      const k = Math.min(1, s.t / SWEEP_S);
      const pad = 0.02;
      this.sweep.push(s.min[0] - pad, s.min[1] - pad, s.min[2] - pad, s.max[0] + 1 + pad, s.max[1] + 1 + pad, s.max[2] + 1 + pad, 1, 0.78, 0.46, k);
    }
    this.sweep.end();
  }

  /** Smoke from an open top: a few puffs a second over the opening while the fire burns, a wisp while only hot. */
  private smoke(h: Tracked, dt: number, x0: number, z0: number, x1: number, z1: number, top: number, day: number, lit: boolean, k: number): void {
    const area = (x1 - x0 + 1) * (z1 - z0 + 1);
    const rate = lit ? (3 + area * 0.9) * (0.5 + 0.5 * k) : 0.5 * k;
    h.smoke += rate * dt;
    while (h.smoke >= 1) {
      h.smoke -= 1;
      const x = x0 + 0.2 + rnd() * (x1 - x0 + 0.6);
      const z = z0 + 0.2 + rnd() * (z1 - z0 + 0.6);
      shapePuff(this.spec, 'smoke', x, top - 0.2, z, day, rnd() * 0.08);
      this.particles.spawn(this.spec);
    }
  }

  private scan(): void {
    let n = 0;
    const range2 = HEARTH_RANGE * HEARTH_RANGE;
    for (const e of this.world.entities()) {
      if (e.kind !== 'furnace' || n >= HEARTH_CAP) continue;
      const dx = e.x + 0.5 - this.camX;
      const dz = e.z + 0.5 - this.camZ;
      if (dx * dx + dz * dz > range2) continue;
      const box = hearthBox(e);
      if (!box) continue;
      let t = this.tracked[n];
      if (!t) t = this.tracked[n] = { e, box, windows: [], smoke: rnd() };
      t.e = e;
      t.box = box;
      this.findWindows(t);
      n++;
    }
    this.trackedCount = n;
  }

  /** Glass in the shell's faces (windows show the inner glow; a halo outside each lights the ground). */
  private findWindows(t: Tracked): void {
    const { min, max } = t.box;
    const w = t.windows;
    w.length = 0;
    for (let y = min[1]; y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        for (let x = min[0]; x <= max[0]; x++) {
          const onShell = x === min[0] || x === max[0] || z === min[2] || z === max[2] || y === min[1] || y === max[1];
          if (!onShell) continue;
          if (blockDefOf(this.world.getVoxel(x, y, z)).key !== 'glass') continue;
          const nrm = shellNormal(t.box, x, y, z);
          if (!nrm) continue;
          w.push(x, y, z, nrm[0], nrm[1], nrm[2]);
          if (w.length >= WINDOW_HALOS * 6) return;
        }
      }
    }
  }
}
