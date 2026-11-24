/**
 * GroundItemRenderer: draws every item lying in the world as a small spinning, bobbing block (block items) or
 * extruded pixel sprite (everything else), one instanced draw call per item kind, lit like the terrain around it.
 * Items a collector is pulling glow, and while a collector runs a few cyan rings close in on the player's view.
 * Takes the DOM-free `GroundItems.items` list every frame; allocation-free in steady state.
 */
import * as THREE from 'three';
import { blockOfItem, itemOrNull, TEXTURE_NAMES } from '../core/registry';
import type { IWorld } from '../core/types';
import type { GroundItem } from '../game/groundItems';
import { ATLAS_GLSL, atlasDefines } from './atlas';
import { cubeGeometry, spriteGeometry } from './heldItem';
import { LightProbe } from './lightProbe';
import type { WorldUniforms } from './materials';
import { LIGHT_GLSL } from './shaders/chunk';
import { itemRarity, RARITY_COLOUR } from './rarity';
import { paintTile } from './tiles';

/** The parts of the Renderer it draws into (the Renderer satisfies it, as it does MobScene). */
export interface GroundScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly uniforms: WorldUniforms;
}

const BEAM_HEIGHT = 2.6;

const VERTEX = /* glsl */ `
precision highp float;
in float layer;
in float shade;
in vec3 aLight; // x sky 0..1, y block 0..1, z glow 0..1
in vec3 aRarity; // glow colour of the item's rarity (black for common)
uniform float uTime;
${LIGHT_GLSL}
out vec2 vUv;
flat out float vLayer;
out vec3 vColor;
out vec4 vFog;
out float vGlow;
out vec3 vRare;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vColor = lightColor(aLight.x, aLight.y) * shade;
  vec3 toVertex = world.xyz - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  vUv = uv;
  vLayer = layer;
  vGlow = aLight.z;
  // Rarity glow breathes slowly, each instance on its own beat.
  vRare = aRarity * (0.5 + 0.2 * sin(uTime * 3.0 + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3));
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
in float vGlow;
in vec3 vRare;
out vec4 fragColor;
void main() {
  vec4 t = atlasTexel(vUv, vLayer);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * vColor + vGlow * vec3(0.16, 0.34, 0.38) + vRare * (0.4 + 0.6 * t.rgb);
  fragColor = vec4(mix(c, vFog.rgb, vFog.a), 1.0);
}
`;

const BEAM_VERTEX = /* glsl */ `
precision highp float;
in vec3 aBeam;
${LIGHT_GLSL}
out vec3 vBeam;
out float vFade;
out vec2 vQ;
void main() {
  vec3 base = instanceMatrix[3].xyz;
  vec3 toCam = cameraPosition - base;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(0.0001, 0.0, 0.0));
  float h = position.y + 0.5;
  vec3 world = base + right * position.x * 0.22 * (1.0 - 0.6 * h) + vec3(0.0, h * ${BEAM_HEIGHT.toFixed(1)}, 0.0);
  vBeam = aBeam;
  // Fades up the beam and into the distance fog, so it never outlines the fog edge.
  vFade = 1.0 - fogFactor(length(world - cameraPosition));
  vQ = vec2(position.x * 2.0, h);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;
const BEAM_FRAGMENT = /* glsl */ `
precision mediump float;
in vec3 vBeam;
in float vFade;
in vec2 vQ;
out vec4 fragColor;
void main() {
  float a = (1.0 - vQ.y) * (1.0 - abs(vQ.x)) * (1.0 - abs(vQ.x)) * vFade;
  fragColor = vec4(mix(vBeam, vec3(1.0), 0.4 * a), a * 0.75);
}
`;

/** Items of this rarity and above also stand in a light beam (when beams are on and the graphics setting is not low), so loot reads from far away. */
const BEAM_MIN_RARITY = 2;
const BEAM_CAPACITY = 64;

/** Edge of a block item and width of a sprite item, in blocks. */
const BLOCK_SIZE = 0.3;
const SPRITE_SIZE = 0.38;
const START_CAPACITY = 16;
const FRESH_PROBES = 8;
const PROBES_PER_FRAME = 3;
const SPIN = 1.3;
const BOB = 0.05;
/**
 * The physics runs at 20 Hz (src/game/groundItems.ts) and moves an item in steps, so drawing its raw position looks like stutter at 60
 * frames a second. Each item is drawn at a smoothed position that eases to the physics one (this rate, per second; a flying item
 * follows faster), and its bob height and size ease too, so landing, taking off and merging never snap.
 */
const FOLLOW_RATE = 28;
const FLIGHT_RATE = 60;
/** Beyond this far from the physics position (a teleport, a respawn) the drawn item just snaps. */
const SNAP_DIST = 3;
/** How fast the bob and the size ease to their targets, per second. */
const POSE_RATE = 9;
const RINGS = 3;
const RING_PERIOD_S = 0.7;

interface Kind {
  rarity: number;
  mesh: THREE.InstancedMesh;
  light: THREE.InstancedBufferAttribute;
  capacity: number;
  /** Half-height of the model after scaling (rests on the ground). */
  lift: number;
  scale: number;
}

/** `from` eased towards `to` at `rate` per second over `dt` seconds: frame-rate independent and never overshooting. */
export const easeToward = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * Math.max(0, dt)));

/** The drawn pose of one item: eased towards the physics state each frame so nothing snaps. */
interface Pose {
  x: number;
  y: number;
  z: number;
  bob: number;
  pop: number;
}

interface Lit {
  sky: number;
  block: number;
  age: number;
}

export class GroundItemRenderer {
  readonly group = new THREE.Group();
  private readonly kinds = new Map<string, Kind>();
  private readonly lit = new Map<number, Lit>();
  private readonly poses = new Map<number, Pose>();
  private dt = 0;
  private readonly material: THREE.ShaderMaterial;
  private readonly probe: LightProbe;
  private readonly rings: THREE.Mesh[] = [];
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly tmp = new THREE.Object3D();
  private readonly used = new Map<Kind, number>();
  private readonly beams: THREE.InstancedMesh;
  private readonly beamColour: THREE.InstancedBufferAttribute;
  private readonly beamMaterial: THREE.ShaderMaterial;
  /** Light beams over rare drops: a few extra triangles, so cheap, but a quality setting can switch them off. */
  beamsOn = true;
  private time = 0;
  private frame = 0;
  private probeCursor = 0;
  private ringT = 0;
  private ringsOn = false;
  /** Draw calls last frame (one per kind drawn). */
  drawn = 0;
  /** Instances last frame. */
  instances = 0;

  constructor(
    private readonly view: GroundScene,
    world: IWorld,
  ) {
    this.probe = new LightProbe(world);
    this.material = new THREE.ShaderMaterial({
      name: 'ground-items',
      glslVersion: THREE.GLSL3,
      defines: atlasDefines({ texture2: (view.uniforms.uAtlas2.value as THREE.DataArrayTexture | null) ?? null }),
      uniforms: { ...view.uniforms },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.DoubleSide,
    });
    this.ringGeometry = new THREE.RingGeometry(0.9, 1, 40);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xbfefff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < RINGS; i++) {
      const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
      ring.visible = false;
      ring.frustumCulled = false;
      ring.renderOrder = 10;
      this.rings.push(ring);
      this.group.add(ring);
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    this.beamColour = new THREE.InstancedBufferAttribute(new Float32Array(BEAM_CAPACITY * 3), 3);
    this.beamColour.setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('aBeam', this.beamColour);
    this.beamMaterial = new THREE.ShaderMaterial({
      name: 'ground-beams',
      glslVersion: THREE.GLSL3,
      uniforms: { ...view.uniforms },
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beams = new THREE.InstancedMesh(quad, this.beamMaterial, BEAM_CAPACITY);
    this.beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beams.frustumCulled = false;
    this.beams.count = 0;
    this.beams.renderOrder = 5;
    this.group.add(this.beams);
    this.group.frustumCulled = false;
    view.scene.add(this.group);
  }

  /**
   * One frame. `items` is `player.ground.items`; `pulling` is true while a collector runs (the rings; `radius` only
   * sizes nothing - the rings are a view-space effect).
   */
  update(dt: number, items: readonly GroundItem[], pulling = false): void {
    this.time += dt;
    this.dt = dt;
    this.frame++;
    this.drawn = 0;
    this.instances = 0;
    const cam = this.view.camera.position;
    const reach = this.view.uniforms.uFog.value.y + 2;
    const reach2 = reach * reach;
    const used = this.used;
    used.clear();
    for (const kind of this.kinds.values()) kind.mesh.count = 0;
    let beams = 0;
    const beamsOn = this.beamsOn && this.view.uniforms.uFx.value > 0;
    let probes = 0;
    for (let n = 0; n < items.length; n++) {
      const e = items[n];
      const dx = e.x - cam.x;
      const dy = e.y - cam.y;
      const dz = e.z - cam.z;
      if (dx * dx + dy * dy + dz * dz > reach2) continue;
      const kind = this.kindOf(e.item);
      if (!kind) continue;
      let lit = this.lit.get(e.id);
      if (!lit) {
        lit = { sky: 1, block: 0, age: -1 };
        this.lit.set(e.id, lit);
      }
      if (lit.age < 0 && probes < FRESH_PROBES) {
        this.sample(e, lit);
        probes++;
      } else if (lit.age >= 0 && (n + this.probeCursor) % Math.max(1, Math.floor(items.length / PROBES_PER_FRAME)) === 0) {
        this.sample(e, lit);
      }
      const copies = e.count >= 16 ? 3 : e.count >= 2 ? 2 : 1;
      const pose = this.pose(e);
      for (let c = 0; c < copies; c++) {
        const i = used.get(kind) ?? 0;
        if (i >= kind.capacity) this.grow(kind);
        used.set(kind, i + 1);
        this.place(kind, i, e, c, copies, lit, pose);
      }
      if (beamsOn && kind.rarity >= BEAM_MIN_RARITY && beams < BEAM_CAPACITY) {
        this.tmp.position.set(pose.x, pose.y + 0.05, pose.z);
        this.tmp.rotation.set(0, 0, 0);
        this.tmp.scale.setScalar(1);
        this.tmp.updateMatrix();
        this.beams.setMatrixAt(beams, this.tmp.matrix);
        this.beamColour.setXYZ(beams, ...RARITY_COLOUR[kind.rarity]);
        beams++;
      }
    }
    this.beams.count = beams;
    this.beams.instanceMatrix.needsUpdate = true;
    this.beamColour.needsUpdate = true;
    this.probeCursor++;
    for (const [kind, n] of used) {
      kind.mesh.count = n;
      kind.mesh.instanceMatrix.needsUpdate = true;
      kind.light.needsUpdate = true;
      this.drawn++;
      this.instances += n;
    }
    if (this.frame % 120 === 0 && (this.lit.size > items.length * 2 + 16 || this.poses.size > items.length * 2 + 16)) this.prune(items);
    this.updateRings(dt, pulling);
  }

  dispose(): void {
    this.view.scene.remove(this.group);
    for (const k of this.kinds.values()) {
      k.mesh.geometry.dispose();
      k.mesh.dispose();
    }
    this.kinds.clear();
    this.beams.geometry.dispose();
    this.beams.dispose();
    this.beamMaterial.dispose();
    this.material.dispose();
    this.ringGeometry.dispose();
    this.ringMaterial.dispose();
  }

  // ---------------------------------------------------------------------------------------------

  private sample(e: GroundItem, lit: Lit): void {
    this.probe.probe(e.x, e.y + 0.3, e.z);
    const k = lit.age < 0 ? 1 : 0.25; // eased, so it never pops
    lit.sky += (this.probe.sky - lit.sky) * k;
    lit.block += (this.probe.block - lit.block) * k;
    lit.age = 0;
  }

  /** The eased pose of `e` for this frame (created at its physics position the first time it is seen). Call once per item per frame. */
  private pose(e: GroundItem): Pose {
    let p = this.poses.get(e.id);
    if (!p) {
      p = { x: e.x, y: e.y, z: e.z, bob: e.onGround ? BOB : 0.04, pop: 1 };
      this.poses.set(e.id, p);
    }
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dz = e.z - p.z;
    if (dx * dx + dy * dy + dz * dz > SNAP_DIST * SNAP_DIST) {
      p.x = e.x;
      p.y = e.y;
      p.z = e.z;
    } else {
      const rate = e.homing ? FLIGHT_RATE : FOLLOW_RATE;
      p.x = easeToward(p.x, e.x, rate, this.dt);
      p.y = easeToward(p.y, e.y, rate, this.dt);
      p.z = easeToward(p.z, e.z, rate, this.dt);
    }
    // The bob is a smooth wave whose height eases in on landing and out on take-off, never jumping between two formulas.
    const bobTarget = e.onGround ? BOB : 0.04;
    const popTarget = e.homing ? Math.max(0.55, Math.min(1, 0.45 + 0.4 * Math.hypot(e.vx, e.vy, e.vz) * 0.1)) : 1;
    p.bob = easeToward(p.bob, bobTarget, POSE_RATE, this.dt);
    p.pop = easeToward(p.pop, popTarget, POSE_RATE, this.dt);
    return p;
  }

  private place(kind: Kind, i: number, e: GroundItem, copy: number, copies: number, lit: Lit, p: Pose): void {
    const t = this.tmp;
    const spin = this.time * SPIN + e.phase + copy * 0.9;
    // Resting stacks bob gently (a wave of the eased height `p.bob`); items in flight hover.
    const wave = e.onGround ? Math.sin(this.time * 2.2 + e.phase) * BOB * (p.bob / BOB) : 0;
    const bob = p.bob + wave;
    const ox = copies > 1 ? (copy - (copies - 1) / 2) * 0.09 : 0;
    const oz = copies > 1 ? (copy % 2 === 0 ? -0.05 : 0.05) : 0;
    t.position.set(p.x + ox, p.y + kind.lift + 0.04 + bob + copy * 0.015, p.z + oz);
    t.rotation.set(0, spin, 0);
    t.scale.setScalar(kind.scale * p.pop);
    t.updateMatrix();
    kind.mesh.setMatrixAt(i, t.matrix);
    kind.light.setXYZ(i, lit.sky, lit.block, e.pulled ? 1 : 0);
  }

  private kindOf(item: string): Kind | null {
    let kind = this.kinds.get(item);
    if (kind) return kind;
    const def = itemOrNull(item);
    if (!def) return null;
    const placed = blockOfItem(item);
    let geometry: THREE.BufferGeometry;
    let scale: number;
    if (def.iconLayer < 0 && placed) {
      geometry = cubeGeometry(placed.layers, placed.shape === 'slab' ? 0.5 : 1);
      scale = BLOCK_SIZE;
    } else {
      const layer = def.iconLayer >= 0 ? def.iconLayer : 0;
      geometry = spriteGeometry(layer, paintTile(TEXTURE_NAMES[layer]));
      scale = SPRITE_SIZE;
    }
    const rare = RARITY_COLOUR[itemRarity(def)];
    const n = geometry.getAttribute('position').count;
    const rarity = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rarity.set(rare, i * 3);
    geometry.setAttribute('aRarity', new THREE.BufferAttribute(rarity, 3));
    kind = this.makeKind(geometry, scale, START_CAPACITY, placed && def.iconLayer < 0 && placed.shape === 'slab' ? 0.25 : 0.5);
    kind.rarity = itemRarity(def);
    this.kinds.set(item, kind);
    this.group.add(kind.mesh);
    return kind;
  }

  private makeKind(geometry: THREE.BufferGeometry, scale: number, capacity: number, halfHeight: number): Kind {
    const mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const light = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    light.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aLight', light);
    return { rarity: 0, mesh, light, capacity, lift: halfHeight * scale, scale };
  }

  /** More instances of one kind than fit: doubles the buffers (rare; copies what is there). */
  private grow(kind: Kind): void {
    const capacity = kind.capacity * 2;
    const old = kind.mesh;
    const mesh = new THREE.InstancedMesh(old.geometry, this.material, capacity);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    (mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    const light = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    light.setUsage(THREE.DynamicDrawUsage);
    light.array.set(kind.light.array);
    old.geometry.setAttribute('aLight', light);
    this.group.remove(old);
    old.dispose();
    this.group.add(mesh);
    kind.mesh = mesh;
    kind.light = light;
    kind.capacity = capacity;
  }

  private prune(items: readonly GroundItem[]): void {
    const alive = new Set<number>();
    for (const e of items) alive.add(e.id);
    for (const id of this.lit.keys()) if (!alive.has(id)) this.lit.delete(id);
    for (const id of this.poses.keys()) if (!alive.has(id)) this.poses.delete(id);
  }

  /** Cyan rings that shrink towards the view centre while a collector runs. */
  private updateRings(dt: number, on: boolean): void {
    if (!on && !this.ringsOn) return;
    this.ringsOn = on;
    this.ringT += dt;
    const cam = this.view.camera;
    for (let i = 0; i < RINGS; i++) {
      const ring = this.rings[i];
      ring.visible = on;
      if (!on) continue;
      const phase = ((this.ringT / RING_PERIOD_S + i / RINGS) % 1 + 1) % 1; // 0 far/large .. 1 near/small
      const size = 0.34 * (1 - phase) + 0.03;
      ring.position.set(0, 0, -1.0 - 0.5 * (1 - phase));
      ring.scale.setScalar(size);
      ring.position.applyQuaternion(cam.quaternion).add(cam.position);
      ring.quaternion.copy(cam.quaternion);
    }
    this.ringMaterial.opacity = 0.4;
  }
}
