/**
 * The machine-part shader: moves each vertex by its assembly's motion (spin about an axis, slide, stretch / follow
 * for a drill string) from the instance's state, places it with the instance matrix, and lights it per vertex like
 * the terrain (the world uniforms: sky light by time of day, firelight, ambient floor, fog) from light probed at the
 * machine, with the terrain's face shading taken from the moved normal. Textured from the block atlas.
 */
import * as THREE from 'three';
import { ATLAS_GLSL, atlasDefines } from '../atlas';
import type { WorldUniforms } from '../materials';
import { COOL_TINT_GLSL } from '../coolLight';
import { LIGHT_GLSL } from '../shaders/chunk';

const VERTEX = /* glsl */ `
precision highp float;
in float aLayer;
in vec3 aTint;
in vec4 aPivot;  // xyz pivot (model frame), w spin ratio or slide stroke
in vec4 aAxis;   // xyz axis (model frame), w motion: 0 static, 1 spin, 2 slide, 3 stretch, 4 follow
in float aPhase; // slide phase
in vec4 aState;  // per instance: x angle (rad), y extent, z sky light, w block light
in float aCool;  // per instance: share of the block light from cool glows, negative = violet (src/render/coolLight.ts)
${LIGHT_GLSL}
${COOL_TINT_GLSL}
out vec2 vUv;
flat out float vLayer;
out vec3 vColor;
out vec4 vFog;

vec3 turn(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  int motion = int(aAxis.w + 0.5);
  vec3 axis = aAxis.xyz;
  if (motion == 2) {
    p += axis * sin(aState.x + aPhase) * aPivot.w;
  } else if (motion != 0) {
    if (motion == 3) p += axis * (dot(p - aPivot.xyz, axis) * (aState.y - 1.0));
    else if (motion == 4) p += axis * (aState.y - 1.0);
    float a = aState.x * aPivot.w;
    p = aPivot.xyz + turn(p - aPivot.xyz, axis, a);
    n = turn(n, axis, a);
  }
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  // The terrain's face shading (top 1, bottom 0.5, north/south 0.8, east/west 0.65), from the world normal.
  float side = mix(0.65, 0.8, abs(wn.z) / (abs(wn.x) + abs(wn.z) + 1e-4));
  float shade = wn.y >= 0.0 ? mix(side, 1.0, wn.y) : mix(side, 0.5, -wn.y);
  vColor = aTint * lightColorTinted(aState.z, aState.w, coolBlockTint(aCool)) * shade;
  vec3 toVertex = world.xyz - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  vUv = vec2(uv.x, 1.0 - uv.y);
  vLayer = aLayer;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
${ATLAS_GLSL}
in vec2 vUv;
flat in float vLayer;
in vec3 vColor;
in vec4 vFog;
out vec4 fragColor;
void main() {
  vec3 c = atlasTexel(vUv, vLayer).rgb * vColor;
  fragColor = vec4(mix(c, vFog.rgb, vFog.a), 1.0);
}
`;

/** One material for every machine's parts; it shares the world uniforms by reference. */
export function createMachineMaterial(world: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'machine-parts',
    glslVersion: THREE.GLSL3,
    defines: atlasDefines({ texture2: world.uAtlas2.value as THREE.DataArrayTexture | null }),
    uniforms: { ...world },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
}
