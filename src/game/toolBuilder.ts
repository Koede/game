/**
 * The Tool Builder's rules (docs/plans/modular-tools.md): what a build needs and how it compares, building it, and
 * reworking a tool in the pack (replace one part with one from the pack, the old part comes back). DOM-free; the panel is
 * src/ui/screens/workbench/toolBuilderPanel.ts.
 */
import { amounts } from '../content/amounts';
import {
  BINDINGS, HANDLES, buildStats, buildTraits, headItemKey, partInputs, partsOfItem, type PartRole, type ToolBuild,
} from '../content/toolParts';
import { itemOrNull, recipe } from '../core/registry';
import type { ItemAmount, RecipeDef } from '../core/types';
import { BUILD_RECIPES, craftByPlayer, maxCraftable, mergeAmounts, type CraftResult } from './crafting';
import { buildItemKey } from '../content/toolParts';
import type { Inventory } from './inventory';
import type { PlayerState } from './playerState';
import { swapPart } from './toolParts';

export const nameOfItem = (key: string): string => itemOrNull(key)?.name ?? key;

/** The items one build costs. */
export const buildNeeds = (b: ToolBuild): ItemAmount[] => mergeAmounts(amounts(partInputs(b)));

/** The assembly recipe of a build: ours, or (bronze's plain builds) the handwork's own. */
export function recipeForBuild(b: ToolBuild): RecipeDef | null {
  const key = buildItemKey(b);
  return BUILD_RECIPES.find((r) => r.output.item === key) ?? recipe(`bronze_${b.kind}`) ?? null;
}

/** Items missing for a build, from `inv` (empty when it can be built now). */
export function missingForBuild(b: ToolBuild, inv: Inventory): ItemAmount[] {
  return buildNeeds(b).filter((n) => inv.count(n.item) < n.count).map((n) => ({ item: n.item, count: n.count - inv.count(n.item) }));
}

export function buildTool(player: PlayerState, b: ToolBuild): CraftResult {
  const r = recipeForBuild(b);
  if (!r) return { ok: false, reason: 'That cannot be built', missing: [] };
  return craftByPlayer(player, r, { sfx: 'craft' });
}

export const canBuildNow = (b: ToolBuild, inv: Inventory): boolean => {
  const r = recipeForBuild(b);
  return r !== null && maxCraftable(r, [inv], inv, 1) >= 1;
};

export interface StatRow {
  label: string;
  value: number;
  /** Against the tool compared with (null: nothing to compare). */
  delta: number | null;
}

/** The numbers of a build for the preview, each against a tool held (any build of the same kind, or null). */
export function previewRows(b: ToolBuild, against: ToolBuild | null): StatRow[] {
  const s = buildStats(b);
  const o = against && against.kind === b.kind ? buildStats(against) : null;
  const rows: StatRow[] = [];
  if (b.kind === 'pickaxe' || b.kind === 'axe' || b.kind === 'shovel') rows.push({ label: 'Mining speed', value: s.speed, delta: o ? Math.round((s.speed - o.speed) * 100) / 100 : null });
  if (s.damage !== undefined) rows.push({ label: 'Damage', value: s.damage, delta: o?.damage !== undefined ? s.damage - o.damage : null });
  rows.push({ label: 'Uses', value: s.durability, delta: o ? s.durability - o.durability : null });
  rows.push({ label: 'Mining tier', value: s.tier, delta: o ? s.tier - o.tier : null });
  return rows;
}
export { buildTraits };

/** What replacing one part costs from the pack. */
export function partNeeds(b: ToolBuild, role: PartRole, material: string): ItemAmount[] {
  if (role === 'head') return [{ item: headItemKey(material, b.kind), count: 1 }];
  if (role === 'binding') return [{ item: BINDINGS[material].item, count: 1 }];
  return mergeAmounts(amounts(HANDLES[material].inputs));
}

export type ReworkResult = { ok: true; item: string; returned: string } | { ok: false; reason: string };

/** Replaces `role` of the tool in pack slot `slot` with `material`: the new part leaves the pack, the old one comes back. Atomic. */
export function reworkTool(inv: Inventory, slot: number, role: PartRole, material: string): ReworkResult {
  const stack = inv.slots[slot];
  const build = stack ? partsOfItem(stack.item) : null;
  if (!stack || !build) return { ok: false, reason: 'That has no parts to swap' };
  const swapped = swapPart(stack, role, material);
  if (!swapped.ok) return swapped;
  const needs = partNeeds(build, role, material);
  const missing = needs.filter((n) => inv.count(n.item) < n.count);
  if (missing.length > 0) return { ok: false, reason: `Missing ${missing.map((n) => `${n.count - inv.count(n.item)} ${nameOfItem(n.item)}`).join(', ')}` };
  const trial = inv.clone();
  for (const n of needs) trial.remove(n.item, n.count);
  trial.slots[slot] = swapped.stack;
  if (trial.add(swapped.returned, 1) > 0) return { ok: false, reason: 'No room for the old part: free a slot' };
  inv.batch(() => {
    for (const n of needs) inv.remove(n.item, n.count);
    inv.set(slot, swapped.stack);
    inv.add(swapped.returned, 1);
  });
  return { ok: true, item: swapped.stack.item, returned: swapped.returned };
}

/** Pack slots holding a tool made of parts, with their builds. */
export function reworkable(inv: Inventory): Array<{ slot: number; item: string; build: ToolBuild }> {
  const out: Array<{ slot: number; item: string; build: ToolBuild }> = [];
  inv.slots.forEach((s, slot) => {
    const build = s ? partsOfItem(s.item) : null;
    if (s && build) out.push({ slot, item: s.item, build });
  });
  return out;
}
