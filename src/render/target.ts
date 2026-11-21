/**
 * The targeted block: a thick outline (thin boxes along the 12 edges, so it reads on a phone where GL lines
 * are always one pixel) and the mining cracks, eight stages painted procedurally and drawn on a box hugging
 * the block.
 */
import * as THREE from 'three';
import { CUP_BLOCK } from '../core/brewing';
import { PIPE_CORE_MAX, PIPE_CORE_MIN } from '../core/constants';
import { mulberry32 } from '../core/math';
import { blockOf } from '../core/registry';
import { stationBounds } from '../world/stationShapes';
import type { BlockShape, Voxel } from '../core/types';

export const CRACK_STAGES = 8;
const SIZE = 16;

/**
 * Crack pixels for every stage (16x16 RGBA per stage, top row first). The same branching cracks grow
 * stage by stage, so every stage contains all the cracks of the stage before.
 */
export function paintCracks(): Uint8Array {
  const out = new Uint8Array(CRACK_STAGES * SIZE * SIZE * 4);
  const rand = mulberry32(0x5eed);
  // Random walks from near the centre; each step remembers the stage at which it appears.
  const order: number[] = new Array(SIZE * SIZE).fill(-1);
  let step = 0;
  const walks: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.8;
    walks.push({ x: 7.5 + rand() * 1.5 - 0.75, y: 7.5 + rand() * 1.5 - 0.75, dx: Math.cos(a), dy: Math.sin(a) });
  }
  const total = 120;
  while (step < total && walks.length > 0) {
    for (let w = walks.length - 1; w >= 0; w--) {
      const k = walks[w];
      const turn = (rand() - 0.5) * 1.1;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      const dx = k.dx * c - k.dy * s;
      const dy = k.dx * s + k.dy * c;
      k.dx = dx;
      k.dy = dy;
      k.x += dx;
      k.y += dy;
      const px = Math.floor(k.x);
      const py = Math.floor(k.y);
      if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) {
        walks.splice(w, 1);
        continue;
      }
      if (order[py * SIZE + px] < 0) order[py * SIZE + px] = step++;
      if (rand() < 0.07 && walks.length < 12) walks.push({ x: k.x, y: k.y, dx: -dy, dy: dx });
    }
  }
  for (let stage = 0; stage < CRACK_STAGES; stage++) {
    const limit = ((stage + 1) / CRACK_STAGES) * step;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const o = order[i];
      if (o < 0 || o >= limit) continue;
      const p = (stage * SIZE * SIZE + i) * 4;
      // Older cracks are darker and wider-looking; fresh ones are fainter.
      const fresh = o > limit - step / CRACK_STAGES;
      out[p] = 18;
      out[p + 1] = 14;
      out[p + 2] = 12;
      out[p + 3] = fresh ? 150 : 215;
    }
  }
  return out;
}

const CRACK_VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const CRACK_FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2DArray;
uniform sampler2DArray uCracks;
uniform float uStage;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 c = texture(uCracks, vec3(vUv, uStage));
  if (c.a < 0.05) discard;
  fragColor = c;
}
`;

/** One box per edge of the unit cube, merged: 12 boxes, 144 triangles, one draw call. */
export function edgeGeometry(thickness: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const t = thickness;
  for (const axis of [0, 1, 2]) {
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const size = [t, t, t];
        size[axis] = 1 + t;
        const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
        const pos = [0, 0, 0];
        pos[axis] = 0.5;
        pos[(axis + 1) % 3] = a;
        pos[(axis + 2) % 3] = b;
        g.translate(pos[0], pos[1], pos[2]);
        parts.push(g);
      }
    }
  }
  const merged = new THREE.BufferGeometry();
  let count = 0;
  for (const p of parts) count += p.getAttribute('position').count;
  const positions = new Float32Array(count * 3);
  const indices: number[] = [];
  let offset = 0;
  for (const p of parts) {
    positions.set(p.getAttribute('position').array as Float32Array, offset * 3);
    const idx = p.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
    offset += p.getAttribute('position').count;
    p.dispose();
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(indices);
  return merged;
}

/** No outline side of a small block is shorter than this (8/16): the outline is the tap target on a phone. */
export const MIN_TARGET = 8 / 16;
const CUP_BARE: Bounds = [4 / 16, 0, 4 / 16, 12 / 16, MIN_TARGET, 12 / 16];
const CUP_CONE: Bounds = [4 / 16, 0, 4 / 16, 12 / 16, 10 / 16, 12 / 16];
const BUCKET: Bounds = [3 / 16, 0, 3 / 16, 13 / 16, MIN_TARGET, 13 / 16];

type Bounds = readonly [number, number, number, number, number, number];

/**
 * The part of the cell a shape fills: [minX, minY, minZ, maxX, maxY, maxZ] in 0..1. Brewing's cups and buckets are
 * real small boxes padded to MIN_TARGET so they stay tappable; a bare cup (`key` clay_cup) is the only low one.
 */
export function shapeBounds(shape: BlockShape, key = ''): readonly [number, number, number, number, number, number] {
  // Hand stations (EMBER_PLAN 2) are cubes or slabs in the content and small boxes in the mesh: the outline hugs the box.
  const station = shape === 'cube' || shape === 'slab' ? stationBounds(key) : null;
  if (station) return station;
  switch (shape) {
    case 'slab':
      return [0, 0, 0, 1, 0.5, 1];
    case 'torch':
      return [6 / 16, 0, 6 / 16, 10 / 16, 11 / 16, 10 / 16];
    case 'cross':
      return [0.12, 0, 0.12, 0.88, 0.85, 0.88];
    case 'pipe':
      return [PIPE_CORE_MIN, PIPE_CORE_MIN, PIPE_CORE_MIN, PIPE_CORE_MAX, PIPE_CORE_MAX, PIPE_CORE_MAX];
    case 'cup':
      return key === CUP_BLOCK.cup ? CUP_BARE : CUP_CONE;
    case 'bucket':
      return BUCKET;
    default:
      return [0, 0, 0, 1, 1, 1];
  }
}

export class TargetBox {
  readonly group = new THREE.Group();
  private readonly outline: THREE.Mesh;
  private readonly cracks: THREE.Mesh;
  private readonly outlineMaterial: THREE.MeshBasicMaterial;
  private readonly crackTexture: THREE.DataArrayTexture;
  private readonly crackMaterial: THREE.ShaderMaterial;
  private voxel: Voxel = -1;

  constructor() {
    this.group.name = 'target';
    this.group.visible = false;
    this.outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x15110e, transparent: true, opacity: 0.7, depthWrite: false });
    this.outline = new THREE.Mesh(edgeGeometry(0.022), this.outlineMaterial);
    this.outline.renderOrder = 5;
    this.crackTexture = new THREE.DataArrayTexture(paintCracks(), SIZE, SIZE, CRACK_STAGES);
    this.crackTexture.magFilter = THREE.NearestFilter;
    this.crackTexture.minFilter = THREE.NearestFilter;
    this.crackTexture.needsUpdate = true;
    this.crackMaterial = new THREE.ShaderMaterial({
      name: 'cracks',
      glslVersion: THREE.GLSL3,
      uniforms: { uCracks: { value: this.crackTexture }, uStage: { value: 0 } },
      vertexShader: CRACK_VERTEX,
      fragmentShader: CRACK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    box.translate(0.5, 0.5, 0.5);
    this.cracks = new THREE.Mesh(box, this.crackMaterial);
    this.cracks.renderOrder = 5;
    this.cracks.visible = false;
    this.group.add(this.outline, this.cracks);
  }

  /** Shows the outline around a block (null hides it) and the crack stage for mining progress 0..1 (-1 none). */
  set(x: number, y: number, z: number, voxel: Voxel, mining: number): void {
    this.group.visible = true;
    if (voxel !== this.voxel) {
      this.voxel = voxel;
      const def = blockOf(voxel);
      const b = shapeBounds(def.shape, def.key);
      this.outline.position.set(b[0], b[1], b[2]);
      this.outline.scale.set(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
      this.cracks.position.copy(this.outline.position);
      this.cracks.scale.copy(this.outline.scale);
    }
    this.group.position.set(x, y, z);
    if (mining >= 0) {
      this.cracks.visible = true;
      this.crackMaterial.uniforms.uStage.value = Math.min(CRACK_STAGES - 1, Math.floor(mining * CRACK_STAGES));
    } else {
      this.cracks.visible = false;
    }
  }

  hide(): void {
    this.group.visible = false;
  }

  /** Dark outline where it is bright, a pale one where it is dark (night, caves) so it always reads. */
  setBrightness(brightness: number): void {
    const bright = brightness > 0.3;
    const v = bright ? 0.08 : 0.78;
    this.outlineMaterial.color.setRGB(v, v * 0.92, v * 0.82);
    this.outlineMaterial.opacity = bright ? 0.7 : 0.55;
  }

  dispose(): void {
    this.outline.geometry.dispose();
    this.outlineMaterial.dispose();
    this.cracks.geometry.dispose();
    this.crackMaterial.dispose();
    this.crackTexture.dispose();
  }
}
