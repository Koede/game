/**
 * The glass shape (docs/api/glass.md): a piece of glassware drawn from its model (glassModels.ts). Glass parts borrow the clear
 * glass tile and brass parts the bronze plate tile (GLASSWARE_GLASS_SLOT, GLASSWARE_METAL_SLOT); the status lamp samples the lamp
 * corner of the block's own tile, so it still reads idle, working, done or blocked. A joint, a glass tube with a brass flange ring
 * at the cell face, appears on a face only when this piece has a port there and the neighbour is glass with a port looking back
 * (GLASS_PORTS). Translucent, like the cube it replaces.
 */
import { VOXEL_ID_MASK } from '../core/types';
import { GLASS_PORTS, GLASSWARE_GLASS_SLOT, GLASSWARE_METAL_SLOT } from './blockTables';
import { FLANGE_HALF, GLASS_MODEL_NAMES, GLASS_MODELS, TUBE_HALF, type Box } from './glassModels';
import { box, D_FRONT, vol, type Builder } from './meshQuads';

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const CENTRE = 8;
/** The lamp sits in the top-right corner of the chemistry tiles (src/render/textures/distill.ts): sample just that. */
const LAMP_UV_LO = [11 / 16, 11 / 16, 11 / 16];
const LAMP_UV_HI = [14 / 16, 14 / 16, 14 / 16];

/** Bit mask of the faces (Face order) where the glass at volume index `p`, with ports `mine`, is joined to a neighbour. */
export function glassJoints(p: number, mine: number): number {
  let joints = 0;
  for (let f = 0; f < 6; f++) {
    if (((mine >> f) & 1) === 0) continue;
    // The neighbour must have a port on the face looking back: the opposite face is f ^ 1 in Face order.
    if (((GLASS_PORTS[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] >> (f ^ 1)) & 1) === 1) joints |= 1 << f;
  }
  return joints;
}

function part(b: Builder, slot: number, p: number, x: number, y: number, z: number, bx: Box, lamp = false): void {
  lo[0] = bx[0] / 16; lo[1] = bx[1] / 16; lo[2] = bx[2] / 16;
  hi[0] = bx[3] / 16; hi[1] = bx[4] / 16; hi[2] = bx[5] / 16;
  if (lamp) box(b, slot, p, x, y, z, lo, hi, 0, 0, LAMP_UV_LO, LAMP_UV_HI);
  else box(b, slot, p, x, y, z, lo, hi, 0, 0);
}

/** Draws the glass piece `model` (a 1-based index into GLASS_MODEL_NAMES) and its joints; `own` is the block's face slot. */
export function glass(b: Builder, own: number, model: number, p: number, x: number, y: number, z: number): void {
  const name = GLASS_MODEL_NAMES[model - 1];
  const m = name === undefined ? undefined : GLASS_MODELS[name];
  if (!m) return;
  for (const bx of m.body) part(b, GLASSWARE_GLASS_SLOT, p, x, y, z, bx);
  if (m.metal) for (const bx of m.metal) part(b, GLASSWARE_METAL_SLOT, p, x, y, z, bx);
  if (m.lamp) part(b, own, p, x, y, z, m.lamp, true);
  const joints = glassJoints(p, m.ports);
  for (let f = 0; f < 6; f++) {
    if (((joints >> f) & 1) === 0) continue;
    const axis = f >> 1;
    const positive = (f & 1) === 0;
    // The glass tube, from the middle of the piece out to its face.
    for (let a = 0; a < 3; a++) { lo[a] = (CENTRE - TUBE_HALF) / 16; hi[a] = (CENTRE + TUBE_HALF) / 16; }
    if (positive) { lo[axis] = CENTRE / 16; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = CENTRE / 16; }
    box(b, GLASSWARE_GLASS_SLOT, p, x, y, z, lo, hi, 3 << (axis * 2), 0);
    // The brass flange ring that caps the joint at the face (the face on the cell boundary is left for the neighbour's ring).
    for (let a = 0; a < 3; a++) { lo[a] = (CENTRE - FLANGE_HALF) / 16; hi[a] = (CENTRE + FLANGE_HALF) / 16; }
    if (positive) { lo[axis] = 15 / 16; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = 1 / 16; }
    box(b, GLASSWARE_METAL_SLOT, p, x, y, z, lo, hi, 1 << f, 0);
  }
}
