/**
 * The ghost preview (spec 17.4, 'ghost:show' / 'ghost:clear'): translucent blue cubes where a block is missing, with a
 * faint image of the block that belongs there, and red-tinted cubes hugging a block that is wrong. Depth-tested like
 * the world, but a ghost hidden only by leaves still shows faintly (a second pass without the depth test draws just
 * those, found by walking the voxels towards each ghost a few ghosts per frame). Lit by itself so it reads at night.
 * Two draw calls while a preview is up, none otherwise.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import type { GameEvents } from '../../core/gameEvents';
import { blockOrNull } from '../../core/registry';
import { Face, type IWorld } from '../../core/types';
import { ATLAS_GLSL, atlasDefines } from '../atlas';
import type { WorldUniforms } from '../materials';
import { flush } from './boxBatch';
import { LEAVES_ONLY, sightTo } from './sightline';

/** Ghost cells drawn at most (a Starhearth's largest shell is 218 cells plus 125 inside). */
export const GHOST_CAP = 512;
/** Sight lines re-checked per frame (round-robin), and only while the camera is within this range of the ghosts. */
const SIGHT_CHECKS = 24;

type GhostCell = GameEvents['ghost:show']['cells'][number];

const VERTEX = /* glsl */ `
precision highp float;
in float aFace;
in vec4 aCell;   // xyz, w state: 0 missing, 1 wrong
in vec4 aTex;    // side layer, top layer (-1 none), w seen only through leaves
uniform float uPass; // 0 depth-tested, 1 through leaves
uniform vec2 uFog;
out vec2 vUv;
flat out float vLayer;
flat out float vState;
flat out float vShade;
out float vFog;

void main() {
  if (uPass > 0.5 && aTex.z < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vUv = vec2(0.0); vLayer = -1.0; vState = 0.0; vShade = 0.0; vFog = 0.0;
    return;
  }
  // Missing blocks are a little smaller than a block; a red ghost wraps the wrong block just outside it.
  float grow = aCell.w > 0.5 ? 0.03 : -0.06;
  vec3 world = aCell.xyz + 0.5 + (position - 0.5) * (1.0 + 2.0 * grow);
  int f = int(aFace + 0.5);
  vLayer = f == 2 || f == 3 ? aTex.y : aTex.x;
  vState = aCell.w;
  vShade = f == 2 ? 1.0 : f == 3 ? 0.6 : f < 2 ? 0.75 : 0.88;
  vUv = uv;
  vFog = smoothstep(uFog.x, uFog.y, length(world - cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
${ATLAS_GLSL}
uniform highp float uTime;
uniform float uPass;
in vec2 vUv;
flat in float vLayer;
flat in float vState;
flat in float vShade;
in float vFog;
out vec4 fragColor;

void main() {
  vec2 e2 = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.02, 0.09, min(e2.x, e2.y));
  float breathe = 0.5 + 0.5 * sin(uTime * 2.6);
  vec3 c;
  float a;
  if (vState < 0.5) {
    c = vec3(0.36, 0.68, 1.0);
    if (vLayer >= 0.0) {
      // A faint image of the block that belongs here.
      vec3 t = atlasTexel(vUv, vLayer).rgb;
      c = mix(c, c * (0.45 + 1.1 * dot(t, vec3(0.3, 0.55, 0.15))) + t * 0.18, 0.55);
    }
    a = 0.2 + 0.06 * breathe + 0.55 * edge;
  } else {
    c = vec3(1.0, 0.24, 0.18);
    float hatch = step(0.62, fract((vUv.x + vUv.y) * 4.0));
    a = 0.22 + 0.1 * hatch + 0.12 * breathe + 0.55 * edge;
  }
  c = mix(c * vShade, vec3(1.0), edge * 0.35);
  if (uPass > 0.5) a *= 0.45;
  fragColor = vec4(c, a * (1.0 - vFog * 0.85));
}
`;

function ghostGeometry(): THREE.InstancedBufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const face: number[] = [];
  const index: number[] = [];
  // Origin, u, v per face (u x v = the outward normal); uv runs along u and v (v up on the sides).
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 1], [0, 0, -1], [0, 1, 0]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 1], [1, 0, 0], [0, 0, -1]],
    [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0]],
  ];
  faces.forEach(([o, u, v], f) => {
    const base = pos.length / 3;
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b);
      uv.push(a, 1 - b);
      face.push(f);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 1));
  g.setIndex(index);
  return g;
}

export class GhostLayer {
  readonly group = new THREE.Group();
  private readonly geometry = ghostGeometry();
  private readonly solid: THREE.ShaderMaterial;
  private readonly xray: THREE.ShaderMaterial;
  private readonly aCell: THREE.InstancedBufferAttribute;
  private readonly aTex: THREE.InstancedBufferAttribute;
  private readonly sets = new Map<string, GhostCell[]>();
  private readonly offs: (() => void)[];
  private count = 0;
  private cursor = 0;
  private dirty = false;
  private texDirty = false;

  constructor(private readonly world: IWorld, bus: GameBus, uniforms: WorldUniforms) {
    this.aCell = new THREE.InstancedBufferAttribute(new Float32Array(GHOST_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aTex = new THREE.InstancedBufferAttribute(new Float32Array(GHOST_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aCell', this.aCell);
    this.geometry.setAttribute('aTex', this.aTex);
    this.geometry.instanceCount = 0;
    const make = (pass: number): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        name: pass ? 'ghosts-through-leaves' : 'ghosts',
        glslVersion: THREE.GLSL3,
        defines: atlasDefines({ texture2: uniforms.uAtlas2.value as THREE.DataArrayTexture | null }),
        uniforms: { uAtlas: uniforms.uAtlas, uAtlas2: uniforms.uAtlas2, uAtlasSplit: uniforms.uAtlasSplit, uTime: uniforms.uTime, uFog: uniforms.uFog, uPass: { value: pass } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: pass === 0,
      });
    this.solid = make(0);
    this.xray = make(1);
    const solid = new THREE.Mesh(this.geometry, this.solid);
    const xray = new THREE.Mesh(this.geometry, this.xray);
    for (const m of [solid, xray]) {
      m.frustumCulled = false;
      m.renderOrder = 5;
    }
    solid.name = 'ghosts';
    xray.name = 'ghosts-through-leaves';
    this.group.add(solid, xray);
    this.group.visible = false;
    this.group.name = 'ghost-preview';
    this.offs = [
      bus.on('ghost:show', ({ key, cells }) => {
        this.sets.set(key, cells.slice());
        this.dirty = true;
      }),
      bus.on('ghost:clear', ({ key }) => {
        if (key === undefined) this.sets.clear();
        else this.sets.delete(key);
        this.dirty = true;
      }),
    ];
  }

  /** Ghost cells shown. */
  get shown(): number {
    return this.count;
  }

  update(camX: number, camY: number, camZ: number): void {
    if (this.dirty) this.rebuild();
    if (this.count === 0) return;
    // Re-check a few sight lines per frame: which ghosts only leaves stand in front of.
    const cell = this.aCell.array as Float32Array;
    const tex = this.aTex.array as Float32Array;
    for (let i = 0; i < SIGHT_CHECKS && i < this.count; i++) {
      this.cursor = (this.cursor + 1) % this.count;
      const o = this.cursor * 4;
      const through = sightTo(this.world, camX, camY, camZ, cell[o], cell[o + 1], cell[o + 2]) === LEAVES_ONLY ? 1 : 0;
      if (tex[o + 2] !== through) {
        tex[o + 2] = through;
        this.texDirty = true;
      }
    }
    if (this.texDirty) {
      this.texDirty = false;
      flush(this.aTex, this.count);
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.geometry.dispose();
    this.solid.dispose();
    this.xray.dispose();
  }

  private rebuild(): void {
    this.dirty = false;
    const cell = this.aCell.array as Float32Array;
    const tex = this.aTex.array as Float32Array;
    let n = 0;
    for (const cells of this.sets.values()) {
      for (const c of cells) {
        if (n >= GHOST_CAP) break;
        if (c.state !== 'missing' && c.state !== 'wrong') continue;
        const def = c.block === 'air' ? null : blockOrNull(c.block);
        const o = n * 4;
        cell[o] = c.x;
        cell[o + 1] = c.y;
        cell[o + 2] = c.z;
        cell[o + 3] = c.state === 'wrong' ? 1 : 0;
        tex[o] = def ? def.layers[Face.PZ] : -1;
        tex[o + 1] = def ? def.layers[Face.PY] : -1;
        tex[o + 2] = 0;
        tex[o + 3] = 0;
        n++;
      }
    }
    this.count = n;
    this.cursor = 0;
    this.geometry.instanceCount = n;
    this.group.visible = n > 0;
    if (n === 0) return;
    flush(this.aCell, n);
    flush(this.aTex, n);
  }
}
