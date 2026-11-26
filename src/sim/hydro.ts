/**
 * Hydropower rules: how much a river (or a dammed pool) gives a water wheel. Pure functions, no state.
 * - Head: the water stacked above the water beside a wheel. A dam raises the pool, so the stack is taller and the
 *   wheel makes more (HEAD_GAIN per block, up to HEAD_MAX blocks).
 * - Ice: rivers slow as winter comes and freeze solid in it, so output follows `riverScale` of the clock day.
 */
import type { IWorld } from '../core/types';
import { DAYS_PER_SEASON, dayOfSeason, seasonOf } from './seasons';

/** Most blocks of head that count. */
export const HEAD_MAX = 4;
/** Extra output per block of head (0.25: four blocks of head double a wheel). */
export const HEAD_GAIN = 0.25;
/** Output multiplier while the river is frozen over. */
export const FROZEN = 0.1;

/** Multiplier on a wheel's output for `head` blocks of head. */
export const headBoost = (head: number): number => 1 + HEAD_GAIN * Math.min(HEAD_MAX, Math.max(0, Math.floor(head)));

/**
 * How freely rivers run on 1-based clock `day`: 1 in spring, summer and autumn; ice forms through the last third
 * of autumn (down to 0.6), and winter is frozen hard (FROZEN) after a short thaw-in-reverse ramp, easing back up
 * to 0.6 over the last third of winter.
 */
export function riverScale(day: number): number {
  const s = seasonOf(day);
  const t = (dayOfSeason(day) - 1) / Math.max(1, DAYS_PER_SEASON - 1); // 0..1 through the season
  if (s === 'autumn') return t < 2 / 3 ? 1 : 1 - 0.4 * ((t - 2 / 3) * 3);
  if (s === 'winter') return t < 1 / 3 ? 0.6 - (0.6 - FROZEN) * (t * 3) : t < 2 / 3 ? FROZEN : FROZEN + (0.6 - FROZEN) * ((t - 2 / 3) * 3);
  return 1;
}

const SIDES: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Blocks of head at a wheel: the tallest stack of water above any water block beside it (waterfalls count). */
export function headAt(world: IWorld, x: number, y: number, z: number): number {
  let best = 0;
  for (const [dx, dz] of SIDES) {
    if (world.getBlock(x + dx, y, z + dz).liquid !== 'water') continue;
    let h = 0;
    while (h < HEAD_MAX && world.getBlock(x + dx, y + 1 + h, z + dz).liquid === 'water') h++;
    if (h > best) best = h;
  }
  return best;
}
