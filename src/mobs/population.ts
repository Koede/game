/**
 * Keeping the herd within the caps (spec 12.5) without emptying the world: which animals may be retired to make
 * room. Only wild grown animals qualify: the player's animals (fed, or born to fed parents), babies and corpses
 * never do.
 */
import { MOB_DESPAWN_DISTANCE } from '../core/constants';
import type { IWorld } from '../core/types';
import type { Mob } from './types';

const retirable = (m: Mob): boolean => !m.tame && !m.baby && m.state !== 'dying';

/**
 * Frozen (column not loaded) wild adults at least MOB_DESPAWN_DISTANCE blocks from the player, farthest first,
 * as many as it takes to bring `mobs.length` down to `keep` (fewer when not enough qualify).
 */
export function farFrozen(mobs: readonly Mob[], world: IWorld, px: number, pz: number, keep: number): Mob[] {
  const excess = mobs.length - keep;
  if (excess <= 0) return [];
  const min2 = MOB_DESPAWN_DISTANCE * MOB_DESPAWN_DISTANCE;
  const found: { m: Mob; d: number }[] = [];
  for (const m of mobs) {
    if (!retirable(m) || world.isLoaded(m.x, m.z)) continue;
    const d = (m.x - px) ** 2 + (m.z - pz) ** 2;
    if (d >= min2) found.push({ m, d });
  }
  found.sort((a, b) => b.d - a.d);
  return found.slice(0, excess).map((e) => e.m);
}

/** The simulated wild adult farthest from the player and at least `minDist` blocks away, or undefined. */
export function farthestWild(active: readonly Mob[], px: number, pz: number, minDist: number): Mob | undefined {
  let best: Mob | undefined;
  let bestD = minDist * minDist;
  for (const m of active) {
    if (!retirable(m)) continue;
    const d = (m.x - px) ** 2 + (m.z - pz) ** 2;
    if (d >= bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}
