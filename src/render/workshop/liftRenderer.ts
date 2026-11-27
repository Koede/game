/**
 * Draws lifts and elevators (docs/api/lifts.md): a timber headframe over the top of each shaft with a sheave that turns as
 * the rope runs, the rope (or chain) down to the cage, and the cage itself: an open timber lift platform with rails, or an
 * iron mine cage with barred sides, a roof and a lamp. Original art in the tractor's vertex-coloured style, lit like the
 * terrain: the cage's light is probed where it is now (dark down a mine, bright at the top), the headframe's at the top.
 *
 * Model space: origin at the middle of the shaft column at the winch's level, the winch along +X (the group is turned so).
 */
import * as THREE from 'three';
import type { IWorld } from '../../core/types';
import type { LiftView } from '../../workshop/lifts';
import { CAGE_HEIGHT, HEAD_HEIGHT } from '../../workshop/lifts';
import { LightProbe } from '../lightProbe';
import { Builder, VEHICLE_FRAGMENT as FRAGMENT, VEHICLE_VERTEX as VERTEX, type RGB, type TractorScene } from '../vehicles/tractorRenderer';

const hex = (c: number): RGB => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const WOOD = hex(0xa07a40);
const WOOD_DARK = hex(0x6a4c2e);
const WOOD_LIGHT = hex(0xc49a5a);
const ROPE = hex(0xc8b07a);
const IRON = hex(0x4d4f57);
const STEEL = hex(0x8b97a6);
const BRONZE = hex(0xcca44d);
const LAMP = hex(0xffe0a0);

/** Four posts at the shaft's corners, beams round the top, a beam out to the winch, and the sheave's axle blocks. */
function headframeGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  const t = HEAD_HEIGHT + 0.25;
  for (const x of [-0.5, 0.44]) for (const z of [-0.5, 0.44]) b.box(x, 0, z, x + 0.06, t, z + 0.06, WOOD_DARK);
  b.box(-0.5, t - 0.1, -0.5, 0.5, t, -0.44, WOOD);
  b.box(-0.5, t - 0.1, 0.44, 0.5, t, 0.5, WOOD);
  b.box(-0.5, t - 0.1, -0.5, -0.44, t, 0.5, WOOD);
  // A beam out over the winch, and a diagonal brace down to it.
  b.box(0.44, t - 0.1, -0.08, 1.45, t, 0.08, WOOD);
  b.box(1.35, 1.0, -0.06, 1.45, t - 0.1, 0.06, WOOD_DARK);
  // Bearing blocks for the sheave axle.
  b.box(0.24, HEAD_HEIGHT - 0.08, -0.5, 0.36, HEAD_HEIGHT + 0.08, -0.38, BRONZE);
  b.box(0.24, HEAD_HEIGHT - 0.08, 0.38, 0.36, HEAD_HEIGHT + 0.08, 0.5, BRONZE);
  b.box(0.27, HEAD_HEIGHT - 0.03, -0.4, 0.33, HEAD_HEIGHT + 0.03, 0.4, IRON);
  // Hand rails round the open sides of the top, knee high.
  b.box(-0.5, 0.95, -0.5, 0.5, 1.0, -0.46, WOOD_LIGHT);
  b.box(-0.5, 0.95, 0.46, 0.5, 1.0, 0.5, WOOD_LIGHT);
  return b.build();
}

/** The sheave: a spoked wheel along X (the pivot turns it so its axle runs across the beam). */
function sheaveGeometry(iron: boolean): THREE.BufferGeometry {
  const b = new Builder().wheel(0, 0, 0, 0.3, 0.1, 14, iron ? STEEL : WOOD, iron ? IRON : BRONZE);
  b.box(-0.06, -0.27, -0.02, 0.06, 0.27, 0.02, iron ? IRON : WOOD_DARK);
  b.box(-0.06, -0.02, -0.27, 0.06, 0.02, 0.27, iron ? IRON : WOOD_DARK);
  return b.build();
}

/** The timber lift: a plank platform, corner posts, rails at waist height, a cross-tree with the hook on top. */
function liftCageGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  const h = CAGE_HEIGHT;
  b.box(-0.43, 0, -0.43, 0.43, 0.08, 0.43, WOOD);
  for (let i = 0; i < 4; i++) b.box(-0.43 + i * 0.215, 0.08, -0.43, -0.42 + i * 0.215, 0.081, 0.43, WOOD_DARK);
  for (const x of [-0.42, 0.36]) for (const z of [-0.42, 0.36]) b.box(x, 0.08, z, x + 0.06, h, z + 0.06, WOOD_DARK);
  for (const y of [0.55, 1.05]) {
    b.box(-0.42, y, -0.42, 0.42, y + 0.05, -0.38, WOOD_LIGHT);
    b.box(-0.42, y, 0.38, 0.42, y + 0.05, 0.42, WOOD_LIGHT);
  }
  b.box(-0.42, h - 0.08, -0.42, 0.42, h, -0.36, WOOD);
  b.box(-0.42, h - 0.08, 0.36, 0.42, h, 0.42, WOOD);
  b.box(-0.06, h - 0.08, -0.42, 0.06, h, 0.42, WOOD);
  b.box(-0.05, h, -0.05, 0.05, h + 0.1, 0.05, IRON);
  return b.build();
}

/** The iron mine cage: a chequer plate floor, barred sides front and back, a roof and a lamp under it. */
function elevatorCageGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  const h = CAGE_HEIGHT;
  b.box(-0.44, 0, -0.44, 0.44, 0.07, 0.44, IRON);
  for (let i = 0; i < 5; i++) b.box(-0.4 + i * 0.18, 0.07, -0.4, -0.36 + i * 0.18, 0.08, 0.4, STEEL);
  for (const x of [-0.44, 0.38]) for (const z of [-0.44, 0.38]) b.box(x, 0.07, z, x + 0.06, h, z + 0.06, IRON);
  for (const z of [-0.43, 0.39]) {
    for (let i = 1; i < 6; i++) b.box(-0.42 + i * 0.14, 0.07, z, -0.4 + i * 0.14, h - 0.1, z + 0.04, STEEL);
    for (const y of [0.07, 1.0, h - 0.12]) b.box(-0.44, y, z, 0.44, y + 0.05, z + 0.04, IRON);
  }
  b.box(-0.46, h - 0.06, -0.46, 0.46, h, 0.46, IRON);
  b.box(-0.08, h, -0.08, 0.08, h + 0.14, 0.08, STEEL);
  b.box(0.3, h - 0.22, -0.05, 0.38, h - 0.08, 0.05, LAMP, 1);
  return b.build();
}

interface Rig {
  group: THREE.Group;
  cage: THREE.Group;
  sheave: THREE.Mesh;
  line: THREE.Mesh;
  cageMat: THREE.ShaderMaterial;
  headMat: THREE.ShaderMaterial;
  kind: string;
  seen: number;
  probed: boolean;
  sky: number;
  block: number;
}

export class LiftRenderer {
  private readonly root = new THREE.Group();
  private readonly rigs = new Map<string, Rig>();
  private readonly probe: LightProbe;
  private readonly geo = {
    head: headframeGeometry(), sheaveWood: sheaveGeometry(false), sheaveIron: sheaveGeometry(true),
    lift: liftCageGeometry(), elevator: elevatorCageGeometry(),
    rope: new Builder().box(-0.5, 0, -0.5, 0.5, 1, 0.5, ROPE).build(), chain: new Builder().box(-0.5, 0, -0.5, 0.5, 1, 0.5, STEEL).build(),
  };
  private frame = 0;
  /** Lifts drawn in the last update (tests, e2e). */
  drawn = 0;

  constructor(private readonly view: TractorScene, world: IWorld) {
    this.probe = new LightProbe(world);
    this.root.name = 'lifts';
    view.scene.add(this.root);
  }

  private material(name: string): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      name, glslVersion: THREE.GLSL3, uniforms: { ...this.view.uniforms, uSky: { value: 1 }, uBlock: { value: 0 } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    });
  }

  private createRig(v: LiftView): Rig {
    const iron = v.kind === 'elevator_winch';
    const cageMat = this.material('lift-cage');
    const headMat = this.material('lift-head');
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => {
      const out = new THREE.Mesh(g, m);
      out.frustumCulled = false;
      return out;
    };
    const group = new THREE.Group();
    group.add(mesh(this.geo.head, headMat));
    const pivot = new THREE.Group();
    pivot.position.set(0.3, HEAD_HEIGHT, 0);
    pivot.rotation.y = Math.PI / 2;
    const sheave = mesh(iron ? this.geo.sheaveIron : this.geo.sheaveWood, headMat);
    pivot.add(sheave);
    group.add(pivot);
    // The run from the sheave over to the winch drum: fixed.
    const run = mesh(iron ? this.geo.chain : this.geo.rope, headMat);
    const from = new THREE.Vector3(0.3, HEAD_HEIGHT + 0.3, 0);
    const to = new THREE.Vector3(1.0, 1.0, 0);
    run.position.copy(from);
    run.scale.set(0.045, from.distanceTo(to), 0.045);
    run.rotation.z = Math.atan2(-(to.x - from.x), to.y - from.y);
    group.add(run);
    const line = mesh(iron ? this.geo.chain : this.geo.rope, cageMat);
    line.scale.set(iron ? 0.06 : 0.045, 1, iron ? 0.06 : 0.045);
    group.add(line);
    const cage = new THREE.Group();
    cage.add(mesh(iron ? this.geo.elevator : this.geo.lift, cageMat));
    group.add(cage);
    this.root.add(group);
    return { group, cage, sheave, line, cageMat, headMat, kind: v.kind, seen: 0, probed: false, sky: 1, block: 0 };
  }

  /** Places every lift; call once per frame before the world is drawn. */
  update(views: readonly LiftView[]): void {
    this.frame++;
    for (const v of views) {
      let rig = this.rigs.get(v.key);
      if (rig && rig.kind !== v.kind) {
        this.drop(v.key, rig);
        rig = undefined;
      }
      if (!rig) this.rigs.set(v.key, (rig = this.createRig(v)));
      rig.seen = this.frame;
      rig.group.position.set(v.sx + 0.5, v.y, v.sz + 0.5);
      rig.group.rotation.y = Math.atan2(-(v.z - v.sz), v.x - v.sx);
      const drop = v.floor - v.y;
      rig.cage.position.y = drop;
      rig.sheave.rotation.x = v.turn;
      // The vertical line from the cage's hook up to the sheave.
      const top = drop + CAGE_HEIGHT + 0.1;
      rig.line.position.set(0, top, 0);
      rig.line.scale.y = Math.max(0.01, HEAD_HEIGHT - top);
      this.light(rig, v);
    }
    let drawn = 0;
    for (const [key, rig] of this.rigs) {
      if (rig.seen === this.frame) drawn++;
      else this.drop(key, rig);
    }
    this.drawn = drawn;
  }

  private drop(key: string, rig: Rig): void {
    this.root.remove(rig.group);
    rig.cageMat.dispose();
    rig.headMat.dispose();
    this.rigs.delete(key);
  }

  /** Probes the light at the cage (often, it moves) and at the headframe (now and then), easing to them. */
  private light(rig: Rig, v: LiftView): void {
    const cageEvery = v.moving ? 6 : 30;
    if (!rig.probed || this.frame % cageEvery === 0) {
      this.probe.probe(v.sx + 0.5, v.floor + 1.2, v.sz + 0.5);
      const sky = this.probe.sky;
      const block = this.probe.block;
      if (!rig.probed) {
        rig.sky = sky;
        rig.block = block;
      }
      (rig.cageMat.userData as { sky: number; block: number }).sky = sky;
      (rig.cageMat.userData as { sky: number; block: number }).block = block;
    }
    if (!rig.probed || this.frame % 60 === 0) {
      this.probe.probe(v.sx + 0.5, v.y + 1.5, v.sz + 0.5);
      rig.headMat.uniforms.uSky.value = this.probe.sky;
      rig.headMat.uniforms.uBlock.value = this.probe.block;
    }
    rig.probed = true;
    const target = rig.cageMat.userData as { sky?: number; block?: number };
    rig.sky += ((target.sky ?? rig.sky) - rig.sky) * 0.15;
    rig.block += ((target.block ?? rig.block) - rig.block) * 0.15;
    rig.cageMat.uniforms.uSky.value = rig.sky;
    rig.cageMat.uniforms.uBlock.value = rig.block;
  }

  dispose(): void {
    for (const [key, rig] of this.rigs) this.drop(key, rig);
    this.root.removeFromParent();
    for (const g of Object.values(this.geo)) g.dispose();
  }
}
