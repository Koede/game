/**
 * What each person wears (assets/npcs/<id>_sleep.jpg, <id>_swim.jpg; assets/npcs/faces/outfits.py). The outfit is never saved: it is a pure
 * function of the moment, so it is always right after a load. Priority: a party puts everyone in swimwear; hired or dancing people keep
 * their day clothes; anyone standing in the pool wears swimwear; at night (late evening to dawn) they are in their sleepwear.
 */
import type { Phase } from './dialogue';
import { SEASON_DAYS, festivalDay, seasonOf } from './festival';
import { POOL } from './tavern';
import type { Spot } from './routines';

export type Outfit = 'day' | 'sleep' | 'swim';

export interface OutfitState {
  phase: Phase;
  /** The person's feet are in the pool. */
  inWater: boolean;
  dancing: boolean;
  hired: boolean;
  /** The party switch behind the bar: everyone in swimwear. */
  party?: boolean;
}

export function chooseOutfit(s: OutfitState): Outfit {
  if (s.party) return 'swim';
  if (s.hired || s.dancing) return 'day';
  if (s.inWater) return 'swim';
  if (s.phase === 'night') return 'sleep';
  return 'day';
}

/** Whether tavern-local x, z is over the pool's water. */
export const inPool = (x: number, z: number): boolean => x >= POOL.x0 && x < POOL.x1 + 1 && z >= POOL.z0 && z < POOL.z1 + 1;

/** Where each regular bobs about in the pool on a hot day (feet in the water). */
export const SWIM_SPOTS: Readonly<Record<string, Spot>> = {
  mara: [0, 1, 11], rosa: [1, 1, 11], orrin: [2, 1, 11], gruk: [1, 1, 12], veyra: [0, 1, 13], bram: [2, 1, 13],
};

/** Hot days: the days of the warm season (summer), never the festival. They cool off in the pool around midday (about 10:30 to 13:30). */
export function coolOffAt(day: number, tod: number): boolean {
  return seasonOf(day).season === 'summer' && !festivalDay(day) && tod >= 0.19 && tod < 0.31 && SEASON_DAYS > 0;
}
