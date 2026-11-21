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
float blockRamp(float l) { return pow(l, 1.55) * 1.2; }

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
${LIGHT_GLSL}
out vec2 vUv;
flat out float vLayer;
out vec3 vColor;
out vec4 vFog;

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
in vec2 vUv;
flat in float vLayer;
in vec3 vColor;
in vec4 vFog;
out vec4 fragColor;

void main() {
  vec4 tex = texture(uAtlas, vec3(vUv, vLayer));
#ifdef CUTOUT
  if (tex.a < 0.4) discard;
#endif
  vec3 c = mix(tex.rgb * vColor, vFog.rgb, vFog.a);
#ifdef TRANSLUCENT
  fragColor = vec4(c, mix(tex.a * uOpacity, 1.0, vFog.a));
#else
  fragColor = vec4(c, 1.0);
#endif
}
`;
