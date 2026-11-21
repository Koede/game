/**
 * What pipes carry, drawn over the pipes the chunk mesher made (spec 16.1, 16.5): the fluid in a fluid pipe's sight
 * glasses - tinted with the fluid's colour, filled to the network's amount / capacity (a moving stream when it flows
 * straight through), streaks scrolling slowly while it moves, lava full-bright and flickering - and the "carrying"
 * active bit as a subtle tint of the whole pipe (warmer glass on an item pipe with packets in it).
 *
 * The overlay repeats the mesher's pipe geometry (core, arms to joined neighbours, collars at endpoints) for every
 * carrying pipe near the camera, as instanced boxes with the mesher's texture mapping, and a 16x16 mask of the pipe
 * tiles' window texels (pipeWindow) decides where the inside shows. One draw call; instances are rewritten once per
 * simulation tick, never per frame.
 */
import * as THREE from 'three';
import { PIPE_CORE_MAX, PIPE_CORE_MIN } from '../../core/constants';
import type { GameBus } from '../../core/context';
import { blockOf as blockDefOf } from '../../core/registry';
import { VOXEL_ID_MASK, type IWorld } from '../../core/types';
import { PIPE_COLLAR_DEPTH, PIPE_COLLAR_MAX, PIPE_COLLAR_MIN } from '../../world/meshPipe';
import { PIPE_ENDPOINT, PIPE_FAMILY, PIPE_JOINS } from '../../world/blockTables';
import type { WorldUniforms } from '../materials';
import { LIGHT_GLSL } from '../shaders/chunk';
import { pipeWindowTexel } from '../tiles';
import { blockOf as blockLight, skyOf, type CellLight } from './cellLight';
import type { PipeNetFeed, TransportFeed } from './feed';

/** Pieces (core, arm or collar boxes) drawn at most, and how far from the camera carrying pipes are drawn. */
export const OVERLAY_CAP = 4096;
export const OVERLAY_RANGE = 48;

/** Tile index per pipe block key: which mask channel holds its windows. */
const TILE_OF: Record<string, number> = { item_pipe: 0, fast_item_pipe: 1, fluid_pipe: 2, hot_fluid_pipe: 3 };
const PIPE_TILES = ['pipe_item', 'pipe_item_fast', 'pipe_fluid', 'pipe_fluid_hot'];
/** Mask channel of each tile index (RGBA): fluid pipes R, hot pipes G, item pipes B, conveyors A. */
const CHANNEL = [2, 3, 0, 1];

/** 16x16 RGBA mask: 255 in a tile's channel where its texel is a window. Row 0 is the tile's top row (as the atlas). */
export function buildPipeMask(): Uint8Array {
  const out = new Uint8Array(16 * 16 * 4);
  PIPE_TILES.forEach((tile, t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pipeWindowTexel(tile, x, y)) out[(y * 16 + x) * 4 + CHANNEL[t]] = 255;
  });
  return out;
}

/**
 * The boxes of the pipe at (x, y, z) exactly as the mesher builds it, appended to `out` as 11 numbers each:
 * min xyz, max xyz, skip mask (faces not drawn), tile, code (arm axis 0..2 or 3 for the core, +4 for a collar), and
 * the cell's x, z (to key the light). `vox(dx, dy, dz)` reads the neighbour voxels. Returns the number of boxes.
 */
export function pipePieces(id: number, x: number, y: number, z: number, tile: number, vox: (x: number, y: number, z: number) => number, out: number[]): number {
  const family = PIPE_FAMILY[id];
  const lo = PIPE_CORE_MIN;
  const hi = PIPE_CORE_MAX;
  let arms = 0;
  let collars = 0;
  for (let f = 0; f < 6; f++) {
    const a = f >> 1;
    const s = (f & 1) === 0 ? 1 : -1;
    const n = vox(x + (a === 0 ? s : 0), y + (a === 1 ? s : 0), z + (a === 2 ? s : 0)) & VOXEL_ID_MASK;
    if ((PIPE_JOINS[n] & family) === 0) continue;
    arms |= 1 << f;
    if (PIPE_ENDPOINT[n] === 1) collars |= 1 << f;
  }
  out.push(x + lo, y + lo, z + lo, x + hi, y + hi, z + hi, arms, tile, 3, x, z);
  let count = 1;
  for (let f = 0; f < 6; f++) {
    if (((arms >> f) & 1) === 0) continue;
    const axis = f >> 1;
    const positive = (f & 1) === 0;
    const collar = ((collars >> f) & 1) === 1;
    const reach = collar ? 1 - PIPE_COLLAR_DEPTH : 1;
    const min = [lo, lo, lo];
    const max = [hi, hi, hi];
    if (positive) {
      min[axis] = hi;
      max[axis] = reach;
    } else {
      min[axis] = 1 - reach;
      max[axis] = lo;
    }
    out.push(x + min[0], y + min[1], z + min[2], x + max[0], y + max[1], z + max[2], 3 << (axis * 2), tile, axis, x, z);
    count++;
    if (!collar) continue;
    const cmin = [PIPE_COLLAR_MIN, PIPE_COLLAR_MIN, PIPE_COLLAR_MIN];
    const cmax = [PIPE_COLLAR_MAX, PIPE_COLLAR_MAX, PIPE_COLLAR_MAX];
    if (positive) {
      cmin[axis] = reach;
      cmax[axis] = 1;
    } else {
      cmin[axis] = 0;
      cmax[axis] = 1 - reach;
    }
    // Its face against the endpoint is hidden (opaque endpoints) or inside it; skip it like the mesher may.
    out.push(x + cmin[0], y + cmin[1], z + cmin[2], x + cmax[0], y + cmax[1], z + cmax[2], 1 << f, tile, axis + 4, x, z);
    count++;
  }
  return count;
}

/** Shown level of a fluid network: its fill, but a network streaming fluid straight through shows a running stream. */
export const shownLevel = (net: Pick<PipeNetFeed, 'fill' | 'flowing'>): number => (net.flowing ? Math.max(net.fill, 0.45) : net.fill);

const VERTEX = /* glsl */ `
precision highp float;
in float aFace;
in vec3 aMin;
in vec3 aMax;
in vec4 aPiece;  // skip mask, tile, code (axis / 3 core, +4 collar), flags (1 glow, 2 flowing, 4 item)
in vec4 aFluid;  // rgb, shown level
in vec2 aLight;
${LIGHT_GLSL}
out vec2 vUv;
out vec3 vLocal;
out vec3 vWorld;
flat out vec4 vPiece;
flat out float vFace;
out vec4 vFluid;
out vec3 vLight;
out vec4 vFog;

const vec3 U[6] = vec3[6](vec3(0.0, 0.0, -1.0), vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0));
const vec3 V[6] = vec3[6](vec3(0.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, -1.0), vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0));
const float SHADE[6] = float[6](0.65, 0.65, 1.0, 0.5, 0.8, 0.8);

void main() {
  int f = int(aFace + 0.5);
  int skip = int(aPiece.x + 0.5);
  vPiece = aPiece;
  vFace = aFace;
  vFluid = aFluid;
  if (((skip >> f) & 1) != 0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vUv = vec2(0.0); vLocal = vec3(0.0); vWorld = vec3(0.0); vLight = vec3(0.0); vFog = vec4(0.0);
    return;
  }
  vec3 world = mix(aMin, aMax, position);
  vec3 cell = floor((aMin + aMax) * 0.5);
  vec3 p = world - cell;
  vec3 q = p;
  int code = int(aPiece.z + 0.5);
  int axis = code & 3;
  if (code >= 4) {
    // A collar is wider than the arm but samples the arm's band of the tile (as the mesher maps it).
    vec3 cq = ${PIPE_CORE_MIN.toFixed(5)} + (p - ${PIPE_COLLAR_MIN.toFixed(5)}) * ${((PIPE_CORE_MAX - PIPE_CORE_MIN) / (PIPE_COLLAR_MAX - PIPE_COLLAR_MIN)).toFixed(5)};
    q = vec3(axis == 0 ? p.x : cq.x, axis == 1 ? p.y : cq.y, axis == 2 ? p.z : cq.z);
  }
  float u = 0.5 + dot(q - 0.5, U[f]);
  float v = 0.5 + dot(q - 0.5, V[f]);
  vUv = vec2(u, 1.0 - v);
  vLocal = p;
  vWorld = world;
  vLight = lightColor(aLight.x, aLight.y) * SHADE[f];
  vec3 toVertex = world - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform sampler2D uMask;
uniform highp float uTime;
in vec2 vUv;
in highp vec3 vLocal;
in highp vec3 vWorld;
flat in vec4 vPiece;
flat in float vFace;
in vec4 vFluid;
in vec3 vLight;
in vec4 vFog;
out vec4 fragColor;

void main() {
  vec4 m = texture(uMask, vUv);
  int tile = int(vPiece.y + 0.5);
  float win = tile == 0 ? m.b : tile == 1 ? m.a : tile == 2 ? m.r : m.g;
  int flags = int(vPiece.w + 0.5);
  bool glow = (flags & 1) != 0;
  bool flowing = (flags & 2) != 0;
  if ((flags & 4) != 0) {
    // An item pipe with packets in it: its glass warms a little.
    if (win < 0.5) discard;
    fragColor = vec4(mix(vec3(1.0, 0.74, 0.4) * vLight, vFog.rgb, vFog.a), 0.12);
    return;
  }
  vec3 col = vFluid.rgb;
  float flicker = 0.92 + 0.08 * sin(uTime * 5.3 + vWorld.x * 2.1 + vWorld.z * 1.7);
  if (win < 0.5) {
    // The carrying bit: a faint wash of the fluid's colour over the whole pipe (lava warms it more).
    vec3 c = glow ? col * flicker : col * vLight;
    fragColor = vec4(mix(c, vFog.rgb, vFog.a), glow ? 0.16 : 0.07);
    return;
  }
  int face = int(vFace + 0.5);
  int axis = int(vPiece.z + 0.5) & 3;
  float level = vFluid.a;
  float surface = mix(${PIPE_CORE_MIN.toFixed(4)}, ${PIPE_CORE_MAX.toFixed(4)}, level);
  bool side = face != 2 && face != 3;
  bool levelled = side && axis != 1;
  if (level < 0.02 || (levelled && vLocal.y > surface)) discard;
  // Streaks drifting along the pipe while the fluid moves (still when it only sits there).
  highp float along = axis == 0 ? vWorld.x : axis == 1 ? vWorld.y : axis == 2 ? vWorld.z : vWorld.x + vWorld.z;
  highp float phase = along * 2.0 - (flowing ? uTime * 0.9 : 0.0);
  float streak = 0.5 + 0.5 * sin(phase * 6.2832 + vLocal.y * 9.0);
  vec3 c = col * (0.86 + 0.24 * streak);
  if (levelled && surface - vLocal.y < 0.04) c *= 1.35;
  if (face == 2) c *= 0.85;
  c = glow ? c * (1.1 + 0.25 * streak) * flicker : c * vLight * 1.15;
  fragColor = vec4(mix(c, vFog.rgb, vFog.a), 0.94);
}
`;

/** A unit cube with corners in 0..1, faces in Face order (aFace). */
function cubeGeometry(): THREE.InstancedBufferGeometry {
  const pos: number[] = [];
  const face: number[] = [];
  const index: number[] = [];
  // Origin, u, v per face with u x v = the outward normal (counter-clockwise seen from outside).
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, 0], [0, 1, 0], [1, 0, 0]],
  ];
  faces.forEach(([o, u, v], f) => {
    const base = pos.length / 3;
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b);
      face.push(f);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 1));
  g.setIndex(index);
  return g;
}

export { cubeGeometry as unitCubeGeometry };

interface NetPieces {
  /** 11 numbers per piece (see pipePieces). */
  data: number[];
  count: number;
  gen: number;
  seen: number;
}

const attr = (n: number, size: number): THREE.InstancedBufferAttribute =>
  new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);

function flush(a: THREE.InstancedBufferAttribute, count: number): void {
  a.clearUpdateRanges();
  a.addUpdateRange(0, count * a.itemSize);
  a.needsUpdate = true;
}

export class PipeOverlay {
  readonly mesh: THREE.Mesh;
  /** Pieces drawn (instances). */
  drawn = 0;
  private readonly geometry = cubeGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly mask: THREE.DataTexture;
  private readonly aMin = attr(OVERLAY_CAP, 3);
  private readonly aMax = attr(OVERLAY_CAP, 3);
  private readonly aPiece = attr(OVERLAY_CAP, 4);
  private readonly aFluid = attr(OVERLAY_CAP, 4);
  private readonly aLight = attr(OVERLAY_CAP, 2);
  private readonly nets = new Map<Int32Array, NetPieces>();
  private readonly vox = (x: number, y: number, z: number): number => this.world.getVoxel(x, y, z);
  private readonly off: () => void;
  /** Bumped when a pipe or a block pipes join changes: every network's pieces are rebuilt. */
  private gen = 0;
  private tick = -1;
  private frame = 0;
  private camX = 0;
  private camY = 0;
  private camZ = 0;

  constructor(private readonly world: IWorld, bus: GameBus, uniforms: WorldUniforms, private readonly light: CellLight) {
    this.mask = new THREE.DataTexture(buildPipeMask(), 16, 16, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.mask.magFilter = THREE.NearestFilter;
    this.mask.minFilter = THREE.NearestFilter;
    this.mask.wrapS = THREE.RepeatWrapping;
    this.mask.wrapT = THREE.RepeatWrapping;
    this.mask.colorSpace = THREE.NoColorSpace;
    this.mask.needsUpdate = true;
    for (const [name, a] of [['aMin', this.aMin], ['aMax', this.aMax], ['aPiece', this.aPiece], ['aFluid', this.aFluid], ['aLight', this.aLight]] as const) {
      this.geometry.setAttribute(name, a);
    }
    this.geometry.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      name: 'pipe-overlay',
      glslVersion: THREE.GLSL3,
      uniforms: { ...uniforms, uMask: { value: this.mask } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'pipe-overlay';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // After the chunks' blended batch (2): the overlay sits on glass tubes too.
    this.mesh.renderOrder = 3;
    this.off = bus.on('block:changed', ({ from, to }) => {
      const a = from & VOXEL_ID_MASK;
      const b = to & VOXEL_ID_MASK;
      if (a !== b && (PIPE_JOINS[a] !== 0 || PIPE_JOINS[b] !== 0)) this.gen++;
    });
  }

  /** Rewrites the instances when the simulation ticked (or the camera moved a few blocks). */
  update(feed: TransportFeed | null, camX: number, camY: number, camZ: number, fallbackSky: number, fallbackBlock: number): void {
    const moved = Math.abs(camX - this.camX) + Math.abs(camY - this.camY) + Math.abs(camZ - this.camZ) > 4;
    if (!feed) {
      if (this.drawn > 0) this.clear();
      return;
    }
    if (feed.tick === this.tick && !moved) return;
    this.tick = feed.tick;
    this.camX = camX;
    this.camY = camY;
    this.camZ = camZ;
    this.frame++;
    const range2 = OVERLAY_RANGE * OVERLAY_RANGE;
    const mn = this.aMin.array as Float32Array;
    const mx = this.aMax.array as Float32Array;
    const pc = this.aPiece.array as Float32Array;
    const fl = this.aFluid.array as Float32Array;
    const li = this.aLight.array as Float32Array;
    let n = 0;
    for (let k = 0; k < feed.netCount && n < OVERLAY_CAP; k++) {
      const net = feed.nets[k];
      const pieces = this.piecesOf(net);
      const item = net.family === 'item';
      const flags = (net.glow ? 1 : 0) | (net.flowing ? 2 : 0) | (item ? 4 : 0);
      const r = ((net.colour >> 16) & 255) / 255;
      const g = ((net.colour >> 8) & 255) / 255;
      const b = (net.colour & 255) / 255;
      const level = item ? 0 : shownLevel(net);
      const d = pieces.data;
      let lastCell = NaN;
      let sky = fallbackSky;
      let block = fallbackBlock;
      let skipCell = false;
      for (let i = 0; i < pieces.count && n < OVERLAY_CAP; i++) {
        const o = i * 11;
        const cx = d[o + 9];
        const cy = Math.floor(d[o + 1]);
        const cz = d[o + 10];
        const cell = cx * 7919 + cy * 104729 + cz;
        if (cell !== lastCell) {
          lastCell = cell;
          const dx = cx + 0.5 - camX;
          const dy = cy + 0.5 - camY;
          const dz = cz + 0.5 - camZ;
          skipCell = dx * dx + dy * dy + dz * dz > range2;
          if (!skipCell) {
            const l = this.light.get(cx, cy, cz);
            sky = l < 0 ? fallbackSky : skyOf(l);
            block = l < 0 ? fallbackBlock : blockLight(l);
          }
        }
        if (skipCell) continue;
        mn[n * 3] = d[o];
        mn[n * 3 + 1] = d[o + 1];
        mn[n * 3 + 2] = d[o + 2];
        mx[n * 3] = d[o + 3];
        mx[n * 3 + 1] = d[o + 4];
        mx[n * 3 + 2] = d[o + 5];
        pc[n * 4] = d[o + 6];
        pc[n * 4 + 1] = d[o + 7];
        pc[n * 4 + 2] = d[o + 8];
        pc[n * 4 + 3] = flags;
        fl[n * 4] = r;
        fl[n * 4 + 1] = g;
        fl[n * 4 + 2] = b;
        fl[n * 4 + 3] = level;
        li[n * 2] = sky;
        li[n * 2 + 1] = block;
        n++;
      }
    }
    // Forget the pieces of networks that are gone (rebuilt or no longer carrying).
    if (this.frame % 40 === 0) for (const [key, p] of this.nets) if (this.frame - p.seen > 40) this.nets.delete(key);
    this.drawn = n;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    flush(this.aMin, n);
    flush(this.aMax, n);
    flush(this.aPiece, n);
    flush(this.aFluid, n);
    flush(this.aLight, n);
  }

  dispose(): void {
    this.off();
    this.geometry.dispose();
    this.material.dispose();
    this.mask.dispose();
  }

  private clear(): void {
    this.drawn = 0;
    this.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  /** The boxes of every pipe of a network, built once per network (and again after pipe-related block changes). */
  private piecesOf(net: PipeNetFeed): NetPieces {
    let p = this.nets.get(net.xs);
    if (!p) {
      p = { data: [], count: 0, gen: -1, seen: 0 };
      this.nets.set(net.xs, p);
    }
    p.seen = this.frame;
    if (p.gen === this.gen && p.count > 0) return p;
    p.gen = this.gen;
    p.data.length = 0;
    p.count = 0;
    for (let i = 0; i < net.size; i++) {
      const x = net.xs[i];
      const y = net.ys[i];
      const z = net.zs[i];
      const v = this.world.getVoxel(x, y, z);
      const def = blockDefOf(v);
      const tile = TILE_OF[def.key];
      if (tile === undefined) continue;
      p.count += pipePieces(v & VOXEL_ID_MASK, x, y, z, tile, this.vox, p.data);
    }
    return p;
  }
}
