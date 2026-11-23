/**
 * Collision of the player's box (PLAYER_WIDTH x PLAYER_HEIGHT, feet-centred) against voxels. Solid blocks are
 * full cells, slabs are the bottom half; cells in unloaded columns and below the world are solid, above the
 * world is air. Pure functions over IWorld, no allocation.
 */
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../core/constants';
import type { Vec3 } from '../core/math';
import { blockOf } from '../core/registry';
import { STAIR_BOXES } from '../core/stairShape';
import { WORLD_HEIGHT, voxelFacing, type IWorld } from '../core/types';

export const HALF_WIDTH = PLAYER_WIDTH / 2;
/** Contact tolerance: touching is not overlapping. */
export const EPS = 1e-4;

/** Height of the collision box in cell (x, y, z): 0 = passable, 0.5 = slab, 1 = full. */
export function solidHeight(world: IWorld, x: number, y: number, z: number): number {
  if (y < 0) return 1;
  if (y >= WORLD_HEIGHT) return 0;
  if (!world.isLoaded(x, z)) return 1;
  const def = blockOf(world.getVoxel(x, y, z));
  if (!def.solid) return 0;
  return def.shape === 'slab' || def.shape === 'stairs' || def.shape === 'slope' ? 0.5 : 1;
}

// The boxes of one cell for sweepAxis: normally the whole cell (up to `solidHeight`), but stairs and slopes are two boxes.
const BX0 = [0, 0];
const BZ0 = [0, 0];
const BX1 = [1, 1];
const BZ1 = [1, 1];
const BH = [0, 0];

function boxesAt(world: IWorld, x: number, y: number, z: number): number {
  if (y >= 0 && y < WORLD_HEIGHT && world.isLoaded(x, z)) {
    const v = world.getVoxel(x, y, z);
    const def = blockOf(v);
    if (def.solid && (def.shape === 'stairs' || def.shape === 'slope')) {
      const boxes = STAIR_BOXES[voxelFacing(v)];
      for (let i = 0; i < 2; i++) {
        [BX0[i], BZ0[i], BX1[i], BZ1[i], BH[i]] = boxes[i];
      }
      return 2;
    }
  }
  const h = solidHeight(world, x, y, z);
  BX0[0] = BZ0[0] = 0;
  BX1[0] = BZ1[0] = 1;
  BH[0] = h;
  return h === 0 ? 0 : 1;
}

/** Whether a box of the given height in cell (x, y, z) intersects the player's box at feet position `pos`. */
export function boxIntersectsCell(pos: Vec3, x: number, y: number, z: number, height = 1): boolean {
  return (
    pos.x + HALF_WIDTH > x + EPS &&
    pos.x - HALF_WIDTH < x + 1 - EPS &&
    pos.z + HALF_WIDTH > z + EPS &&
    pos.z - HALF_WIDTH < z + 1 - EPS &&
    pos.y + PLAYER_HEIGHT > y + EPS &&
    pos.y < y + height - EPS
  );
}

/**
 * Moves the box at `pos` along one axis (0 = x, 1 = y, 2 = z) by `d`, stopping flush against the first solid
 * box in the way. The swept region is tested as a whole, so nothing tunnels however large `d` is. Boxes the
 * player already overlaps are ignored so a stuck player can always walk out. Returns the distance moved
 * (equal to `d` when nothing was in the way).
 */
export function sweepAxis(world: IWorld, pos: Vec3, axis: 0 | 1 | 2, d: number): number {
  if (d === 0) return 0;
  const minX = pos.x - HALF_WIDTH;
  const maxX = pos.x + HALF_WIDTH;
  const minY = pos.y;
  const maxY = pos.y + PLAYER_HEIGHT;
  const minZ = pos.z - HALF_WIDTH;
  const maxZ = pos.z + HALF_WIDTH;
  const cx0 = Math.floor((axis === 0 && d < 0 ? minX + d : minX) + EPS);
  const cx1 = Math.floor((axis === 0 && d > 0 ? maxX + d : maxX) - EPS);
  const cy0 = Math.floor((axis === 1 && d < 0 ? minY + d : minY) + EPS);
  const cy1 = Math.floor((axis === 1 && d > 0 ? maxY + d : maxY) - EPS);
  const cz0 = Math.floor((axis === 2 && d < 0 ? minZ + d : minZ) + EPS);
  const cz1 = Math.floor((axis === 2 && d > 0 ? maxZ + d : maxZ) - EPS);
  let allowed = d;
  for (let y = cy0; y <= cy1; y++) {
    for (let z = cz0; z <= cz1; z++) {
      for (let x = cx0; x <= cx1; x++) {
        const n = boxesAt(world, x, y, z);
        for (let i = 0; i < n; i++) {
          const x0 = x + BX0[i];
          const x1 = x + BX1[i];
          const z0 = z + BZ0[i];
          const z1 = z + BZ1[i];
          const top = y + BH[i];
          if (axis === 0) {
            if (!(top > minY + EPS && y < maxY - EPS && z1 > minZ + EPS && z0 < maxZ - EPS)) continue;
            if (d > 0 && x0 >= maxX - EPS) allowed = Math.min(allowed, Math.max(0, x0 - maxX));
            else if (d < 0 && x1 <= minX + EPS) allowed = Math.max(allowed, Math.min(0, x1 - minX));
          } else if (axis === 1) {
            if (!(x1 > minX + EPS && x0 < maxX - EPS && z1 > minZ + EPS && z0 < maxZ - EPS)) continue;
            if (d > 0 && y >= maxY - EPS) allowed = Math.min(allowed, Math.max(0, y - maxY));
            else if (d < 0 && top <= minY + EPS) allowed = Math.max(allowed, Math.min(0, top - minY));
          } else {
            if (!(top > minY + EPS && y < maxY - EPS && x1 > minX + EPS && x0 < maxX - EPS)) continue;
            if (d > 0 && z0 >= maxZ - EPS) allowed = Math.min(allowed, Math.max(0, z0 - maxZ));
            else if (d < 0 && z1 <= minZ + EPS) allowed = Math.max(allowed, Math.min(0, z1 - minZ));
          }
        }
      }
    }
  }
  if (axis === 0) pos.x += allowed;
  else if (axis === 1) pos.y += allowed;
  else pos.z += allowed;
  return allowed;
}

/** Whether the box at `pos` overlaps a solid block in a LOADED column (unloaded walls do not count). */
export function overlapsLoadedSolid(world: IWorld, pos: Vec3): boolean {
  const x0 = Math.floor(pos.x - HALF_WIDTH + EPS);
  const x1 = Math.floor(pos.x + HALF_WIDTH - EPS);
  const z0 = Math.floor(pos.z - HALF_WIDTH + EPS);
  const z1 = Math.floor(pos.z + HALF_WIDTH - EPS);
  const y0 = Math.floor(pos.y + EPS);
  const y1 = Math.floor(pos.y + PLAYER_HEIGHT - EPS);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!world.isLoaded(x, z)) continue;
        const h = solidHeight(world, x, y, z);
        if (h > 0 && y + h > pos.y + EPS) return true;
      }
    }
  }
  return false;
}
