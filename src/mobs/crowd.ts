/**
 * Animals keep a little room between each other: bodies that overlap push apart sideways, so a flock following
 * the player spreads around them instead of stacking into one spot, and a pair never stands inside each other.
 * Runs after the brains chose their velocities and before physics; the push never carries an animal over an
 * edge its own walk would refuse (canStride). O(n^2) over the simulated animals, which the caps keep small.
 */
import { MOB_BABY_SCALE } from '../core/constants';
import type { IWorld } from '../core/types';
import { bodyHeight, canStride, forwardReach } from './brain';
import { CROWD_GAP, CROWD_PUSH } from './constants';
import type { Mob } from './types';

/** Matches the brains' ground grip (1/s), so a steady push adds about its own size to the walking speed. */
const CROWD_BLEND = 10;

/**
 * Personal space of an animal (blocks): between its box half width and its model's forward reach, since the
 * models are longer than their square collision boxes are wide.
 */
export function crowdRadius(m: Mob): number {
  const hw = m.spec.size.w / 2;
  return Math.max(hw, (hw + forwardReach(m.spec)) / 2) * (m.baby ? MOB_BABY_SCALE : 1);
}

/**
 * Adds the separation push to the velocities of the living animals in `mobs`, blended in like the brains' own
 * steering (an overlapping pair drifts apart at up to CROWD_PUSH m/s on top of what they are doing).
 */
export function separate(world: IWorld, mobs: readonly Mob[], dt: number): void {
  const blend = Math.min(1, CROWD_BLEND * dt);
  for (let i = 0; i < mobs.length; i++) {
    const a = mobs[i];
    if (a.state === 'dying') continue;
    const ra = crowdRadius(a);
    let px = 0;
    let pz = 0;
    for (let j = 0; j < mobs.length; j++) {
      const b = mobs[j];
      if (i === j || b.state === 'dying') continue;
      if (b.y > a.y + bodyHeight(a) || a.y > b.y + bodyHeight(b)) continue;
      const min = (ra + crowdRadius(b)) * CROWD_GAP;
      let dx = a.x - b.x;
      let dz = a.z - b.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        // Exactly on top of each other: split along a direction fixed by the pair's ids.
        const ang = (a.id < b.id ? 0 : Math.PI) + Math.min(a.id, b.id) * 2.39996;
        dx = Math.cos(ang);
        dz = Math.sin(ang);
        d = 1;
      }
      const k = (CROWD_PUSH * (min - Math.sqrt(d2))) / min / d;
      px += dx * k;
      pz += dz * k;
    }
    if (px === 0 && pz === 0) continue;
    const len = Math.hypot(px, pz);
    if (len > CROWD_PUSH) {
      px = (px / len) * CROWD_PUSH;
      pz = (pz / len) * CROWD_PUSH;
    }
    if (!canStride(world, a, px / Math.max(len, 1e-9), pz / Math.max(len, 1e-9))) continue;
    a.vx += px * blend;
    a.vz += pz * blend;
  }
}
