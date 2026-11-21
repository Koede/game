/**
 * A tiny box-model builder for machine parts. Every part is a set of textured boxes in the MODEL FRAME of a
 * machine: origin at the centre of the block's bottom face, +Y up, the block's front facing north (-Z), units in
 * blocks. Boxes are grouped into assemblies; an assembly has a pivot (its origin) and a motion that the machine
 * shader applies per vertex from the instance's state (angle, extent):
 *   STATIC   - rigid with the block
 *   SPIN     - turns about the assembly's local Z axis through its origin by angle x ratio
 *   SLIDE    - moves along the assembly's local Y axis by sin(angle + phase) x stroke
 *   STRETCH  - SPIN, and stretched along local Z (from the origin) by the instance's extent (a drill string)
 *   FOLLOW   - SPIN, and carried along local Z by (extent - 1): what sits at the end of a STRETCH part (the bit)
 *   PULSE    - moves along the assembly's local Y axis by the instance's extent x stroke (hand stations: a flash, a
 *              pestle, a split log; the extent is an impulse that decays after each stroke)
 * Vertex attributes: position, normal, uv (1 block = 1 tile, so pixels match the terrain's), aLayer (texture
 * layer), aTint (multiplies the texel), aPivot (xyz pivot, w ratio | stroke), aAxis (xyz axis, w motion code),
 * aPhase (slide phase).
 */
import * as THREE from 'three';
import { textureLayer } from '../../core/registry';

export type V3 = readonly [number, number, number];
/** A 3x3 rotation, column-major (columns are the images of the local x, y, z axes). */
export type M3 = readonly number[];

export const enum Motion {
  Static = 0,
  Spin = 1,
  Slide = 2,
  Stretch = 3,
  Follow = 4,
  Pulse = 5,
}

export const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const rotX = (a: number): M3 => [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)];
export const rotY = (a: number): M3 => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
export const rotZ = (a: number): M3 => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
export function mul(a: M3, b: M3): M3 {
  const out: number[] = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out.push(a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]);
  return out;
}
export const apply = (m: M3, v: V3): [number, number, number] => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];

/** A surface: an atlas tile and a colour multiplier (values above 1 brighten a mid-grey tile). */
export interface Finish {
  tile: string;
  tint: V3;
}

/** Corner order of each face (bit 0 = +x, bit 1 = +y, bit 2 = +z), counter-clockwise seen from outside. */
const FACES: { n: V3; c: readonly number[]; u: 0 | 1 | 2; v: 0 | 1 | 2 }[] = [
  { n: [1, 0, 0], c: [5, 1, 3, 7], u: 2, v: 1 },
  { n: [-1, 0, 0], c: [0, 4, 6, 2], u: 2, v: 1 },
  { n: [0, 1, 0], c: [6, 7, 3, 2], u: 0, v: 2 },
  { n: [0, -1, 0], c: [0, 1, 5, 4], u: 0, v: 2 },
  { n: [0, 0, 1], c: [4, 5, 7, 6], u: 0, v: 1 },
  { n: [0, 0, -1], c: [1, 0, 2, 3], u: 0, v: 1 },
];

interface Assembly {
  origin: V3;
  rot: M3;
  motion: Motion;
  /** Spin ratio (rotations per instance angle) or slide stroke in blocks. */
  amount: number;
  phase: number;
}

export interface PartModel {
  geometry: THREE.BufferGeometry;
  /** Boxes and vertices (for tests and stats). */
  boxes: number;
  vertices: number;
}

export class ModelBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly layer: number[] = [];
  private readonly tint: number[] = [];
  private readonly pivot: number[] = [];
  private readonly axis: number[] = [];
  private readonly phase: number[] = [];
  private readonly index: number[] = [];
  private asm: Assembly = { origin: [0, 0, 0], rot: IDENTITY, motion: Motion.Static, amount: 0, phase: 0 };
  private boxes = 0;

  /** Starts an assembly: following boxes are given in its local frame (`rot`, then moved to `origin`). */
  assembly(origin: V3, rot: M3, motion: Motion, amount = 1, phase = 0): this {
    this.asm = { origin, rot, motion, amount, phase };
    return this;
  }

  /**
   * A box of `size` centred at `center` (assembly-local). `pitch` turns the box about its own centre first,
   * `spin` then turns box and centre together about the assembly origin (blades round a hub, rim segments).
   */
  box(center: V3, size: V3, finish: Finish, spin: M3 = IDENTITY, pitch: M3 = IDENTITY): this {
    const a = this.asm;
    const toModel = mul(a.rot, spin);
    const layer = textureLayer(finish.tile);
    const axisVec = apply(a.rot, a.motion === Motion.Slide || a.motion === Motion.Pulse ? [0, 1, 0] : [0, 0, 1]);
    // Each box samples its own spot of the tile, so neighbouring boxes do not repeat one pattern.
    const ou = (this.boxes * 5) % 16 / 16;
    const ov = (this.boxes * 11) % 16 / 16;
    this.boxes++;
    for (const f of FACES) {
      const base = this.pos.length / 3;
      const n = apply(toModel, apply(pitch, f.n));
      for (const c of f.c) {
        const local: V3 = [(c & 1 ? 0.5 : -0.5) * size[0], (c & 2 ? 0.5 : -0.5) * size[1], (c & 4 ? 0.5 : -0.5) * size[2]];
        const p = apply(toModel, add(apply(pitch, local), center));
        this.pos.push(p[0] + a.origin[0], p[1] + a.origin[1], p[2] + a.origin[2]);
        this.nor.push(n[0], n[1], n[2]);
        this.uv.push(local[f.u] + size[f.u] / 2 + ou, local[f.v] + size[f.v] / 2 + ov);
        this.layer.push(layer);
        this.tint.push(finish.tint[0], finish.tint[1], finish.tint[2]);
        this.pivot.push(a.origin[0], a.origin[1], a.origin[2], a.amount);
        this.axis.push(axisVec[0], axisVec[1], axisVec[2], a.motion);
        this.phase.push(a.phase);
      }
      this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  /** `count` copies of a box spun evenly round the assembly axis (rim segments, spokes, blades). */
  ring(count: number, center: V3, size: V3, finish: Finish, pitch: M3 = IDENTITY, start = 0): this {
    for (let k = 0; k < count; k++) this.box(center, size, finish, rotZ(start + (k * 2 * Math.PI) / count), pitch);
    return this;
  }

  build(): PartModel {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aLayer', new THREE.Float32BufferAttribute(this.layer, 1));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.pivot, 4));
    g.setAttribute('aAxis', new THREE.Float32BufferAttribute(this.axis, 4));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(this.phase, 1));
    g.setIndex(this.index);
    return { geometry: g, boxes: this.boxes, vertices: this.pos.length / 3 };
  }
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
