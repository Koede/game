/**
 * GLSL of a formed hearth's light (spec 17.4): the molten pool on the interior floor, the glowing haze that fills the
 * chamber (seen through an open top or a window), the heat shimmer over an open top and the light sweep across the
 * shell when it forms. Every one is an instanced draw of a unit box or quad; per-instance data is in aBox / aData.
 */

const NOISE = /* glsl */ `
highp float hash12(highp vec2 p) {
  highp vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(highp vec2 p) {
  highp vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/** Shared vertex stage of the boxes and the pool: the unit geometry stretched over aBox (min xyz, max xyz). */
export const BOX_VERTEX = /* glsl */ `
precision highp float;
in vec3 aMin;
in vec3 aMax;
in vec4 aData;   // rgb heat colour, w strength
uniform vec2 uFog;
out vec3 vWorld;
out vec3 vRel;   // 0..1 across the box
flat out vec4 vData;
flat out vec3 vMin;
flat out vec3 vMax;
out float vFog;
void main() {
  vec3 world = mix(aMin, aMax, position);
  vWorld = world;
  vRel = position;
  vData = aData;
  vMin = aMin;
  vMax = aMax;
  vFog = smoothstep(uFog.x, uFog.y, length(world - cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

/** The molten pool: crusted and cracked while merely hot, a bright churning melt as it climbs the ramp. */
export const POOL_FRAGMENT = /* glsl */ `
precision mediump float;
uniform highp float uTime;
uniform vec3 uFogColor;
in highp vec3 vWorld;
in vec3 vRel;
flat in vec4 vData;
in float vFog;
out vec4 fragColor;
${NOISE}
void main() {
  highp vec2 p = vWorld.xz * 2.2;
  float t = uTime;
  float churn = noise(p + vec2(t * 0.21, -t * 0.17)) * 0.6 + noise(p * 2.3 - vec2(t * 0.33, t * 0.27)) * 0.4;
  // Crust: dark plates with glowing seams, melting away as the pool heats (aData.w carries 0..1 heat).
  float crust = (1.0 - vData.w) * smoothstep(0.42, 0.6, noise(p * 0.9 + 7.0 + t * 0.03));
  float seam = 1.0 - smoothstep(0.0, 0.08, abs(noise(p * 1.7 + 3.0) - 0.5));
  float flicker = 0.9 + 0.1 * sin(t * 6.3 + vWorld.x * 3.1) * sin(t * 4.1 + vWorld.z * 2.7);
  vec3 melt = vData.rgb * (1.05 + 0.55 * churn) * flicker;
  vec3 c = mix(melt, vData.rgb * (0.18 + 0.9 * seam), crust);
  // Edges darken where the melt meets the walls.
  vec2 e = min(vRel.xz, 1.0 - vRel.xz);
  c *= 0.7 + 0.3 * smoothstep(0.0, 0.12, min(e.x, e.y));
  fragColor = vec4(mix(c, uFogColor, vFog), 1.0);
}
`;

/** The chamber's glow on its inner walls (back faces of the interior box, additive), brightest at the melt. */
export const HAZE_FRAGMENT = /* glsl */ `
precision mediump float;
uniform highp float uTime;
in highp vec3 vWorld;
in vec3 vRel;
flat in vec4 vData;
flat in vec3 vMin;
flat in vec3 vMax;
in float vFog;
out vec4 fragColor;
void main() {
  float h = max(vMax.y - vMin.y, 0.5);
  float up = (vWorld.y - vMin.y) / h;
  float g = 0.35 + 0.65 * exp(-2.4 * up);
  float flicker = 0.88 + 0.12 * sin(uTime * 7.1 + vWorld.x * 1.3) * sin(uTime * 5.3 + vWorld.z * 1.9);
  fragColor = vec4(vData.rgb * vData.w * g * flicker * (1.0 - vFog), 1.0);
}
`;

/** Heat shimmer over an open top: faint wavering streaks of warm air on a quad that turns to face the camera. */
export const SHIMMER_VERTEX = /* glsl */ `
precision highp float;
in vec3 aMin;    // base centre of the column
in vec3 aMax;    // x width, y height, z phase
in vec4 aData;
uniform vec2 uFog;
out vec2 vUv;
flat out vec4 vData;
flat out float vPhase;
out float vFog;
void main() {
  vec3 toCam = cameraPosition - aMin;
  vec2 d = normalize(toCam.xz + vec2(1e-4, 0.0));
  vec3 right = vec3(-d.y, 0.0, d.x);
  vec3 world = aMin + right * (position.x - 0.5) * aMax.x + vec3(0.0, position.y * aMax.y, 0.0);
  vUv = position.xy;
  vData = aData;
  vPhase = aMax.z;
  vFog = smoothstep(uFog.x, uFog.y, length(world - cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const SHIMMER_FRAGMENT = /* glsl */ `
precision mediump float;
uniform highp float uTime;
in vec2 vUv;
flat in vec4 vData;
flat in float vPhase;
in float vFog;
out vec4 fragColor;
void main() {
  float t = uTime + vPhase;
  float wave = sin(vUv.y * 9.0 - t * 3.4) * 0.6 + sin(vUv.y * 4.0 - t * 1.9 + vUv.x * 3.0) * 0.4;
  float streak = sin(vUv.x * 21.0 + wave * 2.2 + t * 0.7);
  float s = smoothstep(0.55, 1.0, streak) + 0.35 * smoothstep(0.8, 1.0, -streak);
  float fade = sin(3.1416 * vUv.x) * pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.08, vUv.y);
  fragColor = vec4(vData.rgb * vData.w * s * fade * (1.0 - vFog), 1.0);
}
`;

/** The formation sweep: a bright band climbing the shell (outside faces, additive), and a short flash behind it. */
export const SWEEP_FRAGMENT = /* glsl */ `
precision mediump float;
in highp vec3 vWorld;
in vec3 vRel;
flat in vec4 vData;   // rgb colour, w progress 0..1
flat in vec3 vMin;
flat in vec3 vMax;
in float vFog;
out vec4 fragColor;
void main() {
  float k = vData.w;
  float centre = mix(vMin.y - 0.6, vMax.y + 0.6, k);
  float d = (vWorld.y - centre) / 0.45;
  float band = exp(-d * d);
  // Faint seams where the blocks meet catch the light as the band passes.
  vec3 normalAxis = step(vec3(0.999), max(vRel, 1.0 - vRel));
  vec3 f = abs(fract(vWorld) - 0.5) * (1.0 - normalAxis);
  float seam = smoothstep(0.43, 0.5, max(f.x, max(f.y, f.z)));
  float trail = smoothstep(centre, vMin.y - 0.6, vWorld.y) * (1.0 - k) * 0.25;
  float glow = band * (0.75 + 0.5 * seam) + trail;
  fragColor = vec4(vData.rgb * glow * (1.0 - k * k) * (1.0 - vFog), 1.0);
}
`;
