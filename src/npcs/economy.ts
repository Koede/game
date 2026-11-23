/**
 * Coin (docs/api/npcs.md): earned at the quest board (one bounty per progression goal) and from Old Bram; spent on Gruk's help.
 * Coins are a counter kept by the NpcManager, not an item.
 */
import { AGES, OBJECTIVES, itemOrNull } from '../core/registry';
import type { ObjectiveSpec } from '../core/types';

/** What the board pays for a goal: more in later ages, a bonus for furnace milestones. */
export function bountyOf(o: ObjectiveSpec): number {
  const age = Math.min(o.age, AGES.length - 1);
  const milestone = o.condition.type === 'furnaceTier' ? 40 : 0;
  return 8 + age * 6 + milestone;
}

/** Every bounty in goal order. */
export const BOUNTIES: readonly { id: string; title: string; coin: number; age: number }[] = OBJECTIVES.map((o) => ({ id: o.id, title: o.title, coin: bountyOf(o), age: o.age }));

/**
 * What Old Bram pays per item: by kind and age, with a bonus for tools and machines. He pays anything but never much for junk;
 * `mood` (0.7..1.4) is his mood for this sale.
 */
export function priceOf(itemKey: string, mood = 1): number {
  const it = itemOrNull(itemKey);
  if (!it) return 0;
  const base: Record<string, number> = { resource: 1.5, material: 2.5, component: 4, fuel: 1.5, food: 2, tool: 7, machine: 12, block: 1, misc: 2 };
  let v = base[it.category] ?? 2;
  v *= 1 + it.age * 0.6;
  if (it.tool) v += it.tool.tier * 3;
  return Math.max(1, Math.round(v * mood));
}

/** Total for a stack. */
export const stackPrice = (itemKey: string, count: number, mood = 1): number => Math.max(0, Math.round(priceOf(itemKey, mood) * count));
