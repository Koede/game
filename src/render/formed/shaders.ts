/**
 * GLSL of the merged multiblock models: procedural brickwork / plating by material id (so a wall has no seams between
 * the blocks that make it), lit by the world's sky light and the structure's own firelight, the interior glowing with
 * the furnace temperature, and the formation snap (each cell slides in from outside, staggered, ending in a flash).
 * Material ids are MAT in meshBuilder.ts.
 */
import { PARTS_GLSL } from '../parts/track';

export const FORMED_VERTEX = /* glsl */ `
precision highp float;
${PARTS_GLSL}
in vec4 aData;       // rgb colour, w material id
uniform float uSnap; // 0 pieces apart .. 1 settled
uniform vec2 uFog;
out vec3 vLocal;
out vec3 vWorld;
out vec3 vN;
flat out vec4 vData;
out float vFog;
void main() {
  mat4 pm = partMatrix();
  vec3 p = (pm * vec4(position, 1.0)).xyz;
  vec3 nrm = mat3(pm) * normal;
  if (uSnap < 1.0) {
    vec3 cell = floor(position - normal * 0.02);
    float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float k = clamp(uSnap * 1.3 - h * 0.3, 0.0, 1.0);
    k = 1.0 - pow(1.0 - k, 3.0);
    p += nrm * (1.0 - k) * (0.5 + h * 0.9);
  }
  vec4 world = modelMatrix * vec4(p, 1.0);
  vLocal = position;
  vWorld = world.xyz;
  vN = nrm;
  vData = aData;
  vFog = smoothstep(uFog.x, uFog.y, length(world.xyz - cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FORMED_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uHeat;      // 0..1 how hot the structure glows
uniform vec3 uHeatCol;
uniform float uFlash;     // the snap's flash, 0..1
uniform float uActive;    // 0 idle .. 1 running (eased)
uniform vec3 uSkyLight;
uniform vec3 uSunDir;
uniform vec3 uBlockLight;
uniform float uAmbient;
uniform vec3 uFogColor;
in vec3 vLocal;
in vec3 vWorld;
in vec3 vN;
flat in vec4 vData;
in float vFog;
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 n = normalize(vN);
  int mat = int(vData.w + 0.5);
  vec3 col = vData.rgb;
  vec2 st = abs(n.y) > 0.7 ? vLocal.xz : (abs(n.x) > abs(n.z) ? vLocal.zy : vLocal.xy);
  float sun = max(dot(n, normalize(uSunDir)), 0.0);
  float emit = 0.0;
  vec3 emitCol = uHeatCol;
  float glow = 0.0;
  if (mat == 0) {
    // Brickwork: courses a quarter block high, running bond, mortar that glows when the hearth is hot.
    float row = floor(st.y * 4.0);
    float u = st.x * 2.0 + 0.5 * mod(row, 2.0);
    float h = hash21(vec2(floor(u), row));
    float mortar = clamp(step(fract(u), 0.07) + step(fract(st.y * 4.0), 0.12), 0.0, 1.0);
    col *= 0.8 + 0.34 * h;
    col = mix(col, col * 0.42, mortar);
    glow = mortar * 0.22;
  } else if (mat == 1 || mat == 2) {
    // Plating: panel seams every block, rivets at the corners.
    vec2 f = fract(st);
    vec2 e = min(f, 1.0 - f);
    float seam = 1.0 - smoothstep(0.0, 0.03, min(e.x, e.y));
    vec2 q = abs(f - 0.5);
    float rivet = 1.0 - smoothstep(0.03, 0.055, length(q - vec2(0.39)));
    float brush = hash21(floor(st * vec2(24.0, 6.0))) * 0.08;
    col *= 0.95 + brush;
    col = mix(col, col * 0.5, seam);
    col += 0.13 * rivet;
    glow = seam * 0.2;
    if (mat == 2) {
      // Casing: an inlaid line across the middle of each block that pulses with the heat.
      float line = 1.0 - smoothstep(0.0, 0.03, abs(f.y - 0.5));
      float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + (vLocal.x + vLocal.z) * 2.5);
      emit = line * (0.2 + 0.8 * uHeat) * (0.35 + 0.65 * uActive) * pulse * 0.55;
      emitCol = mix(vec3(0.3, 0.75, 0.95), uHeatCol, 0.35);
    }
  } else if (mat == 3) {
    col *= 0.82 + 0.32 * pow(sun, 1.5);
  } else if (mat == 4) {
    col *= 0.88 + 0.2 * hash21(floor(st * 10.0));
  } else if (mat == 5) {
    // Window glass: dark, with the chamber's fire behind it.
    float fl = 0.78 + 0.22 * sin(uTime * 5.3 + st.x * 7.0) * sin(uTime * 3.7 + st.y * 5.0);
    col = col + uHeatCol * uHeat * 0.9 * fl;
    emit = 0.0;
  } else if (mat == 6) {
    col = vec3(0.9, 0.55, 0.25);
    emit = 0.4 + 0.6 * uHeat;
    emitCol = mix(vec3(1.0, 0.7, 0.4), uHeatCol, 0.5);
  } else if (mat == 7) {
    col *= 0.7 + 0.5 * (0.5 + 0.5 * n.y) + 0.2 * pow(sun, 3.0);
  } else if (mat == 8) {
    col = vec3(0.03);
    emit = uHeat * 0.22;
  } else if (mat == 9) {
    // The lining: brick-dark, lit from within by the fire.
    float fl = 0.7 + 0.3 * sin(uTime * 6.1 + vLocal.x * 3.0 + vLocal.z * 2.3) * sin(uTime * 4.3 + vLocal.y * 2.1);
    float low = 1.0 - clamp((vLocal.y - 1.0) * 0.18, 0.0, 0.7);
    col *= 0.45;
    emit = uHeat * 0.95 * fl * low;
  } else if (mat == 10) {
    float pulse = 0.55 + 0.45 * sin(uTime * 3.0 + (vLocal.x + vLocal.z) * 3.0);
    col = vec3(0.1, 0.3, 0.35);
    emit = (0.3 + 0.7 * uHeat) * (0.3 + 0.7 * uActive) * pulse;
    emitCol = vec3(0.35, 0.9, 1.0);
  } else if (mat == 11) {
    // Display face: scanlines, running a bright heat-coloured readout, idle a dim standby glow.
    float scan = 0.75 + 0.25 * sin(vLocal.y * 90.0 + uTime * 6.0 * uActive);
    float bars = step(0.5, fract(vLocal.x * 4.0 + vLocal.z * 4.0 + floor(uTime * 2.0) * 0.37 * uActive));
    col = vec3(0.02);
    emit = (0.25 + 0.75 * uActive) * scan * (0.7 + 0.3 * bars);
    emitCol = mix(vData.rgb, uHeatCol, 0.5 * uActive);
  } else if (mat == 12) {
    // Accent strip: the tier colour, a light chasing along it while running.
    float run = 0.5 + 0.5 * sin(uTime * 4.0 - (vLocal.x + vLocal.z) * 3.0);
    emit = 0.22 + uActive * (0.35 + 0.5 * run);
    emitCol = vData.rgb;
    col = vData.rgb * 0.4;
  }
  vec3 L = uSkyLight * (0.36 + 0.64 * sun) + uBlockLight * uHeat * 0.35 + uAmbient;
  vec3 lit = col * L + uHeatCol * uHeat * glow + emitCol * emit + vec3(1.0, 0.82, 0.55) * uFlash;
  fragColor = vec4(mix(lit, uFogColor, vFog), 1.0);
}
`;
