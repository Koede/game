/**
 * Keeping the herd within the caps (spec 12.5) without emptying the world: which animals may be retired to make
 * room. Only wild grown animals qualify: the player's animals (fed, or born to fed parents), babies and corpses
 * never do.
 */
import { MOB_BREED_RADIUS, MOB_DESPAWN_DISTANCE } from '../core/constants';
import { CHUNK_SIZE, type IWorld } from '../core/types';
import { columnKey } from './spawner';
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

/**
 * Removes (through `remove`) frozen wild adults far from the player, farthest first, down to `keep` stored
 * animals (fewer go when not enough qualify: see farFrozen). A column left with none of its animals is taken
 * out of `rolled`, so it rolls a group again when it next loads and the world does not empty behind an explorer.
 */
export function retireFar(
  mobs: readonly Mob[],
  world: IWorld,
  px: number,
  pz: number,
  keep: number,
  rolled: Set<number>,
  remove: (m: Mob) => void,
): void {
  const gone = farFrozen(mobs, world, px, pz, keep);
  if (gone.length === 0) return;
  const col = (m: Mob): number => columnKey(Math.floor(m.x / CHUNK_SIZE), Math.floor(m.z / CHUNK_SIZE));
  const emptied = new Set<number>();
  for (const m of gone) {
    emptied.add(col(m));
    remove(m);
  }
  for (const m of mobs) emptied.delete(col(m));
  for (const k of emptied) rolled.delete(k);
}

/** Another grown animal of m's species, eager and rested, within MOB_BREED_RADIUS (a partner is waiting). */
export function eagerPartnerNear(mobs: readonly Mob[], m: Mob): boolean {
  const r2 = MOB_BREED_RADIUS * MOB_BREED_RADIUS;
  for (const o of mobs) {
    if (o === m || o.spec !== m.spec || o.baby || o.state === 'dying' || o.eagerS <= 0 || o.cooldownS > 0) continue;
    if ((o.x - m.x) ** 2 + (o.z - m.z) ** 2 <= r2) return true;
  }
  return false;
}
