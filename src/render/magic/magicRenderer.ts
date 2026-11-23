/**
 * Draws Essentia & Research in the world (docs/api/magic.md): the coloured fill inside essentia jars, the floating
 * wellsprings (soft breathing orbs of light that rise and sink, fainter as they are drawn), and the items resting on pedestals and altars
 * (through a second GroundItemRenderer, so they look exactly like dropped items). Simple unlit materials: glowing glass.
 * Meshes are pooled; nothing is allocated per frame once the pools are warm.
 */
import * as THREE from 'three';
import type { IWorld } from '../../core/types';
import type { GroundItem } from '../../game/groundItems';
import { aspectInfo, type Aspect } from '../../magic/aspects';
import { NODE_POOL } from '../../magic/nodes';
import { GroundItemRenderer, type GroundScene } from '../groundItems';

export interface JarFill { x: number; y: number; z: number; aspect: Aspect; fill: number }
export interface NodeView { key: string; x: number; y: number; z: number; aspect: Aspect; left: number }
export interface DisplayItem { item: string; x: number; y: number; z: number }

/** Wellsprings farther than this (blocks) are not drawn. */
export const NODE_DRAW_DIST = 64;

export class MagicRenderer {
  readonly group = new THREE.Group();
  private readonly jarGeo = new THREE.BoxGeometry(0.62, 1, 0.62);
  // Round, not faceted: a wellspring is welling light, not a cut gem.
  private readonly nodeGeo = new THREE.SphereGeometry(0.36, 14, 10);
  private readonly haloGeo = new THREE.SphereGeometry(0.6, 14, 10);
  private readonly jarMeshes: THREE.Mesh[] = [];
  private readonly nodeMeshes: { core: THREE.Mesh; halo: THREE.Mesh }[] = [];
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly items: GroundItemRenderer;
  private readonly fake: GroundItem[] = [];
  private time = 0;
  /** Counts last frame, for tests and diagnostics. */
  stats = { jars: 0, nodes: 0, items: 0 };

  constructor(private readonly scene: GroundScene, world: IWorld) {
    scene.scene.add(this.group);
    this.items = new GroundItemRenderer(scene, world);
  }

  private material(color: string, opacity: number): THREE.MeshBasicMaterial {
    const key = `${color}:${opacity}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, depthWrite: false });
      this.materials.set(key, m);
    }
    return m;
  }

  update(dt: number, jars: readonly JarFill[], nodes: readonly NodeView[], displays: readonly DisplayItem[], eye: { x: number; y: number; z: number }): void {
    this.time += dt;
    // Jars: a box of colour rising with the fill, inside the glass.
    for (let i = 0; i < jars.length; i++) {
      let mesh = this.jarMeshes[i];
      if (!mesh) {
        mesh = new THREE.Mesh(this.jarGeo);
        this.jarMeshes.push(mesh);
        this.group.add(mesh);
      }
      const j = jars[i];
      const h = Math.max(0.04, Math.min(1, j.fill)) * 0.78;
      mesh.visible = true;
      mesh.material = this.material(aspectInfo(j.aspect).color, 0.92);
      mesh.scale.set(1, h, 1);
      mesh.position.set(j.x + 0.5, j.y + 0.04 + h / 2, j.z + 0.5);
    }
    for (let i = jars.length; i < this.jarMeshes.length; i++) this.jarMeshes[i].visible = false;
    // Wellsprings: a bright orb in a faint halo that breathes and rises and sinks slowly, never spins.
    let n = 0;
    for (const node of nodes) {
      if (Math.hypot(node.x - eye.x, node.z - eye.z) > NODE_DRAW_DIST) continue;
      let m = this.nodeMeshes[n];
      if (!m) {
        m = { core: new THREE.Mesh(this.nodeGeo), halo: new THREE.Mesh(this.haloGeo) };
        this.nodeMeshes.push(m);
        this.group.add(m.core, m.halo);
      }
      const color = aspectInfo(node.aspect).color;
      const strength = 0.35 + 0.6 * Math.max(0, Math.min(1, node.left / NODE_POOL));
      m.core.material = this.material(color, Math.round(strength * 20) / 20);
      m.halo.material = this.material(color, 0.18);
      const phase = (node.x * 13 + node.z * 7) % 6;
      const y = node.y + Math.sin(this.time * 0.9 + phase) * 0.18;
      const breath = 1 + 0.08 * Math.sin(this.time * 2 + phase);
      m.core.visible = true;
      m.core.position.set(node.x + 0.5, y, node.z + 0.5);
      m.core.scale.setScalar(1);
      m.halo.visible = true;
      m.halo.position.set(node.x + 0.5, y, node.z + 0.5);
      m.halo.scale.setScalar(breath);
      n++;
    }
    for (let i = n; i < this.nodeMeshes.length; i++) {
      this.nodeMeshes[i].core.visible = false;
      this.nodeMeshes[i].halo.visible = false;
    }
    // Items on pedestals and altars.
    this.fake.length = 0;
    displays.forEach((d, i) => {
      this.fake.push({
        id: -1 - i, item: d.item, count: 1, x: d.x, y: d.y, z: d.z, vx: 0, vy: 0, vz: 0, age: 0, delayS: 1e9,
        onGround: true, homing: false, pulled: false, phase: i * 1.7,
      });
    });
    this.items.update(dt, this.fake, false);
    this.stats = { jars: jars.length, nodes: n, items: displays.length };
  }

  dispose(): void {
    this.items.dispose();
    this.scene.scene.remove(this.group);
    this.jarGeo.dispose();
    this.nodeGeo.dispose();
    this.haloGeo.dispose();
    for (const m of this.materials.values()) m.dispose();
  }
}
