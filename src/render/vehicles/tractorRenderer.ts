/**
 * Draws the tractors (docs/api/tractor.md): a blocky green farm tractor with a cab frame, big rear and small front
 * wheels that roll and steer, a smoking-hot exhaust, headlamps, and the two attachments (a rotary tiller and a reaping
 * header with a turning reel) that spin while they work. Built from boxes and short cylinders in the game's own
 * vertex-coloured style (original art, no textures), lit like the terrain: the light at each machine is probed from the
 * voxels (a few probes per frame, eased), the world's fog and sky tint come from the shared uniforms.
 *
 * Model space: origin at the ground under the machine's middle, forward = -Z, right = +X (the machine's own heading,
 * the same convention as the player: yaw 0 faces -Z and a positive yaw turns left).
 */
import * as THREE from 'three';
import type { IWorld } from '../../core/types';
import { LightProbe } from '../lightProbe';
import type { WorldUniforms } from '../materials';
import { LIGHT_GLSL } from '../shaders/chunk';

/** The parts of the Renderer it draws into. */
export interface TractorScene {
  readonly scene: THREE.Scene;
  readonly uniforms: WorldUniforms;
}

/** What it reads of each tractor (src/vehicles' TractorView fits). */
export interface TractorDrawView {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  steer: number;
  roll: number;
  working: number;
  attachment: 'tiller' | 'harvester' | null;
  occupied: boolean;
}

export type RGB = [number, number, number];
const hex = (c: number): RGB => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const GREEN = hex(0x3f7a3a);
const GREEN_DARK = hex(0x2a5428);
const GREEN_LIGHT = hex(0x69a553);
const YELLOW = hex(0xd9b02a);
const RUBBER = hex(0x1f1f24);
const HUB = hex(0xb78a2e);
const STEEL = hex(0x8b97a6);
const IRON = hex(0x4d4f57);
const ORANGE = hex(0xd9741f);
const GLASS = hex(0x9ec9d6);
const SEAT = hex(0x4a3226);
const LAMP = hex(0xfff0b0);

export const VEHICLE_VERTEX = /* glsl */ `
precision highp float;
in vec3 aColor;
in float aEmit;
uniform float uSky;
uniform float uBlock;
${LIGHT_GLSL}
out vec3 vColor;
out vec4 vFog;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * normal);
  float side = mix(0.65, 0.8, abs(wn.z) / (abs(wn.x) + abs(wn.z) + 1e-4));
  float shade = wn.y >= 0.0 ? mix(side, 1.0, wn.y) : mix(side, 0.5, -wn.y);
  vec3 light = lightColor(uSky, uBlock);
  vColor = mix(aColor * light * shade, aColor, aEmit);
  vec3 toVertex = world.xyz - cameraPosition;
  float dist = length(toVertex);
  vFog = vec4(fogColorFor(toVertex / max(dist, 0.0001)), fogFactor(dist));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
export const VEHICLE_FRAGMENT = /* glsl */ `
precision mediump float;
in vec3 vColor;
in vec4 vFog;
out vec4 fragColor;
void main() {
  fragColor = vec4(mix(vColor, vFog.rgb, vFog.a), 1.0);
}
`;

/** Accumulates boxes and cylinders into one indexed geometry (position, normal, colour, emissive flag). */
export class Builder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly emit: number[] = [];
  private readonly idx: number[] = [];

  private quad(a: number[], b: number[], c: number[], d: number[], n: number[], color: RGB, e: number): void {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.emit.push(e);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** An axis-aligned box from (x0, y0, z0) to (x1, y1, z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: RGB, e = 0): this {
    const q = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => this.quad(a, b, c, d, n, color, e);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    return this;
  }

  /** A cylinder along X centred at (cx, cy, cz): radius r, length len, n sides, tread colour and hub colour. */
  wheel(cx: number, cy: number, cz: number, r: number, len: number, n: number, tread: RGB, hub: RGB): this {
    const x0 = cx - len / 2;
    const x1 = cx + len / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const y00 = cy + Math.sin(a0) * r;
      const z00 = cz + Math.cos(a0) * r;
      const y01 = cy + Math.sin(a1) * r;
      const z01 = cz + Math.cos(a1) * r;
      const am = (a0 + a1) / 2;
      const c = i % 2 === 0 ? tread : [tread[0] * 1.5, tread[1] * 1.5, tread[2] * 1.5] as RGB;
      this.quad([x0, y00, z00], [x1, y00, z00], [x1, y01, z01], [x0, y01, z01], [0, Math.sin(am), Math.cos(am)], c, 0);
      for (const [x, nx, rr] of [[x0, -1, r * 0.55], [x1, 1, r * 0.55]] as const) {
        const hy0 = cy + Math.sin(a0) * rr;
        const hz0 = cz + Math.cos(a0) * rr;
        const hy1 = cy + Math.sin(a1) * rr;
        const hz1 = cz + Math.cos(a1) * rr;
        const flip = nx > 0;
        const centre = [x, cy, cz];
        const p0 = [x, hy0, hz0];
        const p1 = [x, hy1, hz1];
        this.quad(centre, flip ? p0 : p1, flip ? p1 : p0, centre, [nx, 0, 0], hub, 0);
        const o0 = [x, y00, z00];
        const o1 = [x, y01, z01];
        this.quad(p0, flip ? o0 : o1, flip ? o1 : o0, p1, [nx, 0, 0], tread, 0);
      }
    }
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aEmit', new THREE.Float32BufferAttribute(this.emit, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Body, cab, fenders, engine, lamps, exhaust: the part that never moves relative to the machine. */
function bodyGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  // Chassis rail and engine block with its hood.
  b.box(-0.35, 0.45, -1.1, 0.35, 0.75, 0.95, IRON);
  b.box(-0.45, 0.75, -1.2, 0.45, 1.3, -0.15, GREEN);
  b.box(-0.47, 1.28, -1.15, 0.47, 1.36, -0.2, GREEN_LIGHT);
  b.box(-0.4, 0.8, -1.26, 0.4, 1.2, -1.2, IRON);
  for (let i = 0; i < 4; i++) b.box(-0.34, 0.86 + i * 0.09, -1.28, 0.34, 0.9 + i * 0.09, -1.255, STEEL);
  b.box(-0.35, 1.0, -1.3, -0.2, 1.12, -1.26, LAMP, 1);
  b.box(0.2, 1.0, -1.3, 0.35, 1.12, -1.26, LAMP, 1);
  // Exhaust stack.
  b.box(0.28, 1.36, -0.95, 0.38, 1.95, -0.85, IRON);
  b.box(0.26, 1.93, -0.97, 0.4, 1.99, -0.83, STEEL);
  // Rear body and fenders over the big wheels.
  b.box(-0.6, 0.65, 0.0, 0.6, 1.0, 0.95, GREEN_DARK);
  b.box(-0.95, 1.05, 0.0, -0.55, 1.12, 0.9, GREEN);
  b.box(0.55, 1.05, 0.0, 0.95, 1.12, 0.9, GREEN);
  // Seat, steering column and wheel.
  b.box(-0.22, 1.0, 0.35, 0.22, 1.12, 0.75, SEAT);
  b.box(-0.22, 1.12, 0.65, 0.22, 1.5, 0.75, SEAT);
  b.box(-0.04, 1.0, 0.0, 0.04, 1.4, 0.08, IRON);
  b.box(-0.2, 1.38, -0.02, 0.2, 1.42, 0.1, IRON);
  // Cab frame: four posts, a roof, glass in the rear.
  for (const x of [-0.55, 0.5]) for (const z of [-0.1, 0.9]) b.box(x, 1.0, z, x + 0.05, 2.0, z + 0.05, GREEN_DARK);
  b.box(-0.6, 1.98, -0.15, 0.6, 2.06, 0.98, GREEN);
  b.box(-0.5, 1.2, 0.93, 0.5, 1.95, 0.95, GLASS);
  // Hitch bar at the front for the attachments.
  b.box(-0.5, 0.5, -1.45, 0.5, 0.62, -1.2, IRON);
  return b.build();
}

const rearWheel = (): THREE.BufferGeometry => new Builder().wheel(0, 0, 0, 0.58, 0.34, 12, RUBBER, HUB).build();
const frontWheel = (): THREE.BufferGeometry => new Builder().wheel(0, 0, 0, 0.36, 0.22, 10, RUBBER, HUB).build();

/** The rotary tiller: a frame and a drum of tines, the drum (rotor) separate so it can spin. */
function tillerGeometry(): { frame: THREE.BufferGeometry; rotor: THREE.BufferGeometry } {
  const frame = new Builder();
  frame.box(-0.85, 0.55, -1.55, 0.85, 0.67, -1.45, IRON);
  frame.box(-0.9, 0.2, -1.95, -0.8, 0.67, -1.45, STEEL);
  frame.box(0.8, 0.2, -1.95, 0.9, 0.67, -1.45, STEEL);
  frame.box(-0.85, 0.62, -1.98, 0.85, 0.7, -1.38, ORANGE);
  const rotor = new Builder();
  rotor.box(-0.8, -0.05, -0.05, 0.8, 0.05, 0.05, IRON);
  for (let i = 0; i < 9; i++) {
    const x = -0.76 + i * 0.19;
    rotor.box(x, -0.3, -0.03, x + 0.04, 0.3, 0.03, STEEL);
    rotor.box(x, -0.03, -0.3, x + 0.04, 0.03, 0.3, STEEL);
  }
  return { frame: frame.build(), rotor: rotor.build() };
}

/** The reaping header: a wide cutter bar, side plates, an auger floor, and a reel with slats (rotor). */
function harvesterGeometry(): { frame: THREE.BufferGeometry; rotor: THREE.BufferGeometry } {
  const frame = new Builder();
  frame.box(-1.5, 0.12, -2.25, 1.5, 0.2, -2.05, STEEL);
  for (let i = 0; i < 15; i++) frame.box(-1.45 + i * 0.2, 0.08, -2.4, -1.37 + i * 0.2, 0.14, -2.2, STEEL);
  frame.box(-1.5, 0.2, -2.2, 1.5, 0.78, -1.9, ORANGE);
  frame.box(-1.5, 0.2, -2.3, -1.42, 1.15, -1.5, YELLOW);
  frame.box(1.42, 0.2, -2.3, 1.5, 1.15, -1.5, YELLOW);
  frame.box(-0.5, 0.5, -1.9, 0.5, 0.8, -1.45, ORANGE);
  const rotor = new Builder();
  rotor.box(-1.45, -0.04, -0.04, 1.45, 0.04, 0.04, IRON);
  for (let k = 0; k < 4; k++) {
    // Four slats at right angles around the axle.
    const a = (k * Math.PI) / 2;
    const y = Math.sin(a) * 0.42;
    const z = Math.cos(a) * 0.42;
    rotor.box(-1.42, y - 0.03, z - 0.03, 1.42, y + 0.03, z + 0.03, YELLOW);
    rotor.box(-1.42, y * 0.5 - 0.015, z * 0.5 - 0.015, 1.42, y * 0.5 + 0.015, z * 0.5 + 0.015, IRON);
  }
  return { frame: frame.build(), rotor: rotor.build() };
}

interface Rig {
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  wheelsRear: THREE.Mesh[];
  wheelsFront: THREE.Group[];
  frontMeshes: THREE.Mesh[];
  tiller: THREE.Group;
  harvester: THREE.Group;
  tillerRotor: THREE.Mesh;
  harvesterRotor: THREE.Mesh;
  spin: number;
  sky: number;
  block: number;
  probed: boolean;
  seen: number;
}

export class TractorRenderer {
  private readonly root = new THREE.Group();
  private readonly rigs = new Map<number, Rig>();
  private readonly probe: LightProbe;
  private readonly geo = {
    body: bodyGeometry(), rear: rearWheel(), front: frontWheel(), tiller: tillerGeometry(), harvester: harvesterGeometry(),
  };
  private frame = 0;
  /** Machines drawn in the last update. */
  drawn = 0;

  constructor(private readonly view: TractorScene, world: IWorld) {
    this.probe = new LightProbe(world);
    this.root.name = 'tractors';
    view.scene.add(this.root);
  }

  private createRig(): Rig {
    const material = new THREE.ShaderMaterial({
      name: 'tractor',
      glslVersion: THREE.GLSL3,
      uniforms: { ...this.view.uniforms, uSky: { value: 1 }, uBlock: { value: 0 } },
      vertexShader: VEHICLE_VERTEX,
      fragmentShader: VEHICLE_FRAGMENT,
    });
    const group = new THREE.Group();
    const mesh = (g: THREE.BufferGeometry): THREE.Mesh => {
      const m = new THREE.Mesh(g, material);
      m.frustumCulled = false;
      return m;
    };
    group.add(mesh(this.geo.body));
    const wheelsRear: THREE.Mesh[] = [];
    const wheelsFront: THREE.Group[] = [];
    const frontMeshes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const rear = mesh(this.geo.rear);
      rear.position.set(side * 0.78, 0.58, 0.45);
      group.add(rear);
      wheelsRear.push(rear);
      // The steering pivot is a group; the wheel inside it rolls.
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.55, 0.36, -0.85);
      const front = mesh(this.geo.front);
      pivot.add(front);
      group.add(pivot);
      wheelsFront.push(pivot);
      frontMeshes.push(front);
    }
    const tiller = new THREE.Group();
    tiller.add(mesh(this.geo.tiller.frame));
    const tillerRotor = mesh(this.geo.tiller.rotor);
    tillerRotor.position.set(0, 0.3, -1.7);
    tiller.add(tillerRotor);
    const harvester = new THREE.Group();
    harvester.add(mesh(this.geo.harvester.frame));
    const harvesterRotor = mesh(this.geo.harvester.rotor);
    harvesterRotor.position.set(0, 0.95, -1.85);
    harvester.add(harvesterRotor);
    group.add(tiller, harvester);
    this.root.add(group);
    return {
      group, material, wheelsRear, wheelsFront, frontMeshes, tiller, harvester, tillerRotor, harvesterRotor, spin: 0, sky: 1, block: 0, probed: false, seen: 0,
    };
  }

  /** Places and animates every tractor; call once per frame before the world is drawn. */
  update(dt: number, views: readonly TractorDrawView[]): void {
    this.frame++;
    let drawn = 0;
    for (const v of views) {
      let rig = this.rigs.get(v.id);
      if (!rig) this.rigs.set(v.id, (rig = this.createRig()));
      rig.seen = this.frame;
      drawn++;
      rig.group.position.set(v.x, v.y, v.z);
      rig.group.rotation.y = v.yaw;
      rig.tiller.visible = v.attachment === 'tiller';
      rig.harvester.visible = v.attachment === 'harvester';
      const rearAngle = -v.roll / 0.58;
      for (const w of rig.wheelsRear) w.rotation.x = rearAngle;
      for (const p of rig.wheelsFront) p.rotation.y = -v.steer * 0.5;
      for (const f of rig.frontMeshes) f.rotation.x = -v.roll / 0.36;
      // Rotors turn with the work, and a little with the ground speed.
      rig.spin += dt * (2 + v.working * 14);
      rig.tillerRotor.rotation.x = rig.spin;
      rig.harvesterRotor.rotation.x = -rig.spin * 0.6;
      this.light(rig, v);
    }
    for (const [id, rig] of this.rigs) {
      if (rig.seen === this.frame) continue;
      this.root.remove(rig.group);
      rig.material.dispose();
      this.rigs.delete(id);
    }
    this.drawn = drawn;
  }

  /** Probes the light at the machine now and then (at once the first time) and eases to it. */
  private light(rig: Rig, v: TractorDrawView): void {
    if (!rig.probed || (this.frame + v.id) % 20 === 0) {
      this.probe.probe(v.x, v.y + 1.2, v.z);
      if (!rig.probed) {
        rig.sky = this.probe.sky;
        rig.block = this.probe.block;
        rig.probed = true;
      }
      (rig.material.userData as { sky: number; block: number }).sky = this.probe.sky;
      (rig.material.userData as { sky: number; block: number }).block = this.probe.block;
    }
    const target = rig.material.userData as { sky?: number; block?: number };
    rig.sky += ((target.sky ?? rig.sky) - rig.sky) * 0.1;
    rig.block += ((target.block ?? rig.block) - rig.block) * 0.1;
    rig.material.uniforms.uSky.value = rig.sky;
    rig.material.uniforms.uBlock.value = rig.block;
  }

  dispose(): void {
    for (const rig of this.rigs.values()) rig.material.dispose();
    this.rigs.clear();
    this.root.removeFromParent();
    this.geo.body.dispose();
    this.geo.rear.dispose();
    this.geo.front.dispose();
    for (const k of ['tiller', 'harvester'] as const) {
      this.geo[k].frame.dispose();
      this.geo[k].rotor.dispose();
    }
  }
}
