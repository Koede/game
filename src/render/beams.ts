/**
 * Lighthouse beams (docs/api/optics.md): every lit Lighthouse Lamp near the camera turns a ring of two brass-framed lenses, and
 * each lens throws a long cone of light that sweeps the dark. The cones are additive and fade along their length; by day they
 * all but vanish. A lamp high on a shore (src/world/coast.ts) throws a longer, brighter beam than one inland. Twice a second
 * the world's block entities are scanned for lit lamps; every frame the rings turn. No allocation per frame.
 */
import * as THREE from 'three';
import { blockOf } from '../core/registry';
import { voxelActive, type IWorld } from '../core/types';
import { isLighthouse } from '../world/coast';

/** Lamps drawn at most, and how far from the camera (horizontal blocks) they are looked for. */
export const BEAM_CAPACITY = 12;
export const BEAM_RANGE = 220;
const SCAN_S = 0.5;
/** The turning lens frames are drawn within this distance (blocks); beyond it only the beams. */
const PANEL_RANGE = 72;
/** Turns of the lens ring per second (radians). */
export const BEAM_SPIN = 0.9;
/** Beam length (blocks) of a true lighthouse and of a lamp inland. */
export const BEAM_LENGTH = 46;
export const BEAM_LENGTH_INLAND = 16;
/** Centre of the lantern core above the block's bottom. */
const CORE_Y = 0.47;

const VERT = /* glsl */ `
varying float vAlong;
void main() {
  vAlong = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlong;
void main() {
  float a = uOpacity * pow(vAlong, 1.6);
  gl_FragColor = vec4(uColor * a, a);
}`;

interface Lamp {
  key: string;
  x: number;
  y: number;
  z: number;
  coast: boolean;
  seen: number;
  phase: number;
}

export class LighthouseBeams {
  readonly group = new THREE.Group();
  private readonly rings: THREE.Group[] = [];
  private readonly lamps = new Map<string, Lamp>();
  private readonly order: Lamp[] = [];
  private readonly material: THREE.ShaderMaterial;
  private readonly cone: THREE.ConeGeometry;
  private readonly panel: THREE.BoxGeometry;
  private readonly brass: THREE.MeshBasicMaterial;
  private readonly lens: THREE.MeshBasicMaterial;
  private scanIn = 0;
  private generation = 0;
  private angle = 0;
  private camX = 0;
  private camZ = 0;
  /** Lamps drawn last frame (stats, tests). */
  drawn = 0;

  constructor(private readonly world: IWorld) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uOpacity: { value: 0.4 }, uColor: { value: new THREE.Color(1, 0.93, 0.72) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    // A cone with its tip at the origin, opening along +X; uv.y = 1 at the tip.
    this.cone = new THREE.ConeGeometry(1, 1, 14, 1, true);
    this.cone.translate(0, -0.5, 0);
    this.cone.rotateZ(Math.PI / 2);
    this.panel = new THREE.BoxGeometry(0.05, 0.6, 0.36);
    this.brass = new THREE.MeshBasicMaterial({ color: 0x9a7a3a });
    this.lens = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    for (let i = 0; i < BEAM_CAPACITY; i++) {
      const ring = new THREE.Group();
      for (const side of [1, -1]) {
        const frame = new THREE.Mesh(this.panel, this.brass);
        frame.position.set(0.43 * side, 0, 0);
        const glass = new THREE.Mesh(this.panel, this.lens);
        glass.scale.set(0.6, 0.7, 0.7);
        glass.position.set(0.47 * side, 0, 0);
        const beam = new THREE.Mesh(this.cone, this.material);
        beam.position.set(0.48 * side, 0, 0);
        beam.rotation.y = side > 0 ? 0 : Math.PI;
        beam.frustumCulled = false;
        beam.renderOrder = 5;
        beam.name = 'beam';
        ring.add(frame, glass, beam);
      }
      ring.visible = false;
      this.rings.push(ring);
      this.group.add(ring);
    }
  }

  /** `day` is the sky's daylight blend (0 night .. 1 day). */
  update(dt: number, cam: THREE.Vector3, day: number): void {
    this.camX = cam.x;
    this.camZ = cam.z;
    this.scanIn -= dt;
    if (this.scanIn <= 0) {
      this.scanIn = SCAN_S;
      this.scan();
    }
    this.angle = (this.angle + BEAM_SPIN * dt) % (Math.PI * 2);
    this.material.uniforms.uOpacity.value = 0.05 + 0.4 * Math.max(0, Math.min(1, 1 - day));
    let n = 0;
    for (const lamp of this.order) {
      if (n >= BEAM_CAPACITY) break;
      const ring = this.rings[n++];
      ring.visible = true;
      ring.position.set(lamp.x + 0.5, lamp.y + CORE_Y, lamp.z + 0.5);
      ring.rotation.y = this.angle + lamp.phase;
      const length = lamp.coast ? BEAM_LENGTH : BEAM_LENGTH_INLAND;
      const spread = lamp.coast ? 3.2 : 1.6;
      // Far off, past the fog where the tower itself is gone, only the light shows: the lens frames would float.
      const near = Math.hypot(lamp.x + 0.5 - cam.x, lamp.z + 0.5 - cam.z) < PANEL_RANGE;
      for (const child of ring.children) {
        if (child.name === 'beam') child.scale.set(length, spread, spread);
        else child.visible = near;
      }
    }
    for (let i = n; i < this.rings.length; i++) this.rings[i].visible = false;
    this.drawn = n;
  }

  dispose(): void {
    this.material.dispose();
    this.cone.dispose();
    this.panel.dispose();
    this.brass.dispose();
    this.lens.dispose();
  }

  /** Finds the lit lamps near the camera (nearest first) and whether each stands on a shore. */
  private scan(): void {
    const gen = ++this.generation;
    for (const e of this.world.entities()) {
      if (e.kind !== 'lighthouse_lamp') continue;
      const dx = e.x + 0.5 - this.camX;
      const dz = e.z + 0.5 - this.camZ;
      if (dx * dx + dz * dz > BEAM_RANGE * BEAM_RANGE || !this.world.isLoaded(e.x, e.z)) continue;
      const v = this.world.getVoxel(e.x, e.y, e.z);
      if (blockOf(v).machine !== 'lighthouse_lamp' || !voxelActive(v)) continue;
      const key = `${e.x},${e.y},${e.z}`;
      let lamp = this.lamps.get(key);
      if (!lamp) {
        lamp = { key, x: e.x, y: e.y, z: e.z, coast: isLighthouse(this.world, e.x, e.y, e.z), seen: gen, phase: ((e.x * 7 + e.z * 13) % 10) * 0.6 };
        this.lamps.set(key, lamp);
      }
      lamp.seen = gen;
    }
    this.order.length = 0;
    for (const [key, lamp] of this.lamps) {
      if (lamp.seen !== gen) this.lamps.delete(key);
      else this.order.push(lamp);
    }
    const cx = this.camX;
    const cz = this.camZ;
    this.order.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  }
}
