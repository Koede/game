/**
 * The liquids of brewing, animated (BREWING_PLAN 6, docs/api/glass.md "Liquids"): the drink filling a cup under a falling
 * stream from the cone, water in a bucket, beaker or vial heating to a rolling boil, sap cooking to resin, the kettle's
 * boiling water under its pushed-aside lid. Their colours and levels come from the entities, which the chunk mesher
 * cannot see, so they are drawn here: one LiquidBoxes (one draw call), rebuilt four times a second from the brewing
 * entities near the camera (brewBodies.ts says which bodies each shows); the motion itself runs in the shader.
 */
import * as THREE from 'three';
import { KETTLE_MACHINE, BOIL_BUCKET_MACHINE, BREW_CUP_MACHINE } from '../core/brewing';
import { itemOrNull } from '../core/registry';
import { voxelActive, type BlockEntity, type IWorld } from '../core/types';
import { brewBodies, type Body, type BrewLook } from './brewBodies';
import type { LightProbe } from './emitters';
import { LiquidBoxes } from './liquids/liquidBoxes';

export const LIQUID_RANGE = 48;
/** Most bodies drawn (a cup is two while it brews). */
export const LIQUID_CAPACITY = 96;
const INTERVAL_S = 0.25;
/** Liquid reads a touch brighter than the clay and wood round it. */
const LIFT = 0.15;

const light = new Float32Array(3);
const col = new THREE.Color();
const FLOW_DOWN: readonly [number, number, number] = [0, -1, 0];
const STILL: readonly [number, number, number] = [0, 0, 0];

export class BrewLiquid {
  readonly liquids = new LiquidBoxes(LIQUID_CAPACITY, 'brew-liquid');
  readonly mesh = this.liquids.mesh;
  private timer = 0;
  private clock = 0;
  private cx = 0;
  private cy = 0;
  private cz = 0;
  private readonly body: Body = { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, colour: 0, flowY: 0, speed: 0, boil: 0, surface: false };
  private readonly look: BrewLook = { drinkColour: null, boilScale: 1, holds: 'water', active: false };
  private readonly style = { flow: STILL, speed: 0, boil: 0, surface: false };
  private readonly emit = (b: Body): void => this.add(b);

  constructor(private readonly world: IWorld, private readonly probe: LightProbe) {}

  /** Bodies drawn at the last rebuild (tests, stats). */
  get count(): number {
    return this.liquids.count;
  }

  update(dt: number, camX: number, camZ: number): void {
    this.clock = (this.clock + dt) % 3600;
    this.liquids.tick(this.clock);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = INTERVAL_S;
    this.liquids.begin();
    for (const e of this.world.entities()) {
      if (e.kind !== BREW_CUP_MACHINE && e.kind !== BOIL_BUCKET_MACHINE && e.kind !== KETTLE_MACHINE) continue;
      const dx = e.x + 0.5 - camX;
      const dz = e.z + 0.5 - camZ;
      if (dx * dx + dz * dz > LIQUID_RANGE * LIQUID_RANGE) continue;
      if (this.liquids.count >= LIQUID_CAPACITY - 1) break;
      this.lookOf(e);
      this.cx = e.x;
      this.cy = e.y;
      this.cz = e.z;
      brewBodies(e, this.look, this.body, this.emit);
    }
    this.liquids.end();
  }

  private lookOf(e: BlockEntity): void {
    const l = this.look;
    l.drinkColour = null;
    l.boilScale = 1;
    l.holds = 'water';
    l.active = false;
    if (e.kind === BREW_CUP_MACHINE) {
      l.drinkColour = typeof e.drink === 'string' ? itemOrNull(e.drink)?.drink?.colour ?? null : null;
    } else if (e.kind === BOIL_BUCKET_MACHINE) {
      const spec = typeof e.container === 'string' ? itemOrNull(e.container)?.container : undefined;
      l.boilScale = spec?.boilScale ?? 1;
      l.holds = spec?.holds ?? 'water';
    } else l.active = voxelActive(this.world.getVoxel(e.x, e.y, e.z));
  }

  private add(b: Body): void {
    const x = this.cx + b.x;
    const y = this.cy + b.y;
    const z = this.cz + b.z;
    const l = this.probe(x, y + b.sy, z, light);
    // Raw channel values like the chunk textures (the renderer outputs linear), not setHex's sRGB-to-linear conversion.
    const c = b.colour;
    col.setRGB((((c >> 16) & 255) / 255) * Math.min(1, l[0] + LIFT), (((c >> 8) & 255) / 255) * Math.min(1, l[1] + LIFT), ((c & 255) / 255) * Math.min(1, l[2] + LIFT));
    const s = this.style;
    s.flow = b.speed > 0 ? FLOW_DOWN : STILL;
    s.speed = b.speed;
    s.boil = b.boil;
    s.surface = b.surface;
    this.liquids.add(x, y, z, b.sx, b.sy, b.sz, col, s);
  }

  dispose(): void {
    this.liquids.dispose();
  }
}
