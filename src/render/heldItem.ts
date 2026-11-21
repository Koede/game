/**
 * The first-person hand: a small textured cube for block items, an extruded pixel sprite for tools and
 * other items (every opaque texel becomes a little slab, so a pickaxe has thickness), and a blocky forearm
 * when the hand is empty. Drawn in its own scene after the world, with the depth buffer cleared.
 */
import * as THREE from 'three';
import { blockOfItem, itemOrNull, TEXTURE_NAMES } from '../core/registry';
import { Face } from '../core/types';
import { paintTile, TILE_SIZE } from './tiles';

const VERTEX = /* glsl */ `
in float layer;
in float shade;
out vec2 vUv;
flat out float vLayer;
out float vShade;
void main() {
  vUv = uv;
  vLayer = layer;
  vShade = shade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2DArray;
uniform sampler2DArray uAtlas;
uniform vec3 uLight;
uniform vec3 uArm;
uniform vec3 uSleeve;
uniform float uGlow;
in vec2 vUv;
flat in float vLayer;
in float vShade;
out vec4 fragColor;
void main() {
  vec3 base;
  if (vLayer < -1.5) {
    base = uSleeve;
  } else if (vLayer < -0.5) {
    base = uArm;
  } else {
    vec4 t = texture(uAtlas, vec3(vUv, vLayer));
    if (t.a < 0.5) discard;
    base = t.rgb;
  }
  fragColor = vec4(base * mix(uLight * vShade, vec3(1.0), uGlow), 1.0);
}
`;

const FACE_SHADE = [0.72, 0.72, 1.0, 0.5, 0.86, 0.86];

class GeometryBuilder {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly layer: number[] = [];
  readonly shade: number[] = [];
  readonly index: number[] = [];

  /** A quad from corner `o` spanning `u` and `v` (counter-clockwise seen from the front), uv rectangle given. */
  quad(o: number[], u: number[], v: number[], uv: [number, number, number, number], layer: number, shade: number): void {
    const base = this.pos.length / 3;
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (const [a, b] of corners) {
      this.pos.push(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b);
      this.uv.push(uv[0] + (uv[2] - uv[0]) * a, uv[1] + (uv[3] - uv[1]) * b);
      this.layer.push(layer);
      this.shade.push(shade);
    }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('layer', new THREE.Float32BufferAttribute(this.layer, 1));
    g.setAttribute('shade', new THREE.Float32BufferAttribute(this.shade, 1));
    g.setIndex(this.index);
    return g;
  }
}

/** A unit cube centred on the origin with per-face texture layers (indexed by Face); `height` < 1 for slabs. */
export function cubeGeometry(layers: readonly number[], height = 1): THREE.BufferGeometry {
  const b = new GeometryBuilder();
  addCube(b, layers, height);
  return b.build();
}

function addCube(b: GeometryBuilder, layers: readonly number[], height: number): void {
  const h = height;
  const top = h - 0.5;
  const vTop = 1 - h; // sides sample the bottom part of the tile (v grows downwards in the atlas)
  const side: [number, number, number, number] = [0, 1, 1, vTop];
  b.quad([0.5, -0.5, 0.5], [0, 0, -1], [0, h, 0], side, layers[Face.PX], FACE_SHADE[Face.PX]);
  b.quad([-0.5, -0.5, -0.5], [0, 0, 1], [0, h, 0], side, layers[Face.NX], FACE_SHADE[Face.NX]);
  b.quad([-0.5, top, 0.5], [1, 0, 0], [0, 0, -1], [0, 1, 1, 0], layers[Face.PY], FACE_SHADE[Face.PY]);
  b.quad([-0.5, -0.5, -0.5], [1, 0, 0], [0, 0, 1], [0, 1, 1, 0], layers[Face.NY], FACE_SHADE[Face.NY]);
  b.quad([-0.5, -0.5, 0.5], [1, 0, 0], [0, h, 0], side, layers[Face.PZ], FACE_SHADE[Face.PZ]);
  b.quad([0.5, -0.5, -0.5], [-1, 0, 0], [0, h, 0], side, layers[Face.NZ], FACE_SHADE[Face.NZ]);
}

/**
 * Extrudes a 16x16 sprite into a 1-unit-wide, 1/16-thick slab of texels: front and back faces per opaque
 * texel, plus a side wall wherever an opaque texel borders a transparent one. Centred on the origin, in the
 * XY plane, facing +Z.
 */
export function spriteGeometry(layer: number, pixels: Uint8ClampedArray): THREE.BufferGeometry {
  const b = new GeometryBuilder();
  const n = TILE_SIZE;
  const s = 1 / n;
  const depth = s;
  const opaque = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < n && y < n && pixels[(y * n + x) * 4 + 3] >= 128;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!opaque(x, y)) continue;
      const x0 = x * s - 0.5;
      const y0 = 0.5 - (y + 1) * s;
      const uv: [number, number, number, number] = [x * s, (y + 1) * s, (x + 1) * s, y * s];
      // Sides sample the texel's centre so the wall takes its colour.
      const c: [number, number, number, number] = [(x + 0.5) * s, (y + 0.5) * s, (x + 0.5) * s, (y + 0.5) * s];
      b.quad([x0, y0, depth / 2], [s, 0, 0], [0, s, 0], uv, layer, 1);
      b.quad([x0 + s, y0, -depth / 2], [-s, 0, 0], [0, s, 0], [uv[2], uv[1], uv[0], uv[3]], layer, 0.7);
      if (!opaque(x, y - 1)) b.quad([x0, y0 + s, depth / 2], [s, 0, 0], [0, 0, -depth], c, layer, 0.95);
      if (!opaque(x, y + 1)) b.quad([x0, y0, -depth / 2], [s, 0, 0], [0, 0, depth], c, layer, 0.55);
      if (!opaque(x - 1, y)) b.quad([x0, y0, -depth / 2], [0, 0, depth], [0, s, 0], c, layer, 0.75);
      if (!opaque(x + 1, y)) b.quad([x0 + s, y0, depth / 2], [0, 0, -depth], [0, s, 0], c, layer, 0.8);
    }
  }
  return b.build();
}

/** A blocky forearm: a canvas work sleeve (layer -2) and a bare hand (layer -1), untextured. */
function armGeometry(): THREE.BufferGeometry {
  const sleeve = new GeometryBuilder();
  addCube(sleeve, [-2, -2, -2, -2, -2, -2], 1);
  const hand = new GeometryBuilder();
  addCube(hand, [-1, -1, -1, -1, -1, -1], 1);
  const g1 = sleeve.build();
  g1.scale(0.21, 0.21, 0.56);
  g1.translate(0, 0, 0.1);
  const g2 = hand.build();
  g2.scale(0.18, 0.18, 0.2);
  g2.translate(0, 0, -0.28);
  const pos = new Float32Array([...(g1.attributes.position.array as Float32Array), ...(g2.attributes.position.array as Float32Array)]);
  const cat = (name: string): Float32Array =>
    new Float32Array([...(g1.getAttribute(name).array as Float32Array), ...(g2.getAttribute(name).array as Float32Array)]);
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(cat('uv'), 2));
  merged.setAttribute('layer', new THREE.BufferAttribute(cat('layer'), 1));
  merged.setAttribute('shade', new THREE.BufferAttribute(cat('shade'), 1));
  const offset = g1.attributes.position.count;
  const i1 = Array.from(g1.getIndex()?.array ?? []);
  const i2 = Array.from(g2.getIndex()?.array ?? [], (i) => i + offset);
  merged.setIndex([...i1, ...i2]);
  g1.dispose();
  g2.dispose();
  return merged;
}

const SWING_S = 0.3;
const DIP_S = 0.32;

export class HeldItem {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  private readonly pivot = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly arm: THREE.BufferGeometry;
  private shown: string | null = null;
  private wanted: string | null = null;
  private swingT = 1;
  private dipT = 1;
  private time = 0;
  private glow = 0;
  private baseX = 0.5;

  constructor(atlas: THREE.Texture) {
    this.material = new THREE.ShaderMaterial({
      name: 'held-item',
      glslVersion: THREE.GLSL3,
      uniforms: {
        uAtlas: { value: atlas },
        uLight: { value: new THREE.Vector3(1, 1, 1) },
        uArm: { value: new THREE.Vector3(0.74, 0.55, 0.43) },
        uSleeve: { value: new THREE.Vector3(0.36, 0.3, 0.22) },
        uGlow: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.DoubleSide,
    });
    this.arm = armGeometry();
    this.mesh = new THREE.Mesh(this.arm, this.material);
    this.mesh.frustumCulled = false;
    this.pivot.add(this.mesh);
    this.scene.add(this.pivot);
    this.applyPose(null);
  }

  /** Item to show; the hand dips out of view and comes back with it. */
  set(itemKey: string | null): void {
    if (itemKey === this.wanted) return;
    this.wanted = itemKey;
    this.dipT = 0;
  }

  swing(): void {
    if (this.swingT > 0.45) this.swingT = 0;
  }

  /** Light colour at the player's eye (multiplier per channel). */
  setLight(r: number, g: number, b: number): void {
    (this.material.uniforms.uLight.value as THREE.Vector3).set(r, g, b);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // Keep the hand inside the right edge of narrow (portrait phone) screens.
    const halfWidth = 0.78 * Math.tan((this.camera.fov * Math.PI) / 360) * aspect;
    this.baseX = Math.min(0.5, halfWidth * 0.78);
  }

  update(dt: number): void {
    this.time += dt;
    this.swingT = Math.min(1, this.swingT + dt / SWING_S);
    if (this.dipT < 1) {
      const before = this.dipT;
      this.dipT = Math.min(1, this.dipT + dt / DIP_S);
      if (before < 0.5 && this.dipT >= 0.5) this.show(this.wanted);
    }
    // Pose: idle breathing, the dip (down and back up), the swing (a short downward arc towards the centre).
    const dip = Math.sin(this.dipT * Math.PI) * 0.55;
    const s = this.swingT < 1 ? Math.sin(this.swingT * Math.PI) : 0;
    const s2 = this.swingT < 1 ? Math.sin(Math.sqrt(this.swingT) * Math.PI) : 0;
    const p = this.pivot;
    p.position.set(this.baseX - s2 * 0.22, -0.46 - dip + Math.sin(this.time * 1.6) * 0.008 - s * 0.12, -0.78 - s2 * 0.12);
    p.rotation.set(-s * 0.9, s2 * 0.5, s * 0.25);
    this.material.uniforms.uGlow.value = this.glow;
  }

  dispose(): void {
    for (const g of this.geometries.values()) g.dispose();
    this.arm.dispose();
    this.material.dispose();
  }

  private show(itemKey: string | null): void {
    this.shown = itemKey;
    this.mesh.geometry = itemKey ? this.geometryFor(itemKey) ?? this.arm : this.arm;
    this.applyPose(this.mesh.geometry === this.arm ? null : itemKey);
  }

  private geometryFor(itemKey: string): THREE.BufferGeometry | null {
    let g = this.geometries.get(itemKey);
    if (g) return g;
    const def = itemOrNull(itemKey);
    if (!def) return null;
    const placed = blockOfItem(itemKey);
    if (def.iconLayer < 0 && placed) {
      g = cubeGeometry(placed.layers, placed.shape === 'slab' ? 0.5 : 1);
    } else {
      const layer = def.iconLayer >= 0 ? def.iconLayer : 0;
      g = spriteGeometry(layer, paintTile(TEXTURE_NAMES[layer]));
    }
    this.geometries.set(itemKey, g);
    return g;
  }

  /** Each kind of thing is held differently: a cube in front of the palm, tools tilted forward, the bare arm. */
  private applyPose(itemKey: string | null): void {
    const m = this.mesh;
    this.glow = 0;
    if (!itemKey) {
      m.position.set(0.08, -0.12, 0.12);
      m.rotation.set(0.55, -0.22, 0.12);
      m.scale.setScalar(1);
      return;
    }
    const def = itemOrNull(itemKey);
    const placed = blockOfItem(itemKey);
    if (def && def.iconLayer < 0 && placed) {
      m.position.set(0.02, 0.06, -0.04);
      m.rotation.set(0.1, 0.78, 0);
      m.scale.setScalar(0.3);
      this.glow = placed.light >= 13 ? 0.6 : 0;
      return;
    }
    const tool = !!def?.tool;
    m.position.set(0.02, tool ? 0.12 : 0.08, -0.02);
    m.rotation.set(tool ? 0.1 : 0, tool ? -1.3 : -0.35, tool ? 0.4 : 0.05);
    m.scale.setScalar(tool ? 0.54 : 0.4);
    this.glow = placed && placed.light >= 13 ? 0.5 : 0;
  }

  /** What is currently in the hand (after the dip finished). */
  get current(): string | null {
    return this.shown;
  }
}
