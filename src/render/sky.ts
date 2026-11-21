/**
 * The sky: a gradient dome with a square sun, a pixel moon drawn in its phase, a slowly turning field of
 * twinkling stars and storm lightning, plus a layer of drifting clouds that thickens with the weather. Both
 * follow the camera; colours come from skyModel.computeSky + applyWeather.
 */
import * as THREE from 'three';
import { hashFloat, smoothstep } from '../core/math';
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
uniform vec4 uVeil;
uniform float uCover;
// Moon phase 0..8 (0 new, 4 full) and the star field's rotation about the pole.
uniform float uMoonPhase;
uniform vec3 uStarAxis;
uniform float uStarAngle;
// Lightning: flash strength, the direction it came from, and the bolt (bearing, alpha, seed, closeness).
uniform float uFlash;
uniform vec3 uFlashDir;
uniform vec4 uBolt;
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

// Lit part of the pixel moon at disc coordinates c (-1..1): a pixel disc with the terminator of the phase.
float moonLit(vec2 c) {
  float theta = 6.2831853 * uMoonPhase / 8.0;
  float t = cos(theta);
  float x = uMoonPhase > 4.0 ? -c.x : c.x;
  return x > t * sqrt(max(0.0, 1.0 - c.y * c.y)) ? 1.0 : 0.0;
}

// Rodrigues rotation of v about unit axis k.
vec3 rotateAbout(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

float boltHash(float n) {
  return fract(sin(n * 127.1 + uBolt.z * 311.7) * 43758.5453);
}

// A jagged bolt hanging from the cloud base to the horizon at a bearing (yaw convention: 0 north, + turns left).
float bolt(vec3 dir) {
  if (uBolt.y <= 0.0 || dir.y < -0.01 || dir.y > 0.34) return 0.0;
  float az = atan(-dir.x, -dir.z);
  float d = az - uBolt.x;
  d = mod(d + 3.14159265, 6.2831853) - 3.14159265;
  float seg = dir.y / 0.028;
  float i = floor(seg);
  float f = fract(seg);
  float a = (boltHash(i) - 0.5) * 0.05 + (i * 0.004) * (boltHash(99.0) - 0.5);
  float b = (boltHash(i + 1.0) - 0.5) * 0.05 + ((i + 1.0) * 0.004) * (boltHash(99.0) - 0.5);
  float x = d - mix(a, b, f);
  float width = mix(0.0018, 0.0045, uBolt.w);
  float core = 1.0 - smoothstep(width * 0.4, width, abs(x));
  float glow = exp(-abs(x) / (width * 5.0)) * 0.35;
  return (core + glow) * uBolt.y * smoothstep(-0.01, 0.03, dir.y);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  float up = sqrt(max(h, 0.0));
  vec3 col = mix(uHorizon, uZenith, up);
  float g = max(dot(dir, uSunDir), 0.0);
  col += uGlow * (g * g * g) * (1.0 - up * 0.6);
  // Below the horizon the dome is exactly the fog colour, so the far terrain melts into it without a seam.
  if (h < 0.0) col = uHorizon + uGlow * (g * g * g);

  // Cloud cover veils the sun to a pale smudge, then hides it.
  float clear = 1.0 - smoothstep(0.45, 0.95, uCover);
  float sun = squareDist(dir, uSunDir);
  if (sun < 0.075) col = mix(col, uSunColor * 1.3, (sun < 0.06 ? 1.0 : 0.45) * clear);
  col += uSunColor * 0.32 * exp(-sun * 9.0) * (0.35 + 0.65 * uDay) * (0.25 + 0.75 * clear);

  vec3 moonDir = -uSunDir;
  float moon = squareDist(dir, moonDir);
  float illum = (1.0 - cos(6.2831853 * uMoonPhase / 8.0)) * 0.5;
  if (moon < 0.05 && clear > 0.0) {
    // A pixel disc, 12 cells across, in the moon's own square frame.
    vec3 side = normalize(cross(moonDir, vec3(0.0, 0.0, 1.0)));
    vec3 up = cross(side, moonDir);
    float facing = dot(dir, moonDir);
    vec2 q = vec2(dot(dir, side), dot(dir, up)) / facing / 0.05;
    vec2 c = (floor(q * 6.0) + 0.5) / 6.0;
    if (dot(c, c) < 1.0) {
      float lit = moonLit(c);
      vec3 m = vec3(0.86, 0.88, 0.95);
      if (hash3(vec3(floor(q * 6.0), 3.0)) > 0.7) m *= 0.82;
      // The dark side is a faint earthshine disc, so even a new moon has a shape.
      vec3 dark = mix(col, vec3(0.1, 0.12, 0.17), 0.55);
      col = mix(col, mix(dark, m, lit), (1.0 - uDay * 0.75) * clear);
    }
  }
  col += vec3(0.5, 0.55, 0.7) * 0.07 * illum * exp(-moon * 12.0) * (1.0 - uDay) * clear;

  if (uStars > 0.0 && h > -0.02) {
    vec3 cell = floor(rotateAbout(dir, uStarAxis, -uStarAngle) * 150.0);
    float s = hash3(cell);
    if (s > 0.9935) {
      float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + s * 40.0) + s * 300.0);
      float bright = (s - 0.9935) / 0.0065;
      col += vec3(0.75, 0.8, 1.0) * uStars * twinkle * (0.35 + 0.65 * bright) * smoothstep(-0.02, 0.18, h);
    }
  }
  if (uFlash > 0.0) {
    float toward = max(dot(dir, uFlashDir), 0.0);
    col += vec3(0.75, 0.8, 1.0) * uFlash * (0.15 + 0.85 * toward * toward * toward) * (0.6 + 0.4 * (1.0 - up));
  }
  col += vec3(0.85, 0.9, 1.0) * bolt(dir);
  // Under water or lava the whole sky is replaced by the fog colour.
  fragColor = vec4(mix(col, uVeil.rgb, uVeil.a), 1.0);
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
uniform float uAlpha;
uniform float uCover;
in vec3 vWorld;
out vec4 fragColor;
void main() {
  vec2 cell = (vWorld.xz + uOffset) / 12.0;
  float c = texture(uMap, cell / 48.0).r;
  // Soft-edged puffs: density above the threshold fades in over a short band. More cover lowers the threshold
  // until the puffs merge into one grey deck.
  float thr = mix(0.6, -0.08, uCover);
  float body = smoothstep(thr, thr + 0.16, c);
  if (body <= 0.0) discard;
  float dist = length(vWorld.xz - cameraPosition.xz);
  float fade = 1.0 - smoothstep(uFar * 0.6, uFar, dist);
  if (fade <= 0.0) discard;
  // Thick parts are a little darker underneath, thin edges catch the light.
  float shade = cameraPosition.y > vWorld.y ? 1.0 : 1.0 - (0.16 + 0.3 * uCover) * smoothstep(thr + 0.1, thr + 0.5, c);
  vec3 col = mix(uFogColor, uCloud * shade, 0.35 + 0.65 * fade);
  fragColor = vec4(col, uAlpha * fade * body);
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

const CLOUD_HEIGHT = 112;
const CLOUD_SPEED = 1.1;
/** The star field's pole: the sun's path is tilted SUN_TILT towards the south (skyModel), so the pole leans north. */
const SUN_TILT = 0.42;

/** Per-frame inputs of the sky beyond the SkyState (all optional effects default to off). */
export interface SkyExtras {
  /** Moon phase 0..7 (0 new, 4 full). */
  moonPhase: number;
  /** Rotation of the star field, radians. */
  starAngle: number;
  /** Direction the lightning came from (unit vector) and the bolt: bearing, alpha 0..1, seed, closeness 0..1. */
  flashDir: THREE.Vector3;
  bolt: THREE.Vector4;
  /** Seconds since the last frame (cloud drift speeds up in a storm without jumping). */
  dt: number;
}

export class Sky {
  readonly dome: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  private readonly domeUniforms;
  private readonly cloudUniforms;
  private readonly cloudMap: THREE.DataTexture;
  private driftX = 0;
  private driftZ = 0;

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
      uVeil: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCover: { value: 0 },
      uMoonPhase: { value: 4 },
      uStarAxis: { value: new THREE.Vector3(0, Math.sin(SUN_TILT), -Math.cos(SUN_TILT)) },
      uStarAngle: { value: 0 },
      uFlash: { value: 0 },
      uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
      uBolt: { value: new THREE.Vector4(0, 0, 0, 0) },
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
    this.cloudMap.magFilter = THREE.LinearFilter;
    this.cloudMap.minFilter = THREE.LinearFilter;
    this.cloudMap.wrapS = THREE.RepeatWrapping;
    this.cloudMap.wrapT = THREE.RepeatWrapping;
    this.cloudMap.needsUpdate = true;
    this.cloudUniforms = {
      uMap: { value: this.cloudMap },
      uOffset: { value: new THREE.Vector2() },
      uCloud: { value: new THREE.Vector3(1, 1, 1) },
      uFogColor: { value: new THREE.Vector3() },
      uFar: { value: 200 },
      uAlpha: { value: 0.82 },
      uCover: { value: 0 },
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

  /**
   * Copies the sky state into the uniforms and moves dome and clouds with the camera. `veil` (the fog colour)
   * replaces the whole sky when given, for a camera under water or in lava. Allocation-free.
   */
  update(sky: SkyState, camera: THREE.Camera, time: number, far: number, veil: THREE.Vector3 | null, extras?: SkyExtras): void {
    const u = this.domeUniforms;
    u.uZenith.value.fromArray(sky.zenith);
    u.uHorizon.value.fromArray(sky.horizon);
    u.uGlow.value.fromArray(sky.glow);
    u.uSunDir.value.fromArray(sky.sunDir);
    u.uSunColor.value.fromArray(sky.sunColor);
    u.uStars.value = sky.stars;
    u.uDay.value = sky.day;
    // GPU floats lose precision on large values; the twinkle only needs a wrapping phase.
    u.uTime.value = time % 3600;
    if (veil) u.uVeil.value.set(veil.x, veil.y, veil.z, 1);
    else u.uVeil.value.w = 0;
    this.clouds.visible = !veil;
    u.uCover.value = sky.cover;
    u.uFlash.value = sky.flash;
    if (extras) {
      u.uMoonPhase.value = extras.moonPhase;
      u.uStarAngle.value = extras.starAngle;
      u.uFlashDir.value.copy(extras.flashDir);
      u.uBolt.value.copy(extras.bolt);
    }

    const c = this.cloudUniforms;
    c.uCloud.value.fromArray(sky.cloud);
    c.uFogColor.value.fromArray(sky.horizon);
    c.uFar.value = far;
    // At night clear-weather clouds are only a faint veil over the stars; an overcast deck stays solid.
    const clearAlpha = 0.3 + 0.52 * sky.day;
    c.uAlpha.value = clearAlpha + (0.95 - clearAlpha) * smoothstep(0.3, 0.9, sky.cover);
    c.uCover.value = sky.cover;
    // Drift faster as a storm builds. Wrapped so float precision never degrades (the field repeats every 576 blocks).
    const drift = (extras ? extras.dt : 0) * CLOUD_SPEED * (1 + 2.2 * sky.storm);
    this.driftX = (this.driftX + drift) % 576;
    this.driftZ = (this.driftZ + drift * 0.35) % 576;
    if (!extras) {
      this.driftX = (time * CLOUD_SPEED) % 576;
      this.driftZ = (time * CLOUD_SPEED * 0.35) % 576;
    }
    c.uOffset.value.set(this.driftX, this.driftZ);
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
