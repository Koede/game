/**
 * HandParts: the moving parts of the hand stations near the camera (EMBER_PLAN 2 and 5), through the machine-parts
 * layer (the same model builder, shader, light probe and instancing as src/render/machines). The difference is the
 * driver: machines turn at a speed, a hand station moves only when the player strokes it, so every record keeps
 * the little state of "what just happened" (strokes counted, seconds since the last one, work done) and the models'
 * poses (handModels.ts) turn that into the two numbers the shader takes. A stroke event also spawns the station's
 * particles. Twice a second it rescans the world's `hand` entities within range for what is loaded (a log on the
 * block, hide on the rack) and how far the work is. One instanced draw call per part in view; nothing is allocated
 * per frame.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import { blockOf, recipe } from '../../core/registry';
import { voxelFacing, type BlockEntity, type IWorld, type ItemStack } from '../../core/types';
import { signedCool } from '../coolLight';
import { LightProbe } from '../lightProbe';
import { createMachineMaterial } from '../machines/material';
import { placeMatrix } from '../machines/machineParts';
import type { WorldUniforms } from '../materials';
import type { Particles } from '../particles';
import { HandFx } from './handFx';
import { HAND_ANIMS, type HandAnim, type HandRec, type PartDef, type Pose } from './handModels';

export const HAND_DRAW_CAPACITY = 64;
export const HAND_RANGE = 64;
export const SCAN_INTERVAL_S = 0.5;
const FRESH_PROBES = 8;
const REPROBE_FRAMES = 3;
const LONG_AGO = 1e3;

interface Batch {
  anim: HandAnim;
  part: PartDef;
  mesh: THREE.InstancedMesh;
  state: THREE.InstancedBufferAttribute;
  cool: THREE.InstancedBufferAttribute;
  count: number;
}

interface Rec extends HandRec {
  key: number;
  anim: HandAnim;
  x: number;
  y: number;
  z: number;
  readonly matrix: Float32Array;
  sky: number;
  block: number;
  cool: number;
  probed: boolean;
}

const posKey = (x: number, y: number, z: number): number => ((x + 524288) * 1048576 + (z + 524288)) * 128 + y;
const itemOf = (v: unknown): string => {
  const s = v as ItemStack | null | undefined;
  return s && typeof s.item === 'string' ? s.item : '';
};

/** What a rack holds, as the variant of bundle to hang: 1 leaves or grass, 2 hide, 3 finished goods. */
function rackVariant(input: string, output: string): number {
  if (output) return 3;
  if (!input) return 0;
  return input.includes('hide') ? 2 : 1;
}

export class HandParts {
  readonly group = new THREE.Group();
  /** Instances drawn in the last update. */
  drawn = 0;
  private readonly batches: Batch[] = [];
  private readonly animBatches = new Map<HandAnim, Batch[]>();
  private readonly byStation = new Map<string, HandAnim>();
  private readonly records: Rec[] = [];
  private readonly byKey = new Map<number, Rec>();
  private readonly material: THREE.ShaderMaterial;
  private readonly probe: LightProbe;
  private readonly fx: HandFx;
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly pose: Pose = { x: 0, y: 0 };
  private readonly offs: (() => void)[];
  private scanTimer = 0;
  private probeCursor = 0;
  private frame = 0;
  private camX = 0;
  private camZ = 0;
  private time = 0;

  constructor(
    private readonly world: IWorld,
    private readonly uniforms: WorldUniforms,
    bus: GameBus,
    particles: Particles,
  ) {
    this.probe = new LightProbe(world);
    this.fx = new HandFx(particles);
    this.material = createMachineMaterial(uniforms);
    for (const anim of HAND_ANIMS) {
      const list: Batch[] = [];
      for (const part of anim.parts) {
        const model = part.build();
        const state = new THREE.InstancedBufferAttribute(new Float32Array(HAND_DRAW_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
        const cool = new THREE.InstancedBufferAttribute(new Float32Array(HAND_DRAW_CAPACITY), 1).setUsage(THREE.DynamicDrawUsage);
        model.geometry.setAttribute('aState', state);
        model.geometry.setAttribute('aCool', cool);
        const mesh = new THREE.InstancedMesh(model.geometry, this.material, HAND_DRAW_CAPACITY);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `hand-${anim.stations[0]}-${part.name}`;
        const batch: Batch = { anim, part, mesh, state, cool, count: 0 };
        list.push(batch);
        this.batches.push(batch);
        this.group.add(mesh);
      }
      this.animBatches.set(anim, list);
      for (const s of anim.stations) this.byStation.set(s, anim);
    }
    this.group.name = 'hand-parts';
    this.offs = [
      bus.on('hand:stroke', (e) => this.onStroke(e.station, e.x, e.y, e.z, e.progress, e.needed, e.double)),
      bus.on('hand:done', (e) => {
        const r = this.record(e.x, e.y, e.z);
        if (r) r.frac = 0;
        this.fx.done(e.x, e.y, e.z);
      }),
    ];
  }

  get tracked(): number {
    return this.records.length;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const fogEnd = this.uniforms.uFog.value.y;
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
    for (const b of this.batches) b.count = 0;
    let fresh = 0;
    const n = this.records.length;
    for (let i = 0; i < n; i++) {
      const r = this.records[i];
      r.since += dt;
      r.time = this.time;
      const turn = r.anim.turn;
      if (turn) r.angle += (r.strokes * turn - r.angle) * Math.min(1, dt * 14);
      const sx = r.x + 0.5;
      const sy = r.y + r.anim.centerY;
      const sz = r.z + 0.5;
      const reach = fogEnd + r.anim.radius;
      const dx = sx - cx;
      const dy = sy - cy;
      const dz = sz - cz;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      this.sphere.center.set(sx, sy, sz);
      this.sphere.radius = r.anim.radius;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      if (!r.probed) {
        if (fresh >= FRESH_PROBES) continue;
        this.probeRecord(r);
        fresh++;
      }
      for (const b of this.animBatches.get(r.anim) as Batch[]) {
        if (b.count < HAND_DRAW_CAPACITY && b.part.visible(r)) this.write(r, b);
      }
    }
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
    for (const off of this.offs) off();
    this.group.removeFromParent();
    for (const b of this.batches) {
      b.mesh.geometry.dispose();
      b.mesh.dispose();
    }
    this.material.dispose();
  }

  private write(r: Rec, b: Batch): void {
    const i = b.count++;
    (b.mesh.instanceMatrix.array as Float32Array).set(r.matrix, i * 16);
    b.part.pose(r, this.pose);
    const s = b.state.array as Float32Array;
    s[i * 4] = this.pose.x;
    s[i * 4 + 1] = this.pose.y;
    s[i * 4 + 2] = r.sky;
    s[i * 4 + 3] = r.block;
    (b.cool.array as Float32Array)[i] = r.cool;
  }

  private probeRecord(r: Rec): void {
    this.probe.probe(r.x + 0.5, r.y + r.anim.probeY, r.z + 0.5);
    r.sky = this.probe.sky;
    r.block = this.probe.block;
    r.cool = signedCool(this.probe);
    r.probed = true;
  }

  private onStroke(station: string, x: number, y: number, z: number, progress: number, needed: number, double: boolean): void {
    const r = this.record(x, y, z);
    if (r) {
      r.strokes++;
      r.since = 0;
      r.loaded = true;
      r.frac = needed > 0 ? Math.min(1, progress / needed) : 0;
    }
    this.fx.stroke(station, x, y, z, double);
  }

  /** The record of the station block at (x, y, z), made on the spot when the block is a known station. */
  private record(x: number, y: number, z: number): Rec | null {
    const key = posKey(x, y, z);
    const have = this.byKey.get(key);
    if (have) return have;
    if (!this.world.isLoaded(x, z)) return null;
    const v = this.world.getVoxel(x, y, z);
    const anim = this.byStation.get(blockOf(v).key);
    if (!anim) return null;
    const r: Rec = {
      key, anim, x, y, z, matrix: new Float32Array(16), strokes: 0, since: LONG_AGO, time: this.time, frac: 0, loaded: false,
      ready: false, variant: 0, angle: 0, phase: ((x * 7 + z * 13) % 10) * 0.63, sky: 1, block: 0, cool: 0, probed: false,
    };
    placeMatrix(r.matrix, x + 0.5, y, z + 0.5, -voxelFacing(v) * (Math.PI / 2));
    this.byKey.set(key, r);
    this.records.push(r);
    return r;
  }

  /** Finds the stations near the camera and refreshes what each holds and how far its work is. */
  private scan(): void {
    for (const e of this.world.entities()) {
      if (e.kind !== 'hand') continue;
      const dx = e.x + 0.5 - this.camX;
      const dz = e.z + 0.5 - this.camZ;
      if (dx * dx + dz * dz > HAND_RANGE * HAND_RANGE) continue;
      const r = this.record(e.x, e.y, e.z);
      if (!r) continue;
      this.refresh(r, e);
    }
    // Forget stations whose block is gone or that the camera has left far behind.
    for (let i = this.records.length - 1; i >= 0; i--) {
      const r = this.records[i];
      const dx = r.x + 0.5 - this.camX;
      const dz = r.z + 0.5 - this.camZ;
      const gone = this.world.isLoaded(r.x, r.z) && this.byStation.get(blockOf(this.world.getVoxel(r.x, r.y, r.z)).key) !== r.anim;
      if (gone || dx * dx + dz * dz > 4 * HAND_RANGE * HAND_RANGE) this.forget(r);
    }
  }

  private refresh(r: Rec, e: BlockEntity): void {
    // The sim's entity keeps [input, output] in `slots` (docs/api/handwork.md names them input and output).
    const slots = Array.isArray(e.slots) ? (e.slots as unknown[]) : [];
    const input = itemOf(slots[0] ?? e.input);
    const output = itemOf(slots[1] ?? e.output);
    r.loaded = input !== '';
    r.ready = output !== '';
    r.variant = r.anim.stations[0] === 'drying_rack' ? rackVariant(input, output) : 0;
    const spec = typeof e.recipe === 'string' ? recipe(e.recipe) : null;
    const need = spec ? (spec.strokes ?? spec.timeS ?? 0) : 0;
    r.frac = need > 0 && typeof e.progress === 'number' ? Math.min(1, e.progress / need) : 0;
    // A station loaded from a save starts with its stone where its strokes put it (no spin-up on arrival).
    if (r.strokes === 0 && typeof e.progress === 'number' && spec?.strokes) r.strokes = e.progress;
    if (r.angle === 0 && r.since >= LONG_AGO && r.anim.turn) r.angle = r.strokes * r.anim.turn;
  }

  private forget(r: Rec): void {
    this.byKey.delete(r.key);
    const i = this.records.indexOf(r);
    if (i < 0) return;
    const last = this.records.pop() as Rec;
    if (last !== r) this.records[i] = last;
  }
}

function flush(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count);
  attr.needsUpdate = true;
}
