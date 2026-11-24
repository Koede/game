/**
 * The glass distillery come alive (docs/DISTILLERY_PLAN.md 10, docs/api/glass.md "Liquids"): what is inside the glassware,
 * in two draw calls.
 *
 * 1. LIQUIDS - the shared animated liquid (src/render/liquids/liquidBoxes.ts), rebuilt four times a second from the module
 *    entities and fitted to each glass model's interior (src/world/glassModels.ts): the charge in a flask or vessel SETTLED
 *    INTO LAYERS (oil floats on water, bitumen sinks under it; chem.ts `layersOf`), its top surface sloshing and, while it
 *    boils, churning with foam; a receiver filling with the cut it takes and the stream falling into it; condensate running
 *    down a coil's rod; streams flowing through glass tubes towards each neighbour they feed; the jacket's water; and the
 *    BANDS of a running column - each segment glows in the colour of the cut that condenses at its tray.
 * 2. MOTION - one InstancedMesh of tiny boxes animated entirely in the vertex shader from uTime: bubbles rise in a boiling
 *    flask (fast and small for thin liquids, slow and fat for thick ones), vapour curls up its neck, bubbles drift up a
 *    fermenting vessel, and drops fall from a condensing coil, at a pace that follows the flow and the viscosity.
 * Between rebuilds a frame only advances the shared clock.
 */
import * as THREE from 'three';
import { colourOf, layersOf, total, viscosityOf, type Mix } from '../../core/chem';
import { CHEM, CHEM_CAPACITY_L, chemKindOf } from '../../core/distill';
import type { IWorld } from '../../core/types';
import type { LightProbe } from '../emitters';
import { LiquidBoxes, type LiquidStyle } from '../liquids/liquidBoxes';

export const DISTILL_RANGE = 40;
export const LIQUID_MAX = 512;
export const MOTION_MAX = 768;
const INTERVAL_S = 0.25;
/** One sixteenth of a block: the glass models are drawn in these. */
const P = 1 / 16;

interface Mod {
  kind: string;
  x: number;
  y: number;
  z: number;
  mix: Record<string, number>;
  state: string;
  flow?: number;
  band?: number;
  recvS?: number;
  settleS?: number;
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

const col = new THREE.Color();
const light = new Float32Array(3);

export class DistillFx {
  readonly group = new THREE.Group();
  private readonly liquids: LiquidBoxes;
  private readonly motion: THREE.Mesh;
  private readonly motionGeo: THREE.InstancedBufferGeometry;
  private readonly start: THREE.InstancedBufferAttribute;
  private readonly travel: THREE.InstancedBufferAttribute;
  private readonly time: THREE.InstancedBufferAttribute;
  private readonly colour: THREE.InstancedBufferAttribute;
  private readonly motionMat: THREE.ShaderMaterial;
  private timer = 0;
  private clock = 0;
  private nLiquid = 0;
  private nMotion = 0;

  constructor(private readonly world: IWorld, private readonly probe: LightProbe) {
    this.liquids = new LiquidBoxes(LIQUID_MAX, 'distill-liquids');

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
    this.group.add(this.liquids.mesh, this.motion);
  }

  /** Liquid bodies and moving bits drawn at the last rebuild (tests, stats). */
  get counts(): { liquids: number; motion: number } {
    return { liquids: this.nLiquid, motion: this.nMotion };
  }

  update(dt: number, camX: number, camZ: number): void {
    this.clock = (this.clock + dt) % 3600;
    this.motionMat.uniforms.uTime.value = this.clock;
    this.liquids.tick(this.clock);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = INTERVAL_S;
    this.rebuild(camX, camZ);
  }

  private lit(hex: number, x: number, y: number, z: number, glow = 0): THREE.Color {
    const l = this.probe(x, y, z, light);
    // Raw RGB (no sRGB-to-linear step): the liquid and motion shaders write colour straight out.
    const r = ((hex >> 16) & 255) / 255;
    const g = ((hex >> 8) & 255) / 255;
    const b = (hex & 255) / 255;
    return col.setRGB(r * Math.min(1, l[0] + glow), g * Math.min(1, l[1] + glow), b * Math.min(1, l[2] + glow));
  }

  private box(x: number, y: number, z: number, sx: number, sy: number, sz: number, hex: number, glow = 0, style: LiquidStyle = {}): void {
    this.liquids.add(x, y, z, sx, sy, sz, this.lit(hex, x, y + 0.5, z, glow + 0.2), style);
  }

  /**
   * A vessel's contents settled into layers, bottom first, in a body `w` x `d` from height `y0` up to at most `y0 + hMax`
   * when full. The top layer has the open surface and the boil; the layers below roll gently. Returns the height reached.
   */
  private layered(cx: number, y0: number, cz: number, w: number, d: number, hMax: number, mix: Mix, fill: number, boil: number, glow = 0): number {
    const layers = layersOf(mix);
    const all = layers.reduce((t, l) => t + l.litres, 0);
    let y = y0;
    layers.forEach((l, i) => {
      const h = hMax * Math.min(1, fill) * (all > 0 ? l.litres / all : 0);
      const top = i === layers.length - 1;
      this.box(cx, y, cz, w, h, d, l.colour, glow, { surface: top, boil: top ? boil : boil * 0.4 });
      y += h;
    });
    return y - y0;
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
    this.liquids.begin();
    this.nMotion = 0;
    for (const raw of this.world.entities()) {
      if (chemKindOf(raw.kind) !== raw.kind) continue;
      const e = raw as unknown as Mod;
      const dx = e.x + 0.5 - camX;
      const dz = e.z + 0.5 - camZ;
      if (dx * dx + dz * dz > DISTILL_RANGE * DISTILL_RANGE) continue;
      this.module(e);
    }
    this.liquids.end();
    this.nLiquid = this.liquids.count;
    this.motionGeo.instanceCount = this.nMotion;
    for (const a of [this.start, this.travel, this.time, this.colour]) a.needsUpdate = true;
  }

  private module(e: Mod): void {
    const cx = e.x + 0.5;
    const cz = e.z + 0.5;
    const mix = (e.mix ?? {}) as Mix;
    const litres = total(mix);
    const cap = CHEM_CAPACITY_L[e.kind as keyof typeof CHEM_CAPACITY_L] ?? 0;
    const fill = cap > 0 ? Math.min(1, litres / cap) : 0;
    const hex = colourOf(mix);
    const visc = viscosityOf(mix);
    const working = e.state === 'working';
    const boil = working ? Math.min(1, 0.45 + (e.flow ?? 0) / 20) : 0;
    const run = 0.9 / Math.sqrt(visc);
    switch (e.kind) {
      case CHEM.flask: {
        // The belly (walls 2..14, from 1/16): the charge settles in layers and boils on top.
        const h = this.layered(cx, e.y + P, cz, 10 * P, 10 * P, 10 * P, mix, fill, boil, working ? 0.15 : 0);
        if (working && h > 0.05) {
          const n = Math.min(10, 4 + Math.round((e.flow ?? 0) / 4));
          const period = 0.5 + 0.35 * Math.log2(1 + visc);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            this.bit(cx + Math.cos(a) * 0.2, e.y + 0.1, cz + Math.sin(a) * 0.2, 0, h - 0.04, 0, period, i / n, 0.045 + 0.01 * Math.min(4, visc), 0xf4fbff);
          }
          for (let i = 0; i < 3; i++) this.bit(cx, e.y + h + 0.1, cz, 0, Math.max(0.1, 0.9 - h), 0, 1.1, i / 3, 0.05, 0xe8f2f6);
        }
        break;
      }
      case CHEM.vessel: {
        const h = this.layered(cx, e.y + P, cz, 10 * P, 10 * P, 10 * P, mix, fill, working ? 0.25 : 0);
        if (working && h > 0.05) for (let i = 0; i < 5; i++) this.bit(cx - 0.25 + i * 0.12, e.y + 0.1, cz + (i % 2 ? 0.15 : -0.15), 0, h - 0.04, 0, 2.4, i / 5, 0.035, 0xfaf3dc);
        break;
      }
      case CHEM.receiver: {
        // The jar (walls 3..13, to 7/16), then the neck as it brims; a stream falls in while it receives.
        this.layered(cx, e.y + P, cz, 8 * P, 8 * P, 6 * P, mix, Math.min(1, fill * 1.15), 0);
        if (fill > 0.87) this.box(cx, e.y + 7 * P, cz, 4 * P, Math.min(6 * P, (fill - 0.87) * 4), 4 * P, hex, 0, { surface: true });
        if ((e.recvS ?? 99) < 0.5) this.box(cx, e.y + 7 * P, cz, 1.5 * P, 9 * P, 1.5 * P, hex, 0.1, { flow: [0, -1, 0], speed: run * 1.3 });
        break;
      }
      case CHEM.jacket:
        this.box(cx, e.y, cz, 12 * P, 13 * P * fill, 12 * P, hex, 0, { surface: true, flow: [0, 1, 0], speed: 0.15 });
        break;
      case CHEM.segment:
        if (e.band) {
          this.box(cx, e.y + P, cz, 4 * P, 14 * P, 4 * P, e.band, 0.45, { flow: [0, 1, 0], speed: working ? 0.8 : 0.2, boil: working ? 0.4 : 0 });
          if (working) this.bit(cx, e.y + 0.05, cz, 0, 0.9, 0, 0.8, (e.x * 7 + e.y * 3) % 10 / 10, 0.07, 0xffffff);
        }
        break;
      case CHEM.condenser:
        if (litres > 0.5 || working) {
          // Condensate running down the coil's rod, then dripping.
          this.box(cx, e.y + P, cz, 1.5 * P, 14 * P, 1.5 * P, hex, 0.05, { flow: [0, -1, 0], speed: run });
          const period = 0.35 + 0.25 * Math.log2(1 + visc);
          for (let i = 0; i < 2; i++) this.bit(cx, e.y + 0.1, cz, 0, -0.55, 0, period, i / 2, 0.045, hex);
        }
        break;
      case CHEM.filter:
        if (litres > 0.05) {
          // Liquid standing in the funnel's mouth and running out of its stem.
          this.layered(cx, e.y + 10 * P, cz, 8 * P, 8 * P, 4 * P, mix, fill, 0);
          this.box(cx, e.y, cz, 1.5 * P, 10 * P, 1.5 * P, hex, 0, { flow: [0, -1, 0], speed: run * 0.7 });
        }
        break;
      case CHEM.funnel: {
        // The bulb (5/16 to 13/16): layers settle; once settled the bottom one runs out of the stem.
        this.layered(cx, e.y + 5 * P, cz, 8 * P, 8 * P, 8 * P, mix, fill, 0);
        const layers = layersOf(mix);
        if (working && layers.length > 1 && (e.settleS ?? 0) >= 3) {
          this.box(cx, e.y - 0.5, cz, 1.5 * P, 0.5 + 4 * P, 1.5 * P, layers[0].colour, 0.05, { flow: [0, -1, 0], speed: run });
        } else if (working) {
          // Settling: the layers churn gently apart.
          for (let i = 0; i < 3; i++) this.bit(cx - 0.12 + i * 0.12, e.y + 0.4, cz, 0, 0.3, 0, 1.6, i / 3, 0.035, layers[layers.length - 1]?.colour ?? hex);
        }
        break;
      }
      case CHEM.tube:
        if (litres > 0.05) this.streams(e, hex, Math.max(0.3, fill), run);
        break;
      default:
        break;
    }
  }

  /** A tube carrying liquid: a stream in the tube's channel towards every chemistry neighbour, moving the way it pours. */
  private streams(e: Mod, hex: number, fill: number, run: number): void {
    const cx = e.x + 0.5;
    const cz = e.z + 0.5;
    const w = (1.2 + 1.6 * fill) * P;
    const y = e.y + 0.5 - w / 2;
    this.box(cx, y, cz, w, w, w, hex, 0.05, { flow: [0, -1, 0], speed: run });
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!chemKindOf(this.world.getBlock(e.x + dx, e.y, e.z + dz).key)) continue;
      this.box(cx + dx * 0.25, y, cz + dz * 0.25, dx ? 0.5 : w, w, dz ? 0.5 : w, hex, 0.05, { flow: [dx, 0, dz], speed: run });
      this.bit(cx, y + w / 2, cz, dx * 0.5, 0, dz * 0.5, 0.6, (e.x + e.z) % 4 / 4, w * 0.6, 0xffffff);
    }
    if (chemKindOf(this.world.getBlock(e.x, e.y - 1, e.z).key)) this.box(cx, e.y, cz, w, 0.5, w, hex, 0.05, { flow: [0, -1, 0], speed: run });
  }

  dispose(): void {
    this.liquids.dispose();
    this.motionGeo.dispose();
    this.motionMat.dispose();
  }
}
