/**
 * The shape of one liquid cell for the mesher (spec 18.4): the height of each top corner and, for water, the flow
 * direction its surface scrolls along. A cell stands at its own height (sources and falling water 14/16, flowing
 * level L at (8 - L) / 9, full under a cover or under more of the same liquid); each top corner takes the average of
 * the up-to-4 cells of that liquid around it (full when any of them has that liquid above), so neighbouring cells
 * share their corners and the surface is one continuous slope.
 */
import { VOXEL_ID_MASK } from '../core/types';
import { OPAQUE } from './blockTables';
import { LIGHT_W, lightIndex } from './lighting';
import { SY, vol } from './meshQuads';
import { WATER_ID, WATER_SOURCE, flowDirection, isFallingWater, waterHeight, type VoxelReader } from './water';

/** Height of a liquid's surface inside its cell when nothing of the same liquid lies above. */
export const LIQUID_SURFACE = 14 / 16;

/** Result of `liquidShape` (module scratch, one cell at a time). */
export const LIQ = {
  /** Height of the top corner (x + i, z + j) at index i + 2j. */
  h: new Float32Array(4),
  /** Water that is not a source: its side faces run downwards. */
  moving: false,
  /** Horizontal flow direction of the surface (unit vector, 0, 0 when still). */
  fx: 0,
  fz: 0,
};

const readVol: VoxelReader = (x, y, z) => vol[lightIndex(x, y, z)];
const dir = { x: 0, z: 0 };

/** Own surface height of cell p if it holds liquid `id`, else -1. */
function ownHeight(p: number, id: number): number {
  const v = vol[p];
  if ((v & VOXEL_ID_MASK) !== id) return -1;
  const above = vol[p + SY] & VOXEL_ID_MASK;
  if (above === id) return 1;
  // Flowing water keeps its level under a cover; a full liquid fills the cell under ice so no gap opens there.
  if (id === WATER_ID && v !== WATER_SOURCE && !isFallingWater(v)) return waterHeight(v);
  return OPAQUE[above] === 1 ? 1 : LIQUID_SURFACE;
}

/** Corner height from the cells (p + dx, p + dz) around it, dx, dz in {-1, 0} steps. */
function corner(p: number, id: number): number {
  let sum = 0;
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const q = p - (k & 1) - (k >> 1) * LIGHT_W;
    const h = ownHeight(q, id);
    if (h < 0) continue;
    if ((vol[q + SY] & VOXEL_ID_MASK) === id) return 1;
    sum += h;
    n++;
  }
  return sum / n;
}

/** Fills LIQ for the liquid cell at volume index p (chunk-local x, y, z), voxel v of block id. */
export function liquidShape(v: number, id: number, p: number, x: number, y: number, z: number): void {
  // Corner (i, j) sits between cells x - 1 + i .. x + i and z - 1 + j .. z + j: start from the cell at (+i, +j).
  LIQ.h[0] = corner(p, id);
  LIQ.h[1] = corner(p + 1, id);
  LIQ.h[2] = corner(p + LIGHT_W, id);
  LIQ.h[3] = corner(p + 1 + LIGHT_W, id);
  LIQ.fx = 0;
  LIQ.fz = 0;
  LIQ.moving = false;
  if (id !== WATER_ID) return;
  LIQ.moving = v !== WATER_SOURCE;
  flowDirection(readVol, x, y, z, dir);
  LIQ.fx = dir.x;
  LIQ.fz = dir.z;
}
