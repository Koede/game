/**
 * The brewing shapes (BREWING_PLAN 6), small boxes standing on the floor of their cell like the torch:
 *  - 'cup': a 6/16 wide, 5/16 tall cup; every stage but the bare cup adds a drip cone, an inverted stepped cone that
 *    makes the whole thing 10/16 tall. The drink's liquid is not here: its tint comes from the entity, so the
 *    renderer draws it (src/render/brewLiquid.ts) at CUP_RIM_Y.
 *  - 'bucket': a 10/16 wide, 8/16 tall pot with a rim; a boiling one gets a shimmering water top (the liquid flag),
 *    the kettle pot (BUCKET_KETTLE) a lid and a knob instead of open water.
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

const SKIP_BOTTOM = 1 << Face.NY;
const SKIP_TOP = 1 << Face.PY;
const lo = [0, 0, 0];
const hi = [0, 0, 0];

function span(x0: number, y0: number, x1: number, y1: number): void {
  lo[0] = lo[2] = x0 / 16;
  hi[0] = hi[2] = x1 / 16;
  lo[1] = y0 / 16;
  hi[1] = y1 / 16;
}

export function cup(b: Builder, slot: number, id: number, p: number, x: number, y: number, z: number): void {
  const stage = CUP_STAGE[id];
  lo[0] = lo[2] = CUP_MIN;
  hi[0] = hi[2] = CUP_MAX;
  lo[1] = 0;
  hi[1] = CUP_RIM_Y;
  box(b, slot, p, x, y, z, lo, hi, SKIP_BOTTOM, 0);
  if (stage < STAGE_CONE) return;
  // The cone's spout, a wider middle and the rim, narrowing downwards. The spout is narrower than the cup so a ring of
  // the drink (drawn by the renderer) shows round it.
  const spout = 1.5;
  span(8 - spout, 5, 8 + spout, 7);
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
const WATER_Y = 7.5 / 16;

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
    // A closed pot: a full-width shoulder, a lid and a knob. The lit voxel bit means it boils.
    span(3, 7, 13, 8);
    box(b, slot, p, x, y, z, lo, hi, 0, 0);
    span(5, 8, 11, 9);
    box(b, slot, p, x, y, z, lo, hi, SKIP_BOTTOM, 0);
    span(7, 9, 9, 10);
    box(b, slot, p, x, y, z, lo, hi, SKIP_BOTTOM, voxelActive(v) ? LIGHT_FLAG_LIQUID : 0);
    return;
  }
  slabBox(b, slot, p, x, y, z, RIM_MIN, RIM_MIN, RIM_MAX, RIM_MIN + WALL, 0);
  slabBox(b, slot, p, x, y, z, RIM_MIN, RIM_MAX - WALL, RIM_MAX, RIM_MAX, 0);
  slabBox(b, slot, p, x, y, z, RIM_MIN, RIM_MIN + WALL, RIM_MIN + WALL, RIM_MAX - WALL, 0);
  slabBox(b, slot, p, x, y, z, RIM_MAX - WALL, RIM_MIN + WALL, RIM_MAX, RIM_MAX - WALL, 0);
  waterTop(b, slot, p, x, y, z, WATER_Y, kind === BUCKET_BOILING ? LIGHT_FLAG_LIQUID : 0);
}
