/**
 * Which ground drop the view is aimed at, and how the crosshair names it ("Stone ×12", in its rarity colour). Pure: no DOM,
 * no world. A drop is small, so the look ray has to pass within DROP_AIM_RADIUS of its middle, and a drop only counts when it
 * lies nearer than the block the ray hits (a drop behind a wall is not named).
 */
import { itemOrNull, rarityOf } from '../core/registry';
import type { GroundItem } from './groundItems';

/** How close the look ray must pass to a drop's middle (blocks). */
export const DROP_AIM_RADIUS = 0.3;
/** Height of a drop's middle above the ground it lies on (block and sprite models sit on it). */
const MIDDLE = 0.15;

/**
 * The nearest drop the ray (origin o, unit direction d) passes through within `maxDist` and nearer than `blockDist`
 * (Infinity when no block is hit), or null. The list is short, so a plain scan is fine.
 */
export function aimGroundItem(
  items: readonly GroundItem[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  blockDist: number,
): GroundItem | null {
  const reach = Math.min(maxDist, blockDist);
  const r2 = DROP_AIM_RADIUS * DROP_AIM_RADIUS;
  let best: GroundItem | null = null;
  let bestT = Infinity;
  for (const e of items) {
    const cx = e.x - ox;
    const cy = e.y + MIDDLE - oy;
    const cz = e.z - oz;
    const along = cx * dx + cy * dy + cz * dz;
    if (along < -DROP_AIM_RADIUS) continue; // wholly behind the eye
    const perp2 = cx * cx + cy * cy + cz * cz - along * along;
    if (perp2 > r2) continue; // the ray misses it
    const t = Math.max(0, along - Math.sqrt(r2 - perp2)); // where the ray enters it
    if (t > reach || t >= bestT) continue;
    best = e;
    bestT = t;
  }
  return best;
}

/** The crosshair text for a drop: its name, with the count when there is more than one, and its rarity (null for common). */
export function dropLabel(item: string, count: number): { text: string; rarity: string | null } {
  const name = itemOrNull(item)?.name ?? item;
  const rarity = rarityOf(item);
  return { text: count > 1 ? `${name} ×${count}` : name, rarity: rarity === 'common' ? null : rarity };
}
