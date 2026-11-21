/**
 * Items moving through item pipes (spec 16.4): one tiny textured cube (block items) or camera-facing icon (every
 * other item) per packet, slid along its path between simulation ticks (`along + speed * time since the tick`).
 * One instanced draw call, at most PACKET_CAP drawn (nearest first is not needed: a busy base rarely has more in
 * view), culled by distance and frustum. Lit like the terrain from the light of the pipe cell it is in.
 * Allocation-free per frame once every path has been seen.
 */
import * as THREE from 'three';
import { blockOfItem, itemOrNull } from '../../core/registry';
import { Face } from '../../core/types';
import { ATLAS_GLSL, atlasDefines } from '../atlas';
import type { WorldUniforms } from '../materials';
import { LIGHT_GLSL } from '../shaders/chunk';
import { blockOf as blockLight, skyOf, type CellLight } from './cellLight';
import type { TransportFeed } from './feed';
import { cumulativeLengths, packetDistance, pointAlong } from './path';

/** Packets drawn at most (the brief's global cap). */
export const PACKET_CAP = 150;
/** Packets farther than this from the camera are not drawn (they are specks inside pipes beyond it). */
export const PACKET_RANGE = 64;
/** Edge of a block item's cube and of an item icon, in blocks (the pipe's inside is 0.5 across). */
export const PACKET_CUBE = 0.22;
export const PACKET_ICON = 0.34;

const VERTEX = /* glsl */ `
precision highp float;
in float aFace;
in vec4 aPos;   // xyz centre, w spin (cubes)
in vec4 aTex;   // side, top, bottom layer; w 0 cube / 1 icon
in vec2 aLight; // sky, block 0..1
${LIGHT_GLSL}
out vec2 vUv;
flat out float vLayer;
out vec3 vColor;
out vec4 vFog;

void main() {
  bool icon = aFace > 5.5;
  if (icon != (aTex.w > 0.5)) {
    // The other half of the shared geometry: collapse it (no area, nothing rasterised).
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vUv = vec2(0.0); vLayer = 0.0; vColor = vec3(0.0); vFog = vec4(0.0);
    return;
  }
  vec3 world;
  float shade;
  if (icon) {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    world = aPos.xyz + (right * position.x + up * position.y) * ${PACKET_ICON.toFixed(3)};
    vLayer = aTex.x;
    shade = 0.95;
  } else {
    float c = cos(aPos.w);
    float s = sin(aPos.w);
    vec3 p = position * ${PACKET_CUBE.toFixed(3)};
    world = aPos.xyz + vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    int f = int(aFace + 0.5);
    vLayer = f == 2 ? aTex.y : f == 3 ? aTex.z : aTex.x;
    shade = f == 2 ? 1.0 : f == 3 ? 0.5 : f < 2 ? 0.7 : 0.85;
  }
  vColor = lightColor(aLight.x, aLight.y) * shade;
  vec3 toVertex = world - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
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
  vec4 t = atlasTexel(vUv, vLayer);
  if (t.a < 0.5) discard;
  fragColor = vec4(mix(t.rgb * vColor, vFog.rgb, vFog.a), 1.0);
}
`;

/** A unit cube (faces in Face order, aFace 0..5) and a unit quad (aFace 6), centred on the origin. */
function packetGeometry(): THREE.InstancedBufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const face: number[] = [];
  const index: number[] = [];
  // Per face: normal axis, sign, and the u / v axes (as in the mesher: u to the right, v up as seen from outside).
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const quad = (f: number, o: number[], u: number[], v: number[]): void => {
    const base = pos.length / 3;
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b);
      uv.push(a, b);
      face.push(f);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  faces.forEach(([n, u, v], f) => {
    const o = [0, 1, 2].map((i) => n[i] * 0.5 - u[i] * 0.5 - v[i] * 0.5);
    quad(f, o, u, v);
  });
  quad(6, [-0.5, -0.5, 0], [1, 0, 0], [0, 1, 0]);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 1));
  g.setIndex(index);
  return g;
}

interface ItemLook {
  side: number;
  top: number;
  bottom: number;
  icon: boolean;
}

/** How an item is drawn in a pipe: block items with a cube-like shape as a cube, everything else as its icon. */
export function itemLook(key: string): ItemLook {
  const item = itemOrNull(key);
  if (item && item.iconLayer >= 0) return { side: item.iconLayer, top: item.iconLayer, bottom: item.iconLayer, icon: true };
  const block = item ? blockOfItem(key) : null;
  if (!block) return { side: 0, top: 0, bottom: 0, icon: true };
  const cube = block.shape === 'cube' || block.shape === 'slab' || block.shape === 'liquid';
  return { side: block.layers[Face.PZ], top: block.layers[Face.PY], bottom: block.layers[Face.NY], icon: !cube };
}

const attr = (n: number, size: number): THREE.InstancedBufferAttribute =>
  new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);

function flush(a: THREE.InstancedBufferAttribute, count: number): void {
  a.clearUpdateRanges();
  a.addUpdateRange(0, count * a.itemSize);
  a.needsUpdate = true;
}

export class PacketLayer {
  readonly mesh: THREE.Mesh;
  /** Packets drawn last frame. */
  drawn = 0;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly aPos: THREE.InstancedBufferAttribute;
  private readonly aTex: THREE.InstancedBufferAttribute;
  private readonly aLight: THREE.InstancedBufferAttribute;
  private readonly looks = new Map<string, ItemLook>();
  private readonly lengths = new WeakMap<Float32Array, Float32Array>();
  private readonly p = new Float32Array(3);
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 0.3);
  private tick = -1;
  private since = 0;
  private time = 0;

  constructor(uniforms: WorldUniforms, private readonly light: CellLight) {
    this.geometry = packetGeometry();
    this.aPos = attr(PACKET_CAP, 4);
    this.aTex = attr(PACKET_CAP, 4);
    this.aLight = attr(PACKET_CAP, 2);
    this.geometry.setAttribute('aPos', this.aPos);
    this.geometry.setAttribute('aTex', this.aTex);
    this.geometry.setAttribute('aLight', this.aLight);
    this.geometry.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      name: 'pipe-packets',
      glslVersion: THREE.GLSL3,
      defines: atlasDefines({ texture2: uniforms.uAtlas2.value as THREE.DataArrayTexture | null }),
      uniforms: { ...uniforms },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'pipe-packets';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /**
   * Places this frame's packets. `fallbackSky` / `fallbackBlock` light a packet whose cell is not probed yet.
   */
  update(dt: number, feed: TransportFeed | null, camera: THREE.Camera, frustum: THREE.Frustum, fallbackSky: number, fallbackBlock: number): void {
    this.time += dt;
    let n = 0;
    if (feed) {
      if (feed.tick !== this.tick) {
        this.tick = feed.tick;
        this.since = 0;
      } else this.since += dt;
      const cam = camera.position;
      const pos = this.aPos.array as Float32Array;
      const tex = this.aTex.array as Float32Array;
      const lit = this.aLight.array as Float32Array;
      const packets = feed.packets;
      const range2 = PACKET_RANGE * PACKET_RANGE;
      for (let i = 0; i < packets.length && n < PACKET_CAP; i++) {
        const pk = packets[i];
        let cum = this.lengths.get(pk.points);
        if (!cum) {
          cum = cumulativeLengths(pk.points);
          this.lengths.set(pk.points, cum);
        }
        const total = cum[cum.length - 1];
        pointAlong(pk.points, cum, packetDistance(pk.along, pk.speed, this.since, pk.length, total), this.p);
        const x = this.p[0];
        const y = this.p[1];
        const z = this.p[2];
        const dx = x - cam.x;
        const dy = y - cam.y;
        const dz = z - cam.z;
        if (dx * dx + dy * dy + dz * dz > range2) continue;
        this.sphere.center.set(x, y, z);
        if (!frustum.intersectsSphere(this.sphere)) continue;
        let look = this.looks.get(pk.item);
        if (!look) {
          look = itemLook(pk.item);
          this.looks.set(pk.item, look);
        }
        const o = n * 4;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        // Each packet tumbles slowly at its own phase (from where its path starts).
        pos[o + 3] = this.time * 1.3 + pk.points[0] * 1.7 + pk.points[2] * 2.3;
        tex[o] = look.side;
        tex[o + 1] = look.top;
        tex[o + 2] = look.bottom;
        tex[o + 3] = look.icon ? 1 : 0;
        const l = this.light.get(Math.floor(x), Math.floor(y), Math.floor(z));
        lit[n * 2] = l < 0 ? fallbackSky : skyOf(l);
        lit[n * 2 + 1] = l < 0 ? fallbackBlock : blockLight(l);
        n++;
      }
    }
    this.drawn = n;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    flush(this.aPos, n);
    flush(this.aTex, n);
    flush(this.aLight, n);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
