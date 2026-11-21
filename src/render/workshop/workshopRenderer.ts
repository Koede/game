/**
 * Draws the moving parts of the Bronze workshop (docs/api/workshop.md): cogs turning on top of every running gear part, chain
 * and belt links between sprockets and pulleys, mechanical arms swinging between source and target, deployer pistons, drill
 * bits, mixer paddles and press rams. Two InstancedMeshes (cogs and bars), unlit flat colours, no allocation per frame.
 */
import * as THREE from 'three';
import { Facing } from '../../core/types';
import type { SwingView, WorkshopView } from '../../workshop/workshop';
import type { GroundScene } from '../groundItems';

const MAX = 768;
const BRONZE = new THREE.Color(0xd09a4c);
const DARK = new THREE.Color(0x6a4a1c);
const IRON = new THREE.Color(0x9aa2ac);
const LEATHER = new THREE.Color(0x7a4a24);
const WOOD = new THREE.Color(0xa07a40);

const FRONT: Record<number, [number, number]> = { [Facing.North]: [0, -1], [Facing.East]: [1, 0], [Facing.South]: [0, 1], [Facing.West]: [-1, 0] };

export class WorkshopRenderer {
  readonly group = new THREE.Group();
  private readonly cogs: THREE.InstancedMesh;
  private readonly bars: THREE.InstancedMesh;
  private readonly angle = new Map<string, number>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(1, 0, 0);
  private readonly dir = new THREE.Vector3();
  private nCogs = 0;
  private nBars = 0;
  private time = 0;
  /** Counts of the last frame, for tests and the e2e. */
  stats = { cogs: 0, bars: 0 };

  constructor(private readonly scene: GroundScene) {
    const cogGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8);
    const barGeo = new THREE.BoxGeometry(1, 1, 1);
    this.cogs = new THREE.InstancedMesh(cogGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.bars = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    for (const mesh of [this.cogs, this.bars]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
    }
    scene.scene.add(this.group);
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

  private swing(w: SwingView): void {
    const cx = w.x + 0.5;
    const cz = w.z + 0.5;
    const [fx, fz] = FRONT[w.facing] ?? [0, -1];
    const ph = w.phase;
    switch (w.kind) {
      case 'deployer': {
        const out = Math.sin(Math.min(1, ph) * Math.PI);
        this.bar(cx, w.y + 0.5, cz, cx + fx * (0.55 + out * 0.5), w.y + 0.5, cz + fz * (0.55 + out * 0.5), 0.18, IRON);
        this.bar(cx + fx * (0.55 + out * 0.5), w.y + 0.5, cz + fz * (0.55 + out * 0.5), cx + fx * (0.7 + out * 0.5), w.y + 0.5, cz + fz * (0.7 + out * 0.5), 0.3, BRONZE);
        break;
      }
      case 'mech_drill': {
        const a = this.time * Math.max(1, w.rpm) * 0.6;
        const tipX = cx + fx * 0.75;
        const tipZ = cz + fz * 0.75;
        this.bar(cx, w.y + 0.5, cz, tipX, w.y + 0.5, tipZ, 0.16, IRON);
        const r = 0.22;
        this.bar(tipX, w.y + 0.5 - r * Math.cos(a), tipZ - fx * r * Math.sin(a) * 0, tipX, w.y + 0.5 + r * Math.cos(a), tipZ, 0.1, BRONZE);
        this.bar(tipX - fz * r * Math.sin(a), w.y + 0.5, tipZ + fx * r * Math.sin(a), tipX + fz * r * Math.sin(a), w.y + 0.5, tipZ - fx * r * Math.sin(a), 0.1, BRONZE);
        break;
      }
      case 'mixer': {
        const a = this.time * Math.max(0, w.rpm) * 0.5;
        this.bar(cx, w.y + 0.3, cz, cx, w.y - 0.5, cz, 0.12, IRON);
        this.bar(cx - Math.cos(a) * 0.3, w.y - 0.4, cz - Math.sin(a) * 0.3, cx + Math.cos(a) * 0.3, w.y - 0.4, cz + Math.sin(a) * 0.3, 0.1, BRONZE);
        break;
      }
      case 'mech_press': {
        const down = w.rpm > 0 ? 0.5 + 0.5 * Math.sin(this.time * w.rpm * 0.3) : 0;
        this.bar(cx, w.y + 0.4, cz, cx, w.y - 0.1 - down * 0.5, cz, 0.18, IRON);
        this.bar(cx - 0.3, w.y - 0.1 - down * 0.5, cz, cx + 0.3, w.y - 0.1 - down * 0.5, cz, 0.12, BRONZE);
        break;
      }
      case 'mech_arm': {
        const base = [cx, w.y + 1.0, cz] as const;
        const src = w.src ? [w.src[0] + 0.5, w.src[1] + 1.1, w.src[2] + 0.5] : [cx + 1, w.y + 1.4, cz];
        const tgt = w.tgt ? [w.tgt[0] + 0.5, w.tgt[1] + 1.1, w.tgt[2] + 0.5] : src;
        const u = ph < 0.5 ? ph * 2 : (ph - 0.5) * 2;
        const a = ph < 0.5 ? base : src;
        const hand = ph < 0.5
          ? [base[0] + (src[0] - base[0]) * u, base[1] + (src[1] - base[1]) * u, base[2] + (src[2] - base[2]) * u]
          : [src[0] + (tgt[0] - src[0]) * u, src[1] + (tgt[1] - src[1]) * u + Math.sin(u * Math.PI) * 0.4, src[2] + (tgt[2] - src[2]) * u];
        void a;
        const elbow = [(base[0] + hand[0]) / 2, Math.max(base[1], hand[1]) + 0.45, (base[2] + hand[2]) / 2];
        this.bar(base[0], w.y + 0.5, base[2], base[0], base[1], base[2], 0.2, IRON);
        this.bar(base[0], base[1], base[2], elbow[0], elbow[1], elbow[2], 0.14, BRONZE);
        this.bar(elbow[0], elbow[1], elbow[2], hand[0], hand[1], hand[2], 0.12, BRONZE);
        this.bar(hand[0] - 0.1, hand[1], hand[2], hand[0] + 0.1, hand[1], hand[2], 0.16, DARK);
        break;
      }
      default:
    }
  }

  update(dt: number, view: WorkshopView): void {
    this.time += dt;
    this.nCogs = 0;
    this.nBars = 0;
    for (const sp of view.spin) {
      const a = (this.angle.get(sp.key) ?? 0) + sp.rpm * 6 * (Math.PI / 180) * dt;
      this.angle.set(sp.key, a);
      if (sp.kind === 'drive_shaft') {
        this.cog(sp.x + 0.5, sp.y + 0.5, sp.z + 0.5, a, 0.35, WOOD);
        continue;
      }
      if (sp.kind === 'hand_crank') {
        const r = 0.32;
        this.bar(sp.x + 0.5, sp.y + 1.05, sp.z + 0.5, sp.x + 0.5 + Math.cos(a) * r, sp.y + 1.05, sp.z + 0.5 + Math.sin(a) * r, 0.1, IRON);
        continue;
      }
      this.cog(sp.x + 0.5, sp.y + 1.07, sp.z + 0.5, a, sp.kind === 'chain_sprocket' || sp.kind === 'worm_gear' ? 0.8 : 1, BRONZE);
    }
    for (const l of view.links) {
      const belt = l.kind === 'belt_pulley';
      const sway = l.rpm !== 0 ? Math.sin(this.time * Math.abs(l.rpm) * 0.5) * 0.02 : 0;
      this.bar(l.x1 + 0.5, l.y + 1.0 + sway, l.z1 + 0.5, l.x2 + 0.5, l.y + 1.0 + sway, l.z2 + 0.5, belt ? 0.1 : 0.06, belt ? LEATHER : IRON);
    }
    for (const w of view.swings) this.swing(w);
    this.cogs.count = this.nCogs;
    this.bars.count = this.nBars;
    this.cogs.instanceMatrix.needsUpdate = true;
    this.bars.instanceMatrix.needsUpdate = true;
    if (this.cogs.instanceColor) this.cogs.instanceColor.needsUpdate = true;
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
    this.stats = { cogs: this.nCogs, bars: this.nBars };
  }

  dispose(): void {
    this.scene.scene.remove(this.group);
    for (const mesh of [this.cogs, this.bars]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}
