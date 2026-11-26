/**
 * Tool quality and repair (docs/api/tool-quality.md). A tool is made plain, fine or masterwork; better work holds
 * more durability (`QUALITY_DURABILITY_MULT`). A worn tool is repaired at an anvil with the material it is made
 * of: each unit restores a quarter of its best durability. Pure rules over stacks and inventories; DOM-free.
 */
import { HEADS, partsOfItem } from '../content/toolParts';
import { itemOrNull } from '../core/registry';
import type { ItemStack } from '../core/types';
import { QUALITY_DURABILITY_MULT, maxDurabilityOf, type Inventory } from './inventory';

export type Quality = 1 | 2;

export const QUALITY_NAME: Readonly<Record<0 | 1 | 2, string>> = { 0: 'Plain', 1: 'Fine', 2: 'Masterwork' };
/** Base odds a freshly made tool is fine / masterwork. `skill` (0..1) from a hot window or good hands shifts them. */
export const FINE_CHANCE = 0.2;
export const MASTERWORK_CHANCE = 0.05;
/** Share of the best durability one repair unit restores. */
export const REPAIR_FRACTION = 0.25;

/** What a tool of this metal or wood is mended with (the part before the tool kind in its key). */
export const REPAIR_MATERIALS: Readonly<Record<string, string>> = {
  wooden: 'plank',
  flint: 'flint',
  bronze: 'bronze_ingot',
  iron: 'iron_ingot',
  steel: 'steel_ingot',
};

/** The item that repairs this tool, or null when it cannot be repaired (not a tool, or a material with no repair). */
export function repairMaterial(item: string): string | null {
  const def = itemOrNull(item);
  if (!def?.tool) return null;
  const kind = def.tool.kind;
  // A modular build mends with its head's material (src/content/toolParts.ts); a legacy tool reads as its default build.
  const build = partsOfItem(item);
  if (build) return HEADS[build.head]?.repair ?? null;
  if (!item.endsWith(`_${kind}`)) return null;
  return REPAIR_MATERIALS[item.slice(0, -kind.length - 1)] ?? null;
}

/** Quality for a tool being made: `roll` is a uniform [0,1) draw, `skill` raises both odds (0 = none, 1 = double). */
export function rollQuality(roll: number, skill = 0): 0 | Quality {
  const k = 1 + Math.max(0, Math.min(1, skill));
  if (roll < MASTERWORK_CHANCE * k) return 2;
  if (roll < (MASTERWORK_CHANCE + FINE_CHANCE) * k) return 1;
  return 0;
}

/** Gives a made tool stack its workmanship: full durability at that quality. Returns the stack (unchanged for non-tools). */
export function applyQuality(stack: ItemStack, quality: 0 | Quality): ItemStack {
  if (!itemOrNull(stack.item)?.tool || !quality) return stack;
  stack.quality = quality;
  stack.durability = maxDurabilityOf(stack.item, quality)!;
  return stack;
}

export const qualityOf = (stack: ItemStack): 0 | Quality => stack.quality ?? 0;
/** "Fine Iron Pickaxe" style label prefix, '' for plain. */
export const qualityLabel = (stack: ItemStack): string => (stack.quality ? QUALITY_NAME[stack.quality] : '');

/** How worn a stack is: 0 fresh .. 1 about to break; null when it does not wear. */
export function wearFraction(stack: ItemStack): number | null {
  const max = maxDurabilityOf(stack.item, stack.quality);
  if (max === undefined || stack.durability === undefined) return null;
  return 1 - Math.min(1, stack.durability / max);
}

export type RepairResult =
  | { ok: true; used: number; durability: number; item: string }
  | { ok: false; reason: string };

/**
 * Repairs `stack` using the material from `sources` (pack first, then crates): as many units as it takes to fill it,
 * at most what the sources hold. Atomic on failure.
 */
export function repairTool(stack: ItemStack, sources: readonly Inventory[]): RepairResult {
  const mat = repairMaterial(stack.item);
  const max = maxDurabilityOf(stack.item, stack.quality);
  if (!mat || max === undefined || stack.durability === undefined) return { ok: false, reason: 'That cannot be repaired' };
  if (stack.durability >= max) return { ok: false, reason: 'Already as good as it gets' };
  const perUnit = Math.max(1, Math.round(max * REPAIR_FRACTION));
  const want = Math.ceil((max - stack.durability) / perUnit);
  let used = 0;
  for (const inv of new Set(sources)) {
    if (used >= want) break;
    used += inv.remove(mat, want - used);
  }
  if (used === 0) return { ok: false, reason: `Needs ${itemOrNull(mat)?.name ?? mat} to repair` };
  stack.durability = Math.min(max, stack.durability + used * perUnit);
  return { ok: true, used, durability: stack.durability, item: mat };
}

export { QUALITY_DURABILITY_MULT };
