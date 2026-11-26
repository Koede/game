/**
 * Draws the moving parts of the Bronze workshop (docs/api/workshop.md): cogs turning on top of every running gear part, chain
 * and belt links between sprockets and pulleys, mechanical arms swinging between source and target, deployer pistons, drill
 * bits, mixer paddles and press rams. Two InstancedMeshes (cogs and bars), unlit flat colours, no allocation per frame.
 *
 * A third mesh carries structure blocks that are mid-step. Pass `Contraptions.motions()` as the third argument of `update`
 * (S10, from game.ts). Each block lerps from its old cell to its new one; a bearing yaws about its pivot. The world mesh
 * still draws the voxel at `from` until S10 hides those cells (and `vacating()`).
 */
import * as THREE from 'three';
import { Facing } from '../../core/types';
import type { StructureMotion } from '../../workshop/contraption';
import type { SwingView, WorkshopView } from '../../workshop/workshop';
import type { GroundScene } from '../groundItems';
import { structurePose, type StructurePose } from './structurePose';

const MAX = 768;
const MAX_BLOCKS = 256;
const BRONZE = new THREE.Color(0xd09a4c);
const DARK = new THREE.Color(0x6a4a1c);
const IRON = new THREE.Color(0x9aa2ac);
const LEATHER = new THREE.Color(0x7a4a24);
const WOOD = new THREE.Color(0xa07a40);
const FRAME = new THREE.Color(0xc8a060);

const KIND_TINT: Record<string, number> = {
  contraption_frame: 0xc8a060,
  conveyor_belt: 0x7a4a24,
  depot: 0x8d949c,
  skiff: 0x8a5a32,
  rail: 0x6e7580,
  mech_arm: 0xd09a4c,
  mech_drill: 0x9aa2ac,
  mixer: 0xd09a4c,
  deployer: 0x9aa2ac,
  saw_arm: 0x9aa2ac,
  piston: 0xb87333,
  bearing: 0xb87333,
};

const FRONT: Record<number, [number, number]> = { [Facing.North]: [0, -1], [Facing.East]: [1, 0], [Facing.South]: [0, 1], [Facing.West]: [-1, 0] };

const cellKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export class WorkshopRenderer {
  readonly group = new THREE.Group();
  private readonly cogs: THREE.InstancedMesh;
  private readonly bars: THREE.InstancedMesh;
  private readonly blocks: THREE.InstancedMesh;
  private readonly angle = new Map<string, number>();
  private readonly motionAt = new Map<string, StructureMotion>();
  private readonly poseAt = new Map<string, StructurePose>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(1, 0, 0);
  private readonly dir = new THREE.Vector3();
  private readonly tint = new THREE.Color();
  private nCogs = 0;
  private nBars = 0;
  private nBlocks = 0;
  private time = 0;
  /** Counts of the last frame, for tests and the e2e. `blocks` is structure voxels mid-step. */
  stats = { cogs: 0, bars: 0, blocks: 0 };

  constructor(private readonly scene: GroundScene) {
    const cogGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8);
    const barGeo = new THREE.BoxGeometry(1, 1, 1);
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    this.cogs = new THREE.InstancedMesh(cogGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.bars = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.blocks = new THREE.InstancedMesh(blockGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BLOCKS);
    this.blocks.name = 'structure-blocks';
    for (const mesh of [this.cogs, this.bars, this.blocks]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
    }
    scene.scene.add(this.group);
  }

  private bindMotions(motions: readonly StructureMotion[]): void {
    this.motionAt.clear();
    this.poseAt.clear();
    for (const motion of motions) {
      const key = cellKey(motion.from[0], motion.from[1], motion.from[2]);
      this.motionAt.set(key, motion);
      this.poseAt.set(key, structurePose(motion));
    }
  }

  /** World point that belongs to the block at (cx, cy, cz), slid or yawed with that block's step. */
  private nudge(cx: number, cy: number, cz: number, x: number, y: number, z: number): [number, number, number] {
    const pose = this.poseAt.get(cellKey(cx, cy, cz));
    if (!pose) return [x, y, z];
    const ox = x - (cx + 0.5);
    const oy = y - (cy + 0.5);
    const oz = z - (cz + 0.5);
    const c = Math.cos(pose.yaw);
    const s = Math.sin(pose.yaw);
    return [pose.x + ox * c - oz * s, pose.y + oy, pose.z + ox * s + oz * c];
  }

  private cog(x: number, y: number, z: number, angle: number, scale: number, color: THREE.Color): void {
    if (this.nCogs >= MAX) return;
    this.e.set(0, angle, 0);
    this.q.setFromEuler(this.e);
    this.v.set(x, y, z);
    this.s.set(scale, 1, scale);
    this.m.compose(this.v, this.q, this.s);
    this.cogs.setMatrixAt(this.nCogs, this.m);
    this.cogs.setColorAt(this.nCogs, color);
    this.nCogs++;
  }

  /** A box from (x1,y1,z1) to (x2,y2,z2) of the given thickness. */
  private bar(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, thick: number, color: THREE.Color): void {
    if (this.nBars >= MAX) return;
    this.dir.set(x2 - x1, y2 - y1, z2 - z1);
    const len = this.dir.length();
    if (len < 1e-4) return;
    this.dir.divideScalar(len);
    this.q.setFromUnitVectors(this.up, this.dir);
    this.v.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    this.s.set(len, thick, thick);
    this.m.compose(this.v, this.q, this.s);
    this.bars.setMatrixAt(this.nBars, this.m);
    this.bars.setColorAt(this.nBars, color);
    this.nBars++;
  }

  /** The structure block itself, at the lerped (or yawed) pose. One unit cube. */
  private structureBlock(motion: StructureMotion): void {
    if (this.nBlocks >= MAX_BLOCKS) return;
    const pose = this.poseAt.get(cellKey(motion.from[0], motion.from[1], motion.from[2])) ?? structurePose(motion);
    this.e.set(0, pose.yaw, 0);
    this.q.setFromEuler(this.e);
    this.v.set(pose.x, pose.y, pose.z);
    this.s.set(1, 1, 1);
    this.m.compose(this.v, this.q, this.s);
    this.blocks.setMatrixAt(this.nBlocks, this.m);
    this.tint.setHex(KIND_TINT[motion.kind] ?? FRAME.getHex());
    this.blocks.setColorAt(this.nBlocks, this.tint);
    this.nBlocks++;
  }

  private swing(w: SwingView): void {
    const cx = w.x + 0.5;
    const cz = w.z + 0.5;
    const [fx, fz] = FRONT[w.facing] ?? [0, -1];
    const ph = w.phase;
    const n = (x: number, y: number, z: number): [number, number, number] => this.nudge(w.x, w.y, w.z, x, y, z);
    switch (w.kind) {
      case 'deployer': {
        const out = Math.sin(Math.min(1, ph) * Math.PI);
        const base = n(cx, w.y + 0.5, cz);
        const mid = n(cx + fx * (0.55 + out * 0.5), w.y + 0.5, cz + fz * (0.55 + out * 0.5));
        const tip = n(cx + fx * (0.7 + out * 0.5), w.y + 0.5, cz + fz * (0.7 + out * 0.5));
        this.bar(base[0], base[1], base[2], mid[0], mid[1], mid[2], 0.18, IRON);
        this.bar(mid[0], mid[1], mid[2], tip[0], tip[1], tip[2], 0.3, BRONZE);
        break;
      }
      case 'mech_drill': {
        const a = this.time * Math.max(1, w.rpm) * 0.6;
        const tipX = cx + fx * 0.75;
        const tipZ = cz + fz * 0.75;
        const base = n(cx, w.y + 0.5, cz);
        const tip = n(tipX, w.y + 0.5, tipZ);
        this.bar(base[0], base[1], base[2], tip[0], tip[1], tip[2], 0.16, IRON);
        const r = 0.22;
        const bitA = n(tipX, w.y + 0.5 - r * Math.cos(a), tipZ - fx * r * Math.sin(a) * 0);
        const bitB = n(tipX, w.y + 0.5 + r * Math.cos(a), tipZ);
        this.bar(bitA[0], bitA[1], bitA[2], bitB[0], bitB[1], bitB[2], 0.1, BRONZE);
        const bitC = n(tipX - fz * r * Math.sin(a), w.y + 0.5, tipZ + fx * r * Math.sin(a));
        const bitD = n(tipX + fz * r * Math.sin(a), w.y + 0.5, tipZ - fx * r * Math.sin(a));
        this.bar(bitC[0], bitC[1], bitC[2], bitD[0], bitD[1], bitD[2], 0.1, BRONZE);
        break;
      }
      case 'mixer': {
        const a = this.time * Math.max(0, w.rpm) * 0.5;
        const top = n(cx, w.y + 0.3, cz);
        const low = n(cx, w.y - 0.5, cz);
        this.bar(top[0], top[1], top[2], low[0], low[1], low[2], 0.12, IRON);
        const left = n(cx - Math.cos(a) * 0.3, w.y - 0.4, cz - Math.sin(a) * 0.3);
        const right = n(cx + Math.cos(a) * 0.3, w.y - 0.4, cz + Math.sin(a) * 0.3);
        this.bar(left[0], left[1], left[2], right[0], right[1], right[2], 0.1, BRONZE);
        break;
      }
      case 'mech_press': {
        const down = w.rpm > 0 ? 0.5 + 0.5 * Math.sin(this.time * w.rpm * 0.3) : 0;
        const top = n(cx, w.y + 0.4, cz);
        const ram = n(cx, w.y - 0.1 - down * 0.5, cz);
        this.bar(top[0], top[1], top[2], ram[0], ram[1], ram[2], 0.18, IRON);
        const left = n(cx - 0.3, w.y - 0.1 - down * 0.5, cz);
        const right = n(cx + 0.3, w.y - 0.1 - down * 0.5, cz);
        this.bar(left[0], left[1], left[2], right[0], right[1], right[2], 0.12, BRONZE);
        break;
      }
      case 'mech_arm': {
        const base = [cx, w.y + 1.0, cz] as const;
        const src = w.src ? [w.src[0] + 0.5, w.src[1] + 1.1, w.src[2] + 0.5] : [cx + 1, w.y + 1.4, cz];
        const tgt = w.tgt ? [w.tgt[0] + 0.5, w.tgt[1] + 1.1, w.tgt[2] + 0.5] : src;
        const u = ph < 0.5 ? ph * 2 : (ph - 0.5) * 2;
        const hand = ph < 0.5
          ? [base[0] + (src[0] - base[0]) * u, base[1] + (src[1] - base[1]) * u, base[2] + (src[2] - base[2]) * u]
          : [src[0] + (tgt[0] - src[0]) * u, src[1] + (tgt[1] - src[1]) * u + Math.sin(u * Math.PI) * 0.4, src[2] + (tgt[2] - src[2]) * u];
        const elbow = [(base[0] + hand[0]) / 2, Math.max(base[1], hand[1]) + 0.45, (base[2] + hand[2]) / 2];
        const foot = n(base[0], w.y + 0.5, base[2]);
        const shoulder = n(base[0], base[1], base[2]);
        const bend = n(elbow[0], elbow[1], elbow[2]);
        const grip = n(hand[0], hand[1], hand[2]);
        const jawL = n(hand[0] - 0.1, hand[1], hand[2]);
        const jawR = n(hand[0] + 0.1, hand[1], hand[2]);
        this.bar(foot[0], foot[1], foot[2], shoulder[0], shoulder[1], shoulder[2], 0.2, IRON);
        this.bar(shoulder[0], shoulder[1], shoulder[2], bend[0], bend[1], bend[2], 0.14, BRONZE);
        this.bar(bend[0], bend[1], bend[2], grip[0], grip[1], grip[2], 0.12, BRONZE);
        this.bar(jawL[0], jawL[1], jawL[2], jawR[0], jawR[1], jawR[2], 0.16, DARK);
        break;
      }
      case 'saw_arm': {
        const a = this.time * Math.max(0, w.rpm) * 0.8;
        const base = n(cx, w.y + 0.5, cz);
        const tip = n(cx + fx * 0.55, w.y + 0.5, cz + fz * 0.55);
        this.bar(base[0], base[1], base[2], tip[0], tip[1], tip[2], 0.2, IRON);
        const hub = n(cx + fx * 0.7, w.y + 0.5, cz + fz * 0.7);
        const yaw = this.poseAt.get(cellKey(w.x, w.y, w.z))?.yaw ?? 0;
        this.cog(hub[0], hub[1], hub[2], a + yaw, 0.9, IRON);
        break;
      }
      case 'vacuum_collector': {
        const hub = n(cx, w.y + 1.07, cz);
        const yaw = this.poseAt.get(cellKey(w.x, w.y, w.z))?.yaw ?? 0;
        this.cog(hub[0], hub[1], hub[2], this.time * Math.max(0, w.rpm) * 0.9 + yaw, 0.85, IRON);
        break;
      }
      default:
    }
  }

  /**
   * `motions` is the in-progress structure step (`Contraptions.motions()`). Omit it and nothing slides —
   * game.ts does not pass it yet.
   */
  update(dt: number, view: WorkshopView, motions: readonly StructureMotion[] = []): void {
    this.time += dt;
    this.nCogs = 0;
    this.nBars = 0;
    this.nBlocks = 0;
    this.bindMotions(motions);
    for (const sp of view.spin) {
      const a = (this.angle.get(sp.key) ?? 0) + sp.rpm * 6 * (Math.PI / 180) * dt;
      this.angle.set(sp.key, a);
      const yaw = this.poseAt.get(cellKey(sp.x, sp.y, sp.z))?.yaw ?? 0;
      if (sp.kind === 'drive_shaft') {
        const p = this.nudge(sp.x, sp.y, sp.z, sp.x + 0.5, sp.y + 0.5, sp.z + 0.5);
        this.cog(p[0], p[1], p[2], a + yaw, 0.35, WOOD);
        continue;
      }
      if (sp.kind === 'hand_crank') {
        const r = 0.32;
        const hub = this.nudge(sp.x, sp.y, sp.z, sp.x + 0.5, sp.y + 1.05, sp.z + 0.5);
        const grip = this.nudge(sp.x, sp.y, sp.z, sp.x + 0.5 + Math.cos(a) * r, sp.y + 1.05, sp.z + 0.5 + Math.sin(a) * r);
        this.bar(hub[0], hub[1], hub[2], grip[0], grip[1], grip[2], 0.1, IRON);
        continue;
      }
      if (sp.kind === 'mill_wheel') {
        // A paddle wheel standing on the block, axis along z: two crossing spokes and a paddle at each tip.
        const cx = sp.x + 0.5;
        const cy = sp.y + 1.5;
        const r = 0.45;
        for (let i = 0; i < 4; i++) {
          const t = a + yaw + (i * Math.PI) / 2;
          const tip = this.nudge(sp.x, sp.y, sp.z, cx + Math.cos(t) * r, cy + Math.sin(t) * r, sp.z + 0.5);
          const hub = this.nudge(sp.x, sp.y, sp.z, cx, cy, sp.z + 0.5);
          this.bar(hub[0], hub[1], hub[2], tip[0], tip[1], tip[2], 0.07, DARK);
          const lo = this.nudge(sp.x, sp.y, sp.z, cx + Math.cos(t) * r, cy + Math.sin(t) * r, sp.z + 0.2);
          const hi = this.nudge(sp.x, sp.y, sp.z, cx + Math.cos(t) * r, cy + Math.sin(t) * r, sp.z + 0.8);
          this.bar(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], 0.12, WOOD);
        }
        continue;
      }
      const p = this.nudge(sp.x, sp.y, sp.z, sp.x + 0.5, sp.y + 1.07, sp.z + 0.5);
      this.cog(p[0], p[1], p[2], a + yaw, sp.kind === 'chain_sprocket' || sp.kind === 'worm_gear' ? 0.8 : 1, BRONZE);
    }
    for (const l of view.links) {
      const belt = l.kind === 'belt_pulley';
      const sway = l.rpm !== 0 ? Math.sin(this.time * Math.abs(l.rpm) * 0.5) * 0.02 : 0;
      const a = this.nudge(l.x1, l.y, l.z1, l.x1 + 0.5, l.y + 1.0 + sway, l.z1 + 0.5);
      const b = this.nudge(l.x2, l.y, l.z2, l.x2 + 0.5, l.y + 1.0 + sway, l.z2 + 0.5);
      this.bar(a[0], a[1], a[2], b[0], b[1], b[2], belt ? 0.1 : 0.06, belt ? LEATHER : IRON);
    }
    for (const w of view.swings) this.swing(w);
    for (const motion of motions) this.structureBlock(motion);
    this.cogs.count = this.nCogs;
    this.bars.count = this.nBars;
    this.blocks.count = this.nBlocks;
    this.cogs.instanceMatrix.needsUpdate = true;
    this.bars.instanceMatrix.needsUpdate = true;
    this.blocks.instanceMatrix.needsUpdate = true;
    if (this.cogs.instanceColor) this.cogs.instanceColor.needsUpdate = true;
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
    if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    this.stats = { cogs: this.nCogs, bars: this.nBars, blocks: this.nBlocks };
  }

  dispose(): void {
    this.scene.scene.remove(this.group);
    for (const mesh of [this.cogs, this.bars, this.blocks]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}
