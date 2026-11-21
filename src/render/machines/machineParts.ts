/**
 * MachineParts: the moving parts of machines near the camera - wind turbine rotors, water wheels, steam engine
 * flywheels and piston rods, steam turbine rotors, bore rig drills and pump pistons. One instanced draw call per
 * machine kind in view. Twice a second it scans the world's block entities (like the particle emitters) and keeps a
 * record per animated machine: its instance matrix, the speed its parts should turn at (from the entity's output or
 * work), its drill length. Each frame it eases every speed, advances the angles, culls against the frustum and the
 * fog, and writes the instance data of the visible ones. Light is probed from the voxels a few machines per frame.
 * No allocation per frame.
 */
import * as THREE from 'three';
import { blockOf } from '../../core/registry';
import { voxelActive, voxelFacing, type IWorld } from '../../core/types';
import { signedCool } from '../coolLight';
import { LightProbe } from '../lightProbe';
import type { WorldUniforms } from '../materials';
import { createMachineMaterial } from './material';
import { MACHINE_ANIMS, type MachineAnim } from './models';

/** Instances per machine kind; machines beyond it are not drawn. */
export const MACHINE_DRAW_CAPACITY = 128;
export const SCAN_INTERVAL_S = 0.5;
/** Animated machines are tracked this far from the camera (horizontal blocks). */
export const MACHINE_RANGE = 96;
/** Light probes per frame for machines never probed; and every REPROBE_FRAMES frames one re-probe, round-robin. */
export const FRESH_PROBES = 8;
export const REPROBE_FRAMES = 3;
/** How quickly a machine's parts reach the speed it should run at (1/s): spin-up and coasting to a stop. */
const SPIN_EASE = 1.2;
const TAU = Math.PI * 2;

interface Batch {
  anim: MachineAnim;
  mesh: THREE.InstancedMesh;
  state: THREE.InstancedBufferAttribute;
  cool: THREE.InstancedBufferAttribute;
  count: number;
}

interface Rec {
  key: number;
  batch: Batch;
  x: number;
  y: number;
  z: number;
  /** Instance matrix without shake (column-major). */
  readonly matrix: Float32Array;
  angle: number;
  speed: number;
  target: number;
  extent: number;
  running: boolean;
  sky: number;
  block: number;
  /** Signed cool share of the block light (coolLight.ts). */
  cool: number;
  probed: boolean;
  seen: number;
}

/** A number unique to a block position (x and z within +-2^19, y within 0..127). */
const posKey = (x: number, y: number, z: number): number => ((x + 524288) * 1048576 + (z + 524288)) * 128 + y;

export class MachineParts {
  readonly group = new THREE.Group();
  /** Instances drawn in the last update, and records tracked. */
  drawn = 0;
  private readonly batches: Batch[] = [];
  private readonly byKind = new Map<string, Batch>();
  private readonly records: Rec[] = [];
  private readonly byKey = new Map<number, Rec>();
  private readonly material: THREE.ShaderMaterial;
  private readonly probe: LightProbe;
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private scanTimer = 0;
  private generation = 0;
  private probeCursor = 0;
  private frame = 0;
  private camX = 0;
  private camZ = 0;
  private time = 0;

  constructor(
    private readonly world: IWorld,
    private readonly uniforms: WorldUniforms,
  ) {
    this.probe = new LightProbe(world);
    this.material = createMachineMaterial(uniforms);
    for (const anim of MACHINE_ANIMS) {
      const model = anim.build();
      const state = new THREE.InstancedBufferAttribute(new Float32Array(MACHINE_DRAW_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
      const cool = new THREE.InstancedBufferAttribute(new Float32Array(MACHINE_DRAW_CAPACITY), 1).setUsage(THREE.DynamicDrawUsage);
      model.geometry.setAttribute('aState', state);
      model.geometry.setAttribute('aCool', cool);
      const mesh = new THREE.InstancedMesh(model.geometry, this.material, MACHINE_DRAW_CAPACITY);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; // culled per machine
      mesh.count = 0;
      mesh.visible = false;
      mesh.name = `machine-${anim.kind}`;
      const batch: Batch = { anim, mesh, state, cool, count: 0 };
      this.batches.push(batch);
      this.byKind.set(anim.kind, batch);
      this.group.add(mesh);
    }
    this.group.name = 'machine-parts';
  }

  /** Machines tracked near the camera. */
  get tracked(): number {
    return this.records.length;
  }

  /** Advances and draws-up the parts for this frame. Call before rendering the scene. */
  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.time += dt;
    this.camX = camera.position.x;
    this.camZ = camera.position.z;
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = SCAN_INTERVAL_S;
      this.scan();
    }
    camera.updateMatrixWorld();
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const fogEnd = this.uniforms.uFog.value.y;
    for (const b of this.batches) b.count = 0;

    const ease = Math.min(1, dt * SPIN_EASE);
    const n = this.records.length;
    let fresh = 0;
    for (let i = 0; i < n; i++) {
      const r = this.records[i];
      r.speed += (r.target - r.speed) * ease;
      r.angle = (r.angle + r.speed * dt) % TAU;
      const anim = r.batch.anim;
      const sx = r.x + 0.5;
      const sy = r.y + anim.centerY;
      const sz = r.z + 0.5;
      const reach = fogEnd + anim.radius;
      const dx = sx - cx;
      const dy = sy - cy;
      const dz = sz - cz;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      this.sphere.center.set(sx, sy, sz);
      this.sphere.radius = anim.radius + (anim.extent ? r.extent : 0);
      if (anim.extent) this.sphere.center.y -= r.extent * 0.5;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      if (!r.probed) {
        if (fresh >= FRESH_PROBES) continue;
        this.probeRecord(r);
        fresh++;
      }
      if (r.batch.count < MACHINE_DRAW_CAPACITY) this.write(r);
    }
    // A slow round-robin re-probe keeps the light current (a torch placed, a furnace lit) without a spike.
    if (n > 0 && ++this.frame % REPROBE_FRAMES === 0) {
      this.probeCursor = (this.probeCursor + 1) % n;
      const r = this.records[this.probeCursor];
      if (r.probed) this.probeRecord(r);
    }

    let drawn = 0;
    for (const b of this.batches) {
      b.mesh.count = b.count;
      b.mesh.visible = b.count > 0;
      drawn += b.count;
      if (b.count === 0) continue;
      flush(b.mesh.instanceMatrix, b.count * 16);
      flush(b.state, b.count * 4);
      flush(b.cool, b.count);
    }
    this.drawn = drawn;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const b of this.batches) {
      b.mesh.geometry.dispose();
      b.mesh.dispose();
    }
    this.material.dispose();
  }

  private write(r: Rec): void {
    const b = r.batch;
    const i = b.count++;
    const e = b.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    e.set(r.matrix, o);
    const shake = b.anim.shake;
    if (shake && r.running && r.speed > 0.5) {
      const t = this.time * 37 + r.x * 1.7 + r.z * 2.3;
      e[o + 12] += Math.sin(t) * shake;
      e[o + 13] += Math.sin(t * 1.31) * shake * 0.6;
      e[o + 14] += Math.cos(t * 0.87) * shake;
    }
    const s = b.state.array as Float32Array;
    s[i * 4] = r.angle;
    s[i * 4 + 1] = r.extent;
    s[i * 4 + 2] = r.sky;
    s[i * 4 + 3] = r.block;
    (b.cool.array as Float32Array)[i] = r.cool;
  }

  private probeRecord(r: Rec): void {
    this.probe.probe(r.x + 0.5, r.y + r.batch.anim.probeY, r.z + 0.5);
    r.sky = this.probe.sky;
    r.block = this.probe.block;
    r.cool = signedCool(this.probe);
    r.probed = true;
  }

  /** Finds the animated machines near the camera and refreshes what each should do. */
  private scan(): void {
    const gen = ++this.generation;
    for (const e of this.world.entities()) {
      const batch = this.byKind.get(e.kind);
      if (!batch) continue;
      const dx = e.x + 0.5 - this.camX;
      const dz = e.z + 0.5 - this.camZ;
      if (dx * dx + dz * dz > MACHINE_RANGE * MACHINE_RANGE) continue;
      if (!this.world.isLoaded(e.x, e.z)) continue;
      const v = this.world.getVoxel(e.x, e.y, e.z);
      // The entity may outlive its block for a moment (a machine just broken).
      if (blockOf(v).machine !== e.kind) continue;
      const key = posKey(e.x, e.y, e.z);
      let r = this.byKey.get(key);
      if (!r || r.batch !== batch) {
        if (r) this.forget(r);
        r = {
          key, batch, x: e.x, y: e.y, z: e.z, matrix: new Float32Array(16), angle: ((e.x * 7 + e.z * 13) % 10) * 0.6,
          speed: 0, target: 0, extent: 1, running: false, sky: 1, block: 0, cool: 0, probed: false, seen: gen,
        };
        this.byKey.set(key, r);
        this.records.push(r);
      }
      r.seen = gen;
      const active = voxelActive(v);
      r.running = active;
      r.target = batch.anim.speed(e, active);
      r.extent = batch.anim.extent ? batch.anim.extent(e) : 1;
      const anim = batch.anim;
      const yaw = anim.byWater ? this.waterYaw(e.x, e.y, e.z) : anim.openSide ? openSideYaw(this.world, e.x, e.y, e.z) : -voxelFacing(v) * (Math.PI / 2);
      placeMatrix(r.matrix, e.x + 0.5, e.y, e.z + 0.5, yaw);
    }
    for (let i = this.records.length - 1; i >= 0; i--) {
      const r = this.records[i];
      if (r.seen !== gen) this.forget(r);
    }
  }

  private forget(r: Rec): void {
    this.byKey.delete(r.key);
    const i = this.records.indexOf(r);
    if (i < 0) return;
    const last = this.records.pop() as Rec;
    if (last !== r) this.records[i] = last;
  }

  /** A water wheel's rim runs through the water: along Z unless the water lies only east or west of it. */
  private waterYaw(x: number, y: number, z: number): number {
    const w = this.world;
    const water = (dx: number, dz: number): number => (blockOf(w.getVoxel(x + dx, y, z + dz)).liquid ? 1 : 0);
    const alongZ = water(0, 1) + water(0, -1);
    const alongX = water(1, 0) + water(-1, 0);
    return alongX > alongZ ? Math.PI / 2 : 0;
  }
}

/** The four flanks in order of preference (+X first, as the models are built), with the yaw that turns +X there. */
const FLANKS: readonly (readonly [dx: number, dz: number, yaw: number])[] = [
  [1, 0, 0],
  [0, -1, Math.PI / 2],
  [-1, 0, Math.PI],
  [0, 1, -Math.PI / 2],
];

/**
 * Yaw that turns a model's +X flank to the most open side of the block at (x, y, z): empty air first, then
 * something thin (a plant, a torch, a cable), never a solid block or a liquid unless every side is one. Ties keep
 * the earlier flank, so a free-standing engine looks as it always did.
 */
export function openSideYaw(world: IWorld, x: number, y: number, z: number): number {
  let best = -1;
  let yaw = 0;
  for (const [dx, dz, flankYaw] of FLANKS) {
    const def = blockOf(world.getVoxel(x + dx, y, z + dz));
    const score = def.liquid !== null || def.solid ? 0 : def.shape === 'none' ? 2 : 1;
    if (score > best) {
      best = score;
      yaw = flankYaw;
    }
  }
  return yaw;
}

/** T(x, y, z) * Ry(yaw), column-major. */
export function placeMatrix(m: Float32Array, x: number, y: number, z: number, yaw: number): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  m[0] = c; m[1] = 0; m[2] = -s; m[3] = 0;
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
  m[8] = s; m[9] = 0; m[10] = c; m[11] = 0;
  m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
}

function flush(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count);
  attr.needsUpdate = true;
}
