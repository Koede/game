/**
 * The moving parts of each animated machine (spec 14 "machines alive in the world"), built with ModelBuilder in the
 * model frame (origin at the centre of the block's bottom face, front towards -Z), and how fast each one turns.
 * Sizes are chosen to read on a phone screen from across a base: thick blades with red tips, a wheel that reaches
 * well past its housing, a flywheel and piston rod beside the engine.
 */
import { machine } from '../../core/registry';
import type { BlockEntity } from '../../core/types';
import { IDENTITY, ModelBuilder, Motion, rotX, rotY, type Finish, type PartModel } from './model';

const finish = (tile: string, r: number, g: number, b: number): Finish => ({ tile, tint: [r, g, b] });
// 'concrete' is a quiet light-grey tile: tinted, it gives painted metal with a little pixel grain.
const STEEL = finish('concrete', 0.68, 0.72, 0.78);
const DARK = finish('concrete', 0.34, 0.35, 0.39);
const WHITE = finish('concrete', 1.32, 1.32, 1.28);
const RED = finish('concrete', 1.3, 0.42, 0.32);
const BRASS = finish('concrete', 1.3, 1.02, 0.52);
const COPPER = finish('concrete', 1.22, 0.66, 0.4);
const WOOD = finish('plank', 1, 1, 1);
const DARK_WOOD = finish('oak_log_side', 1, 1, 1);

const HALF_PI = Math.PI / 2;

export interface MachineAnim {
  kind: string;
  build(): PartModel;
  /** Angular speed (rad/s) the parts settle to, from the block entity and the voxel's active flag. */
  speed(e: BlockEntity, active: boolean): number;
  /** The instance's extent (drill string length); 1 when the machine has none. */
  extent?(e: BlockEntity): number;
  /** Bounding sphere about (x + 0.5, y + centerY, z + 0.5) for culling. */
  centerY: number;
  radius: number;
  /** Height above the block's bottom where the light for the parts is probed. */
  probeY: number;
  /** Shake amplitude in blocks while running (the bore rig). */
  shake?: number;
  /** Orient by the water around it instead of the facing (the water wheel). */
  byWater?: boolean;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp01 = (v: number, max = 1): number => (v < 0 ? 0 : v > max ? max : v);

/**
 * Share of a generator's rated output it can deliver right now (its `availW`, potential, not the share the grid
 * takes: a turbine in the wind spins whether or not anything draws on it). Falls back to the active flag.
 */
function outputShare(e: BlockEntity, active: boolean, max = 1): number {
  const rated = machine(e.kind).outputW ?? 0;
  if (typeof e.availW !== 'number' || rated <= 0) return active ? 1 : 0;
  return clamp01(num(e.availW) / rated, max);
}
/** Consumers turn while they work, slower when their network is short (f). */
function workShare(e: BlockEntity, active: boolean): number {
  if (!active) return 0;
  return typeof e.f === 'number' ? 0.35 + 0.65 * clamp01(e.f) : 1;
}

function windTurbine(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Static)
    .box([0, 1.04, 0.04], [0.38, 0.08, 0.38], DARK)
    .box([0, 1.75, 0.04], [0.16, 1.44, 0.16], STEEL)
    .box([0, 2.47, 0.06], [0.3, 0.3, 0.74], WHITE)
    .box([0, 2.47, 0.45], [0.2, 0.2, 0.06], DARK);
  // The rotor turns about the axis pointing out of the block's front.
  b.assembly([0, 2.47, -0.36], IDENTITY, Motion.Spin)
    .box([0, 0, -0.04], [0.22, 0.22, 0.16], WHITE)
    .box([0, 0, -0.16], [0.12, 0.12, 0.1], RED);
  const pitch = rotY(0.32);
  b.ring(3, [0, 0.36, 0], [0.16, 0.46, 0.05], WHITE, pitch)
    .ring(3, [0, 0.88, 0], [0.12, 0.6, 0.04], WHITE, pitch)
    .ring(3, [0, 1.29, 0], [0.1, 0.22, 0.04], RED, pitch);
  return b.build();
}

/**
 * The wheel stands in the block with its axle across it, so its paddles reach 0.4 out of the top, bottom and two
 * opposite sides (into the water around it). Built with the axle along X; the instance turns it to the water.
 */
function waterWheel(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0.5, 0], rotY(HALF_PI), Motion.Spin)
    .box([0, 0, 0], [0.16, 0.16, 1.22], DARK)
    .box([0, 0, 0.58], [0.32, 0.32, 0.07], STEEL)
    .box([0, 0, -0.58], [0.32, 0.32, 0.07], STEEL)
    .ring(12, [0, 0.8, 0], [0.43, 0.08, 0.56], DARK_WOOD)
    .ring(8, [0, 0.42, 0], [0.07, 0.76, 0.1], DARK_WOOD, IDENTITY, Math.PI / 8)
    .ring(8, [0, 0.72, 0], [0.06, 0.36, 0.62], WOOD);
  return b.build();
}

/** A flywheel on the engine's right flank, driving a piston rod back and forth out of a cylinder at the front. */
function steamEngine(): PartModel {
  const b = new ModelBuilder();
  const wheelY = 0.52;
  const wheelZ = 0.12;
  b.assembly([0, 0, 0], IDENTITY, Motion.Static)
    .box([0.62, wheelY, -0.37], [0.18, 0.22, 0.27], COPPER)
    .box([0.56, wheelY, wheelZ], [0.06, 0.12, 0.12], DARK);
  // Axle along +X: local x is world -Z, so a crank pin at local +x sits at z = wheelZ - r cos(angle).
  b.assembly([0.63, wheelY, wheelZ], rotY(HALF_PI), Motion.Spin)
    .ring(10, [0, 0.35, 0], [0.24, 0.09, 0.1], DARK)
    .box([0, 0, 0], [0.05, 0.66, 0.05], STEEL)
    .box([0, 0, 0], [0.66, 0.05, 0.05], STEEL)
    .box([0, 0, 0], [0.13, 0.13, 0.14], STEEL)
    .box([0.18, 0, 0.09], [0.07, 0.07, 0.08], BRASS);
  // The rod slides along Z by 0.18 sin(angle - pi/2) = -0.18 cos(angle): in step with the pin.
  b.assembly([0.72, wheelY, wheelZ], rotX(HALF_PI), Motion.Slide, 0.18, -HALF_PI)
    .box([0, -0.32, 0], [0.05, 0.6, 0.05], STEEL)
    .box([0, 0, 0], [0.08, 0.08, 0.09], BRASS);
  return b.build();
}

/** A bladed rotor spinning just proud of the turbine's front, inside a static shroud. */
function steamTurbine(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0.5, -0.53], IDENTITY, Motion.Static).ring(12, [0, 0.37, 0], [0.2, 0.05, 0.05], DARK);
  b.assembly([0, 0.5, -0.53], IDENTITY, Motion.Spin)
    .box([0, 0, -0.01], [0.15, 0.15, 0.06], BRASS)
    .ring(8, [0, 0.2, 0], [0.09, 0.27, 0.02], STEEL, rotY(0.55));
  return b.build();
}

/**
 * The bore rig: a derrick on top with a turning kelly and gear, and below it the drill string down the shaft it
 * has bored, ending in a fluted bit in the last block mined. Drill axis: straight down through the block centre.
 */
function boreRig(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Static)
    .box([0.36, 1.36, 0], [0.08, 0.72, 0.08], DARK)
    .box([-0.36, 1.36, 0], [0.08, 0.72, 0.08], DARK)
    .box([0, 1.74, 0], [0.84, 0.08, 0.14], DARK);
  // Local z points down the shaft (rotX(pi/2) maps +z to -y).
  const down = rotX(HALF_PI);
  b.assembly([0, 0, 0], down, Motion.Spin)
    .box([0, 0, -1.34], [0.16, 0.16, 0.72], STEEL)
    .box([0, 0, -1.08], [0.46, 0.46, 0.08], BRASS)
    .box([0, 0, -1.08], [0.58, 0.08, 0.06], BRASS)
    .box([0, 0, -1.08], [0.08, 0.58, 0.06], BRASS);
  // Modelled one block long; the shader stretches it to the extent.
  b.assembly([0, 0, 0], down, Motion.Stretch)
    .box([0, 0, 0.5], [0.14, 0.14, 1], STEEL)
    .box([0.1, 0, 0.5], [0.05, 0.03, 1], DARK)
    .box([-0.1, 0, 0.5], [0.05, 0.03, 1], DARK);
  b.assembly([0, 0, 0], down, Motion.Follow)
    .box([0, 0, 1.18], [0.28, 0.28, 0.36], DARK)
    .box([0, 0, 1.24], [0.44, 0.07, 0.14], STEEL)
    .box([0, 0, 1.24], [0.07, 0.44, 0.14], STEEL)
    .box([0, 0, 1.42], [0.12, 0.12, 0.12], BRASS);
  return b.build();
}

/** A cylinder on the pump's top and a rod that bobs gently in it. */
function pump(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Static)
    .box([0, 1.08, 0.06], [0.42, 0.16, 0.42], DARK)
    .box([0, 1.3, 0.06], [0.26, 0.3, 0.26], STEEL)
    .box([0, 1.46, 0.06], [0.3, 0.04, 0.3], DARK);
  b.assembly([0, 1.58, 0.06], IDENTITY, Motion.Slide, 0.09)
    .box([0, 0, 0], [0.08, 0.34, 0.08], BRASS)
    .box([0, 0.19, 0], [0.22, 0.06, 0.22], STEEL);
  return b.build();
}

/** Every animated machine kind. */
export const MACHINE_ANIMS: readonly MachineAnim[] = [
  {
    kind: 'wind_turbine', build: windTurbine, centerY: 2.2, radius: 1.75, probeY: 2.4,
    // A storm can push a turbine past its rating (WEATHER_WIND): it spins faster still.
    speed: (e, active) => 3.4 * outputShare(e, active, 1.5),
  },
  {
    kind: 'water_wheel', build: waterWheel, centerY: 0.5, radius: 1.1, probeY: 1.2, byWater: true,
    speed: (e, active) => 1.5 * outputShare(e, active),
  },
  {
    kind: 'steam_engine', build: steamEngine, centerY: 0.5, radius: 1, probeY: 0.6,
    speed: (e, active) => 7 * outputShare(e, active),
  },
  {
    kind: 'steam_turbine', build: steamTurbine, centerY: 0.5, radius: 0.9, probeY: 0.5,
    speed: (e, active) => 14 * outputShare(e, active),
  },
  {
    kind: 'bore_rig', build: boreRig, centerY: 0.9, radius: 1.2, probeY: 1.5, shake: 0.012,
    speed: (e, active) => 6 * workShare(e, active),
    // From the block's bottom to just inside the last block mined (a bit's length shorter: the bit follows it).
    extent: (e) => Math.max(0.05, e.y - (typeof e.depthY === 'number' ? e.depthY : e.y) - 0.55),
  },
  {
    kind: 'pump', build: pump, centerY: 1.2, radius: 0.8, probeY: 1.3,
    speed: (e, active) => 3.2 * workShare(e, active),
  },
];
