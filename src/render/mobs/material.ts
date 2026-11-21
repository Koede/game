/**
 * The animal and automaton shader: animates the parts (leg swing, head pitch / turn / baby scale, arm angles about
 * their pivots), places the model with its instance matrix, lights it per vertex with the terrain's own ramps and
 * tints (the world uniforms: sky x time of day, firelight) from per-instance light probed at the creature, adds subtle
 * per-pixel colour noise, the red hurt flash, the dithered fade of a corpse, and the world's distance fog. Ember parts
 * of automatons (spec 19.5) glow regardless of light, flare brighter through a wind-up and go dark when dormant; their
 * embers also light their own bodies a little so they read at night.
 * Plus a soft blob shadow under each creature.
 */
import * as THREE from 'three';
import type { WorldUniforms } from '../materials';
import { COOL_TINT_GLSL } from '../coolLight';
import { LIGHT_GLSL } from '../shaders/chunk';
import { EMISSIVE_FLAG } from './geometry';

const NOISE_SIZE = 32;

const VERTEX = /* glsl */ `
precision highp float;
in vec3 aColor;
in vec3 aPivot;
in float aPart;  // group (0 rigid, 1 head, 2/3 legs, 4/5 arms) + ${EMISSIVE_FLAG} for an ember part
in vec4 aFeature; // xyz centre of the part's box, w 1 for horns / tusks
in vec4 aAnim;   // x leg swing (rad), y head pitch (rad), z head scale, w hurt flash 0..1
in vec4 aLight;  // x sky 0..1, y block 0..1, z fade 0..1, w eager 0..1
in vec2 aCool;   // x share of the block light from cool glows, negative = violet (src/render/coolLight.ts); y head turn (rad)
in vec4 aEmber;  // x ember glow 0..1, y flare 0..1, z left arm, w right arm (rad)
uniform float uTime;
${LIGHT_GLSL}
${COOL_TINT_GLSL}
out vec3 vColor;
out vec2 vUv;
out vec4 vFog;
out float vFlash;
out float vFade;
out float vEmit;

vec3 rotX(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  float hot = aPart > ${(EMISSIVE_FLAG - 0.5).toFixed(1)} ? 1.0 : 0.0;
  float group = aPart - hot * ${EMISSIVE_FLAG.toFixed(1)};
  // Young animals (head scale above 1) have only nubs where their parents have horns and tusks.
  if (aFeature.w > 0.5 && aAnim.z > 1.0) p = mix(aFeature.xyz, p, 0.4);
  if (group > 0.5) {
    vec3 local = p - aPivot;
    if (group < 1.5) {
      // Head: pitched in its own frame, then turned (a sentry's kiln, a drone's coil).
      local = rotY(rotX(local * aAnim.z, aAnim.y), aCool.y);
      n = rotY(rotX(n, aAnim.y), aCool.y);
    } else {
      float a = group < 2.5 ? aAnim.x : (group < 3.5 ? -aAnim.x : (group < 4.5 ? aEmber.z : aEmber.w));
      local = rotX(local, a);
      n = rotX(n, a);
    }
    p = aPivot + local;
  }
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  // The terrain's face shading (top 1, bottom 0.5, north/south 0.8, east/west 0.65), from the world normal.
  float side = mix(0.65, 0.8, abs(wn.z) / (abs(wn.x) + abs(wn.z) + 1e-4));
  float shade = wn.y >= 0.0 ? mix(side, 1.0, wn.y) : mix(side, 0.5, -wn.y);
  vec3 light = lightColorTinted(aLight.x, aLight.y, coolBlockTint(aCool.x));
  float ember = aEmber.x;
  float flare = aEmber.y;
  if (hot > 0.5) {
    float flick = 0.9 + 0.1 * sin(uTime * 9.0 + aFeature.x * 37.0 + float(gl_InstanceID) * 2.3);
    vec3 bright = aColor * (1.0 + 0.85 * flare) * flick + vec3(0.35, 0.24, 0.12) * flare * flare;
    // A cold cinder: dark, lit like the rest of the body.
    vec3 cold = aColor * vec3(0.3, 0.24, 0.22) * light * shade;
    vColor = mix(cold, bright, ember);
    vEmit = ember;
  } else {
    float glow = 1.0 + aLight.w * (0.1 + 0.08 * sin(uTime * 7.0));
    vec3 own = vec3(1.0, 0.5, 0.22) * (0.1 + 0.14 * flare) * ember;
    vColor = aColor * (light + own) * shade * glow;
    vEmit = 0.0;
  }
  vec3 toVertex = world.xyz - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  vUv = uv;
  vFlash = clamp(aAnim.w, 0.0, 1.0);
  vFade = aLight.z;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform sampler2D uNoise;
in vec3 vColor;
in vec2 vUv;
in vec4 vFog;
in float vFlash;
in float vFade;
in float vEmit;
out vec4 fragColor;

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[idx]) + 0.5) / 16.0;
}

void main() {
  if (vFade > 0.0 && bayer4(gl_FragCoord.xy) < vFade) discard;
  float n = texture(uNoise, vUv / ${NOISE_SIZE.toFixed(1)}).r;
  vec3 c = vColor * mix(0.86 + 0.28 * n, 0.95 + 0.1 * n, vEmit);
  // Hurt: a red tint that keeps the shading (multiplied), plus a little red glow so it reads in the dark too.
  c = mix(c, c * vec3(1.7, 0.42, 0.36) + vec3(0.16, 0.0, 0.0), vFlash);
  // Embers cut through the fog a little further than iron does.
  fragColor = vec4(mix(c, vFog.rgb, vFog.a * (1.0 - 0.4 * vEmit)), 1.0);
}
`;

const SHADOW_VERTEX = /* glsl */ `
precision highp float;
in float aShadow;
uniform vec2 uFog;
out vec2 vLocal;
out float vAlpha;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vLocal = uv * 2.0 - 1.0;
  float dist = length(world.xyz - cameraPosition);
  vAlpha = aShadow * (1.0 - smoothstep(uFog.x, uFog.y, dist));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SHADOW_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vLocal;
in float vAlpha;
out vec4 fragColor;
void main() {
  float r = dot(vLocal, vLocal);
  if (r >= 1.0) discard;
  // Flat in the middle (mostly under the body anyway), soft towards the rim.
  fragColor = vec4(0.0, 0.0, 0.0, vAlpha * (1.0 - smoothstep(0.45, 1.0, r)));
}
`;

/** A tileable 32x32 noise texture: mostly mid values with a few darker and lighter flecks, nearest-sampled. */
export function createNoiseTexture(): THREE.DataTexture {
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  let s = 0x9e3779b9;
  const rand = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = 0; i < NOISE_SIZE * NOISE_SIZE; i++) {
    const r = rand();
    const v = r < 0.12 ? 0.1 + rand() * 0.2 : r > 0.9 ? 0.8 + rand() * 0.2 : 0.4 + rand() * 0.25;
    const b = Math.round(v * 255);
    data.set([b, b, b, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, NOISE_SIZE, NOISE_SIZE, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** The animal material; it shares the world uniforms by reference (sky tint, firelight, fog, time). */
export function createMobMaterial(world: WorldUniforms, noise: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'mobs',
    glslVersion: THREE.GLSL3,
    uniforms: { ...world, uNoise: { value: noise } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
}

/** Blob shadows: blended, no depth write, drawn after the opaque world. */
export function createShadowMaterial(world: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'mob-shadows',
    glslVersion: THREE.GLSL3,
    uniforms: { uFog: world.uFog },
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}
