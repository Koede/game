/**
 * Draws the airships (docs/api/airship.md): a long cream gas envelope sewn in gores with a red belly band, tail fins and
 * a rudder that swings, rigging down to a varnished wooden gondola with brass rails, and two engine pods on outriggers
 * whose propellers spin with the throttle. Original art in the game's vertex-coloured style (no textures), lit like
 * the terrain through the shared vehicle shader and a light probe at the ship.
 *
 * Model space: origin on the ground under the middle of the gondola, forward = -Z, right = +X (yaw 0 faces -Z).
 */
import * as THREE from 'three';
import { WORLD_HEIGHT, type IWorld } from '../../core/types';
import { LightProbe } from '../lightProbe';
import type { WorldUniforms } from '../materials';
import { VEHICLE_FRAGMENT, VEHICLE_VERTEX } from './tractorRenderer';

export interface AirshipScene {
  readonly scene: THREE.Scene;
  readonly uniforms: WorldUniforms;
}

/** What it reads of each ship (src/vehicles' AirshipView fits). */
export interface AirshipDrawView {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  prop: number;
  rudder: number;
  trim: number;
  thrust: number;
  occupied: boolean;
}

type RGB = [number, number, number];
const hex = (c: number): RGB => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const CREAM = hex(0xe3d3ad);
const CREAM_DARK = hex(0xc9b68c);
const RED = hex(0xa8402c);
const RED_DARK = hex(0x7e2c1f);
const WOOD = hex(0x8a5a32);
const WOOD_DARK = hex(0x5e3a1f);
const BRASS = hex(0xc9a043);
const STEEL = hex(0x8b97a6);
const IRON = hex(0x4d4f57);
const ROPE = hex(0x6d5a3e);
const GLASS = hex(0xa9d4e0);
const LAMP = hex(0xfff0b0);

/** Envelope: centre height, half length along Z, radius. */
const ENV_Y = 3.6;
const ENV_HALF = 3.6;
const ENV_R = 1.55;

class Builder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly emit: number[] = [];
  private readonly idx: number[] = [];

  quad(a: number[], b: number[], c: number[], d: number[], n: number[], color: RGB, e = 0): void {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.emit.push(e);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

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

  /** A thin bar between two points (square section `w`), for rigging and struts. */
  bar(a: number[], b: number[], w: number, color: RGB): this {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    const u = d.map((v) => v / len);
    // Two axes across the bar.
    const t = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const s1 = norm(cross(u, t));
    const s2 = cross(u, s1);
    const corner = (p: number[], i: number): number[] => {
      const a1 = (i === 0 || i === 3 ? -w : w) / 2;
      const a2 = (i < 2 ? -w : w) / 2;
      return [p[0] + s1[0] * a1 + s2[0] * a2, p[1] + s1[1] * a1 + s2[1] * a2, p[2] + s1[2] * a1 + s2[2] * a2];
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const n = norm([corner(a, i)[0] + corner(a, j)[0] - 2 * a[0], corner(a, i)[1] + corner(a, j)[1] - 2 * a[1], corner(a, i)[2] + corner(a, j)[2] - 2 * a[2]]);
      this.quad(corner(a, i), corner(b, i), corner(b, j), corner(a, j), n, color);
    }
    return this;
  }

  /** The envelope: an ellipsoid along Z made of rings, the gores alternately shaded, a red band round its belly. */
  envelope(): this {
    const rings = 14;
    const sides = 16;
    const at = (i: number, k: number): { p: number[]; n: number[] } => {
      const t = -1 + (2 * i) / rings;
      const z = t * ENV_HALF;
      // A blunt nose and a finer tail: the radius profile is fuller ahead of the middle.
      const shape = Math.sqrt(Math.max(0, 1 - t * t)) * (t < 0 ? 1 : 1 - 0.18 * t);
      const a = (k / sides) * Math.PI * 2;
      const r = ENV_R * shape;
      const p = [Math.cos(a) * r, ENV_Y + Math.sin(a) * r, z];
      const n = norm([Math.cos(a) * shape, Math.sin(a) * shape, (t / ENV_HALF) * ENV_R]);
      return { p, n };
    };
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < sides; k++) {
        const a = at(i, k);
        const b = at(i, k + 1);
        const c = at(i + 1, k + 1);
        const d = at(i + 1, k);
        const n = norm([a.n[0] + b.n[0] + c.n[0] + d.n[0], a.n[1] + b.n[1] + c.n[1] + d.n[1], a.n[2] + b.n[2] + c.n[2] + d.n[2]]);
        const belly = k >= 11 && k <= 13;
        const color = belly && i > 2 && i < rings - 3 ? (k % 2 ? RED : RED_DARK) : k % 2 ? CREAM : CREAM_DARK;
        this.quad(a.p, d.p, c.p, b.p, n, color);
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

const cross = (a: number[], b: number[]): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: number[]): number[] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Envelope, fins, rigging, gondola and outriggers: everything that does not move against the ship. */
function hullGeometry(): THREE.BufferGeometry {
  const b = new Builder().envelope();
  // Fixed tail fins: a top fin and two side fins (the rudder below swings).
  b.box(-0.06, ENV_Y + 0.6, 2.4, 0.06, ENV_Y + 1.85, 3.7, CREAM_DARK);
  b.box(-0.06, ENV_Y + 1.6, 2.6, 0.06, ENV_Y + 1.85, 3.7, RED);
  for (const s of [-1, 1]) {
    b.box(s > 0 ? 0.6 : -1.85, ENV_Y - 0.05, 2.4, s > 0 ? 1.85 : -0.6, ENV_Y + 0.05, 3.6, CREAM_DARK);
    b.box(s > 0 ? 1.6 : -1.85, ENV_Y - 0.06, 2.5, s > 0 ? 1.85 : -1.6, ENV_Y + 0.06, 3.6, RED);
  }
  // Keel under the envelope.
  b.box(-0.12, ENV_Y - ENV_R - 0.08, -2.2, 0.12, ENV_Y - ENV_R + 0.06, 2.2, WOOD_DARK);
  // Gondola: a floor, low walls (open at the top so the pilot sees out), brass rails, windows and a bow lamp.
  const gx = 0.9;
  const gz0 = -1.5;
  const gz1 = 1.3;
  b.box(-gx, 0, gz0, gx, 0.18, gz1, WOOD_DARK);
  b.box(-gx, 0.18, gz0, -gx + 0.1, 0.85, gz1, WOOD);
  b.box(gx - 0.1, 0.18, gz0, gx, 0.85, gz1, WOOD);
  b.box(-gx, 0.18, gz1 - 0.1, gx, 0.85, gz1, WOOD);
  b.box(-gx, 0.18, gz0, gx, 0.85, gz0 + 0.1, WOOD);
  for (const x of [-gx - 0.02, gx - 0.08]) for (let z = gz0 + 0.45; z < gz1 - 0.2; z += 0.7) b.box(x, 0.45, z, x + 0.1, 0.7, z + 0.35, GLASS);
  b.box(-gx - 0.03, 0.85, gz0 - 0.03, gx + 0.03, 0.93, gz0 + 0.07, BRASS);
  b.box(-gx - 0.03, 0.85, gz1 - 0.07, gx + 0.03, 0.93, gz1 + 0.03, BRASS);
  b.box(-gx - 0.03, 0.85, gz0, -gx + 0.07, 0.93, gz1, BRASS);
  b.box(gx - 0.07, 0.85, gz0, gx + 0.03, 0.93, gz1, BRASS);
  b.box(-0.6, -0.12, gz0 + 0.2, 0.6, 0.02, gz1 - 0.2, IRON);
  b.box(-0.18, 0.4, gz0 - 0.12, 0.18, 0.62, gz0, LAMP, 1);
  // A low binnacle (the compass stand) by the bow, below the pilot's eye line.
  b.box(-0.14, 0.18, gz0 + 0.25, 0.14, 0.6, gz0 + 0.5, WOOD_DARK);
  b.box(-0.12, 0.6, gz0 + 0.27, 0.12, 0.66, gz0 + 0.48, BRASS);
  // Rigging from the gondola's corners up to the keel.
  for (const x of [-gx, gx]) {
    for (const z of [gz0, gz1]) b.bar([x, 0.9, z], [x * 0.35, ENV_Y - ENV_R + 0.1, z * 1.35], 0.04, ROPE);
  }
  // Outriggers to the engine pods, and the pods.
  for (const s of [-1, 1]) {
    b.bar([s * gx, 0.6, 0.2], [s * 1.75, 0.95, 0.4], 0.08, IRON);
    b.bar([s * gx, 0.8, 0.2], [s * 1.2, ENV_Y - ENV_R + 0.2, 0.3], 0.04, ROPE);
    b.box(s * 1.75 - 0.22, 0.75, -0.05, s * 1.75 + 0.22, 1.15, 0.85, STEEL);
    b.box(s * 1.75 - 0.18, 1.15, 0.0, s * 1.75 + 0.18, 1.2, 0.8, IRON);
    b.box(s * 1.75 - 0.08, 0.87, 0.85, s * 1.75 + 0.08, 1.03, 0.95, BRASS);
  }
  return b.build();
}

/** A four-bladed propeller in the XY plane round the origin. */
function propGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  b.box(-0.07, -0.07, -0.06, 0.07, 0.07, 0.08, BRASS);
  b.box(-0.05, 0.05, -0.02, 0.05, 0.55, 0.02, WOOD);
  b.box(-0.05, -0.55, -0.02, 0.05, -0.05, 0.02, WOOD);
  b.box(0.05, -0.05, -0.02, 0.55, 0.05, 0.02, WOOD);
  b.box(-0.55, -0.05, -0.02, -0.05, 0.05, 0.02, WOOD);
  return b.build();
}

/** The rudder: a flap hinged at its front edge (origin on the hinge). */
function rudderGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  b.box(-0.05, -1.25, 0, 0.05, -0.5, 0.9, CREAM_DARK);
  b.box(-0.06, -1.25, 0.6, 0.06, -0.5, 0.9, RED);
  return b.build();
}

interface Rig {
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  props: THREE.Mesh[];
  rudder: THREE.Mesh;
  bob: number;
  sky: number;
  block: number;
  probed: boolean;
  seen: number;
}

export class AirshipRenderer {
  private readonly root = new THREE.Group();
  private readonly rigs = new Map<number, Rig>();
  private readonly probe: LightProbe;
  private readonly geo = { hull: hullGeometry(), prop: propGeometry(), rudder: rudderGeometry() };
  private frame = 0;
  drawn = 0;

  constructor(private readonly view: AirshipScene, world: IWorld) {
    this.probe = new LightProbe(world);
    this.root.name = 'airships';
    view.scene.add(this.root);
  }

  private createRig(): Rig {
    const material = new THREE.ShaderMaterial({
      name: 'airship',
      glslVersion: THREE.GLSL3,
      uniforms: { ...this.view.uniforms, uSky: { value: 1 }, uBlock: { value: 0 } },
      vertexShader: VEHICLE_VERTEX,
      fragmentShader: VEHICLE_FRAGMENT,
      side: THREE.DoubleSide,
    });
    const group = new THREE.Group();
    const mesh = (g: THREE.BufferGeometry): THREE.Mesh => {
      const m = new THREE.Mesh(g, material);
      m.frustumCulled = false;
      return m;
    };
    group.add(mesh(this.geo.hull));
    const props: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const p = mesh(this.geo.prop);
      p.position.set(s * 1.75, 0.95, 1.0);
      group.add(p);
      props.push(p);
    }
    const rudder = mesh(this.geo.rudder);
    rudder.position.set(0, ENV_Y, 3.0);
    group.add(rudder);
    this.root.add(group);
    return { group, material, props, rudder, bob: Math.random() * 6, sky: 1, block: 0, probed: false, seen: 0 };
  }

  update(dt: number, views: readonly AirshipDrawView[]): void {
    this.frame++;
    let drawn = 0;
    for (const v of views) {
      let rig = this.rigs.get(v.id);
      if (!rig) this.rigs.set(v.id, (rig = this.createRig()));
      rig.seen = this.frame;
      drawn++;
      rig.bob += dt;
      rig.group.position.set(v.x, v.y, v.z);
      rig.group.rotation.set(0, 0, 0);
      rig.group.rotation.y = v.yaw;
      // A gentle pitch with the trim and a slow sway while flown.
      rig.group.rotation.x = v.trim * 0.08 + (v.occupied ? Math.sin(rig.bob * 0.9) * 0.012 : 0);
      rig.group.rotation.z = -v.rudder * 0.05;
      for (const p of rig.props) p.rotation.z = v.prop;
      rig.rudder.rotation.y = -v.rudder * 0.5;
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

  private light(rig: Rig, v: AirshipDrawView): void {
    const data = rig.material.userData as { sky?: number; block?: number };
    if (!rig.probed || (this.frame + v.id) % 20 === 0) {
      this.probe.probe(v.x, Math.min(WORLD_HEIGHT - 1, v.y + 2), v.z);
      if (!rig.probed) {
        rig.sky = this.probe.sky;
        rig.block = this.probe.block;
        rig.probed = true;
      }
      data.sky = this.probe.sky;
      data.block = this.probe.block;
    }
    rig.sky += ((data.sky ?? rig.sky) - rig.sky) * 0.1;
    rig.block += ((data.block ?? rig.block) - rig.block) * 0.1;
    rig.material.uniforms.uSky.value = rig.sky;
    rig.material.uniforms.uBlock.value = rig.block;
  }

  dispose(): void {
    for (const rig of this.rigs.values()) rig.material.dispose();
    this.rigs.clear();
    this.root.removeFromParent();
    this.geo.hull.dispose();
    this.geo.prop.dispose();
    this.geo.rudder.dispose();
  }
}
