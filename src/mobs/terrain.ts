/**
 * How animals read the voxels around them: what blocks a body, where a column can be stood on from a given
 * height (the rule behind "never step into liquid, a drop deeper than MOB_MAX_DROP or beside lava or a
 * cactus"), and where a group may spawn. Unloaded columns count as walls everywhere, so an animal never walks
 * into missing terrain.
 */
import { MOB_MAX_DROP } from '../core/constants';
import { blockOf, blockOrNull } from '../core/registry';
import { WORLD_HEIGHT, voxelActive, type IWorld } from '../core/types';

/** Height of the solid part of a cell: 0 (passable), 0.5 (slab) or 1. Unloaded and below-world cells are 1. */
export function solidHeight(world: IWorld, x: number, y: number, z: number): number {
  if (y < 0) return 1;
  if (y >= WORLD_HEIGHT) return 0;
  if (!world.isLoaded(x, z)) return 1;
  const v = world.getVoxel(x, y, z);
  const def = blockOf(v);
  if (!def.solid) return 0;
  // Doors (docs/api/door.md): open is passable, closed is a wall. Mobs never open doors themselves.
  if (def.shape === 'door') return voxelActive(v) ? 0 : 1;
  return def.shape === 'slab' ? 0.5 : 1;
}

/** Liquid in a cell (null when none or unloaded). */
export function liquidAt(world: IWorld, x: number, y: number, z: number): 'water' | 'lava' | 'oil' | null {
  if (y < 0 || y >= WORLD_HEIGHT) return null;
  return blockOf(world.getVoxel(x, y, z)).liquid;
}

/** A cell that hurts on contact (lava, cactus: BlockDef.contactDamage > 0). */
export function hazardAt(world: IWorld, x: number, y: number, z: number): boolean {
  if (y < 0 || y >= WORLD_HEIGHT) return false;
  return blockOf(world.getVoxel(x, y, z)).contactDamage > 0;
}

/**
 * A body standing at feet cell y in column (x, z) would be next to something that hurts: in its own column from
 * the ground block up to its head, or in one of the four side columns from its feet up to its head. Keeping a
 * one-block margin means a body centred in its cell never touches a hazard (see contactHazard).
 */
function nearHazard(world: IWorld, x: number, z: number, y: number, clearance: number): boolean {
  for (let c = y - 1; c < y + clearance; c++) if (hazardAt(world, x, c, z)) return true;
  for (let c = y; c < y + clearance; c++) {
    if (hazardAt(world, x + 1, c, z) || hazardAt(world, x - 1, c, z) || hazardAt(world, x, c, z + 1) || hazardAt(world, x, c, z - 1)) return true;
  }
  return false;
}

/** Any hazard within `r` columns (square) of (x, z) between heights y0 and y1 inclusive. */
function hazardWithin(world: IWorld, x: number, z: number, y0: number, y1: number, r: number): boolean {
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) for (let y = y0; y <= y1; y++) if (hazardAt(world, x + dx, y, z + dz)) return true;
  }
  return false;
}

/** Spawn spots keep this many blocks from lava and cacti. */
export const SPAWN_HAZARD_MARGIN = 2;

/** Cells (blocks) of headroom a body of height h needs. */
export const clearanceOf = (h: number): number => Math.max(1, Math.ceil(h - 1e-6));

/** A cell an animal can occupy: not solid, not liquid, loaded. */
function open(world: IWorld, x: number, y: number, z: number): boolean {
  if (y >= WORLD_HEIGHT) return true;
  if (y < 0 || !world.isLoaded(x, z)) return false;
  const v = world.getVoxel(x, y, z);
  const def = blockOf(v);
  if (def.shape === 'door') return voxelActive(v);
  return !def.solid && def.liquid === null;
}

/**
 * The feet cell an animal walking at feet cell `fy` would stand in after entering column (x, z), or NaN when it
 * must not go there: a wall more than one block high, liquid, a drop deeper than MOB_MAX_DROP, not loaded, or
 * a hazard (lava, cactus) underfoot or beside the body (nearHazard). A result of fy + 1 means it hops up one
 * block.
 */
export function standCell(world: IWorld, x: number, z: number, fy: number, clearance: number): number {
  if (!world.isLoaded(x, z)) return NaN;
  if (solidHeight(world, x, fy, z) > 0) {
    // A step: everything above it up to the body's height must be free.
    for (let y = fy + 1; y <= fy + clearance; y++) if (!open(world, x, y, z)) return NaN;
    return nearHazard(world, x, z, fy + 1, clearance) ? NaN : fy + 1;
  }
  for (let y = fy; y >= fy - MOB_MAX_DROP; y--) {
    if (liquidAt(world, x, y, z) !== null) return NaN;
    if (solidHeight(world, x, y - 1, z) > 0) {
      for (let c = y; c < fy + clearance; c++) if (!open(world, x, c, z)) return NaN;
      return nearHazard(world, x, z, y, clearance) ? NaN : y;
    }
  }
  return NaN;
}

/**
 * Feet cell at the end of a straight walk from (x0, z0) at feet cell fy to (x1, z1), or NaN when the walk
 * crosses a column standCell refuses.
 */
export function walkable(world: IWorld, x0: number, z0: number, fy: number, x1: number, z1: number, clearance: number): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / 0.5));
  let cy = fy;
  let lastX = Math.floor(x0);
  let lastZ = Math.floor(z0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.floor(x0 + dx * t);
    const cz = Math.floor(z0 + dz * t);
    if (cx === lastX && cz === lastZ) continue;
    // Diagonal corner cuts must be passable through at least one of the two side cells.
    if (cx !== lastX && cz !== lastZ) {
      const a = standCell(world, cx, lastZ, cy, clearance);
      const b = standCell(world, lastX, cz, cy, clearance);
      if (Number.isNaN(a) && Number.isNaN(b)) return NaN;
    }
    const next = standCell(world, cx, cz, cy, clearance);
    if (Number.isNaN(next)) return NaN;
    cy = next;
    lastX = cx;
    lastZ = cz;
  }
  return cy;
}

/** Natural ground a group may spawn on. The Scar has no grass, so its basalt and gravel count too; marsh peat. */
const SPAWN_GROUND: ReadonlySet<number> = new Set(
  ['grass', 'dirt', 'snow', 'sand', 'gravel', 'basalt', 'peat'].map((k) => blockOrNull(k)?.id ?? -1).filter((id) => id >= 0),
);

/**
 * Feet cell of a spawn spot in column (x, z), or -1: the highest solid block must be natural ground, open to
 * the sky (only plants above it), with headroom for the body, no liquid on top and no lava or cactus within
 * SPAWN_HAZARD_MARGIN blocks.
 */
export function spawnCell(world: IWorld, x: number, z: number, clearance: number): number {
  if (!world.isLoaded(x, z)) return -1;
  let y = world.surfaceY(x, z);
  if (y < 0) return -1;
  // Step down through plants standing on the ground.
  while (y > 0) {
    const def = blockOf(world.getVoxel(x, y, z));
    if (def.liquid !== null) return -1;
    if (def.solid) break;
    y--;
  }
  if (!SPAWN_GROUND.has(blockOf(world.getVoxel(x, y, z)).id)) return -1;
  for (let c = y + 1; c <= y + clearance; c++) if (!open(world, x, c, z)) return -1;
  if (hazardWithin(world, x, z, y, y + clearance, SPAWN_HAZARD_MARGIN)) return -1;
  return y + 1;
}

/**
 * Nearest dry column an animal in water can climb out to, searched in growing rings up to `radius`: its top
 * solid block sits at most one block above the water surface level `wy` with headroom and no liquid on it.
 * Writes the column centre to out[0], out[1]; false when there is none.
 */
export function findShore(world: IWorld, x: number, z: number, wy: number, radius: number, clearance: number, out: number[]): boolean {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  for (let r = 1; r <= radius; r++) {
    let best = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = bx + dx;
        const cz = bz + dz;
        if (!world.isLoaded(cx, cz)) continue;
        // Ground at the waterline or one block above it, dry on top.
        for (let gy = wy + 1; gy >= wy - 1; gy--) {
          if (solidHeight(world, cx, gy, cz) === 0) continue;
          let clear = true;
          for (let c = gy + 1; c <= gy + clearance; c++) if (!open(world, cx, c, cz)) clear = false;
          if (clear) {
            const d = dx * dx + dz * dz;
            if (d < best) {
              best = d;
              out[0] = cx + 0.5;
              out[1] = cz + 0.5;
            }
          }
          break;
        }
      }
    }
    if (best < Infinity) return true;
  }
  return false;
}
