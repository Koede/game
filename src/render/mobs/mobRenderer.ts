/**
 * MobRenderer: draws every animal as one instanced mesh per species (one draw call each, whatever the herd
 * size) plus one draw call of blob shadows. Each frame it takes the interpolated MobViews from the MobManager,
 * culls them against the camera frustum and the fog, writes instance matrices (position, yaw, baby scale,
 * tip-over) and per-instance animation / light attributes. Light at each animal is probed from the voxels with
 * the renderer's LightProbe, a few animals per frame, and eased so it never pops. No per-frame allocation.
 */
import * as THREE from 'three';
import { CREATURES } from '../../core/registry';
import type { CreatureSpec, IWorld } from '../../core/types';
import { LightProbe } from '../lightProbe';
import type { WorldUniforms } from '../materials';
import { buildSpeciesGeometry, type SpeciesGeometry } from './geometry';
import { createMobMaterial, createNoiseTexture, createShadowMaterial } from './material';

/** What the MobRenderer reads from each animal (src/mobs' MobView satisfies it). */
export interface MobRenderView {
  id: number;
  spec: CreatureSpec;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  walk: number;
  stride: number;
  head: number;
  flash: number;
  tip: number;
  fade: number;
  onGround: boolean;
  eager: boolean;
}

/** The parts of the Renderer it draws into (the Renderer satisfies it). */
export interface MobScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly uniforms: WorldUniforms;
}

/** Instances per species and shadows in all; animals beyond this are not drawn. */
export const MOB_DRAW_CAPACITY = 64;
/** Light probes per frame (an animal never probed yet is probed at once, up to FRESH_PROBES per frame). */
export const PROBES_PER_FRAME = 2;
export const FRESH_PROBES = 6;
/** Largest leg swing (radians) and the head angles. */
const LEG_SWING = 0.62;
const GRAZE_PITCH = 1.1;
const BABY_HEAD = 1.35;

interface SpeciesBatch {
  spec: CreatureSpec;
  shape: SpeciesGeometry;
  mesh: THREE.InstancedMesh;
  anim: THREE.InstancedBufferAttribute;
  light: THREE.InstancedBufferAttribute;
  count: number;
}

interface LightCache {
  sky: number;
  block: number;
  targetSky: number;
  targetBlock: number;
  probed: boolean;
  seen: number;
}

export class MobRenderer {
  /** Instances drawn in the last update (after culling). */
  drawn = 0;

  private readonly group = new THREE.Group();
  private readonly batches = new Map<CreatureSpec, SpeciesBatch>();
  private readonly batchList: SpeciesBatch[] = [];
  private readonly material: THREE.ShaderMaterial;
  private readonly shadowMaterial: THREE.ShaderMaterial;
  private readonly noise: THREE.DataTexture;
  private readonly shadows: THREE.InstancedMesh;
  private readonly shadowAlpha: THREE.InstancedBufferAttribute;
  private readonly probe: LightProbe;
  private readonly lights = new Map<number, LightCache>();
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private frame = 0;
  private probeCursor = 0;
  private time = 0;

  constructor(
    private readonly view: MobScene,
    world: IWorld,
  ) {
    this.probe = new LightProbe(world);
    this.noise = createNoiseTexture();
    this.material = createMobMaterial(view.uniforms, this.noise);
    this.shadowMaterial = createShadowMaterial(view.uniforms);
    for (const spec of CREATURES) this.addBatch(spec);

    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadowAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MOB_DRAW_CAPACITY), 1).setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('aShadow', this.shadowAlpha);
    this.shadows = new THREE.InstancedMesh(quad, this.shadowMaterial, MOB_DRAW_CAPACITY);
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.shadows.renderOrder = 1;
    this.group.add(this.shadows);
    this.group.name = 'mobs';
    view.scene.add(this.group);
  }

  private addBatch(spec: CreatureSpec): SpeciesBatch {
    const shape = buildSpeciesGeometry(spec);
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(MOB_DRAW_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const light = new THREE.InstancedBufferAttribute(new Float32Array(MOB_DRAW_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
    shape.geometry.setAttribute('aAnim', anim);
    shape.geometry.setAttribute('aLight', light);
    const mesh = new THREE.InstancedMesh(shape.geometry, this.material, MOB_DRAW_CAPACITY);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // culled per animal below
    mesh.count = 0;
    mesh.name = `mob-${spec.key}`;
    const batch: SpeciesBatch = { spec, shape, mesh, anim, light, count: 0 };
    this.batches.set(spec, batch);
    this.batchList.push(batch);
    this.group.add(mesh);
    return batch;
  }

  /** Draw setup for this frame. Call after the simulation ticks and before Renderer.render(dt). */
  update(dt: number, mobs: readonly MobRenderView[]): void {
    this.frame++;
    this.time += dt;
    const cam = this.view.camera;
    cam.updateMatrixWorld();
    this.projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const fogEnd = this.view.uniforms.uFog.value.y + 2;
    const fogEnd2 = fogEnd * fogEnd;
    const cx = cam.position.x;
    const cy = cam.position.y;
    const cz = cam.position.z;

    for (const b of this.batchList) b.count = 0;
    let shadows = 0;
    let probes = 0;
    let fresh = 0;
    const n = mobs.length;
    // Round-robin re-probing across the herd.
    if (this.probeCursor >= n) this.probeCursor = 0;
    for (let i = 0; i < n; i++) {
      const v = mobs[i];
      let lc = this.lights.get(v.id);
      if (!lc) {
        lc = { sky: 1, block: 0, targetSky: 1, targetBlock: 0, probed: false, seen: 0 };
        this.lights.set(v.id, lc);
      }
      lc.seen = this.frame;
      const due = i === (this.probeCursor + probes) % n && probes < PROBES_PER_FRAME;
      if ((!lc.probed && fresh < FRESH_PROBES) || due) {
        this.probe.probe(v.x, v.y + v.spec.size.h * v.scale * 0.6, v.z);
        lc.targetSky = this.probe.sky;
        lc.targetBlock = this.probe.block;
        if (!lc.probed) {
          lc.sky = lc.targetSky;
          lc.block = lc.targetBlock;
          lc.probed = true;
          fresh++;
        } else probes++;
      }
      const k = Math.min(1, dt * 4);
      lc.sky += (lc.targetSky - lc.sky) * k;
      lc.block += (lc.targetBlock - lc.block) * k;

      const dx = v.x - cx;
      const dy = v.y - cy;
      const dz = v.z - cz;
      if (dx * dx + dy * dy + dz * dz > fogEnd2) continue;
      const batch = this.batches.get(v.spec) ?? this.addBatch(v.spec);
      const s = batch.shape;
      this.sphere.center.set(v.x, v.y + s.height * 0.5 * v.scale, v.z);
      this.sphere.radius = s.radius * v.scale + 0.2;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      if (batch.count >= MOB_DRAW_CAPACITY) continue;
      this.writeInstance(batch, v, lc);
      if (shadows < MOB_DRAW_CAPACITY && v.fade < 1) {
        this.writeShadow(shadows, v);
        shadows++;
      }
    }
    this.probeCursor = n > 0 ? (this.probeCursor + Math.max(1, probes)) % n : 0;

    let drawn = 0;
    for (const b of this.batchList) {
      b.mesh.count = b.count;
      drawn += b.count;
      if (b.count > 0) {
        flush(b.mesh.instanceMatrix, b.count * 16);
        flush(b.anim, b.count * 4);
        flush(b.light, b.count * 4);
      }
    }
    this.shadows.count = shadows;
    if (shadows > 0) {
      flush(this.shadows.instanceMatrix, shadows * 16);
      flush(this.shadowAlpha, shadows);
    }
    this.drawn = drawn;
    if ((this.frame & 63) === 0) this.forgetGone();
  }

  private writeInstance(b: SpeciesBatch, v: MobRenderView, lc: LightCache): void {
    const i = b.count++;
    const s = v.scale;
    // Tip over onto a side (alternating by id), lifted so the body rests on the ground.
    const phi = (v.id & 1 ? 1 : -1) * v.tip * (Math.PI / 2);
    const cy = Math.cos(v.yaw);
    const sy = Math.sin(v.yaw);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const lift = Math.abs(sp) * v.spec.size.w * 0.5 * s;
    // M = T * Ry(yaw) * Rz(phi) * S(s), column-major.
    const e = b.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    e[o] = cy * cp * s;
    e[o + 1] = sp * s;
    e[o + 2] = -sy * cp * s;
    e[o + 3] = 0;
    e[o + 4] = -cy * sp * s;
    e[o + 5] = cp * s;
    e[o + 6] = sy * sp * s;
    e[o + 7] = 0;
    e[o + 8] = sy * s;
    e[o + 9] = 0;
    e[o + 10] = cy * s;
    e[o + 11] = 0;
    e[o + 12] = v.x;
    e[o + 13] = v.y + lift;
    e[o + 14] = v.z;
    e[o + 15] = 1;

    const alive = v.tip === 0;
    const freq = 1.9 / b.shape.legHeight;
    const swing = alive ? Math.sin(v.walk * freq) * LEG_SWING * v.stride : 0;
    // Grazing: head down with a little nibble; walking: a small nod in step.
    const nibble = v.head > 0.5 ? Math.sin(this.time * 9 + v.id) * 0.08 * v.head : 0;
    const nod = Math.sin(v.walk * freq * 2) * 0.07 * v.stride;
    const a = b.anim.array as Float32Array;
    a[i * 4] = swing;
    a[i * 4 + 1] = alive ? -(v.head * GRAZE_PITCH) + nibble + nod : 0;
    a[i * 4 + 2] = s < 1 ? BABY_HEAD : 1;
    a[i * 4 + 3] = v.flash;
    const l = b.light.array as Float32Array;
    l[i * 4] = lc.sky;
    l[i * 4 + 1] = lc.block;
    l[i * 4 + 2] = v.fade;
    l[i * 4 + 3] = v.eager ? 1 : 0;
  }

  private writeShadow(i: number, v: MobRenderView): void {
    const w = v.spec.size.w * v.scale * 1.45;
    const len = w * 1.3;
    const cy = Math.cos(v.yaw);
    const sy = Math.sin(v.yaw);
    const e = this.shadows.instanceMatrix.array as Float32Array;
    const o = i * 16;
    // T * Ry(yaw) * S(w, 1, len): an oval longer along the body.
    e[o] = cy * w;
    e[o + 1] = 0;
    e[o + 2] = -sy * w;
    e[o + 3] = 0;
    e[o + 4] = 0;
    e[o + 5] = 1;
    e[o + 6] = 0;
    e[o + 7] = 0;
    e[o + 8] = sy * len;
    e[o + 9] = 0;
    e[o + 10] = cy * len;
    e[o + 11] = 0;
    e[o + 12] = v.x;
    e[o + 13] = v.y + 0.02;
    e[o + 14] = v.z;
    e[o + 15] = 1;
    (this.shadowAlpha.array as Float32Array)[i] = (v.onGround ? 0.52 : 0.25) * (1 - v.fade);
  }

  /** Drops light caches of animals not seen for a while (they died or left the loaded world). */
  private forgetGone(): void {
    for (const [id, lc] of this.lights) if (this.frame - lc.seen > 60) this.lights.delete(id);
  }

  dispose(): void {
    this.view.scene.remove(this.group);
    for (const b of this.batchList) {
      b.mesh.dispose();
      b.shape.geometry.dispose();
    }
    this.shadows.geometry.dispose();
    this.shadows.dispose();
    this.material.dispose();
    this.shadowMaterial.dispose();
    this.noise.dispose();
  }
}

function flush(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count);
  attr.needsUpdate = true;
}
