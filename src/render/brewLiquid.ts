/**
 * The drink in a cup (BREWING_PLAN 6): a flat tinted quad at the cup's rim. Its colour is the `drink.colour` of the
 * drink item the cup's entity names, which the chunk mesher cannot know, so the quads are drawn here: one small
 * dynamic mesh, one quad per brewing or finished cup near the camera, refilled twice a second. While the water drips
 * through the cone the quad fades from clear water to the drink's colour.
 */
import * as THREE from 'three';
import { BREW_CUP_MACHINE } from '../core/brewing';
import { BREW_SECONDS } from '../core/constants';
import { itemOrNull } from '../core/registry';
import type { IWorld } from '../core/types';
import { CUP_RIM_Y } from '../world/meshCup';
import type { LightProbe } from './emitters';

export const LIQUID_RANGE = 48;
export const LIQUID_CAPACITY = 64;
const INTERVAL_S = 0.25;
/** The quad is inset from the cup's walls (5..11 of 16) and lies a hair above its rim. */
const INSET_MIN = 5.5 / 16;
const INSET_MAX = 10.5 / 16;
const LIFT = 0.004;
/** What the cone drips at first: plain hot water. */
const WATER: readonly [number, number, number] = [0.62, 0.7, 0.74];

const rgb = new Float32Array(3);

export class BrewLiquid {
  readonly mesh: THREE.Mesh;
  private readonly colors: THREE.BufferAttribute;
  private readonly positions: THREE.BufferAttribute;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.MeshBasicMaterial;
  private timer = 0;
  private quads = 0;

  constructor(private readonly world: IWorld, private readonly light: LightProbe) {
    this.positions = new THREE.BufferAttribute(new Float32Array(LIQUID_CAPACITY * 12), 3).setUsage(THREE.DynamicDrawUsage);
    this.colors = new THREE.BufferAttribute(new Float32Array(LIQUID_CAPACITY * 12), 3).setUsage(THREE.DynamicDrawUsage);
    const index = new Uint16Array(LIQUID_CAPACITY * 6);
    for (let q = 0; q < LIQUID_CAPACITY; q++) index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('color', this.colors);
    this.geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'brew-liquid';
    this.mesh.frustumCulled = false;
  }

  /** Quads drawn at the last refill (for tests and stats). */
  get count(): number {
    return this.quads;
  }

  update(dt: number, camX: number, camZ: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = INTERVAL_S;
    let n = 0;
    for (const e of this.world.entities()) {
      if (n >= LIQUID_CAPACITY) break;
      if (e.kind !== BREW_CUP_MACHINE) continue;
      const brewing = e.stage === 'brewing';
      if (!brewing && e.stage !== 'done') continue;
      const dx = e.x + 0.5 - camX;
      const dz = e.z + 0.5 - camZ;
      if (dx * dx + dz * dz > LIQUID_RANGE * LIQUID_RANGE) continue;
      const colour = typeof e.drink === 'string' ? itemOrNull(e.drink)?.drink?.colour : undefined;
      const k = brewing ? Math.min(1, Math.max(0, (typeof e.brewS === 'number' ? e.brewS : 0) / BREW_SECONDS)) : 1;
      this.quad(n++, e.x, e.y, e.z, colour ?? 0x6b4423, k);
    }
    this.quads = n;
    this.geometry.setDrawRange(0, n * 6);
    this.positions.needsUpdate = true;
    this.colors.needsUpdate = true;
  }

  private quad(i: number, x: number, y: number, z: number, colour: number, mix: number): void {
    const l = this.light(x + 0.5, y + CUP_RIM_Y, z + 0.5, rgb);
    const cr = ((colour >> 16) & 255) / 255;
    const cg = ((colour >> 8) & 255) / 255;
    const cb = (colour & 255) / 255;
    const r = (WATER[0] + (cr - WATER[0]) * mix) * l[0];
    const g = (WATER[1] + (cg - WATER[1]) * mix) * l[1];
    const b = (WATER[2] + (cb - WATER[2]) * mix) * l[2];
    const yy = y + CUP_RIM_Y + LIFT;
    const p = this.positions.array as Float32Array;
    const c = this.colors.array as Float32Array;
    const o = i * 12;
    for (let k = 0; k < 4; k++) {
      p[o + k * 3] = x + (k === 0 || k === 3 ? INSET_MIN : INSET_MAX);
      p[o + k * 3 + 1] = yy;
      p[o + k * 3 + 2] = z + (k < 2 ? INSET_MIN : INSET_MAX);
      c[o + k * 3] = r;
      c[o + k * 3 + 1] = g;
      c[o + k * 3 + 2] = b;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
