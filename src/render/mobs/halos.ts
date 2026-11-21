/**
 * Soft additive halos that face the camera: the bloom around an automaton's ember core (bigger and hotter through a
 * wind-up), around an ember bolt in flight, and the brief flashes of hits, shots and break-aparts. One instanced draw
 * call for all of them; sizes are in blocks (no screen-scale uniform needed). Each halo is pulled a little towards the
 * camera so the model it sits on does not cut it in half. Allocation-free per frame.
 */
import * as THREE from 'three';
import type { WorldUniforms } from '../materials';

const VERTEX = /* glsl */ `
precision highp float;
in vec4 aHalo;   // xyz centre, w diameter in blocks
in vec3 aTint;   // additive colour at the centre
uniform vec2 uFog;
out vec2 vLocal;
out vec3 vColor;
void main() {
  vec4 mv = viewMatrix * vec4(aHalo.xyz, 1.0);
  float dist = length(mv.xyz);
  mv.xyz += (-mv.xyz / max(dist, 0.001)) * min(0.45, aHalo.w * 0.4);
  // Never wider than the distance (a halo right in front of the lens would flood the screen: fill rate on phones).
  mv.xy += position.xy * min(aHalo.w, max(0.3, dist * 0.9));
  vLocal = position.xy * 2.0;
  vColor = aTint * (1.0 - 0.85 * smoothstep(uFog.x, uFog.y, dist));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vLocal;
in vec3 vColor;
out vec4 fragColor;
void main() {
  float r = dot(vLocal, vLocal);
  if (r >= 1.0) discard;
  float a = (1.0 - r);
  fragColor = vec4(vColor * a * a, 1.0);
}
`;

/** Marks the first `count` floats of an attribute for upload. */
export function flushRange(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count);
  attr.needsUpdate = true;
}

export class Halos {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly halo: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private n = 0;

  constructor(
    world: WorldUniforms,
    readonly capacity = 96,
  ) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.setIndex(quad.getIndex());
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.halo = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aHalo', this.halo);
    this.geometry.setAttribute('aTint', this.tint);
    this.geometry.instanceCount = 0;
    quad.dispose();
    this.material = new THREE.ShaderMaterial({
      name: 'ember-halos',
      glslVersion: THREE.GLSL3,
      uniforms: { uFog: world.uFog },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'ember-halos';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  /** Halos added since the last begin(). */
  get count(): number {
    return this.n;
  }

  begin(): void {
    this.n = 0;
  }

  /** Adds a halo `size` blocks across; r,g,b is added to the scene at its centre (0.4 is already strong). */
  add(x: number, y: number, z: number, size: number, r: number, g: number, b: number): void {
    if (this.n >= this.capacity || size <= 0) return;
    const i = this.n++;
    const h = this.halo.array as Float32Array;
    h[i * 4] = x;
    h[i * 4 + 1] = y;
    h[i * 4 + 2] = z;
    h[i * 4 + 3] = size;
    const t = this.tint.array as Float32Array;
    t[i * 3] = r;
    t[i * 3 + 1] = g;
    t[i * 3 + 2] = b;
  }

  /** Uploads this frame's halos. */
  end(): void {
    this.geometry.instanceCount = this.n;
    if (this.n === 0) return;
    flushRange(this.halo, this.n * 4);
    flushRange(this.tint, this.n * 3);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
