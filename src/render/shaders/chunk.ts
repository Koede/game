/**
 * GLSL ES 3.00 for the three chunk batches (opaque, cutout, translucent). All lighting is done per vertex:
 * chunk quads are one block wide, so per-vertex light is as sharp as the light data itself, and a phone GPU
 * only pays for one texture fetch and a fog mix per pixel.
 */

import { textureLayer } from '../../core/registry';
import { LIGHT_COOL_MAX, LIGHT_COOL_SHIFT, LIGHT_FLAG_VIOLET } from '../../world/meshQuads';
import { ATLAS_GLSL } from '../atlas';

/** Tiles per second moving water's texture runs along its flow (spec 18.4). */
export const WATER_SCROLL = 0.9;

/** Texture layer of crude oil: its pool surface is shuffled per block (see liquidTexel). */
const OIL_LAYER = textureLayer('oil');

/** Colours of the cool glows (glowcaps cyan, crystal clusters violet) that tint block light (spec 14). */
export const COOL_CYAN = [0.36, 0.84, 1.0] as const;
export const COOL_VIOLET = [0.72, 0.5, 1.0] as const;
const vec3 = (c: readonly number[]): string => `vec3(${c.map((v) => v.toFixed(3)).join(', ')})`;

/** Shared by the chunk shaders and the held item: perceptual light ramps and the fog colour. */
export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uSkyLight;
uniform vec3 uBlockLight;
uniform float uAmbient;
uniform vec3 uFogColor;
uniform vec3 uFogGlow;
uniform vec3 uSunDir;
uniform vec2 uFog;

// Each sky level is ~0.8x the one above it (a cave mouth darkens quickly but keeps some light).
float skyRamp(float l) { return exp(-3.4 * (1.0 - l)); }
// Firelight carries further and falls off softly, so a lit furnace leaves a pool of warm light around it.
float blockRamp(float l) { return pow(l, 1.25) * 1.45; }

// Block light tinted by 'tint' instead of the firelight colour (cool glows).
vec3 lightColorTinted(float sky, float block, vec3 tint) {
  vec3 s = skyRamp(sky) * uSkyLight;
  vec3 b = blockRamp(block) * tint;
  return max(max(s, b) + 0.22 * min(s, b), vec3(uAmbient));
}

vec3 lightColor(float sky, float block) {
  return lightColorTinted(sky, block, uBlockLight);
}

// The block-light colour of a chunk vertex: firelight, blended towards cyan or violet by the share of its light
// that comes from cool emitters (flags bits 4-7, the violet choice in bit 3; see src/world/meshQuads.ts).
vec3 blockTint(int flags) {
  int cool = flags >> ${LIGHT_COOL_SHIFT};
  if (cool == 0) return uBlockLight;
  vec3 c = (flags & ${LIGHT_FLAG_VIOLET}) != 0 ? ${vec3(COOL_VIOLET)} : ${vec3(COOL_CYAN)};
  return mix(uBlockLight, c, float(cool) / ${LIGHT_COOL_MAX.toFixed(1)});
}

vec3 fogColorFor(vec3 dir) {
  float g = max(dot(dir, uSunDir), 0.0);
  return uFogColor + uFogGlow * (g * g * g);
}

float fogFactor(float dist) {
  return smoothstep(uFog.x, uFog.y, dist);
}
`;

export const CHUNK_VERTEX = /* glsl */ `
precision highp float;
in float layer;
in vec4 light;
uniform float uTime;
// How soaked sky-exposed surfaces look after rain, 0..1 (spec 15): darker, with a sheen at grazing angles.
uniform float uWet;
${LIGHT_GLSL}
out vec2 vUv;
flat out float vLayer;
out vec3 vColor;
out vec4 vFog;
out vec3 vWorld;
out float vWet;
flat out float vLiquid;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  int flags = int(light.w * 255.0 + 0.5);
  vec2 uvShift = vec2(0.0);
  vec3 color;
  if ((flags & 1) != 0) {
    color = vec3(1.0);
  } else {
    color = lightColorTinted(light.x, light.y, blockTint(flags)) * light.z;
  }
  // Bit 1 alone sways a plant top; with the liquid bit 2 it marks moving water instead (spec 18.4).
  if ((flags & 6) == 2) {
    float phase = uTime * 1.7 + world.x * 0.63 + world.z * 0.41;
    world.x += sin(phase) * 0.055;
    world.z += cos(phase * 0.83) * 0.045;
  }
  vLiquid = 0.0;
  if ((flags & 4) != 0) {
    color *= 0.93 + 0.07 * sin(uTime * 1.4 + world.x * 0.9 + world.z * 0.7);
    // The tile repeats, so only the fraction of the drift matters: it keeps texture coordinates small (mediump).
    // Moving water runs along v (the mesher points v along the flow on top, downwards on the sides).
    uvShift = (flags & 2) != 0 ? vec2(0.0, fract(uTime * ${WATER_SCROLL.toFixed(2)})) : fract(vec2(uTime * 0.018, uTime * 0.011));
    vLiquid = 1.0;
  }
  // Only what the rain reaches gets wet: full sky light, not emissive, not a liquid.
  vWet = (flags & 5) != 0 ? 0.0 : uWet * smoothstep(0.8, 0.97, light.x);
  color *= 1.0 - 0.2 * vWet;
  vWorld = world.xyz;
  vec3 toVertex = world.xyz - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  vColor = color;
  vUv = vec2(uv.x, 1.0 - uv.y) + uvShift;
  vLayer = layer;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CHUNK_FRAGMENT = /* glsl */ `
precision mediump float;
${ATLAS_GLSL}
uniform float uOpacity;
// highp: the vertex shader declares these too, and both stages must agree on a shared uniform's precision.
uniform highp float uWet;
uniform highp float uTime;
in vec2 vUv;
flat in float vLayer;
in vec3 vColor;
in vec4 vFog;
in highp vec3 vWorld;
in float vWet;
flat in float vLiquid;
out vec4 fragColor;

// Hash without sine (stable on phone GPUs at large world coordinates) and smooth value noise over it.
highp float hash12(highp vec2 p) {
  highp vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(highp vec2 p) {
  highp vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

// A liquid surface tiles one texture per block; over a big pool the repeat shows. Water and lava blend in the same
// texture turned a quarter (texel-aligned, so pixels stay crisp and seamless) under a slow noise mask. Crude oil,
// whose sheen marks would line up in a grid, is shuffled per block instead: each block turns, mirrors and shifts the
// tile by whole texels (seams vanish in its dark noise), all drifting the same way. Every liquid also varies in
// brightness over several blocks, so a pool has darker and lighter stretches.
vec4 liquidTexel(vec4 tex) {
  highp vec2 wp = vWorld.xz;
  vec4 c;
  if (abs(vLayer - ${OIL_LAYER.toFixed(1)}) < 0.5) {
    highp vec2 cell = floor(wp);
    float h1 = hash12(cell + 17.0);
    float h2 = hash12(cell.yx + 41.0);
    highp vec2 q = wp;
    if (h1 < 0.25) q = vec2(q.y, -q.x);
    else if (h1 < 0.5) q = -q;
    else if (h1 < 0.75) q = vec2(-q.y, q.x);
    if (h2 > 0.5) q.x = -q.x;
    q += floor(vec2(h1, h2) * 16.0) / 16.0 + vec2(uTime * 0.018, uTime * 0.011);
    c = atlasTexelGrad(q, vLayer, dFdx(wp), dFdy(wp));
  } else {
    float mask = smoothstep(0.3, 0.7, valueNoise(wp * 0.13 + 3.7));
    vec4 turned = atlasTexel(vec2(vUv.y, -vUv.x) + vec2(0.3125, 0.6875), vLayer);
    c = mix(tex, turned, mask);
  }
  float shade = valueNoise(wp * 0.07) * 0.6 + valueNoise(wp * 0.23 + 11.0) * 0.4;
  c.rgb *= 0.88 + 0.22 * shade;
  return c;
}

void main() {
  vec4 tex = atlasTexel(vUv, vLayer);
  if (vLiquid > 0.5) tex = liquidTexel(tex);
#ifdef CUTOUT
  if (tex.a < 0.4) discard;
#endif
  vec3 lit = tex.rgb * vColor;
#ifndef TRANSLUCENT
  // A uniform branch, so the derivatives inside are well defined.
  if (uWet > 0.0) {
    highp vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    highp vec3 v = normalize(cameraPosition - vWorld);
    if (dot(n, v) < 0.0) n = -n;
    float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
    // Wet ground mirrors a little of the sky towards the horizon.
    lit = mix(lit, vFog.rgb * 0.85 + 0.04, fresnel * smoothstep(0.6, 0.9, n.y) * vWet * 0.55);
  }
#endif
  vec3 c = mix(lit, vFog.rgb, vFog.a);
#ifdef TRANSLUCENT
  fragColor = vec4(c, mix(tex.a * uOpacity, 1.0, vFog.a));
#else
  fragColor = vec4(c, 1.0);
#endif
}
`;
