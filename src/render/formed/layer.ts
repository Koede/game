/**
 * Draws the merged multiblock models: one mesh per formed structure (one draw call each), created, rebuilt and
 * disposed as the FormedTracker says. The structure's shell blocks are hidden from the chunk meshes while its model
 * stands (world/shellHide.ts), so the two never overlap. Per frame it only sets a few uniforms per model.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import type { IWorld } from '../../core/types';
import type { WorldUniforms } from '../materials';
import { evalParts, MAX_PARTS, newMotion, stepMotion, type Motion } from '../parts/track';
import { heatColor, heatGlow } from '../tech/heat';
import { hearthKind } from './hearthModel';
import type { ModelData } from './meshBuilder';
import { formedModel } from './registry';
import { FORMED_FRAGMENT, FORMED_VERTEX } from './shaders';
import { FormedTracker, type TrackedModel } from './tracker';

formedModel.register(hearthKind);

/** The Starhearth after ignition burns gold whatever its temperature reads. */
const STAR_GOLD = [1, 0.82, 0.42] as const;
const SHARED = ['uTime', 'uFog', 'uFogColor', 'uSkyLight', 'uSunDir', 'uBlockLight', 'uAmbient'];

export interface FormedStats {
  /** Models drawn (one draw call each). */
  models: number;
  triangles: number;
}

export function modelGeometry(m: ModelData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('aData', new THREE.BufferAttribute(m.data, 4));
  g.setAttribute('aPart', new THREE.BufferAttribute(m.partIds, 1));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  const b = m.bounds;
  // The snap throws pieces out ~1.4 blocks: pad the bounds so a model is never culled mid-animation.
  g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0] - 1.5, b[1] - 1.5, b[2] - 1.5), new THREE.Vector3(b[3] + 1.5, b[4] + 1.5, b[5] + 1.5));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

interface Drawn {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  motion: Motion;
  parts: Float32Array;
}

export class FormedLayer {
  readonly group = new THREE.Group();
  readonly stats: FormedStats = { models: 0, triangles: 0 };
  readonly tracker: FormedTracker;
  private readonly drawn = new Map<string, Drawn>();
  private readonly heat = new Float32Array(3);
  private readonly template: THREE.ShaderMaterial;

  constructor(world: IWorld, bus: GameBus, uniforms: WorldUniforms) {
    this.group.name = 'formed';
    this.template = new THREE.ShaderMaterial({
      name: 'formed-model',
      glslVersion: THREE.GLSL3,
      vertexShader: FORMED_VERTEX,
      fragmentShader: FORMED_FRAGMENT,
      uniforms: {
        uTime: uniforms.uTime,
        uFog: uniforms.uFog,
        uFogColor: uniforms.uFogColor,
        uSkyLight: uniforms.uSkyLight,
        uSunDir: uniforms.uSunDir,
        uBlockLight: uniforms.uBlockLight,
        uAmbient: uniforms.uAmbient,
        uSnap: { value: 1 },
        uHeat: { value: 0 },
        uHeatCol: { value: new THREE.Vector3(1, 0.5, 0.2) },
        uFlash: { value: 0 },
        uActive: { value: 0 },
        uParts: { value: new Float32Array(16 * (MAX_PARTS + 1)) },
      },
    });
    this.tracker = new FormedTracker(world, bus, {
      onAdd: (t) => this.add(t),
      onRebuild: (t) => this.rebuild(t),
      onRemove: (id) => this.drop(id),
      onSettle: (t) => {
        const c = t.inst.controller;
        bus.emit('sfx', { name: 'dig_metal', x: c[0], y: c[1], z: c[2], volume: 0.8, pitch: 0.65 });
      },
    });
  }

  update(dt: number, camX: number, camZ: number): void {
    this.tracker.update(dt, camX, camZ);
    let tris = 0;
    for (const t of this.tracker.models.values()) {
      const d = this.drawn.get(t.id);
      if (!d) continue;
      const { snap, flash } = FormedTracker.snapOf(t);
      const u = d.material.uniforms;
      const inst = t.inst;
      if (inst.gold) this.heat.set(STAR_GOLD);
      else heatColor(inst.tempC, this.heat);
      (u.uHeatCol.value as THREE.Vector3).set(this.heat[0], this.heat[1], this.heat[2]);
      const k = inst.gold ? 1 : heatGlow(inst.tempC);
      u.uHeat.value = k;
      u.uSnap.value = snap;
      u.uFlash.value = flash;
      // Idle <-> running eases over about a third of a second.
      u.uActive.value += ((inst.active ? 1 : 0) - u.uActive.value) * Math.min(1, dt * 4);
      // Parts move with the machine's real state: speed follows the fire / power, spinning up and coasting down.
      if (t.model.parts.length > 0) {
        stepMotion(d.motion, dt, inst.active ? Math.max(0.35, k) : 0);
        evalParts(t.model.parts, d.motion, d.parts);
        u.uParts.value = d.parts;
      }
      tris += t.model.triangles;
    }
    this.stats.models = this.drawn.size;
    this.stats.triangles = tris;
  }

  dispose(): void {
    this.tracker.dispose();
    for (const id of [...this.drawn.keys()]) this.drop(id);
    this.template.dispose();
  }

  private add(t: TrackedModel): void {
    const material = this.template.clone();
    // clone() copies uniform values: re-link the shared ones so time of day and fog keep flowing.
    for (const name of SHARED) material.uniforms[name] = this.template.uniforms[name];
    const mesh = new THREE.Mesh(modelGeometry(t.model), material);
    mesh.name = `formed ${t.id}`;
    mesh.position.set(t.inst.min[0], t.inst.min[1], t.inst.min[2]);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
    this.group.add(mesh);
    const parts = new Float32Array(16 * (MAX_PARTS + 1));
    for (let i = 0; i < parts.length; i += 16) for (let j = 0; j < 4; j++) parts[i + j * 5] = 1;
    material.uniforms.uParts = { value: parts };
    this.drawn.set(t.id, { mesh, material, motion: newMotion(), parts });
  }

  private rebuild(t: TrackedModel): void {
    const d = this.drawn.get(t.id);
    if (!d) {
      this.add(t);
      return;
    }
    d.mesh.geometry.dispose();
    d.mesh.geometry = modelGeometry(t.model);
    d.mesh.position.set(t.inst.min[0], t.inst.min[1], t.inst.min[2]);
    d.mesh.updateMatrix();
    d.mesh.updateMatrixWorld(true);
  }

  private drop(id: string): void {
    const d = this.drawn.get(id);
    if (!d) return;
    this.group.remove(d.mesh);
    d.mesh.geometry.dispose();
    d.material.dispose();
    this.drawn.delete(id);
  }
}
