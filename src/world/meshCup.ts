/**
 * The brewing shapes (BREWING_PLAN 6), small boxes standing on the floor of their cell like the torch:
 *  - 'cup': a hollow 6/16 wide, 5/16 tall cup; every stage but the bare cup adds a drip cone, an inverted stepped cone
 *    that makes the whole thing 10/16 tall, its spout a pixel above the rim so the drip shows. The drink is not here:
 *    its tint comes from the entity, so the renderer draws it (src/render/brewLiquid.ts) inside the cup.
 *  - 'bucket': a 10/16 wide, 8/16 tall pot with a rim; its water is drawn by the renderer too (animated, boiling), over
 *    a still water quad here for when it is out of the renderer's range. The kettle pot (BUCKET_KETTLE) has a shoulder
 *    round an opening and a lid with a knob; while it boils the lid sits pushed aside and the boiling water shows.
 * Textures are cut-out sprites, so both go in the cutout batch and sample the part of the tile they cover.
 */
import { Face, LIGHT_FLAG_LIQUID, voxelActive } from '../core/types';
import { BUCKET_BOILING, BUCKET_KETTLE, BUCKET_KIND, CUP_STAGE, FACE_LAYER } from './blockTables';
import { box, pushQuad, QBlock, QFlags, QShade, QSky, QU, QV, QX, QY, QZ, lit, cellCoolBits, type Builder } from './meshQuads';

/** Stage numbers as CUP_STAGE holds them (1 + index in CUP_STAGES). */
const STAGE_CONE = 2;

export const CUP_MIN = 5 / 16;
export const CUP_MAX = 11 / 16;
/** Height of the cup body: the cone starts here and the drink's liquid lies a hair above it. */
export const CUP_RIM_Y = 5 / 16;
/** Top of a cup with its cone. */
export const CUP_CONE_TOP = 10 / 16;
/** The cup is hollow: a 1/16 floor and 1/16 walls, so its inside is CUP_INNER_MIN..CUP_INNER_MAX from CUP_FLOOR_Y. */
export const CUP_FLOOR_Y = 1 / 16;
export const CUP_INNER_MIN = 6 / 16;
export const CUP_INNER_MAX = 10 / 16;
/** Bottom of the cone's spout: the drip falls from here into the cup. */
export const CUP_SPOUT_Y = 6 / 16;
/** The kettle's opening under its lid, and the top of the shoulder round it. */
export const KETTLE_HOLE_MIN = 5 / 16;
export const KETTLE_HOLE_MAX = 11 / 16;
export const KETTLE_SHOULDER_TOP = 8 / 16;

const SKIP_BOTTOM = 1 << Face.NY;
const SKIP_TOP = 1 << Face.PY;
const lo = [0, 0, 0];
const hi = [0, 0, 0];
const slo = [0, 0, 0];
const shi = [0, 0, 0];

function span(x0: number, y0: number, x1: number, y1: number): void {
  lo[0] = lo[2] = x0 / 16;
  hi[0] = hi[2] = x1 / 16;
  lo[1] = y0 / 16;
  hi[1] = y1 / 16;
}

/**
 * Four walls `t` thick round the square a..c (16ths, x and z) from y0 to y1: open at the top and the bottom. Their sides
 * sample the tile `uvDy` 16ths lower than they stand (the cup's walls skip the sprite's mouth row).
 */
function ring(b: Builder, slot: number, p: number, x: number, y: number, z: number, a: number, c: number, y0: number, y1: number, t: number, uvDy = 0): void {
  const walls = [[a, a, c, a + t], [a, c - t, c, c], [a, a + t, a + t, c - t], [c - t, a + t, c, c - t]];
  for (const [x0, z0, x1, z1] of walls) {
    lo[0] = x0 / 16; lo[1] = y0 / 16; lo[2] = z0 / 16;
    hi[0] = x1 / 16; hi[1] = y1 / 16; hi[2] = z1 / 16;
    slo[0] = lo[0]; slo[1] = lo[1] - uvDy / 16; slo[2] = lo[2];
    shi[0] = hi[0]; shi[1] = hi[1] - uvDy / 16; shi[2] = hi[2];
    box(b, slot, p, x, y, z, lo, hi, 0, 0, slo, shi);
  }
}

/** slo..shi = lo..hi moved `dx` along x. */
function shifted(dx: number): void {
  slo[0] = lo[0] + dx; slo[1] = lo[1]; slo[2] = lo[2];
  shi[0] = hi[0] + dx; shi[1] = hi[1]; shi[2] = hi[2];
}

/** A box from (x0, z0) to (x1, z1), y0..y1, in 16ths. */
function at(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  lo[0] = x0 / 16; lo[1] = y0 / 16; lo[2] = z0 / 16;
  hi[0] = x1 / 16; hi[1] = y1 / 16; hi[2] = z1 / 16;
}

export function cup(b: Builder, slot: number, id: number, p: number, x: number, y: number, z: number): void {
  const stage = CUP_STAGE[id];
  // A floor and four walls.
  span(5, 0, 11, 1);
  box(b, slot, p, x, y, z, lo, hi, SKIP_BOTTOM, 0);
  // The walls' sides sample the sprite's body, not its top row (the mouth, painted empty or full for the icon).
  ring(b, slot, p, x, y, z, 5, 11, 1, 5, 1, 1);
  if (stage < STAGE_CONE) return;
  // The cone's spout, a wider middle and the rim, narrowing downwards. The spout is narrower than the cup's inside so a
  // ring of the drink (drawn by the renderer) shows round it, and stops a pixel above the rim so the drip shows.
  const spout = 1.5;
  span(8 - spout, CUP_SPOUT_Y * 16, 8 + spout, 7);
  box(b, slot, p, x, y, z, lo, hi, SKIP_TOP | SKIP_BOTTOM, 0);
  span(4.5, 7, 11.5, 9);
  box(b, slot, p, x, y, z, lo, hi, 0, 0);
  span(4, 9, 12, 10);
  box(b, slot, p, x, y, z, lo, hi, SKIP_BOTTOM, 0);
}

// The pot: a body, and four rim walls round the open top (the water lies between them).
const BODY_MIN = 3.5 / 16;
const BODY_MAX = 12.5 / 16;
const BODY_TOP = 7 / 16;
const RIM_MIN = 3 / 16;
const RIM_MAX = 13 / 16;
const RIM_TOP = 8 / 16;
const WALL = 1 / 16;
/** The still water quad, under the renderer's animated water (which fills 6/16..7.5/16). */
const WATER_Y = 6.25 / 16;

function slabBox(b: Builder, slot: number, p: number, x: number, y: number, z: number, x0: number, z0: number, x1: number, z1: number, skip: number): void {
  lo[0] = x0; lo[1] = BODY_TOP; lo[2] = z0;
  hi[0] = x1; hi[1] = RIM_TOP; hi[2] = z1;
  box(b, slot, p, x, y, z, lo, hi, skip, 0);
}

/** A horizontal quad at height `h` covering the rim's inside, texture of the block's top face stretched over it. */
function waterTop(b: Builder, slot: number, p: number, x: number, y: number, z: number, h: number, flags: number): void {
  const cell = lit.light[p];
  const cool = cellCoolBits(p);
  const x0 = RIM_MIN + WALL;
  const x1 = RIM_MAX - WALL;
  for (let k = 0; k < 4; k++) {
    QX[k] = x + (k === 0 || k === 3 ? x0 : x1);
    QY[k] = y + h;
    QZ[k] = z + (k < 2 ? x0 : x1);
    QU[k] = k === 0 || k === 3 ? 0 : 1;
    QV[k] = k < 2 ? 0 : 1;
    QSky[k] = (cell >> 4) * 17;
    QBlock[k] = (cell & 15) * 17;
    QShade[k] = 255;
    QFlags[k] = flags | cool;
  }
  pushQuad(b, FACE_LAYER[slot + Face.PY]);
}

export function bucket(b: Builder, slot: number, id: number, v: number, p: number, x: number, y: number, z: number): void {
  const kind = BUCKET_KIND[id];
  lo[0] = lo[2] = BODY_MIN;
  hi[0] = hi[2] = BODY_MAX;
  lo[1] = 0;
  hi[1] = BODY_TOP;
  box(b, slot, p, x, y, z, lo, hi, SKIP_BOTTOM | SKIP_TOP, 0);
  if (kind === BUCKET_KETTLE) {
    // A shoulder round the opening, a lid and a knob. The lit voxel bit means it boils: the lid sits pushed aside (the
    // boiling water, drawn by the renderer, shows in the gap) and the knob shimmers.
    ring(b, slot, p, x, y, z, 3, 13, 7, 8, KETTLE_HOLE_MIN * 16 - 3);
    // The pushed lid samples the texture where the closed lid sits (the sprite is cut out round it).
    const hot = voxelActive(v);
    const shift = hot ? 2 / 16 : 0;
    at(5, 8, 5, 11, 9, 11);
    shifted(shift);
    box(b, slot, p, x, y, z, slo, shi, 0, 0, lo, hi);
    at(7, 9, 7, 9, 10, 9);
    shifted(shift);
    box(b, slot, p, x, y, z, slo, shi, SKIP_BOTTOM, hot ? LIGHT_FLAG_LIQUID : 0, lo, hi);
    return;
  }
  slabBox(b, slot, p, x, y, z, RIM_MIN, RIM_MIN, RIM_MAX, RIM_MIN + WALL, 0);
  slabBox(b, slot, p, x, y, z, RIM_MIN, RIM_MAX - WALL, RIM_MAX, RIM_MAX, 0);
  slabBox(b, slot, p, x, y, z, RIM_MIN, RIM_MIN + WALL, RIM_MIN + WALL, RIM_MAX - WALL, 0);
  slabBox(b, slot, p, x, y, z, RIM_MAX - WALL, RIM_MIN + WALL, RIM_MAX, RIM_MAX - WALL, 0);
  waterTop(b, slot, p, x, y, z, WATER_Y, kind === BUCKET_BOILING ? LIGHT_FLAG_LIQUID : 0);
}
