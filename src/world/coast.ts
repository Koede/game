/**
 * Whether a lamp stands on a shore (docs/api/optics.md): high enough over the level of open water, with water on a good share
 * of the ground around it. Read by the lighthouse lamp's behaviour (src/sim/machines.ts) and its beam (src/render/beams.ts).
 */
import { blockOf } from '../core/registry';
import type { IWorld } from '../core/types';
import { WATER_TOP } from './terrain';

/** A lamp counts as a lighthouse when it stands this many blocks above the water... */
export const LIGHTHOUSE_MIN_HEIGHT = 6;
/** ...and at least this share of the samples around it (radii COAST_RADII) are open water. */
export const COAST_SHARE = 0.2;
const COAST_RADII = [6, 10, 14, 18] as const;
const COAST_DIRS = 16;

/**
 * Share (0..1) of the cells around (x, z) at the height of open water that hold water: COAST_DIRS directions at each of
 * COAST_RADII. Unloaded cells count as dry.
 */
export function waterShareAround(world: IWorld, x: number, z: number): number {
  let wet = 0;
  let n = 0;
  for (const r of COAST_RADII) {
    for (let i = 0; i < COAST_DIRS; i++) {
      const a = (i / COAST_DIRS) * Math.PI * 2;
      const wx = Math.floor(x + 0.5 + Math.cos(a) * r);
      const wz = Math.floor(z + 0.5 + Math.sin(a) * r);
      n++;
      if (!world.isLoaded(wx, wz)) continue;
      if (blockOf(world.getVoxel(wx, WATER_TOP, wz)).liquid === 'water') wet++;
    }
  }
  return n > 0 ? wet / n : 0;
}

/** Whether a lamp at (x, y, z) is a true lighthouse: high enough over open water, with water all round a good share of it. */
export function isLighthouse(world: IWorld, x: number, y: number, z: number): boolean {
  return y >= WATER_TOP + LIGHTHOUSE_MIN_HEIGHT && waterShareAround(world, x, z) >= COAST_SHARE;
}
