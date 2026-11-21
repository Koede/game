/**
 * Rain streaks, snowflakes and blown dust around the camera: one instanced draw call over a fixed pool of
 * particles whose motion is computed entirely in the vertex shader (a box of drops that wraps around the camera
 * as it moves), so the CPU only writes a few uniforms per frame. Particles below the RainMask height of their
 * column are culled in the shader: precipitation stops on roofs and under trees.
 */
import * as THREE from 'three';
import { mulberry32 } from '../core/math';
import type { Precipitation } from '../core/types';
import { MASK_SIZE, type RainMask } from './rainMask';

/** Particles in the pool (desktop / touch devices). `amount` 0..1 draws that share of them. */
export const PRECIP_MAX_DESKTOP = 3600;
export const PRECIP_MAX_TOUCH = 1800;

interface Look {
  /** Half extents of the box of particles around the camera. */
  half: [number, number, number];
  /** Fall speed (blocks/s) and horizontal wind speed at full storm. */
  fall: number;
  wind: number;
  windStorm: number;
  /** Width (rain) or size (snow, dust) and streak length (rain only). */
  size: number;
  length: number;
  color: [number, number, number];
  alpha: number;
  kind: number;
}

const LOOKS: Record<Exclude<Precipitation, 'none'>, Look> = {
  rain: { half: [18, 14, 18], fall: 15, wind: 1.2, windStorm: 4.5, size: 0.022, length: 0.75, color: [0.72, 0.78, 0.88], alpha: 0.5, kind: 0 },
  snow: { half: [15, 10, 15], fall: 1.5, wind: 0.5, windStorm: 3.5, size: 0.075, length: 0, color: [0.97, 0.98, 1.0], alpha: 0.9, kind: 1 },
  dust: { half: [16, 7, 16], fall: 0.25, wind: 7, windStorm: 12, size: 0.22, length: 0, color: [0.8, 0.66, 0.45], alpha: 0.32, kind: 2 },
};

const VERTEX = /* glsl */ `
precision highp float;
in vec4 aSeed;
uniform vec3 uOrigin;
uniform vec3 uHalf;
uniform vec3 uVel;
uniform float uTime;
uniform float uKind;
uniform float uSize;
uniform float uLength;
uniform sampler2D uMask;
out vec2 vUv;
out float vAlpha;

void main() {
  vec3 size = uHalf * 2.0;
  float speed = 0.85 + 0.3 * aSeed.w;
  vec3 p = aSeed.xyz * size + uVel * (uTime * speed);
  if (uKind > 0.5 && uKind < 1.5) {
    p.x += sin(uTime * 1.3 + aSeed.w * 40.0) * 0.5;
    p.z += cos(uTime * 1.1 + aSeed.w * 23.0) * 0.5;
  } else if (uKind > 1.5) {
    p.y += sin(uTime * 1.7 + aSeed.w * 31.0) * 0.7;
  }
  // Wrap into the box around the camera: particles keep their place in the world while the camera moves.
  vec3 base = uOrigin - uHalf;
  p = base + mod(p - base, size);

  vec3 toP = p - cameraPosition;
  float dist = length(toP);
  float alpha = (1.0 - smoothstep(uHalf.x * 0.55, uHalf.x, length(p.xz - uOrigin.xz))) * (0.7 + 0.3 * aSeed.w);
  // No streak right in the eye.
  alpha *= smoothstep(0.35, 1.4, dist);
  float top = texelFetch(uMask, ivec2(mod(floor(p.xz), ${MASK_SIZE}.0)), 0).r * 255.0;
  if (p.y < top || alpha < 0.003) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    vUv = vec2(0.0);
    return;
  }
  vec3 right;
  vec3 up;
  if (uKind < 0.5) {
    up = normalize(uVel) * uLength * (0.8 + 0.4 * aSeed.w);
    right = normalize(cross(up, toP)) * uSize * (1.0 + dist * 0.035);
  } else {
    float s = uSize * (0.6 + 0.8 * aSeed.w);
    right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * s;
    up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * s;
    if (uKind > 1.5) right *= 2.2;
  }
  vec3 world = p + right * position.x + up * position.y;
  vUv = position.xy * 2.0;
  vAlpha = alpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uKind;
in vec2 vUv;
in float vAlpha;
out vec4 fragColor;
void main() {
  float a;
  if (uKind < 0.5) {
    // A streak: solid down the middle, softer at the edges, brightest at the leading (lower) end.
    a = (1.0 - abs(vUv.x)) * (0.35 + 0.65 * (vUv.y * 0.5 + 0.5));
  } else {
    float r = dot(vUv, vUv);
    if (r > 1.0) discard;
    a = uKind < 1.5 ? 1.0 - r * r : (1.0 - r) * (1.0 - r);
  }
  a *= vAlpha * uAlpha;
  if (a < 0.004) discard;
  fragColor = vec4(uColor, a);
}
`;

export class PrecipitationLayer {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly maskTexture: THREE.DataTexture;
  private readonly uniforms;
  private readonly max: number;

  constructor(private readonly mask: RainMask, max: number) {
    this.max = max;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(max * 4);
    const rnd = mulberry32(0x5eed7a1);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geometry.instanceCount = 0;
    this.geometry = geometry;

    this.maskTexture = new THREE.DataTexture(mask.data, MASK_SIZE, MASK_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    this.maskTexture.magFilter = THREE.NearestFilter;
    this.maskTexture.minFilter = THREE.NearestFilter;
    this.maskTexture.generateMipmaps = false;
    this.maskTexture.needsUpdate = true;

    this.uniforms = {
      uOrigin: { value: new THREE.Vector3() },
      uHalf: { value: new THREE.Vector3(16, 10, 16) },
      uVel: { value: new THREE.Vector3(0, -10, 0) },
      uTime: { value: 0 },
      uKind: { value: 0 },
      uSize: { value: 0.02 },
      uLength: { value: 0.7 },
      uMask: { value: this.maskTexture },
      uColor: { value: new THREE.Vector3(1, 1, 1) },
      uAlpha: { value: 0.5 },
    };
    this.material = new THREE.ShaderMaterial({
      name: 'precipitation',
      glslVersion: THREE.GLSL3,
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'precipitation';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** Particles drawn last frame. */
  get count(): number {
    return this.mesh.visible ? this.geometry.instanceCount : 0;
  }

  /**
   * One frame. `amount` 0..1 (WeatherState.intensity), `storm` 0..1 slants the fall, `windAngle` (radians) is the
   * direction the wind blows towards, `light` the colour of daylight on it (sky light, flash included).
   */
  update(kind: Precipitation, amount: number, storm: number, windAngle: number, time: number, camera: THREE.Vector3, light: ArrayLike<number>, hidden: boolean): void {
    const look = kind === 'none' ? null : LOOKS[kind];
    const n = look && !hidden ? Math.round(this.max * Math.min(1, amount)) : 0;
    this.mesh.visible = n > 0;
    if (!look || n === 0) return;
    this.geometry.instanceCount = n;
    if (this.mask.changed) {
      this.mask.changed = false;
      this.maskTexture.needsUpdate = true;
    }
    const u = this.uniforms;
    u.uOrigin.value.copy(camera);
    u.uHalf.value.set(look.half[0], look.half[1], look.half[2]);
    const wind = look.wind + (look.windStorm - look.wind) * storm;
    u.uVel.value.set(Math.cos(windAngle) * wind, -look.fall, Math.sin(windAngle) * wind);
    u.uTime.value = time % 3600;
    u.uKind.value = look.kind;
    u.uSize.value = look.size;
    u.uLength.value = look.length;
    // Lit by the sky: bright by day, faint by night, never fully invisible (a phone screen at night).
    const l = 0.18 + 0.82 * Math.min(1, (light[0] + light[1] + light[2]) / 3);
    u.uColor.value.set(look.color[0] * l, look.color[1] * l, look.color[2] * l);
    u.uAlpha.value = look.alpha * (0.55 + 0.45 * Math.min(1, amount * 1.4));
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
