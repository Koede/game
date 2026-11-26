/**
 * The power grid overlay (docs/api/grid-overlay.md): while the player holds a Grid Meter, or stands near a Grid Monitor,
 * every cable of the grid is drawn as a bright core through whatever hides it, coloured by how hard it works - green,
 * amber, red once the grid is overloaded - and every machine on it as a faint box: cyan for sources, violet for storage,
 * green for consumers that get what they ask and red for those that do not (a brown-out). Two instanced draws; the
 * instances are rewritten when the simulation ticks, never per frame; only the brown-out pulse moves every frame.
 */
import * as THREE from 'three';
import type { GridCell } from '../../sim';
import type { ColorMode } from '../../core/context';
import { LOAD_RAMPS, rampRgb01 } from '../../ui/kit/palette';

/** Cells drawn at most per kind of draw (cables / machines). */
export const GRID_CABLE_CAP = 2048;
export const GRID_NODE_CAP = 512;

const CABLE_SIZE = 0.34;
const NODE_SIZE = 1.06;

const OK = new THREE.Color(0x58e07a);
const BUSY = new THREE.Color(0xf0b440);
const HOT = new THREE.Color(0xe8503c);
const SOURCE = new THREE.Color(0x4ad0ff);
const STORAGE = new THREE.Color(0xa070f0);

/**
 * Colour of a cable (or a healthy consumer) at `load` 0..1 on a grid in `state`. Written into `out`. With a colour-blind
 * `mode` the ok / busy / overloaded stops come from LOAD_RAMPS (src/ui/kit/palette.ts) instead of green / amber / red.
 */
export function loadColour(load: number, state: GridCell['state'], out: THREE.Color, mode: ColorMode = 'off'): THREE.Color {
  if (mode !== 'off') {
    const ramp = LOAD_RAMPS[mode];
    const at = (t: number): THREE.Color => out.setRGB(...rampRgb01(ramp, t));
    if (state === 'overload') return at(1);
    if (state === 'brownout') return at(0.75);
    if (load < 0.6) return at(0);
    if (load < 0.9) return at((load - 0.6) / 0.3 * 0.5);
    return at(0.5 + Math.min(1, (load - 0.9) / 0.1) * 0.5);
  }
  if (state === 'overload') return out.copy(HOT);
  if (state === 'brownout') return out.copy(BUSY).lerp(HOT, 0.5);
  if (load < 0.6) return out.copy(OK);
  if (load < 0.9) return out.copy(OK).lerp(BUSY, (load - 0.6) / 0.3);
  return out.copy(BUSY).lerp(HOT, Math.min(1, (load - 0.9) / 0.1));
}

function layer(cap: number, size: number, opacity: number, order: number): THREE.InstancedMesh {
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity, depthTest: false, depthWrite: false });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), material, cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 5;
  mesh.name = `grid-overlay-${order}`;
  return mesh;
}

export class GridOverlay {
  /** Settings.colorMode; the instance colours are rewritten when it changes. */
  colorMode: ColorMode = 'off';
  private writtenMode: ColorMode = 'off';
  readonly group = new THREE.Group();
  /** Cells drawn (cables + machines). */
  drawn = 0;
  private readonly cables = layer(GRID_CABLE_CAP, CABLE_SIZE, 0.85, 0);
  private readonly nodes = layer(GRID_NODE_CAP, NODE_SIZE, 0.3, 1);
  private readonly colour = new THREE.Color();
  private readonly m = new THREE.Matrix4();
  private tick = -1;
  private problem = false;
  private time = 0;

  constructor() {
    this.group.add(this.cables, this.nodes);
    this.group.name = 'grid-overlay';
  }

  /** One frame. `cells` null hides the overlay; `tick` changes when the simulation moved on. */
  update(dt: number, feed: { tick: number; cells: readonly GridCell[] } | null): void {
    if (feed === null) {
      if (this.drawn > 0 || this.cables.visible) this.clear();
      this.tick = -1;
      return;
    }
    this.time += dt;
    if (feed.tick !== this.tick || this.colorMode !== this.writtenMode) {
      this.tick = feed.tick;
      this.writtenMode = this.colorMode;
      this.write(feed.cells);
    }
    // A grid in trouble breathes: the one thing that moves between ticks.
    const pulse = this.problem ? 0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * 1.6) : 1;
    (this.cables.material as THREE.MeshBasicMaterial).opacity = this.problem ? 0.55 + 0.4 * pulse : 0.85;
    (this.nodes.material as THREE.MeshBasicMaterial).opacity = this.problem ? 0.18 + 0.2 * pulse : 0.3;
  }

  dispose(): void {
    for (const mesh of [this.cables, this.nodes]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }

  private clear(): void {
    this.drawn = 0;
    this.cables.count = 0;
    this.nodes.count = 0;
    this.cables.visible = false;
    this.nodes.visible = false;
  }

  private write(cells: readonly GridCell[]): void {
    let nc = 0;
    let nn = 0;
    this.problem = false;
    for (const c of cells) {
      if (c.state !== 'ok' || c.short) this.problem = true;
      const isCable = c.kind === 'cable';
      const mesh = isCable ? this.cables : this.nodes;
      const i = isCable ? nc : nn;
      if (i >= (isCable ? GRID_CABLE_CAP : GRID_NODE_CAP)) continue;
      if (isCable) nc++;
      else nn++;
      this.m.makeTranslation(c.x + 0.5, c.y + 0.5, c.z + 0.5);
      mesh.setMatrixAt(i, this.m);
      if (c.kind === 'source') this.colour.copy(SOURCE);
      else if (c.kind === 'storage') this.colour.copy(STORAGE);
      else if (c.short) loadColour(1, 'overload', this.colour, this.colorMode);
      else loadColour(c.load, c.state, this.colour, this.colorMode);
      mesh.setColorAt(i, this.colour);
    }
    this.cables.count = nc;
    this.nodes.count = nn;
    this.cables.visible = nc > 0;
    this.nodes.visible = nn > 0;
    this.cables.instanceMatrix.needsUpdate = true;
    this.nodes.instanceMatrix.needsUpdate = true;
    if (this.cables.instanceColor) this.cables.instanceColor.needsUpdate = true;
    if (this.nodes.instanceColor) this.nodes.instanceColor.needsUpdate = true;
    this.drawn = nc + nn;
  }
}
