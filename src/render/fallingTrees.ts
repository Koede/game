/**
 * Draws the trees on their way down (game/fallingTrees.ts) and the logs lying on the ground (game/fallenLogs.ts) as
 * rigid bodies: each one is a single Group whose transform is its pose, holding one InstancedMesh of its cells in its
 * own frame. A falling tree is drawn with its real trunk and crown cells; a fallen log as its column of trunk blocks,
 * with the cut end rounded (a smaller, paler end block) so the player sees how much is left. One draw call per body.
 */
import * as THREE from 'three';
import { cellLocal, tipPoint, type FallingTree } from '../game/fallingTrees';
import type { ParticleSpec } from './particles';
import { ParticleLook } from './particles';
import type { FallenLog } from '../game/fallenLogs';
import { poseOf } from '../game/treeBody';

/** What the renderer needs from the Renderer: the scene to add to. */
export interface TreeScene {
  readonly scene: THREE.Scene;
}

const LOG_COLOUR = new THREE.Color(0x6b4a2b);
const LEAF_COLOUR = new THREE.Color(0x3f7a32);
const CUT_COLOUR = new THREE.Color(0xd2a46a);
const CUBE_SCALE = 0.98;
/** The cut end is rounded: a smaller block on the tip of a fallen log. */
const CUT_END_SCALE = 0.78;

interface Body {
  group: THREE.Group;
  mesh: THREE.InstancedMesh;
  /** What the mesh was built from: a change rebuilds it (a log's length changes when it is cut). */
  sig: string;
  /** Where a falling tree's tip was last frame: the dust puff goes there when it lands. */
  tip?: { x: number; y: number; z: number };
}

export class FallingTreeRenderer {
  readonly group = new THREE.Group();
  private readonly trees = new Map<number, Body>();
  private readonly logs = new Map<number, Body>();
  private readonly geometry = new THREE.BoxGeometry(CUBE_SCALE, CUBE_SCALE, CUBE_SCALE);
  private readonly material = new THREE.MeshBasicMaterial();
  private readonly basis = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private readonly scale = new THREE.Matrix4();
  private readonly colour = new THREE.Color();

  /** `spawn` draws a particle (the Renderer's spawnParticle); the dust of a landing is spawned through it. */
  constructor(target: TreeScene, private readonly spawn?: (p: ParticleSpec) => void) {
    target.scene.add(this.group);
  }

  /** One frame: every falling tree and fallen log has its pose applied (built on first sight, dropped when gone). */
  update(trees: readonly FallingTree[], logs: readonly FallenLog[] = []): void {
    const liveTrees = new Set<number>();
    for (const tree of trees) {
      liveTrees.add(tree.id);
      let body = this.trees.get(tree.id);
      if (!body) {
        body = this.buildTree(tree);
        this.trees.set(tree.id, body);
        this.group.add(body.group);
      }
      const pose = poseOf(tree.body, tree.inertia, tree.pivot);
      setBasis(this.basis, tree.pivot.dx, tree.pivot.dz, pose.theta, pose.ox, pose.oy, pose.oz);
      body.group.matrix.copy(this.basis);
      body.tip = tipPoint(tree);
    }
    // A tree that is no longer falling has landed: a puff of dust where its tip was.
    for (const [id, body] of this.trees) if (!liveTrees.has(id) && body.tip) this.dust(body.tip);
    this.prune(this.trees, liveTrees);

    const liveLogs = new Set<number>();
    for (const log of logs) {
      liveLogs.add(log.id);
      const sig = `${log.length}`;
      let body = this.logs.get(log.id);
      if (!body || body.sig !== sig) {
        if (body) this.drop(body);
        body = this.buildLog(log);
        this.logs.set(log.id, body);
        this.group.add(body.group);
      }
      setBasis(this.basis, log.dx, log.dz, log.theta, log.ox, log.oy, log.oz);
      body.group.matrix.copy(this.basis);
    }
    this.prune(this.logs, liveLogs);
  }

  dispose(): void {
    for (const body of this.trees.values()) this.drop(body);
    for (const body of this.logs.values()) this.drop(body);
    this.trees.clear();
    this.logs.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }

  /** A puff of dust and small chips where a felled tree hits the ground. */
  private dust(at: { x: number; y: number; z: number }): void {
    if (!this.spawn) return;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (i % 3) * 0.4;
      const speed = 1.2 + (i % 4) * 0.45;
      this.spawn({
        x: at.x + Math.cos(a) * 0.4,
        y: at.y + 0.2,
        z: at.z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * speed,
        vy: 0.9 + (i % 3) * 0.5,
        vz: Math.sin(a) * speed,
        life: 0.9,
        size: 0.28,
        sizeEnd: 1.1,
        r: 0.74,
        g: 0.68,
        b: 0.56,
        r2: 0.6,
        g2: 0.55,
        b2: 0.48,
        alpha: 0.55,
        gravity: 2,
        drag: 1.4,
        look: ParticleLook.Puff,
        fog: 0.6,
      });
    }
  }

  private prune(map: Map<number, Body>, live: Set<number>): void {
    for (const [id, body] of map) {
      if (live.has(id)) continue;
      this.drop(body);
      map.delete(id);
    }
  }

  private drop(body: Body): void {
    this.group.remove(body.group);
    body.mesh.dispose();
  }

  private wrap(mesh: THREE.InstancedMesh, sig: string): Body {
    const group = new THREE.Group();
    group.add(mesh);
    group.matrixAutoUpdate = false;
    return { group, mesh, sig };
  }

  private buildTree(tree: FallingTree): Body {
    const cells = [...tree.trunk, ...tree.leaves];
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(1, cells.length));
    mesh.count = cells.length;
    mesh.frustumCulled = false;
    cells.forEach((c, i) => {
      const l = cellLocal(c, tree.pivot);
      this.local.makeTranslation(l.lat, l.a, l.s);
      mesh.setMatrixAt(i, this.local);
      mesh.setColorAt(i, this.colour.copy(i < tree.trunk.length ? LOG_COLOUR : LEAF_COLOUR));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return this.wrap(mesh, `tree${cells.length}`);
  }

  private buildLog(log: FallenLog): Body {
    const n = Math.max(1, log.length);
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    mesh.count = log.length;
    mesh.frustumCulled = false;
    for (let i = 0; i < log.length; i++) {
      const tip = i === log.length - 1;
      this.local.makeTranslation(0, i + 0.5, 0);
      if (tip) this.local.multiply(this.scale.makeScale(CUT_END_SCALE, CUT_END_SCALE, CUT_END_SCALE));
      mesh.setMatrixAt(i, this.local);
      mesh.setColorAt(i, this.colour.copy(tip ? CUT_COLOUR : LOG_COLOUR));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return this.wrap(mesh, `${log.length}`);
  }
}

/**
 * The body's world matrix: the rod's frame. Lateral = (-dz, 0, dx); up the rod = (dx sin, cos, dz sin); along the fall
 * at rest = (dx cos, -sin, dz cos) (the in-plane normal), so a cell at (lat, a, s) lands where the physics says.
 */
export function setBasis(out: THREE.Matrix4, dx: number, dz: number, theta: number, ox: number, oy: number, oz: number): THREE.Matrix4 {
  const sn = Math.sin(theta);
  const cs = Math.cos(theta);
  const xb = new THREE.Vector3(-dz, 0, dx);
  const yb = new THREE.Vector3(dx * sn, cs, dz * sn);
  const zb = new THREE.Vector3(dx * cs, -sn, dz * cs);
  out.makeBasis(xb, yb, zb);
  out.setPosition(ox, oy, oz);
  return out;
}
