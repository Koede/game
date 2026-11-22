/** Reading a formed hearth off its furnace entity (`FurnaceEntity.hearth`, written by src/sim). Pure, node-testable. */
import type { BlockEntity } from '../../core/types';
import { FIRST_HEARTH_TIER } from '../../core/constants';

/** A formed hearth's shell and the interior inside it (inclusive block coordinates). */
export interface HearthBox {
  tier: number;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  closed: boolean;
  /** Interior: x0..x1, y0..y1, z0..z1 inclusive. An open top's interior reaches the top of the walls. */
  inner: [number, number, number, number, number, number];
}

const isTriple = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** The formed hearth of a furnace entity, or null (no hearth, not formed, or a malformed summary). */
export function hearthBox(e: BlockEntity): HearthBox | null {
  if (e.kind !== 'furnace') return null;
  const h = e.hearth as { tier?: unknown; min?: unknown; max?: unknown; closed?: unknown } | null | undefined;
  if (!h || typeof h !== 'object' || typeof h.tier !== 'number' || h.tier < FIRST_HEARTH_TIER) return null;
  if (!isTriple(h.min) || !isTriple(h.max)) return null;
  const min = h.min;
  const max = h.max;
  const closed = h.closed === true;
  const inner: HearthBox['inner'] = [min[0] + 1, min[1] + 1, min[2] + 1, max[0] - 1, closed ? max[1] - 1 : max[1], max[2] - 1];
  if (inner[0] > inner[3] || inner[1] > inner[4] || inner[2] > inner[5]) return null;
  return { tier: h.tier, min, max, closed, inner };
}

/** True for a furnace whose formed hearth has an open top: its smoke rises from the opening, not from the furnace. */
export const hearthOpenTop = (e: BlockEntity): boolean => {
  const h = hearthBox(e);
  return h !== null && !h.closed;
};

/** The outward normal of a shell cell (a window), or null for a cell inside the box / not on it. */
export function shellNormal(box: HearthBox, x: number, y: number, z: number): [number, number, number] | null {
  const { min, max } = box;
  if (x === min[0]) return [-1, 0, 0];
  if (x === max[0]) return [1, 0, 0];
  if (z === min[2]) return [0, 0, -1];
  if (z === max[2]) return [0, 0, 1];
  if (y === max[1] && box.closed) return [0, 1, 0];
  if (y === min[1]) return [0, -1, 0];
  return null;
}
