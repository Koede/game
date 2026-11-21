/**
 * Axis sweeps of a square, feet-centred box of any size against voxels: the vehicle twin of player/collision.ts (which
 * is fixed to the player's box). Solid blocks are full cells, slabs the bottom half, unloaded columns and the world
 * floor are solid, the sky is air. Boxes the vehicle already overlaps are ignored so it can always drive out.
 */
import type { Vec3 } from '../core/math';
import { solidHeight } from '../player/collision';
import type { IWorld } from '../core/types';

const EPS = 1e-4;

/** Moves the box at `pos` along an axis (0 x, 1 y, 2 z) by d, stopping flush against the first solid in the way. Returns the distance moved. */
export function sweepBox(world: IWorld, pos: Vec3, axis: 0 | 1 | 2, d: number, hw: number, height: number): number {
  if (d === 0) return 0;
  const minX = pos.x - hw;
  const maxX = pos.x + hw;
  const minY = pos.y;
  const maxY = pos.y + height;
  const minZ = pos.z - hw;
  const maxZ = pos.z + hw;
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
        const h = solidHeight(world, x, y, z);
        if (h === 0) continue;
        const top = y + h;
        if (axis === 0) {
          if (!(top > minY + EPS && y < maxY - EPS && z + 1 > minZ + EPS && z < maxZ - EPS)) continue;
          if (d > 0 && x >= maxX - EPS) allowed = Math.min(allowed, Math.max(0, x - maxX));
          else if (d < 0 && x + 1 <= minX + EPS) allowed = Math.max(allowed, Math.min(0, x + 1 - minX));
        } else if (axis === 1) {
          if (!(x + 1 > minX + EPS && x < maxX - EPS && z + 1 > minZ + EPS && z < maxZ - EPS)) continue;
          if (d > 0 && y >= maxY - EPS) allowed = Math.min(allowed, Math.max(0, y - maxY));
          else if (d < 0 && top <= minY + EPS) allowed = Math.max(allowed, Math.min(0, top - minY));
        } else {
          if (!(top > minY + EPS && y < maxY - EPS && x + 1 > minX + EPS && x < maxX - EPS)) continue;
          if (d > 0 && z >= maxZ - EPS) allowed = Math.min(allowed, Math.max(0, z - maxZ));
          else if (d < 0 && z + 1 <= minZ + EPS) allowed = Math.max(allowed, Math.min(0, z + 1 - minZ));
        }
      }
    }
  }
  if (axis === 0) pos.x += allowed;
  else if (axis === 1) pos.y += allowed;
  else pos.z += allowed;
  return allowed;
}

/** Whether the box at `pos` overlaps no solid block (in a loaded column; unloaded ones count as free here). */
export function boxFree(world: IWorld, pos: Vec3, hw: number, height: number): boolean {
  const x0 = Math.floor(pos.x - hw + EPS);
  const x1 = Math.floor(pos.x + hw - EPS);
  const z0 = Math.floor(pos.z - hw + EPS);
  const z1 = Math.floor(pos.z + hw - EPS);
  const y0 = Math.floor(pos.y + EPS);
  const y1 = Math.floor(pos.y + height - EPS);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!world.isLoaded(x, z)) continue;
        const h = solidHeight(world, x, y, z);
        if (h > 0 && y + h > pos.y + EPS) return false;
      }
    }
  }
  return true;
}
