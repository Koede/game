/**
 * Wooden doors (docs/api/door.md). A door is two cells: the bottom half (variant 0) is the block the player crafts and
 * places, the top half (variant DOOR_TOP) sits above it and is the same block id. The active bit is open. The panel is
 * thin across the facing axis; closed it fills the cell's width and height, open it is pushed against one edge.
 * Boxes are in cell-local blocks, [lo x, y, z] and [hi x, y, z].
 */
import { Facing } from './types';

/** Voxel variant of the top half (the bottom half is 0). */
export const DOOR_TOP = 1;
export const DOOR_MIN = 6 / 16;
export const DOOR_MAX = 10 / 16;
/** Thickness of an open panel, pushed against the cell edge. */
export const DOOR_OPEN = 4 / 16;

export interface DoorBox {
  lo: [number, number, number];
  hi: [number, number, number];
}

/** The panel: closed it is thin along the facing axis; open it lies against the edge of the cell on the other axis. */
export function doorPanel(facing: Facing, open: boolean): DoorBox {
  const alongZ = facing === Facing.North || facing === Facing.South;
  const lo: [number, number, number] = [0, 0, 0];
  const hi: [number, number, number] = [1, 1, 1];
  if (!open) {
    const a = alongZ ? 2 : 0;
    lo[a] = DOOR_MIN;
    hi[a] = DOOR_MAX;
  } else {
    const a = alongZ ? 0 : 2;
    hi[a] = DOOR_OPEN;
  }
  return { lo, hi };
}

/** The handle: a small bar on the front of the panel (the side the door faces), at about waist height. Bottom half only. */
export function doorHandle(facing: Facing): DoorBox {
  const alongZ = facing === Facing.North || facing === Facing.South;
  const along = alongZ ? 2 : 0;
  const across = alongZ ? 0 : 2;
  const towardsNegative = facing === Facing.North || facing === Facing.West;
  const lo: [number, number, number] = [0, 7 / 16, 0];
  const hi: [number, number, number] = [0, 9 / 16, 0];
  lo[across] = 11 / 16;
  hi[across] = 12 / 16;
  if (towardsNegative) {
    lo[along] = DOOR_MIN - 2 / 16;
    hi[along] = DOOR_MIN;
  } else {
    lo[along] = DOOR_MAX;
    hi[along] = DOOR_MAX + 2 / 16;
  }
  return { lo, hi };
}

/** The y step from one half to the other: the bottom half's partner is above, the top half's is below. */
export const doorPartnerStep = (variant: number): number => (variant === DOOR_TOP ? -1 : 1);
