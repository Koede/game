/**
 * The glass shape (docs/api/glass.md): a piece of glassware drawn from its model (glassModels.ts). A joint, a tube with a flange
 * ring at the cell face, appears on a face only when this piece has a port there and the neighbour is glass with a port looking
 * back (GLASS_PORTS). So a flask on a burner plate shows its joint, and a loose piece, or two that do not meet at ports, stay
 * clean. Translucent, like the cube it replaces.
 */
import { VOXEL_ID_MASK } from '../core/types';
import { GLASS_PORTS } from './blockTables';
import { FLANGE_HALF, GLASS_MODEL_NAMES, GLASS_MODELS, TUBE_HALF } from './glassModels';
import { box, D_FRONT, vol, type Builder } from './meshQuads';

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const CENTRE = 8;

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

/** Draws the glass piece `model` (a 1-based index into GLASS_MODEL_NAMES) and its joints. */
export function glass(b: Builder, slot: number, model: number, p: number, x: number, y: number, z: number): void {
  const name = GLASS_MODEL_NAMES[model - 1];
  const m = name === undefined ? undefined : GLASS_MODELS[name];
  if (!m) return;
  for (const [x0, y0, z0, x1, y1, z1] of m.body) {
    lo[0] = x0 / 16; lo[1] = y0 / 16; lo[2] = z0 / 16;
    hi[0] = x1 / 16; hi[1] = y1 / 16; hi[2] = z1 / 16;
    box(b, slot, p, x, y, z, lo, hi, 0, 0);
  }
  const joints = glassJoints(p, m.ports);
  for (let f = 0; f < 6; f++) {
    if (((joints >> f) & 1) === 0) continue;
    const axis = f >> 1;
    const positive = (f & 1) === 0;
    // The tube, from the middle of the piece out to its face.
    for (let a = 0; a < 3; a++) { lo[a] = (CENTRE - TUBE_HALF) / 16; hi[a] = (CENTRE + TUBE_HALF) / 16; }
    if (positive) { lo[axis] = CENTRE / 16; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = CENTRE / 16; }
    box(b, slot, p, x, y, z, lo, hi, 3 << (axis * 2), 0);
    // The flange ring that caps the joint at the face (the face on the cell boundary is left for the neighbour's ring).
    for (let a = 0; a < 3; a++) { lo[a] = (CENTRE - FLANGE_HALF) / 16; hi[a] = (CENTRE + FLANGE_HALF) / 16; }
    if (positive) { lo[axis] = 15 / 16; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = 1 / 16; }
    box(b, slot, p, x, y, z, lo, hi, 1 << f, 0);
  }
}
