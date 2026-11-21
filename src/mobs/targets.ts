/** Ray against the animals' boxes, for the player's crosshair (slab test, nearest hit wins). */
import { bodyHeight, halfWidth } from './brain';
import type { Mob, MobRayHit } from './types';

/** Boxes are a little larger than the collision box so small animals are easy to hit with a thumb. */
export const TARGET_MARGIN = 0.08;

export class MobTargets {
  private readonly hit: MobRayHit = { id: 0, distance: 0 };

  raycast(mobs: readonly Mob[], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): MobRayHit | null {
    const len = Math.hypot(dx, dy, dz);
    if (!(len > 0)) return null;
    const ix = len / dx;
    const iy = len / dy;
    const iz = len / dz;
    let best = maxDist;
    let bestId = 0;
    for (const m of mobs) {
      if (m.state === 'dying') continue;
      const hw = halfWidth(m) + TARGET_MARGIN;
      const h = bodyHeight(m) + TARGET_MARGIN;
      const t = slab(ox, ix, m.x - hw, m.x + hw, oy, iy, m.y - TARGET_MARGIN, m.y + h, oz, iz, m.z - hw, m.z + hw);
      if (t >= 0 && t <= best) {
        best = t;
        bestId = m.id;
      }
    }
    if (bestId === 0) return null;
    this.hit.id = bestId;
    this.hit.distance = best;
    return this.hit;
  }
}

/** Distance along a unit ray (given as inverse direction components) to an AABB, or -1 when it misses. */
function slab(
  ox: number, ix: number, x0: number, x1: number,
  oy: number, iy: number, y0: number, y1: number,
  oz: number, iz: number, z0: number, z1: number,
): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  let a = (x0 - ox) * ix;
  let b = (x1 - ox) * ix;
  if (ix === Infinity || ix === -Infinity) {
    if (ox < x0 || ox > x1) return -1;
  } else {
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
  }
  a = (y0 - oy) * iy;
  b = (y1 - oy) * iy;
  if (iy === Infinity || iy === -Infinity) {
    if (oy < y0 || oy > y1) return -1;
  } else {
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
  }
  a = (z0 - oz) * iz;
  b = (z1 - oz) * iz;
  if (iz === Infinity || iz === -Infinity) {
    if (oz < z0 || oz > z1) return -1;
  } else {
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
  }
  if (tmax < Math.max(tmin, 0)) return -1;
  return Math.max(tmin, 0);
}
