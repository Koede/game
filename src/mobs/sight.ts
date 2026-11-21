/**
 * What an automaton reads from the voxels (spec 19.2-19.3): line of sight through the grid (a DDA walk, so no wall
 * is ever skipped), open sky above a spot, and the block light at a spot (from the emitters around it: the baked
 * light lives only in chunk meshes). Unloaded columns block sight and count as roofs.
 */
import { blockOf } from '../core/registry';
import { WORLD_HEIGHT, voxelActive, type IWorld } from '../core/types';

/** 'sight' is stopped by opaque solid blocks (eyes see through glass); 'solid' by any solid block (bolts, arcs). */
export type LineMode = 'sight' | 'solid';

function blocks(world: IWorld, x: number, y: number, z: number, mode: LineMode): boolean {
  if (y < 0) return true;
  if (y >= WORLD_HEIGHT) return false;
  if (!world.isLoaded(x, z)) return true;
  const def = blockOf(world.getVoxel(x, y, z));
  return mode === 'sight' ? def.solid && def.opaque : def.solid;
}

/**
 * True when nothing blocks the straight line from (x0, y0, z0) to (x1, y1, z1). The cells of both end points are
 * not tested (the eyes of whoever looks and whatever is looked at are in open cells).
 */
export function lineClear(world: IWorld, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mode: LineMode): boolean {
  let ix = Math.floor(x0);
  let iy = Math.floor(y0);
  let iz = Math.floor(z0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const ez = Math.floor(z1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const sz = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  // Parameter t along the segment (0..1) at which the next cell boundary on each axis is crossed.
  const tdx = sx !== 0 ? 1 / Math.abs(dx) : Infinity;
  const tdy = sy !== 0 ? 1 / Math.abs(dy) : Infinity;
  const tdz = sz !== 0 ? 1 / Math.abs(dz) : Infinity;
  let tx = sx > 0 ? (ix + 1 - x0) * tdx : sx < 0 ? (x0 - ix) * tdx : Infinity;
  let ty = sy > 0 ? (iy + 1 - y0) * tdy : sy < 0 ? (y0 - iy) * tdy : Infinity;
  let tz = sz > 0 ? (iz + 1 - z0) * tdz : sz < 0 ? (z0 - iz) * tdz : Infinity;
  let steps = Math.abs(ex - ix) + Math.abs(ey - iy) + Math.abs(ez - iz);
  while (steps-- > 0) {
    if (tx <= ty && tx <= tz) {
      ix += sx;
      tx += tdx;
    } else if (ty <= tz) {
      iy += sy;
      ty += tdy;
    } else {
      iz += sz;
      tz += tdz;
    }
    if (ix === ex && iy === ey && iz === ez) return true;
    if (blocks(world, ix, iy, iz, mode)) return false;
  }
  return true;
}

/** No opaque block anywhere above cell (x, y, z) (unloaded columns count as covered). */
export function skyOpenAt(world: IWorld, x: number, y: number, z: number): boolean {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  if (!world.isLoaded(bx, bz)) return false;
  const top = world.surfaceY(bx, bz);
  for (let cy = Math.max(0, Math.floor(y)); cy <= top; cy++) if (blockOf(world.getVoxel(bx, cy, bz)).opaque) return false;
  return true;
}

/** Block light never travels farther than this (levels 0..15; one level lost per block). */
const LIGHT_REACH = 15;

/**
 * Block light at cell (x, y, z), estimated as the brightest emitter's level minus its block (Manhattan) distance -
 * walls are ignored, so the estimate errs on the bright (no-spawn) side. Only emitters that could reach `atLeast`
 * are visited: a call asking "is it >= 7 here" walks an octahedron of radius 8. Returns the estimate, capped at
 * what is needed: any value >= atLeast means "at least that".
 */
export function blockLightAt(world: IWorld, x: number, y: number, z: number, atLeast: number): number {
  const bx = Math.floor(x);
  const by = Math.floor(y);
  const bz = Math.floor(z);
  const r = LIGHT_REACH - atLeast;
  let best = 0;
  for (let dy = -r; dy <= r; dy++) {
    const cy = by + dy;
    if (cy < 0 || cy >= WORLD_HEIGHT) continue;
    const ry = r - Math.abs(dy);
    for (let dz = -ry; dz <= ry; dz++) {
      const rz = ry - Math.abs(dz);
      for (let dx = -rz; dx <= rz; dx++) {
        const v = world.getVoxel(bx + dx, cy, bz + dz);
        if (v === 0) continue;
        const def = blockOf(v);
        const emit = voxelActive(v) ? def.lightActive : def.light;
        if (emit === 0) continue;
        const l = emit - Math.abs(dx) - Math.abs(dy) - Math.abs(dz);
        if (l > best) {
          best = l;
          if (best >= atLeast) return best;
        }
      }
    }
  }
  return best;
}
