/**
 * The glass distillery come alive (docs/DISTILLERY_PLAN.md 10): what is inside the glass cases, in two draw calls.
 *
 * 1. LIQUIDS - one InstancedMesh of unit boxes, rebuilt four times a second from the module entities (they are plain
 *    JSON in the world, like the brewing cup the BrewLiquid quad reads): the charge in a flask or vessel at its level
 *    and in the colour of its live mixture (wash visibly pales as the alcohol leaves; crude darkens as its light ends
 *    go), a receiver filling with the cut it takes, coloured streams through glass tubes towards each neighbour they
 *    join, the jacket's water, and the BANDS of a running column - each segment glows in the colour of the cut that
 *    condenses at its tray, so the fractions stack up the column.
 * 2. MOTION - one InstancedMesh of tiny boxes animated entirely in the vertex shader from uTime: bubbles rise in a
 *    boiling flask (fast and small for thin liquids, slow and fat for thick ones), bubbles drift up a fermenting vessel,
 *    and drops fall from a condensing coil, at a pace that follows the flow and the liquid's viscosity. The CPU only
 *    writes an instance when the rebuild runs; between rebuilds a frame costs nothing.
 */
import * as THREE from 'three';
import { colourOf, total, viscosityOf } from '../../core/chem';
import { CHEM, CHEM_CAPACITY_L, chemKindOf } from '../../core/distill';
import type { IWorld } from '../../core/types';
import type { LightProbe } from '../emitters';

export const DISTILL_RANGE = 40;
export const LIQUID_MAX = 512;
export const MOTION_MAX = 768;
const INTERVAL_S = 0.25;

interface Mod {
  kind: string;
  x: number;
  y: number;
  z: number;
  mix: Record<string, number>;
  state: string;
  flow?: number;
  band?: number;
}

const MOTION_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aTravel;
  attribute vec3 aTime;   // period s, phase 0..1, size
  attribute vec3 aColour;
  uniform float uTime;
  varying vec3 vColour;
  void main() {
    float f = fract(uTime / aTime.x + aTime.y);
    float s = aTime.z * (0.35 + 0.65 * sin(3.14159 * f));
    vec3 p = aStart + aTravel * f + position * s;
    vColour = aColour;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const MOTION_FRAG = /* glsl */ `
  varying vec3 vColour;
  void main() { gl_FragColor = vec4(vColour, 1.0); }
`;

const tmp = new THREE.Matrix4();
const col = new THREE.Color();
const light = new Float32Array(3);

export class DistillFx {
  readonly group = new THREE.Group();
  private readonly liquids: THREE.InstancedMesh;
  private readonly motion: THREE.Mesh;
  private readonly motionGeo: THREE.InstancedBufferGeometry;
  private readonly start: THREE.InstancedBufferAttribute;
  private readonly travel: THREE.InstancedBufferAttribute;
  private readonly time: THREE.InstancedBufferAttribute;
  private readonly colour: THREE.InstancedBufferAttribute;
  private readonly motionMat: THREE.ShaderMaterial;
  private readonly liquidMat: THREE.MeshBasicMaterial;
  private timer = 0;
  private clock = 0;
  private nLiquid = 0;
  private nMotion = 0;

  constructor(private readonly world: IWorld, private readonly probe: LightProbe) {
    this.liquidMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.liquids = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.liquidMat, LIQUID_MAX);
    this.liquids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.liquids.count = 0;
    this.liquids.frustumCulled = false;
    this.liquids.name = 'distill-liquids';

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.motionGeo = new THREE.InstancedBufferGeometry();
    this.motionGeo.index = box.index;
    this.motionGeo.setAttribute('position', box.getAttribute('position'));
    const inst = (n: number): THREE.InstancedBufferAttribute => new THREE.InstancedBufferAttribute(new Float32Array(MOTION_MAX * n), n).setUsage(THREE.DynamicDrawUsage);
    this.start = inst(3);
    this.travel = inst(3);
    this.time = inst(3);
    this.colour = inst(3);
    this.motionGeo.setAttribute('aStart', this.start);
    this.motionGeo.setAttribute('aTravel', this.travel);
    this.motionGeo.setAttribute('aTime', this.time);
    this.motionGeo.setAttribute('aColour', this.colour);
    this.motionGeo.instanceCount = 0;
    this.motionMat = new THREE.ShaderMaterial({ vertexShader: MOTION_VERT, fragmentShader: MOTION_FRAG, uniforms: { uTime: { value: 0 } } });
    this.motion = new THREE.Mesh(this.motionGeo, this.motionMat);
    this.motion.frustumCulled = false;
    this.motion.name = 'distill-motion';
    this.group.add(this.liquids, this.motion);
  }

  /** Liquid boxes and moving bits drawn at the last rebuild (tests, stats). */
  get counts(): { liquids: number; motion: number } {
    return { liquids: this.nLiquid, motion: this.nMotion };
  }

  update(dt: number, camX: number, camZ: number): void {
    this.clock = (this.clock + dt) % 3600;
    this.motionMat.uniforms.uTime.value = this.clock;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = INTERVAL_S;
    this.rebuild(camX, camZ);
  }

  private lit(hex: number, x: number, y: number, z: number, glow = 0): THREE.Color {
    const l = this.probe(x, y, z, light);
    col.setHex(hex);
    return col.setRGB(col.r * Math.min(1, l[0] + glow), col.g * Math.min(1, l[1] + glow), col.b * Math.min(1, l[2] + glow));
  }

  private box(x: number, y: number, z: number, sx: number, sy: number, sz: number, hex: number, glow = 0): void {
    if (this.nLiquid >= LIQUID_MAX || sy <= 0.004) return;
    tmp.makeScale(sx, sy, sz).setPosition(x, y + sy / 2, z);
    this.liquids.setMatrixAt(this.nLiquid, tmp);
    this.liquids.setColorAt(this.nLiquid, this.lit(hex, x, y + 0.5, z, glow + 0.2));
    this.nLiquid++;
  }

  private bit(sx: number, sy: number, sz: number, tx: number, ty: number, tz: number, period: number, phase: number, size: number, hex: number): void {
    if (this.nMotion >= MOTION_MAX) return;
    const i = this.nMotion++;
    this.start.setXYZ(i, sx, sy, sz);
    this.travel.setXYZ(i, tx, ty, tz);
    this.time.setXYZ(i, period, phase, size);
    const c = this.lit(hex, sx, sy, sz, 0.25);
    this.colour.setXYZ(i, c.r, c.g, c.b);
  }

  private rebuild(camX: number, camZ: number): void {
    this.nLiquid = 0;
    this.nMotion = 0;
    for (const raw of this.world.entities()) {
      if (chemKindOf(raw.kind) !== raw.kind) continue;
      const e = raw as unknown as Mod;
      const dx = e.x + 0.5 - camX;
      const dz = e.z + 0.5 - camZ;
      if (dx * dx + dz * dz > DISTILL_RANGE * DISTILL_RANGE) continue;
      this.module(e);
    }
    this.liquids.count = this.nLiquid;
    this.liquids.instanceMatrix.needsUpdate = true;
    if (this.liquids.instanceColor) this.liquids.instanceColor.needsUpdate = true;
    this.motionGeo.instanceCount = this.nMotion;
    for (const a of [this.start, this.travel, this.time, this.colour]) a.needsUpdate = true;
  }

  private module(e: Mod): void {
    const cx = e.x + 0.5;
    const cz = e.z + 0.5;
    const mix = e.mix ?? {};
    const litres = total(mix);
    const cap = CHEM_CAPACITY_L[e.kind as keyof typeof CHEM_CAPACITY_L] ?? 0;
    const fill = cap > 0 ? Math.min(1, litres / cap) : 0;
    const hex = colourOf(mix);
    const visc = viscosityOf(mix);
    const working = e.state === 'working';
    switch (e.kind) {
      case CHEM.flask: {
        const h = 0.62 * fill;
        this.box(cx, e.y + 0.12, cz, 0.62, h, 0.62, hex, working ? 0.15 : 0);
        if (working && h > 0.05) {
          const n = Math.min(8, 3 + Math.round((e.flow ?? 0) / 4));
          const period = 0.5 + 0.35 * Math.log2(1 + visc);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            this.bit(cx + Math.cos(a) * 0.18, e.y + 0.14, cz + Math.sin(a) * 0.18, 0, h - 0.04, 0, period, i / n, 0.05 + 0.01 * Math.min(4, visc), 0xf4fbff);
          }
        }
        break;
      }
      case CHEM.vessel: {
        const h = 0.75 * fill;
        this.box(cx, e.y + 0.08, cz, 0.78, h, 0.78, hex);
        if (working && h > 0.05) for (let i = 0; i < 4; i++) this.bit(cx - 0.25 + i * 0.16, e.y + 0.1, cz + (i % 2 ? 0.15 : -0.15), 0, h - 0.04, 0, 2.4, i / 4, 0.035, 0xfaf3dc);
        break;
      }
      case CHEM.receiver:
        this.box(cx, e.y + 0.08, cz, 0.58, 0.72 * fill, 0.58, hex);
        break;
      case CHEM.jacket:
        this.box(cx, e.y + 0.08, cz, 0.84, 0.82 * fill, 0.84, hex);
        break;
      case CHEM.segment:
        if (e.band) {
          this.box(cx, e.y + 0.05, cz, 0.5, 0.9, 0.5, e.band, 0.45);
          if (working) this.bit(cx, e.y + 0.05, cz, 0, 0.9, 0, 0.8, (e.x * 7 + e.y * 3) % 10 / 10, 0.07, 0xffffff);
        }
        break;
      case CHEM.condenser:
        if (litres > 0.5 || working) {
          this.box(cx, e.y + 0.1, cz, 0.22, 0.12, 0.22, hex);
          const period = 0.35 + 0.25 * Math.log2(1 + visc);
          for (let i = 0; i < 2; i++) this.bit(cx, e.y + 0.1, cz, 0, -0.55, 0, period, i / 2, 0.045, hex);
        }
        break;
      case CHEM.tube:
        if (litres > 0.5) this.streams(e, hex, Math.max(0.25, fill));
        break;
      default:
        break;
    }
  }

  /** A coloured core with an arm towards every chemistry neighbour of a tube: the stream you see moving. */
  private streams(e: Mod, hex: number, fill: number): void {
    const cx = e.x + 0.5;
    const cz = e.z + 0.5;
    const w = 0.16 * fill + 0.06;
    const y = e.y + 0.42;
    this.box(cx, y, cz, w, w, w, hex);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!chemKindOf(this.world.getBlock(e.x + dx, e.y, e.z + dz).key)) continue;
      this.box(cx + dx * 0.27, y, cz + dz * 0.27, dx ? 0.46 : w, w, dz ? 0.46 : w, hex);
      this.bit(cx, y + w / 2, cz, dx * 0.5, 0, dz * 0.5, 0.6, (e.x + e.z) % 4 / 4, w * 0.8, 0xffffff);
    }
    if (chemKindOf(this.world.getBlock(e.x, e.y - 1, e.z).key)) this.box(cx, e.y, cz, w, 0.42, w, hex);
  }

  dispose(): void {
    this.liquids.geometry.dispose();
    this.liquidMat.dispose();
    this.motionGeo.dispose();
    this.motionMat.dispose();
  }
}
