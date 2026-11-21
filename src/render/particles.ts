/**
 * One pooled particle system, drawn as a single THREE.Points call. Particles live in typed arrays on the CPU;
 * dead ones are swap-removed so the live ones stay packed at the front and only those are uploaded.
 * Two looks: hard square chips (debris, sparks) and soft round puffs (smoke, steam).
 */
import * as THREE from 'three';
import { LIGHT_GLSL } from './shaders/chunk';
import type { WorldUniforms } from './materials';

export const enum ParticleLook {
  Chip = 0,
  Puff = 1,
}

export interface ParticleSpec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds. */
  life: number;
  /** World size in blocks at birth and at death. */
  size: number;
  sizeEnd: number;
  /** Colour at birth and at death, 0..1 (blended over the particle's life). */
  r: number;
  g: number;
  b: number;
  r2: number;
  g2: number;
  b2: number;
  alpha: number;
  /** Blocks per second squared, positive pulls down. Negative floats up. */
  gravity: number;
  /** Fraction of velocity lost per second. */
  drag: number;
  look: ParticleLook;
  /** How much distance fog hides it (0 = never; smoke keeps reading from afar). */
  fog: number;
}

const VERTEX = /* glsl */ `
precision highp float;
in vec4 aColor;
in vec2 aSize;
uniform float uScale;
${LIGHT_GLSL}
out vec4 vColor;
out vec4 vFog;
flat out float vLook;
void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  float dist = -mv.z;
  gl_Position = projectionMatrix * mv;
  float look = floor(aSize.y);
  float fogAmount = fract(aSize.y) * 2.0;
  gl_PointSize = clamp(aSize.x * uScale / max(dist, 0.05), look > 0.5 ? 2.5 : 1.0, 384.0);
  vec3 toP = position - cameraPosition;
  vFog = vec4(fogColorFor(toP / max(length(toP), 0.0001)), fogFactor(length(toP)) * fogAmount);
  vColor = aColor;
  vLook = look;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
in vec4 vColor;
in vec4 vFog;
flat in float vLook;
out vec4 fragColor;
void main() {
  float a = vColor.a;
  if (vLook > 0.5) {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    float r = dot(d, d);
    if (r > 1.0) discard;
    a *= (1.0 - r) * (1.0 - r);
  }
  fragColor = vec4(mix(vColor.rgb, vFog.rgb, vFog.a), a);
}
`;

export class Particles {
  readonly points: THREE.Points;
  readonly capacity: number;
  private live = 0;
  // Simulation state.
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly sizes: Float32Array;
  private readonly colors: Float32Array;
  private readonly params: Float32Array;
  // GPU attributes.
  private readonly aPos: THREE.BufferAttribute;
  private readonly aColor: THREE.BufferAttribute;
  private readonly aSize: THREE.BufferAttribute;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor(uniforms: WorldUniforms, capacity = 2048) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity * 2);
    this.colors = new Float32Array(capacity * 7);
    this.params = new Float32Array(capacity * 4);
    this.geometry = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.aPos);
    this.geometry.setAttribute('aColor', this.aColor);
    this.geometry.setAttribute('aSize', this.aSize);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      name: 'particles',
      glslVersion: THREE.GLSL3,
      uniforms: { ...uniforms, uScale: { value: 600 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'particles';
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  get count(): number {
    return this.live;
  }

  /** Pixels per block at distance 1: viewport height / (2 tan(fov / 2)). */
  setScale(pixelsPerUnit: number): void {
    this.material.uniforms.uScale.value = pixelsPerUnit;
  }

  /** Adds one particle; when the pool is full the oldest-looking slot (index 0) is recycled. */
  spawn(p: ParticleSpec): void {
    let i = this.live;
    if (i >= this.capacity) i = (Math.random() * this.capacity) | 0;
    else this.live++;
    const i3 = i * 3;
    this.pos[i3] = p.x;
    this.pos[i3 + 1] = p.y;
    this.pos[i3 + 2] = p.z;
    this.vel[i3] = p.vx;
    this.vel[i3 + 1] = p.vy;
    this.vel[i3 + 2] = p.vz;
    this.age[i] = 0;
    this.life[i] = Math.max(0.01, p.life);
    this.sizes[i * 2] = p.size;
    this.sizes[i * 2 + 1] = p.sizeEnd;
    const c = i * 7;
    this.colors[c] = p.r;
    this.colors[c + 1] = p.g;
    this.colors[c + 2] = p.b;
    this.colors[c + 3] = p.r2;
    this.colors[c + 4] = p.g2;
    this.colors[c + 5] = p.b2;
    this.colors[c + 6] = p.alpha;
    const q = i * 4;
    this.params[q] = p.gravity;
    this.params[q + 1] = p.drag;
    this.params[q + 2] = p.look;
    this.params[q + 3] = Math.min(0.49, Math.max(0, p.fog * 0.49));
  }

  /** Advances every particle and uploads the live ones. Allocation-free. */
  update(dt: number, windX: number, windZ: number): void {
    const { pos, vel, age, life, sizes, colors, params } = this;
    const outPos = this.aPos.array as Float32Array;
    const outColor = this.aColor.array as Float32Array;
    const outSize = this.aSize.array as Float32Array;
    let i = 0;
    while (i < this.live) {
      age[i] += dt;
      if (age[i] >= life[i]) {
        this.moveLast(i);
        continue;
      }
      const i3 = i * 3;
      const q = i * 4;
      const drag = Math.max(0, 1 - params[q + 1] * dt);
      const puff = params[q + 2] > 0.5;
      vel[i3] = vel[i3] * drag + (puff ? windX * dt * 0.6 : 0);
      vel[i3 + 1] = vel[i3 + 1] * drag - params[q] * dt;
      vel[i3 + 2] = vel[i3 + 2] * drag + (puff ? windZ * dt * 0.6 : 0);
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      const t = age[i] / life[i];
      const c = i * 7;
      outPos[i3] = pos[i3];
      outPos[i3 + 1] = pos[i3 + 1];
      outPos[i3 + 2] = pos[i3 + 2];
      const i4 = i * 4;
      outColor[i4] = colors[c] + (colors[c + 3] - colors[c]) * t;
      outColor[i4 + 1] = colors[c + 1] + (colors[c + 4] - colors[c + 1]) * t;
      outColor[i4 + 2] = colors[c + 2] + (colors[c + 5] - colors[c + 2]) * t;
      // Puffs fade in quickly and out slowly; chips stay solid and fade over their last quarter.
      const fade = puff ? Math.min(1, t * 6) * (1 - t) * (1 - t) : Math.min(1, (1 - t) * 4);
      outColor[i4 + 3] = colors[c + 6] * fade;
      outSize[i * 2] = sizes[i * 2] + (sizes[i * 2 + 1] - sizes[i * 2]) * t;
      outSize[i * 2 + 1] = (puff ? 1 : 0) + params[q + 3];
      i++;
    }
    this.geometry.setDrawRange(0, this.live);
    if (this.live > 0) {
      this.upload(this.aPos, 3);
      this.upload(this.aColor, 4);
      this.upload(this.aSize, 2);
    }
  }

  clear(): void {
    this.live = 0;
    this.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private upload(attr: THREE.BufferAttribute, size: number): void {
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, this.live * size);
    attr.needsUpdate = true;
  }

  /** Overwrites particle i with the last live particle. */
  private moveLast(i: number): void {
    const last = --this.live;
    if (i === last) return;
    const { pos, vel, age, life, sizes, colors, params } = this;
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = pos[last * 3 + k];
      vel[i * 3 + k] = vel[last * 3 + k];
    }
    age[i] = age[last];
    life[i] = life[last];
    sizes[i * 2] = sizes[last * 2];
    sizes[i * 2 + 1] = sizes[last * 2 + 1];
    for (let k = 0; k < 7; k++) colors[i * 7 + k] = colors[last * 7 + k];
    for (let k = 0; k < 4; k++) params[i * 4 + k] = params[last * 4 + k];
  }
}
