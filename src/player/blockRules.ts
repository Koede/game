/**
 * Pure per-block rules of the player's interaction: which dig sound a block makes, which screen using it opens,
 * how a placed block faces, and the wording of placement and harvesting hints.
 */
import type { ScreenRequest, SfxName } from '../core/gameEvents';
import { ITEMS, block, hearthWallTier, machineOfBlock } from '../core/registry';
import { FACING_TO_FACE, Facing, voxelFacing, type BlockDef, type Face, type Voxel } from '../core/types';
import type { Slot } from '../core/types';
import { effectiveTier, isCrop, toolMatches } from '../game';

/** Which dig sound a block makes. Crops are machine blocks but plants: they rustle like any other plant. */
export function digSound(def: BlockDef): SfxName {
  if (def.shape === 'cross') return 'dig_sand';
  if ((def.machine && !isCrop(def)) || def.power || def.station) return def.tool === 'axe' ? 'dig_wood' : 'dig_metal';
  if (def.tool === 'axe') return 'dig_wood';
  if (def.tool === 'shovel') return def.key === 'sand' || def.key === 'gravel' || def.key === 'snow' ? 'dig_sand' : 'dig_dirt';
  if (def.tool === 'pickaxe') return 'dig_stone';
  return def.opaque ? 'dig_dirt' : 'dig_sand';
}

/**
 * Pitch of a dig sound for what is in hand: the right tool rings fuller the better it is, a bare hand or the wrong
 * tool taps lightly and high, and a tool too weak for the block thuds dull and low.
 */
export function digPitch(def: BlockDef, held: Slot): number {
  if (!toolMatches(def, held)) return 1.18;
  return effectiveTier(def, held) >= def.minTier ? 0.94 + Math.min(5, effectiveTier(def, held)) * 0.04 : 0.82;
}

/** The screen that using this block opens, or null (crops, wild bushes, brewing setups and hand stations are machine blocks without a screen). */
export function screenFor(def: BlockDef, x: number, y: number, z: number): ScreenRequest | null {
  if (def.station === 'workbench') return { type: 'workbench', x, y, z };
  const role = def.machine ? machineOfBlock(def)?.role : undefined;
  if (!def.machine || isCrop(def) || role === 'bush' || role === 'brew' || role === 'hand') return null;
  if (def.machine === 'furnace') return { type: 'furnace', x, y, z };
  if (def.machine === 'crate') return { type: 'crate', x, y, z };
  return { type: 'machine', x, y, z };
}

/**
 * Blocks that are normally built against machines and stations: machines and generators (an engine on a furnace,
 * tanks stacked), cables, pipes and hearth walls. Held, they are placed on any face of a screen block except its
 * front, instead of opening its screen (spec 3.6).
 */
export function buildsOnto(def: BlockDef): boolean {
  return def.machine !== null || def.power !== null || def.pipe !== null || def.key === 'electrode' || hearthWallTier(def.key) > 0;
}

/** The face a block's screen is opened from when a building block is held: the front of an oriented block, else none. */
export function frontFace(def: BlockDef, voxel: Voxel): Face | null {
  return def.oriented ? FACING_TO_FACE[voxelFacing(voxel)] : null;
}

/** Facing that turns a block's front towards a player looking along yaw (0 = north, positive turns left). */
export function facingTowards(yaw: number): Facing {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  if (Math.abs(lookZ) >= Math.abs(lookX)) return lookZ < 0 ? Facing.South : Facing.North;
  return lookX > 0 ? Facing.West : Facing.East;
}

/** Name of the cheapest tool that harvests the block, for the "needs a ..." hint. */
export function toolNeeded(def: BlockDef): string | null {
  for (const it of ITEMS) {
    const tool = it.tool;
    if (tool && tool.tier === def.minTier && (tool.kind === def.tool || tool.universal)) return it.name.toLowerCase();
  }
  return null;
}

/** Why `def` cannot be placed on what is below: what it must stand on (crops: how to make farmland). */
export function placeOnAdvice(def: BlockDef): string {
  if (isCrop(def)) {
    const seed = ITEMS.find((it) => it.block === def.key)?.name ?? def.name;
    return `${seed} can only be planted on farmland - till grass or dirt with a hoe first`;
  }
  const names = (def.placeOn ?? []).map((k) => block(k).name.toLowerCase());
  return `${def.name} can only be placed on ${names.join(', ')}`;
}
