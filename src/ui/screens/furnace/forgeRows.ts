/**
 * The furnace's recipe lists as kit RecipeRowViews, DOM-free: the FORGE tab (the simulation's ForgeRows, every
 * forge recipe in tech-tree order, with category, requirement badges and have/need chips) and the SMELT tab's
 * reference list (every smelt recipe with a Load button).
 */
import { blockOfItem, furnaceTier, itemOrNull, machineOfBlock } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import type { ForgeRow, SmeltRow } from '../../../sim';
import type { RecipeCategory, RecipeRequirement, RecipeRowView } from '../../kit/recipe';
import { isKitchenRecipe, KITCHEN, productBadges } from '../food';
import { heatRoute } from './fuelText';
import { pretty } from './simApi';

export type ForgeCategory = 'tools' | 'parts' | 'machines' | 'kitchen';

/**
 * Four chips, shown only under "Everything" (the default view lists what can be made now, no chips): Kitchen first so
 * cooking is easy to find, then Tools, Machines (machines and power parts) and Parts (materials and building blocks).
 * Four fit a phone without the bar scrolling.
 */
export const FORGE_CATEGORIES: readonly RecipeCategory[] = [
  KITCHEN,
  { id: 'tools', label: 'Tools' },
  { id: 'machines', label: 'Machines' },
  { id: 'parts', label: 'Parts' },
];

export type SmeltCategory = 'materials' | 'fuel' | 'kitchen';

/** The SMELT tab's chips: Kitchen gathers the roasts, the baked potato and bread so cooking is easy to find. */
export const SMELT_CATEGORIES: readonly RecipeCategory[] = [
  KITCHEN,
  { id: 'materials', label: 'Materials' },
  { id: 'fuel', label: 'Fuel' },
];

export function smeltCategory(recipe: RecipeDef): SmeltCategory {
  if (isKitchenRecipe(recipe)) return 'kitchen';
  return itemOrNull(recipe.output.item)?.fuel ? 'fuel' : 'materials';
}

/** The most one tap of the batch button asks for. */
export const FORGE_BATCH = 5;

export const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;

/** Which chip a recipe sits under, from what it makes. */
export function forgeCategory(recipe: RecipeDef): ForgeCategory {
  if (isKitchenRecipe(recipe)) return 'kitchen';
  const key = recipe.output.item;
  const item = itemOrNull(key);
  if (item?.tool || item?.category === 'tool' || item?.category === 'misc') return 'tools';
  const block = blockOfItem(key);
  if (block) {
    if (block.power === 'cable') return 'machines';
    return machineOfBlock(block) ? 'machines' : 'parts';
  }
  return 'parts';
}

/** How many in a row the Make buttons may ask for right now (0 = none). */
export function forgeAvailable(row: ForgeRow): number {
  if (!row.canMake) return 0;
  return Math.max(1, Math.min(row.max, row.heatAllows, 99));
}

/** "Uses 4 Firebrick, 2 Clay" - what the recipe takes, said once (the detail view has the have/need chips). */
export function usesText(ingredients: readonly { name: string; need: number }[]): string {
  if (ingredients.length === 0) return '';
  const shown = ingredients.slice(0, 3).map((i) => (i.need > 1 ? `${i.need} ${i.name}` : i.name));
  return `Uses ${shown.join(', ')}${ingredients.length > 3 ? ` +${ingredients.length - 3}` : ''}`;
}

/** The row's refusal, with how to reach the heat when the fire is too cold (the furnace's tier allows the recipe). */
function forgeReason(row: ForgeRow, electric: boolean): string | undefined {
  if (!row.reason) return undefined;
  const r = row.recipe;
  if (!row.locked && !row.tempOk) return `Needs ${r.minTempC} °C - ${heatRoute(r.minTempC, electric)}`;
  return pretty(row.reason);
}

/** `electric`: this furnace can heat electrically (named among the ways to reach a recipe's heat). */
export function forgeRowView(row: ForgeRow, electric = false): RecipeRowView {
  const r = row.recipe;
  const requirements: RecipeRequirement[] = [
    { text: `${r.minTempC} °C`, kind: 'heat', met: row.tempOk, tempC: r.minTempC },
  ];
  if (row.locked) requirements.unshift({ text: furnaceTier(r.minTier).name, kind: 'tier', met: false });
  requirements.push(...productBadges(r));
  return {
    id: r.id,
    item: r.output.item,
    name: nameOf(r.output.item),
    count: r.output.count,
    category: forgeCategory(r),
    requirements,
    ingredients: row.ingredients.map((s) => ({ item: s.item, name: nameOf(s.item), have: s.have, need: s.need })),
    available: forgeAvailable(row),
    reason: forgeReason(row, electric),
    summary: [usesText(row.ingredients.map((i) => ({ name: nameOf(i.item), need: i.need }))), ...productBadges(r).filter((b) => b.kind === 'food').slice(0, 1).map((b) => b.text)].filter(Boolean).join(' - '),
    locked: row.locked,
    action: 'Forge',
  };
}

/** How much of a row's ingredients the player holds, 0..1. */
const heldShare = (row: ForgeRow): number =>
  row.ingredients.length === 0 ? 1 : row.ingredients.reduce((sum, i) => sum + Math.min(1, i.have / i.need), 0) / row.ingredients.length;

/**
 * The FORGE list in tech-tree order. Variants that make the same item (hearth stew from chop, mutton or fowl) show
 * every one the player holds the ingredients for, or else only the one they are closest to (the first on a tie).
 */
export function forgeRowViews(rows: readonly ForgeRow[], electric = false): RecipeRowView[] {
  const groups = new Map<string, ForgeRow[]>();
  for (const row of rows) {
    const key = row.recipe.output.item;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const out: RecipeRowView[] = [];
  for (const group of groups.values()) {
    const ready = group.filter((r) => r.max > 0);
    if (ready.length > 0) {
      for (const row of ready) out.push(forgeRowView(row, electric));
      continue;
    }
    let best = group[0];
    for (const row of group) if (heldShare(row) > heldShare(best)) best = row;
    out.push(forgeRowView(best, electric));
  }
  return out;
}

/** Rows that can be forged right now (the FORGE tab badge). */
export const forgeReady = (rows: readonly ForgeRow[]): number => rows.reduce((n, row) => n + (row.canMake ? 1 : 0), 0);

/** The message after a forge call that made fewer than asked (the chill or the ingredients stopped it). */
export function forgeShortfall(made: number, asked: number, item: string): string | null {
  if (made >= asked || made <= 0) return null;
  return `Forged ${made} of ${asked} ${nameOf(item)} - it ran too cold or short of ingredients`;
}

/** One reference row per smelt recipe: Load moves a stack of its input into a free crucible. */
export function smeltRowView(row: SmeltRow): RecipeRowView {
  const r = row.recipe;
  const input = r.inputs[0];
  return {
    id: r.id,
    item: r.output.item,
    name: nameOf(r.output.item),
    count: r.output.count,
    category: smeltCategory(r) === 'kitchen' ? 'kitchen' : 'parts',
    requirements: [
      ...(row.locked ? [{ text: pretty(row.reason ?? ''), kind: 'tier' as const, met: false }] : []),
      { text: `${r.minTempC} °C`, kind: 'heat', met: row.tempOk, tempC: r.minTempC },
      { text: `${r.timeS} s`, kind: 'time' },
      ...productBadges(r),
    ],
    ingredients: [{ item: input.item, name: nameOf(input.item), have: row.have, need: input.count }],
    available: row.locked ? 0 : Math.floor(row.have / input.count),
    reason: row.locked ? pretty(row.reason ?? '') : `Bring ${input.count > 1 ? `${input.count} ` : ''}${nameOf(input.item)}`,
    summary: `Takes ${input.count > 1 ? `${input.count} ` : ''}${nameOf(input.item)} - ${r.timeS} s at ${r.minTempC} °C`,
    locked: row.locked,
    action: 'Load',
    single: true,
  };
}

/**
 * The smelt reference list in authored order. Routes to the same product (charcoal from oak or pine, copper from
 * ore or crushed copper) show only the ones the player holds input for, or the plain route when none.
 */
export function smeltRowViews(rows: readonly SmeltRow[]): RecipeRowView[] {
  const held = new Set(rows.filter((r) => r.have > 0).map((r) => r.recipe.output.item));
  const shown = new Set<string>();
  const out: RecipeRowView[] = [];
  for (const row of rows) {
    const product = row.recipe.output.item;
    const keep = held.has(product) ? row.have > 0 : !shown.has(product);
    if (!keep) continue;
    shown.add(product);
    out.push(smeltRowView(row));
  }
  return out;
}
