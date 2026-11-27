/**
 * Stairs and slopes (docs/api/stairs.md): the collision boxes of an oriented block whose high side is at its back. The front of
 * the block (Facing) is the low side, so a stair faces the player who placed it and rises away from them. Each box is
 * [x0, z0, x1, z1, height] in cell-local blocks. Slopes use the same boxes (a coarse two-step version of the slant).
 */
import { Facing } from './types';

export type StairBox = readonly [number, number, number, number, number];

export const STAIR_BOXES: Readonly<Record<Facing, readonly StairBox[]>> = {
  [Facing.North]: [[0, 0, 1, 1, 0.5], [0, 0.5, 1, 1, 1]],
  [Facing.East]: [[0, 0, 1, 1, 0.5], [0, 0, 0.5, 1, 1]],
  [Facing.South]: [[0, 0, 1, 1, 0.5], [0, 0, 1, 0.5, 1]],
  [Facing.West]: [[0, 0, 1, 1, 0.5], [0.5, 0, 1, 1, 1]],
};

/** Turns a point of the cell about its centre for a block placed facing `facing` (North is the canonical, front towards -z). */
export function turn(x: number, z: number, facing: Facing): [number, number] {
  let cx = x - 0.5;
  let cz = z - 0.5;
  for (let i = 0; i < facing; i++) [cx, cz] = [-cz, cx];
  return [cx + 0.5, cz + 0.5];
}
