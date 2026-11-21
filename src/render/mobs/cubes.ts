/**
 * One instanced draw call of small cubes: the debris of a broken automaton (lit like the terrain at the spot it broke,
 * ember pieces glowing) and the cores of ember bolts in flight (full-bright). Each frame the owner writes the cubes it
 * wants between begin() and end(). Allocation-free per frame.
 */
import * as THREE from 'three';
import type { WorldUniforms } from '../materials';
import { LIGHT_GLSL } from '../shaders/chunk';
import { flushRange } from './halos';

const VERTEX = /* glsl */ `
precision highp float;
in vec4 aTint;  // rgb colour, w 0 lit .. 1 glowing
in vec2 aLit;   // sky, block light 0..1
${LIGHT_GLSL}
out vec3 vColor;
out vec4 vFog;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 wn = normalize(mat3(instanceMatrix) * normal);
  float side = mix(0.65, 0.8, abs(wn.z) / (abs(wn.x) + abs(wn.z) + 1e-4));
  float shade = wn.y >= 0.0 ? mix(side, 1.0, wn.y) : mix(side, 0.5, -wn.y);
  vec3 lit = aTint.rgb * lightColor(aLit.x, aLit.y) * shade;
  vColor = mix(lit, aTint.rgb * (0.85 + 0.3 * shade), aTint.w);
  vec3 toVertex = world.xyz - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist) * (1.0 - 0.4 * aTint.w));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
in vec3 vColor;
in vec4 vFog;
out vec4 fragColor;
void main() {
  fragColor = vec4(mix(vColor, vFog.rgb, vFog.a), 1.0);
}
`;

export class CubeBatch {
  readonly mesh: THREE.InstancedMesh;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly lit: THREE.InstancedBufferAttribute;
  private readonly material: THREE.ShaderMaterial;
  private n = 0;

  constructor(
    world: WorldUniforms,
    readonly capacity = 192,
  ) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.lit = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage);
    box.setAttribute('aTint', this.tint);
    box.setAttribute('aLit', this.lit);
    this.material = new THREE.ShaderMaterial({
      name: 'ember-cubes',
      glslVersion: THREE.GLSL3,
      uniforms: { ...world },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    this.mesh = new THREE.InstancedMesh(box, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.name = 'ember-cubes';
  }

  get count(): number {
    return this.n;
  }

  begin(): void {
    this.n = 0;
  }

  /**
   * Adds a cube `size` blocks wide at x,y,z, tumbled by rx (about X) then ry (about Y); colour r,g,b; `glow` 0 lit by
   * (sky, block) light .. 1 full-bright.
   */
  add(x: number, y: number, z: number, size: number, rx: number, ry: number, r: number, g: number, b: number, glow: number, sky: number, block: number): void {
    if (this.n >= this.capacity || size <= 0) return;
    const i = this.n++;
    const cx = Math.cos(rx);
    const sx = Math.sin(rx);
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    // M = T * Ry * Rx * S, column-major.
    const e = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    e[o] = cy * size;
    e[o + 1] = 0;
    e[o + 2] = -sy * size;
    e[o + 3] = 0;
    e[o + 4] = sy * sx * size;
    e[o + 5] = cx * size;
    e[o + 6] = cy * sx * size;
    e[o + 7] = 0;
    e[o + 8] = sy * cx * size;
    e[o + 9] = -sx * size;
    e[o + 10] = cy * cx * size;
    e[o + 11] = 0;
    e[o + 12] = x;
    e[o + 13] = y;
    e[o + 14] = z;
    e[o + 15] = 1;
    const t = this.tint.array as Float32Array;
    t[i * 4] = r;
    t[i * 4 + 1] = g;
    t[i * 4 + 2] = b;
    t[i * 4 + 3] = glow;
    const l = this.lit.array as Float32Array;
    l[i * 2] = sky;
    l[i * 2 + 1] = block;
  }

  end(): void {
    this.mesh.count = this.n;
    if (this.n === 0) return;
    flushRange(this.mesh.instanceMatrix, this.n * 16);
    flushRange(this.tint, this.n * 4);
    flushRange(this.lit, this.n * 2);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
  }
}
