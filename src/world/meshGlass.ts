/**
 * The glass shape (docs/api/glass.md): a piece of glassware drawn from its model (glassModels.ts), with a tube arm to each of
 * the six neighbours that is glass (GLASS_JOINS). Arms run from the body's middle to the cell face, so two glass pieces that touch
 * are joined by one tube and any glass piece fits any other. Translucent, like the cube it replaces.
 */
import { VOXEL_ID_MASK } from '../core/types';
import { GLASS_JOINS } from './blockTables';
import { GLASS_MODEL_NAMES, GLASS_MODELS, TUBE_HALF } from './glassModels';
import { box, D_FRONT, vol, type Builder } from './meshQuads';

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const CENTRE = 8;

/** Bit mask of the faces (Face order) towards which the glass at volume index `p` sends a tube arm. */
export function glassArms(p: number): number {
  let arms = 0;
  for (let f = 0; f < 6; f++) if (GLASS_JOINS[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) arms |= 1 << f;
  return arms;
}

/** Draws the glass piece `model` (a 1-based index into GLASS_MODEL_NAMES) with its tube arms. */
export function glass(b: Builder, slot: number, model: number, p: number, x: number, y: number, z: number): void {
  const name = GLASS_MODEL_NAMES[model - 1];
  const m = name === undefined ? undefined : GLASS_MODELS[name];
  if (m) for (const [x0, y0, z0, x1, y1, z1] of m.body) {
    lo[0] = x0 / 16; lo[1] = y0 / 16; lo[2] = z0 / 16;
    hi[0] = x1 / 16; hi[1] = y1 / 16; hi[2] = z1 / 16;
    box(b, slot, p, x, y, z, lo, hi, 0, 0);
  }
  const arms = glassArms(p);
  for (let f = 0; f < 6; f++) {
    if (((arms >> f) & 1) === 0) continue;
    const axis = f >> 1;
    const positive = (f & 1) === 0;
    for (let a = 0; a < 3; a++) { lo[a] = (CENTRE - TUBE_HALF) / 16; hi[a] = (CENTRE + TUBE_HALF) / 16; }
    // From the middle of the piece out to its face (the body covers the middle; the arm joins the faces).
    if (positive) { lo[axis] = CENTRE / 16; hi[axis] = 1; } else { lo[axis] = 0; hi[axis] = CENTRE / 16; }
    box(b, slot, p, x, y, z, lo, hi, 3 << (axis * 2), 0);
  }
}
