/**
 * The sky: a gradient dome with a square sun, a moon and twinkling stars, plus a layer of slowly drifting
 * blocky clouds. Both follow the camera; colours come from skyModel.computeSky.
 */
import * as THREE from 'three';
import { hashFloat } from '../core/math';
import type { SkyState } from './skyModel';

const DOME_VERTEX = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(position * 300.0 + cameraPosition, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.9999, p.w);
}
`;

const DOME_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uStars;
uniform float uDay;
uniform float uTime;
in vec3 vDir;
out vec4 fragColor;

float hash3(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

// Distance from the centre of a disc-shaped body, measured in its own square frame (blocky sun and moon).
float squareDist(vec3 dir, vec3 body) {
  vec3 side = normalize(cross(body, vec3(0.0, 0.0, 1.0)));
  vec3 up = cross(side, body);
  float facing = dot(dir, body);
  if (facing <= 0.0) return 1e3;
  vec2 q = vec2(dot(dir, side), dot(dir, up)) / facing;
  return max(abs(q.x), abs(q.y));
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  float up = sqrt(max(h, 0.0));
  vec3 col = mix(uHorizon, uZenith, up);
  float g = max(dot(dir, uSunDir), 0.0);
  col += uGlow * (g * g * g) * (1.0 - up * 0.6);
  if (h < 0.0) col = mix(uHorizon, uHorizon * 0.82, min(-h * 4.0, 1.0));

  float sun = squareDist(dir, uSunDir);
  if (sun < 0.075) col = mix(col, uSunColor * 1.3, sun < 0.06 ? 1.0 : 0.45);
  col += uSunColor * 0.32 * exp(-sun * 9.0) * (0.35 + 0.65 * uDay);

  vec3 moonDir = -uSunDir;
  float moon = squareDist(dir, moonDir);
  if (moon < 0.05) {
    vec3 m = vec3(0.86, 0.88, 0.95);
    vec3 cell = floor(dir * 160.0);
    if (hash3(cell) > 0.72) m *= 0.8;
    col = mix(col, m, (1.0 - uDay * 0.75) * (moon < 0.042 ? 1.0 : 0.4));
  }
  col += vec3(0.5, 0.55, 0.7) * 0.06 * exp(-moon * 12.0) * (1.0 - uDay);

  if (uStars > 0.0 && h > -0.02) {
    vec3 cell = floor(dir * 150.0);
    float s = hash3(cell);
    if (s > 0.9935) {
      float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + s * 40.0) + s * 300.0);
      float bright = (s - 0.9935) / 0.0065;
      col += vec3(0.75, 0.8, 1.0) * uStars * twinkle * (0.35 + 0.65 * bright) * smoothstep(-0.02, 0.18, h);
    }
  }
  fragColor = vec4(col, 1.0);
}
`;

const CLOUD_VERTEX = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const CLOUD_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uOffset;
uniform vec3 uCloud;
uniform vec3 uFogColor;
uniform float uFar;
in vec3 vWorld;
out vec4 fragColor;
void main() {
  vec2 cell = (vWorld.xz + uOffset) / 12.0;
  float c = texture(uMap, cell / 48.0).r;
  if (c < 0.5) discard;
  float dist = length(vWorld.xz - cameraPosition.xz);
  float fade = 1.0 - smoothstep(uFar * 0.45, uFar, dist);
  if (fade <= 0.0) discard;
  float shade = cameraPosition.y > vWorld.y ? 1.0 : 0.88 + 0.12 * (c - 0.5) * 2.0;
  vec3 col = mix(uFogColor, uCloud * shade, 0.35 + 0.65 * fade);
  fragColor = vec4(col, 0.82 * fade);
}
`;

/** A tiling field of cloud cells (1 byte each): blobby islands built from value noise. */
function cloudField(size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  const octave = (x: number, y: number, period: number, seed: number): number => {
    const fx = (x / period) % (size / period);
    const fy = (y / period) % (size / period);
    const n = size / period;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const v = (ix: number, iy: number): number => hashFloat(((ix % n) + n) % n, ((iy % n) + n) % n, seed);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = octave(x, y, 16, 7) * 0.6 + octave(x, y, 8, 11) * 0.28 + octave(x, y, 4, 13) * 0.12;
      out[y * size + x] = Math.round(Math.max(0, Math.min(1, (n - 0.2) * 1.25)) * 255);
    }
  }
  return out;
}

const CLOUD_HEIGHT = 118;
const CLOUD_SPEED = 1.1;

export class Sky {
  readonly dome: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  private readonly domeUniforms;
  private readonly cloudUniforms;
  private readonly cloudMap: THREE.DataTexture;

  constructor() {
    this.domeUniforms = {
      uZenith: { value: new THREE.Vector3() },
      uHorizon: { value: new THREE.Vector3() },
      uGlow: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Vector3(1, 1, 1) },
      uStars: { value: 0 },
      uDay: { value: 1 },
      uTime: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        name: 'sky',
        glslVersion: THREE.GLSL3,
        uniforms: this.domeUniforms,
        vertexShader: DOME_VERTEX,
        fragmentShader: DOME_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    dome.name = 'sky';
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.dome = dome;

    const size = 48;
    this.cloudMap = new THREE.DataTexture(cloudField(size), size, size, THREE.RedFormat, THREE.UnsignedByteType);
    this.cloudMap.magFilter = THREE.NearestFilter;
    this.cloudMap.minFilter = THREE.NearestFilter;
    this.cloudMap.wrapS = THREE.RepeatWrapping;
    this.cloudMap.wrapT = THREE.RepeatWrapping;
    this.cloudMap.needsUpdate = true;
    this.cloudUniforms = {
      uMap: { value: this.cloudMap },
      uOffset: { value: new THREE.Vector2() },
      uCloud: { value: new THREE.Vector3(1, 1, 1) },
      uFogColor: { value: new THREE.Vector3() },
      uFar: { value: 200 },
    };
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const clouds = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        name: 'clouds',
        glslVersion: THREE.GLSL3,
        uniforms: this.cloudUniforms,
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    clouds.name = 'clouds';
    clouds.frustumCulled = false;
    clouds.renderOrder = 3;
    this.clouds = clouds;
  }

  /** Copies the sky state into the uniforms and moves dome and clouds with the camera. Allocation-free. */
  update(sky: SkyState, camera: THREE.Camera, time: number, far: number): void {
    const u = this.domeUniforms;
    u.uZenith.value.fromArray(sky.zenith);
    u.uHorizon.value.fromArray(sky.horizon);
    u.uGlow.value.fromArray(sky.glow);
    u.uSunDir.value.fromArray(sky.sunDir);
    u.uSunColor.value.fromArray(sky.sunColor);
    u.uStars.value = sky.stars;
    u.uDay.value = sky.day;
    u.uTime.value = time;

    const c = this.cloudUniforms;
    c.uCloud.value.fromArray(sky.cloud);
    c.uFogColor.value.fromArray(sky.horizon);
    c.uFar.value = far;
    // Wrap the drift so float precision never degrades in a long session (the field repeats every 576 blocks).
    c.uOffset.value.set((time * CLOUD_SPEED) % 576, (time * CLOUD_SPEED * 0.35) % 576);
    const p = camera.position;
    this.clouds.position.set(p.x, CLOUD_HEIGHT, p.z);
    this.clouds.scale.set(far * 2, 1, far * 2);
  }

  dispose(): void {
    this.dome.geometry.dispose();
    (this.dome.material as THREE.Material).dispose();
    this.clouds.geometry.dispose();
    (this.clouds.material as THREE.Material).dispose();
    this.cloudMap.dispose();
  }
}
