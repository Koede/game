/**
 * The moving parts of the hand stations (EMBER_PLAN 2 and 5), built with the machine-parts ModelBuilder in the
 * block's model frame (origin at the centre of the bottom face, front towards -Z, units in blocks). Nothing here
 * runs at a speed: every pose is a function of what the player just did (a stroke event) and of the work done, so a
 * quern stone turns 30 degrees per stroke, a hammer comes down and flashes, a shuttle crosses the loom, a log opens
 * as it is chopped, a rack sways. `HandRec` is the state a record keeps; `PartDef.pose` writes the two numbers the
 * machine shader takes per instance (x = angle, y = pulse) and `visible` says whether the part is drawn at all.
 * Boxes are written in sixteenths of the cell (`b16`) to match src/world/stationShapes.ts.
 */
import { textureLayer } from '../../core/registry';
import { IDENTITY, ModelBuilder, Motion, rotX, rotY, rotZ, type Finish, type M3, type PartModel } from '../machines/model';

export const QUERN_STEP = Math.PI / 6;
/** A stroke's swing lasts this long; a tool is drawn for TOOL_SHOWN_S after the last stroke. */
export const SWING_S = 0.16;
export const TOOL_SHOWN_S = 0.55;

export interface HandRec {
  /** Strokes seen since the record began (events). */
  strokes: number;
  /** Seconds since the last stroke; large when there was none. */
  since: number;
  /** Seconds the game has been drawing (for idle sways). */
  time: number;
  /** Work done, 0..1 (strokes or seconds over what the recipe needs). */
  frac: number;
  loaded: boolean;
  ready: boolean;
  /** Rack content: 0 nothing, 1 green leaves or grass, 2 hide, 3 dried goods. */
  variant: number;
  /** Eased angle (quern stone, loom shuttle): approaches strokes x step. */
  angle: number;
  /** A per-station constant so neighbours do not move in step. */
  phase: number;
}

export interface Pose {
  x: number;
  y: number;
}

export interface PartDef {
  name: string;
  build(): PartModel;
  visible(r: HandRec): boolean;
  pose(r: HandRec, out: Pose): void;
}

export interface HandAnim {
  /** Block keys this animation belongs to. */
  stations: readonly string[];
  /** Radians the record's `angle` advances per stroke (it eases there): the quern's 30 degrees, the loom's half turn. */
  turn?: number;
  centerY: number;
  radius: number;
  probeY: number;
  parts: readonly PartDef[];
}

/** A tile when the atlas has it, else the stand-in (stations' own tiles come with the content). */
const tile = (name: string, fallback: string): string => (textureLayer(name) !== 0 ? name : fallback);
const finish = (t: string, r: number, g: number, b: number): Finish => ({ tile: t, tint: [r, g, b] });
const stone = (): Finish => finish(tile('stone', 'concrete'), 0.9, 0.9, 0.92);
const WOOD = finish('plank', 1, 1, 1);
const LOG = finish('oak_log_side', 1, 1, 1);
const DARK = finish('concrete', 0.3, 0.3, 0.34);
const IRON = finish('concrete', 0.55, 0.56, 0.62);
const FLASH = finish('concrete', 3.2, 2.5, 1.3);
const CLOTH = finish('concrete', 1.5, 1.42, 1.15);
const CLAY = finish(tile('clay', 'concrete'), 1, 0.85, 0.75);
const HIDE = finish('concrete', 1.05, 0.66, 0.42);
const WATER = finish('concrete', 0.5, 0.75, 1.3);
const LEAF = finish('concrete', 0.55, 1.05, 0.4);
const DRIED = finish('concrete', 1.3, 1.1, 0.65);

const centre = (n: number): number => n / 16 - 0.5;
/** A box from sixteenths [x0,y0,z0]-[x1,y1,z1] as (centre, size) in blocks, relative to the cell centre / floor. */
function b16(b: ModelBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, f: Finish): void {
  b.box([centre((x0 + x1) / 2), (y0 + y1) / 32, centre((z0 + z1) / 2)], [(x1 - x0) / 16, (y1 - y0) / 16, (z1 - z0) / 16], f);
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 -> peak (at `up`) -> 0 (at `up + down`): a stroke's rise and fall. */
export function swing(since: number, up = 0.07, down = 0.09): number {
  if (since < up) return since / up;
  const t = (since - up) / down;
  return t >= 1 ? 0 : (1 - t) * (1 - t);
}
/** 1 at `at`, easing to 0 over `len` after it (the flash of an impact). */
export function flash(since: number, at: number, len: number): number {
  return since < at ? 0 : clamp01(1 - (since - at) / len);
}
const recent = (r: HandRec): boolean => r.since < TOOL_SHOWN_S;

/** Local frame whose Z axis points up, so Spin turns a part about the world's vertical axis. */
const UP: M3 = rotX(-Math.PI / 2);

/** A tool lying on a surface, hinged at its handle end: Spin about world Z (positive lifts +X; `flip` mirrors it). */
function arm(b: ModelBuilder, origin: [number, number, number], flip: boolean, handle: number, head: [number, number, number], headAt: number, f: Finish, headF: Finish): void {
  b.assembly(origin, flip ? rotY(Math.PI) : IDENTITY, Motion.Spin);
  b.box([handle / 2, 0, 0], [handle, 0.05, 0.05], f);
  b.box([headAt, head[1] / 2 - 0.025, 0], head, headF);
}

// --- Hand Quern: the runner stone turns 30 degrees per stroke -----------------------------------------------

function quernRunner(): PartModel {
  const b = new ModelBuilder();
  const top = finish(tile('hand_quern_top', 'stone'), 0.9, 0.9, 0.92);
  // An octagon: a square and the same square turned 45 degrees, standing on the bedstone's lip.
  b.assembly([0, 7 / 16, 0], UP, Motion.Spin)
    .box([0, 0, 0.125], [0.62, 0.62, 0.25], top)
    .box([0, 0, 0.125], [0.62, 0.62, 0.25], top, rotZ(Math.PI / 4))
    .box([0, 0, 0.255], [0.12, 0.12, 0.02], DARK)
    .box([0.22, 0, 0.35], [0.07, 0.07, 0.2], WOOD)
    .box([0.22, 0, 0.47], [0.13, 0.05, 0.05], WOOD);
  return b.build();
}

const QUERN: HandAnim = {
  stations: ['hand_quern'],
  centerY: 0.5, radius: 0.9, probeY: 0.6,
  turn: QUERN_STEP,
  parts: [{ name: 'runner', build: quernRunner, visible: () => true, pose: (r, o) => { o.x = r.angle; o.y = 0; } }],
};

// --- Stone Anvil: the hammer comes down, the face flashes ----------------------------------------------------

function hammer(): PartModel {
  const b = new ModelBuilder();
  // Lying along the anvil's face, hinged at the handle's end; the head is a block of iron on its far end.
  arm(b, [-0.4, 0.775, 0], false, 0.5, [0.2, 0.2, 0.17], 0.6, WOOD, IRON);
  return b.build();
}
function anvilFlash(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Pulse, 0.07).box([0.2, 0.71, 0], [0.36, 0.02, 0.2], FLASH);
  return b.build();
}
const ANVIL: HandAnim = {
  stations: ['stone_anvil'],
  centerY: 0.8, radius: 0.9, probeY: 0.9,
  parts: [
    { name: 'hammer', build: hammer, visible: recent, pose: (r, o) => { o.x = 1.15 * swing(r.since); o.y = 0; } },
    { name: 'flash', build: anvilFlash, visible: (r) => r.since < 0.3, pose: (r, o) => { o.x = 0; o.y = flash(r.since, 0.14, 0.14); } },
  ],
};

// --- Chopping Block: the axe falls, the log opens as it is split --------------------------------------------

function axe(): PartModel {
  const b = new ModelBuilder();
  // Hinged on the block's right edge, handle running left over the log; the blade is thin in X and wide in Z.
  arm(b, [0.42, 0.73, 0], true, 0.56, [0.06, 0.24, 0.13], 0.58, WOOD, IRON);
  return b.build();
}
function logHalves(): PartModel {
  const b = new ModelBuilder();
  // Two half logs lying along Z on the stump. Pulse moves along local Y, which each half's frame turns to +-X (and
  // local X to +-world Y, hence the centre (height, offset)): the halves slide apart as the crack opens.
  for (const side of [-1, 1] as const) {
    b.assembly([0, 0, 0], rotZ(-side * Math.PI / 2), Motion.Pulse, 0.05);
    b.box([-side * 0.84, 0.075, 0], [0.3, 0.15, 0.5], LOG);
  }
  return b.build();
}
const CHOP: HandAnim = {
  stations: ['chopping_block', 'chopping_block_pine'],
  centerY: 0.8, radius: 1, probeY: 0.9,
  parts: [
    { name: 'axe', build: axe, visible: recent, pose: (r, o) => { o.x = 1.2 * swing(r.since, 0.08, 0.1); o.y = 0; } },
    { name: 'log', build: logHalves, visible: (r) => r.loaded, pose: (r, o) => { o.x = 0; o.y = clamp01(r.frac) * 0.6 + swing(r.since, 0.05, 0.14) * 0.4; } },
  ],
};

// --- Loom: the shuttle crosses once per stroke; the cloth rises --------------------------------------------

function shuttle(): PartModel {
  const b = new ModelBuilder();
  // Local Y is world +X: the shuttle slides along the warp, cos(angle) x 0.3.
  b.assembly([0, 0.5, -0.01], rotZ(-Math.PI / 2), Motion.Slide, 0.3, Math.PI / 2)
    .box([0, 0, 0], [0.07, 0.3, 0.1], WOOD)
    .box([0, 0, 0], [0.04, 0.34, 0.06], CLOTH);
  return b.build();
}
function cloth(): PartModel {
  const b = new ModelBuilder();
  // Woven cloth coming up out of the bottom beam: starts hidden below the floor line, rises to fill the frame.
  b.assembly([0, 0, 0], IDENTITY, Motion.Pulse, 0.62);
  b.box([0, 0.0, 0.1], [0.58, 0.34, 0.04], CLOTH);
  return b.build();
}
const LOOM: HandAnim = {
  stations: ['loom'],
  centerY: 0.5, radius: 1, probeY: 0.6,
  turn: Math.PI,
  parts: [
    { name: 'shuttle', build: shuttle, visible: () => true, pose: (r, o) => { o.x = r.angle; o.y = 0; } },
    { name: 'cloth', build: cloth, visible: (r) => r.loaded && r.frac > 0.04, pose: (r, o) => { o.x = 0; o.y = clamp01(r.frac); } },
  ],
};

// --- Mortar: the pestle lifts and drops ----------------------------------------------------------------------

function pestle(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Pulse, 0.14)
    .box([0, 0.55, 0], [0.12, 0.7, 0.12], LOG)
    .box([0, 0.24, 0], [0.17, 0.13, 0.17], stone());
  return b.build();
}
const MORTAR: HandAnim = {
  stations: ['mortar'],
  centerY: 0.6, radius: 0.8, probeY: 0.7,
  parts: [{ name: 'pestle', build: pestle, visible: () => true, pose: (r, o) => { o.x = 0; o.y = swing(r.since, 0.08, 0.12); } }],
};

// --- Clay Table: a lump on the board, pressed by a smoothing stick ---------------------------------------------

function lump(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Static);
  b16(b, 4, 12, 4, 12, 16, 11, CLAY);
  b16(b, 5, 16, 5, 11, 17, 10, CLAY);
  return b.build();
}
function stick(): PartModel {
  const b = new ModelBuilder();
  arm(b, [-0.45, 1.03, 0.02], false, 0.55, [0.07, 0.07, 0.07], 0.5, WOOD, WOOD);
  return b.build();
}
const CLAY_TABLE: HandAnim = {
  stations: ['clay_table'],
  centerY: 0.8, radius: 0.9, probeY: 0.9,
  parts: [
    { name: 'lump', build: lump, visible: (r) => r.loaded, pose: (_r, o) => { o.x = 0; o.y = 0; } },
    { name: 'stick', build: stick, visible: recent, pose: (r, o) => { o.x = 0.55 * swing(r.since, 0.06, 0.1); o.y = 0; } },
  ],
};

// --- Drying Rack: bundles hang from the pole and sway ---------------------------------------------------------

function bundles(f: Finish): PartModel {
  const b = new ModelBuilder();
  for (const [x, ratio, h] of [[-0.27, 1, 0.3], [0, -0.7, 0.26], [0.27, 0.85, 0.3]] as const) {
    b.assembly([x, 0.75, 0], IDENTITY, Motion.Spin, ratio);
    b.box([0, -h / 2, 0], [0.15, h, 0.1], f);
    b.box([0, -0.01, 0], [0.04, 0.02, 0.04], DARK);
  }
  return b.build();
}
const rackPart = (name: string, variant: number, f: Finish): PartDef => ({
  name, build: () => bundles(f), visible: (r) => r.variant === variant,
  pose: (r, o) => { o.x = 0.14 * Math.sin(r.time * 1.3 + r.phase); o.y = 0; },
});
const RACK: HandAnim = {
  stations: ['drying_rack'],
  centerY: 0.6, radius: 0.9, probeY: 0.6,
  parts: [rackPart('leaves', 1, LEAF), rackPart('hide', 2, HIDE), rackPart('dried', 3, DRIED)],
};

// --- Tanning Trough: water in the trough and the hide soaking in it ------------------------------------------

function water(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Static);
  b16(b, 3, 2, 4, 13, 6, 12, WATER);
  return b.build();
}
function soaking(): PartModel {
  const b = new ModelBuilder();
  b.assembly([0, 0, 0], IDENTITY, Motion.Static);
  b16(b, 4, 5, 5, 12, 7, 11, HIDE);
  return b.build();
}
const TROUGH: HandAnim = {
  stations: ['tanning_trough'],
  centerY: 0.3, radius: 0.9, probeY: 0.5,
  parts: [
    { name: 'water', build: water, visible: () => true, pose: (_r, o) => { o.x = 0; o.y = 0; } },
    { name: 'hide', build: soaking, visible: (r) => r.loaded || r.ready, pose: (_r, o) => { o.x = 0; o.y = 0; } },
  ],
};

/** Every animated station. */
export const HAND_ANIMS: readonly HandAnim[] = [QUERN, ANVIL, CHOP, LOOM, MORTAR, CLAY_TABLE, RACK, TROUGH];
