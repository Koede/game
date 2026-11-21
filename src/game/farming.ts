/**
 * Farming rules (spec 12.4) as functions over the world: tilling grass or dirt into farmland with a hoe, planting
 * seeds (and potatoes / carrots) on farmland, and reading a crop block's stage. Crop GROWTH is the simulation's.
 * The player's "use" calls these; scripted tests can too. DOM-free.
 */
import { block, blockOfItem, blockOrNull, itemOrNull } from '../core/registry';
import { AIR, Face, Facing, WORLD_HEIGHT, makeVoxel, type BlockDef, type IWorld, type Slot } from '../core/types';
import type { BlockPos, PlayerState } from './playerState';

/** Blocks a hoe turns into farmland (the same list as the content solver's TILLABLE_BLOCKS). */
export const TILLABLE: readonly string[] = ['grass', 'dirt'];
/** Durability one tilled block takes from the hoe. */
export const TILL_WEAR = 1;
/** Machine kind of crop blocks. */
export const CROP_MACHINE = 'crop';

/**
 * What "use" is aimed at: the hit cell, the face the ray entered through and the cell across it. The player's
 * RayHit has this shape.
 */
export interface UseTarget {
  x: number;
  y: number;
  z: number;
  face: Face;
  px: number;
  py: number;
  pz: number;
  block: BlockDef;
}

export interface CropStage {
  /** The crop's base key: 'wheat', 'potato', 'carrot'. */
  crop: string;
  /** 0-based stage. */
  stage: number;
  /** Number of stages (the last one is ripe). */
  stages: number;
  ripe: boolean;
}

/** The held stack is a hoe. */
export const isHoe = (stack: Slot): boolean => stack !== null && itemOrNull(stack.item)?.tool?.kind === 'hoe';

/** A growing plant on farmland (a `crop` machine block): it has no screen. */
export const isCrop = (def: BlockDef): boolean => def.machine === CROP_MACHINE;

const stageCache = new Map<number, CropStage | null>();

/** Stage of a crop block (`<crop>_<n>`, the last stage being ripe), or null for anything else. */
export function cropStage(def: BlockDef): CropStage | null {
  const cached = stageCache.get(def.id);
  if (cached !== undefined) return cached;
  let result: CropStage | null = null;
  const m = isCrop(def) ? /^(.+)_(\d+)$/.exec(def.key) : null;
  if (m) {
    const crop = m[1];
    let stages = 0;
    while (blockOrNull(`${crop}_${stages}`)?.machine === CROP_MACHINE) stages++;
    const stage = Number(m[2]);
    result = { crop, stage, stages, ripe: stage === stages - 1 };
  }
  stageCache.set(def.id, result);
  return result;
}

export const isRipeCrop = (def: BlockDef): boolean => cropStage(def)?.ripe === true;

/** True when a hoe used on face `face` of (x, y, z) tills it: grass or dirt, its top face, air above. */
export function canTill(world: IWorld, x: number, y: number, z: number, face: Face): boolean {
  if (face !== Face.PY || y + 1 >= WORLD_HEIGHT || !world.isLoaded(x, z)) return false;
  if (tillResult(world.getBlock(x, y, z)) === null) return false;
  return world.getVoxel(x, y + 1, z) === AIR;
}

/** The block a hoe turns `def` into (farmland for grass and dirt), or null when it cannot be tilled. */
export function tillResult(def: BlockDef): BlockDef | null {
  return TILLABLE.includes(def.key) ? block('farmland') : null;
}

/**
 * Tills the target with the held hoe: the block becomes farmland, the hoe wears by TILL_WEAR, flag 'tilled' and
 * sfx 'till' are emitted. Returns false (changing nothing) when the target cannot be tilled or no hoe is held.
 */
export function till(world: IWorld, player: PlayerState, target: UseTarget): boolean {
  if (player.dead || !isHoe(player.heldStack())) return false;
  const { x, y, z } = target;
  if (!canTill(world, x, y, z, target.face)) return false;
  const farmland = tillResult(target.block)!;
  if (!world.setVoxel(x, y, z, makeVoxel(farmland.id, Facing.North), 'player')) return false;
  player.wearHeldTool(TILL_WEAR);
  player.bus.emit('flag', { flag: 'tilled' });
  player.bus.emit('sfx', { name: 'till', x: x + 0.5, y: y + 1, z: z + 0.5 });
  return true;
}

/** The crop block an item plants (wheat_seeds -> wheat_0, potato -> potato_0, ...), or null. */
export function plantedBy(itemKey: string): BlockDef | null {
  const def = blockOfItem(itemKey);
  return def && isCrop(def) ? def : null;
}

/** The cell a block placed against the target goes into: the hit cell when it is replaceable, else across the face. */
export function placementCell(target: UseTarget): BlockPos {
  const into = target.block.replaceable && target.block.liquid === null;
  return into ? { x: target.x, y: target.y, z: target.z } : { x: target.px, y: target.py, z: target.pz };
}

/**
 * Where using `itemKey` on the target would plant it: the placement cell when the item plants a crop, the cell is
 * loaded, inside the world, replaceable and not liquid, and stands on a block the crop accepts (farmland). Else null.
 */
export function plantCell(world: IWorld, itemKey: string, target: UseTarget): BlockPos | null {
  const crop = plantedBy(itemKey);
  if (!crop || target.block.liquid !== null) return null;
  const cell = placementCell(target);
  const { x, y, z } = cell;
  if (y < 1 || y >= WORLD_HEIGHT || !world.isLoaded(x, z)) return null;
  const here = world.getBlock(x, y, z);
  if (!here.replaceable || here.liquid !== null) return null;
  const below = world.getBlock(x, y - 1, z).key;
  return crop.placeOn === null || crop.placeOn.includes(below) ? cell : null;
}

/**
 * Plants the held item on the target: one item is used, the stage-0 crop block is set, 'block:placed' (the
 * objective 'plant_seeds' counts it) and sfx 'plant' are emitted. Returns the planted cell, or null when nothing
 * was planted.
 */
export function plant(world: IWorld, player: PlayerState, target: UseTarget): BlockPos | null {
  const held = player.heldStack();
  if (player.dead || !held) return null;
  const cell = plantCell(world, held.item, target);
  const crop = plantedBy(held.item);
  if (!cell || !crop) return null;
  const voxel = makeVoxel(crop.id, Facing.North);
  if (!world.setVoxel(cell.x, cell.y, cell.z, voxel, 'player')) return null;
  player.consumeHeld(1);
  player.bus.emit('block:placed', { x: cell.x, y: cell.y, z: cell.z, voxel });
  player.bus.emit('sfx', { name: 'plant', x: cell.x + 0.5, y: cell.y + 0.2, z: cell.z + 0.5 });
  return cell;
}

/**
 * A block that must stand on something (`placeOn`: crops, wild plants, tall grass) and no longer does - the block
 * under it was removed. Breaking a block pops such a plant above it.
 */
export function isUnsupported(world: IWorld, x: number, y: number, z: number): boolean {
  const def = world.getBlock(x, y, z);
  if (def.placeOn === null || y <= 0) return false;
  return !def.placeOn.includes(world.getBlock(x, y - 1, z).key);
}
