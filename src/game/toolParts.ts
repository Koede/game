/**
 * Swapping parts of a modular tool (docs/plans/modular-tools.md phase 3, rules only; the build rules and content are in
 * src/content/toolParts.ts). A tool keeps its enchants and workmanship through a swap and keeps the SAME share of wear;
 * the part taken off comes back as an item. Pure over stacks.
 */
import { partReturn, partsOfItem, swapPartKey, type PartRole, type ToolBuild } from '../content/toolParts';
import type { ItemStack } from '../core/types';
import { makeStack, maxDurabilityOf } from './inventory';

export type SwapResult = { ok: true; stack: ItemStack; returned: string } | { ok: false; reason: string };

/** The build a tool stack is made of, or null when it is not a pickaxe, axe or shovel. */
export const buildOfStack = (stack: ItemStack): ToolBuild | null => partsOfItem(stack.item);

/** Replaces `role` of the tool with `material`. The caller takes the new part from the pack; `returned` is the old part's item. */
export function swapPart(stack: ItemStack, role: PartRole, material: string): SwapResult {
  const build = partsOfItem(stack.item);
  if (!build) return { ok: false, reason: 'That tool has no parts to swap' };
  if (build[role] === material) return { ok: false, reason: 'It already has that part' };
  const key = swapPartKey(stack.item, role, material);
  if (key === null) return { ok: false, reason: 'That part does not fit this tool' };
  const oldMax = maxDurabilityOf(stack.item, stack.quality);
  const newMax = maxDurabilityOf(key, stack.quality);
  if (oldMax === undefined || newMax === undefined || stack.durability === undefined) return { ok: false, reason: 'That tool cannot be rebuilt' };
  const durability = Math.max(1, Math.min(newMax, Math.round((stack.durability / oldMax) * newMax)));
  return { ok: true, stack: makeStack(key, 1, durability, stack.quality, stack.enchants), returned: partReturn(build, role) };
}
