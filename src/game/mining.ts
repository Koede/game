/** The pure rules of breaking blocks (spec 3.6): how long it takes, whether anything drops, what drops, tool wear. */
import { WELL_WARMED_MINING_BONUS } from '../core/constants';
import { itemOrNull } from '../core/registry';
import type { BlockDef, ItemAmount, Slot, ToolSpec } from '../core/types';

/** Mining below the block's tier is this many times slower (and yields nothing). */
export const UNDER_TIER_SLOWDOWN = 3;

export const toolOf = (held: Slot): ToolSpec | null => (held ? itemOrNull(held.item)?.tool ?? null : null);

/** The held tool works on this block: its kind is the block's tool kind, or it is universal. */
export function toolMatches(block: BlockDef, held: Slot): boolean {
  const tool = toolOf(held);
  return tool !== null && (tool.universal === true || (block.tool !== null && tool.kind === block.tool));
}

/** Tier the held stack counts as against this block: 0 for bare hands, other items and the wrong kind of tool. */
export function effectiveTier(block: BlockDef, held: Slot): number {
  return toolMatches(block, held) ? toolOf(held)?.tier ?? 0 : 0;
}

export const canMine = (block: BlockDef): boolean => block.hardness >= 0;

/** True when breaking the block with this stack in hand yields its drops. */
export function canHarvest(block: BlockDef, held: Slot): boolean {
  return canMine(block) && effectiveTier(block, held) >= block.minTier;
}

/**
 * Seconds to break the block. Infinity when it cannot be mined at all. `speedMult` is any other factor on the
 * mining speed, normally `player.buffs.miningMult` (the Vigor drink).
 */
export function miningTime(block: BlockDef, held: Slot, wellWarmed: boolean, speedMult = 1): number {
  if (!canMine(block)) return Infinity;
  let speed = toolMatches(block, held) ? toolOf(held)?.speed ?? 1 : 1;
  if (wellWarmed) speed *= WELL_WARMED_MINING_BONUS;
  speed *= speedMult;
  const time = block.hardness / speed;
  return canHarvest(block, held) ? time : time * UNDER_TIER_SLOWDOWN;
}

/** Rolls the block's drop table. `rng` returns floats in [0, 1); entries for the same item are summed. */
export function rollDrops(block: BlockDef, rng: () => number): ItemAmount[] {
  const drops: ItemAmount[] = [];
  for (const d of block.drops) {
    if (d.chance !== undefined && d.chance < 1 && rng() >= d.chance) continue;
    const count = typeof d.count === 'number' ? d.count : d.count[0] + Math.floor(rng() * (d.count[1] - d.count[0] + 1));
    if (count <= 0) continue;
    const known = drops.find((x) => x.item === d.item);
    if (known) known.count += count;
    else drops.push({ item: d.item, count });
  }
  return drops;
}

/** What breaking the block with this stack in hand yields: its rolled drops, or nothing below the block's tier. */
export function harvest(block: BlockDef, held: Slot, rng: () => number): ItemAmount[] {
  return canHarvest(block, held) ? rollDrops(block, rng) : [];
}

/** Durability the held stack loses by breaking this block: 1 for a tool that matches it, otherwise 0. */
export function wear(block: BlockDef, held: Slot): number {
  return canMine(block) && toolMatches(block, held) ? 1 : 0;
}
