/**
 * GLSL ES 3.00 for the three chunk batches (opaque, cutout, translucent). All lighting is done per vertex:
 * chunk quads are one block wide, so per-vertex light is as sharp as the light data itself, and a phone GPU
 * only pays for one texture fetch and a fog mix per pixel.
 */

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

vec3 lightColor(float sky, float block) {
  vec3 s = skyRamp(sky) * uSkyLight;
  vec3 b = blockRamp(block) * uBlockLight;
  return max(max(s, b) + 0.22 * min(s, b), vec3(uAmbient));
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

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  int flags = int(light.w * 255.0 + 0.5);
  vec2 uvShift = vec2(0.0);
  vec3 color;
  if ((flags & 1) != 0) {
    color = vec3(1.0);
  } else {
    color = lightColor(light.x, light.y) * light.z;
  }
  if ((flags & 2) != 0) {
    float phase = uTime * 1.7 + world.x * 0.63 + world.z * 0.41;
    world.x += sin(phase) * 0.055;
    world.z += cos(phase * 0.83) * 0.045;
  }
  if ((flags & 4) != 0) {
    color *= 0.93 + 0.07 * sin(uTime * 1.4 + world.x * 0.9 + world.z * 0.7);
    uvShift = vec2(uTime * 0.018, uTime * 0.011);
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
precision mediump sampler2DArray;
uniform sampler2DArray uAtlas;
uniform float uOpacity;
uniform float uWet;
in vec2 vUv;
flat in float vLayer;
in vec3 vColor;
in vec4 vFog;
in highp vec3 vWorld;
in float vWet;
out vec4 fragColor;

void main() {
  vec4 tex = texture(uAtlas, vec3(vUv, vLayer));
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
