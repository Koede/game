/**
 * Draws the trees on their way down (game/fallingTrees.ts) as rigid bodies: each one is a single Group whose transform
 * is the body's pose every frame, holding one InstancedMesh of its real trunk and crown cells in the body's own frame.
 * One draw call per tree; nothing is drawn per block.
 */
import * as THREE from 'three';
import { cellLocal, type FallingTree } from '../game/fallingTrees';
import { poseOf } from '../game/treeBody';

/** What the renderer needs from the Renderer: the scene to add to. */
export interface TreeScene {
  readonly scene: THREE.Scene;
}

const LOG_COLOUR = new THREE.Color(0x6b4a2b);
const LEAF_COLOUR = new THREE.Color(0x3f7a32);
const CUBE_SCALE = 0.98;

interface Body {
  group: THREE.Group;
  mesh: THREE.InstancedMesh;
  key: number;
}

export class FallingTreeRenderer {
  readonly group = new THREE.Group();
  private readonly bodies = new Map<number, Body>();
  private readonly geometry = new THREE.BoxGeometry(CUBE_SCALE, CUBE_SCALE, CUBE_SCALE);
  private readonly material = new THREE.MeshBasicMaterial({ vertexColors: false });
  private readonly m = new THREE.Matrix4();
  private readonly basis = new THREE.Matrix4();
  private readonly tmp = new THREE.Matrix4();

  constructor(target: TreeScene) {
    target.scene.add(this.group);
  }

  /** One frame: every falling tree's pose is applied to its group (created on first sight, dropped when it lands). */
  update(trees: readonly FallingTree[]): void {
    const live = new Set<number>();
    for (const tree of trees) {
      live.add(tree.id);
      let body = this.bodies.get(tree.id);
      if (!body) {
        body = this.build(tree);
        this.bodies.set(tree.id, body);
        this.group.add(body.group);
      }
      const inertia = treeInertia(tree);
      const pose = poseOf(tree.body, inertia, tree.pivot);
      setBasis(this.basis, tree.pivot.dx, tree.pivot.dz, pose.theta, pose.ox, pose.oy, pose.oz);
      body.group.matrix.copy(this.basis);
      body.group.matrixAutoUpdate = false;
      body.group.matrixWorldNeedsUpdate = true;
    }
    for (const [id, body] of this.bodies) {
      if (live.has(id)) continue;
      this.group.remove(body.group);
      body.mesh.dispose();
      this.bodies.delete(id);
    }
  }

  dispose(): void {
    for (const body of this.bodies.values()) body.mesh.dispose();
    this.bodies.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }

  private build(tree: FallingTree): Body {
    const cells = [...tree.trunk, ...tree.leaves];
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(1, cells.length));
    mesh.count = cells.length;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const colour = new THREE.Color();
    cells.forEach((c, i) => {
      const l = cellLocal(c, tree.pivot);
      this.m.makeTranslation(l.lat, l.a, l.s);
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, colour.copy(i < tree.trunk.length ? LOG_COLOUR : LEAF_COLOUR));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const group = new THREE.Group();
    group.add(mesh);
    group.matrixAutoUpdate = false;
    return { group, mesh, key: tree.id };
  }
}

/** The rod's inertia for drawing (the same rod the body was stepped with). */
function treeInertia(tree: FallingTree) {
  return tree.inertia;
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
