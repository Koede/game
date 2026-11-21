/**
 * Soft additive halos in front of glowing furnace mouths, so a lit furnace reads as a warm light from across
 * the base at night. One THREE.Points draw call; positions are rewritten from the emitters' source list.
 */
import * as THREE from 'three';

const VERTEX = /* glsl */ `
in vec4 aGlow;
uniform float uScale;
uniform float uTime;
out vec3 vColor;
void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float flicker = 0.9 + 0.06 * sin(uTime * 7.3 + aGlow.w * 13.0) + 0.04 * sin(uTime * 17.1 + aGlow.w * 5.0);
  gl_PointSize = clamp(aGlow.w * flicker * uScale / max(-mv.z, 0.05), 2.0, 512.0);
  vColor = aGlow.rgb * flicker;
}
`;
const FRAGMENT = /* glsl */ `
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = dot(d, d);
  if (r > 1.0) discard;
  float a = (1.0 - r);
  fragColor = vec4(vColor * a * a, 1.0);
}
`;

function upload(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count);
  attr.needsUpdate = true;
}

export class Glows {
  readonly points: THREE.Points;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly pos: THREE.BufferAttribute;
  private readonly glow: THREE.BufferAttribute;
  private count = 0;

  constructor(readonly capacity = 96) {
    this.pos = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.glow = new THREE.BufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.pos);
    this.geometry.setAttribute('aGlow', this.glow);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      name: 'glows',
      glslVersion: THREE.GLSL3,
      uniforms: { uScale: { value: 600 }, uTime: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'glows';
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  setScale(pixelsPerUnit: number): void {
    this.material.uniforms.uScale.value = pixelsPerUnit;
  }

  /** Starts a new frame's list of halos. */
  begin(time: number): void {
    this.count = 0;
    this.material.uniforms.uTime.value = time % 3600;
  }

  /** Adds a halo of `size` blocks across, coloured r,g,b (additive, so 0.3 is already a strong glow). */
  add(x: number, y: number, z: number, size: number, r: number, g: number, b: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    const p = this.pos.array as Float32Array;
    const c = this.glow.array as Float32Array;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    c[i * 4] = r;
    c[i * 4 + 1] = g;
    c[i * 4 + 2] = b;
    c[i * 4 + 3] = size;
  }

  end(): void {
    this.geometry.setDrawRange(0, this.count);
    this.points.visible = this.count > 0;
    if (this.count === 0) return;
    upload(this.pos, this.count * 3);
    upload(this.glow, this.count * 4);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
