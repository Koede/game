/** Draws a hand station (stationShapes.ts) as its boxes, skipping faces that sit flush against an opaque neighbour. */
import { VOXEL_ID_MASK, type Facing } from '../core/types';
import { OPAQUE } from './blockTables';
import { box, D_FRONT, vol, type Builder } from './meshQuads';
import { stationBoxesByIndex, turnBox } from './stationShapes';

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const turned = [0, 0, 0, 0, 0, 0];

export function stationShape(b: Builder, slot: number, index: number, facing: Facing, p: number, x: number, y: number, z: number): void {
  for (const raw of stationBoxesByIndex(index)) {
    turnBox(raw, facing, turned);
    let skip = 0;
    for (let f = 0; f < 6; f++) {
      const axis = f >> 1;
      const flush = (f & 1) === 0 ? turned[axis + 3] === 16 : turned[axis] === 0;
      if (flush && OPAQUE[vol[p + D_FRONT[f]] & VOXEL_ID_MASK] === 1) skip |= 1 << f;
    }
    for (let a = 0; a < 3; a++) {
      lo[a] = turned[a] / 16;
      hi[a] = turned[a + 3] / 16;
    }
    box(b, slot, p, x, y, z, lo, hi, skip, 0);
  }
}
