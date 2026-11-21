/**
 * Ingredient logic shared by every station (hand, workbench, furnace forge, furnace upgrades). Ingredients are
 * counted and taken across several inventories in priority order - the player's first, then nearby crates.
 * Temperature and tier gates are the simulation's business; it calls these functions for the items.
 */
import type { SfxName } from '../core/gameEvents';
import { itemOrNull, recipesAt } from '../core/registry';
import type { ItemAmount, RecipeDef } from '../core/types';
import type { Inventory } from './inventory';
import type { PlayerState } from './playerState';

/** The parts of a recipe crafting cares about (a RecipeDef or RecipeSpec both fit). */
export interface CraftRecipe {
  inputs: readonly ItemAmount[];
  output: ItemAmount;
  byproducts?: readonly ItemAmount[];
}

/** Item key -> total count over a set of inventories. Build one with `tally` when checking many recipes. */
export type ItemTally = ReadonlyMap<string, number>;

export interface IngredientStatus {
  item: string;
  need: number;
  have: number;
  ok: boolean;
}

export interface Availability {
  /** Every ingredient is there. */
  ok: boolean;
  /** One entry per distinct ingredient, in recipe order. */
  ingredients: IngredientStatus[];
}

export type CraftResult =
  | { ok: true; made: ItemAmount[] }
  | { ok: false; reason: string; missing: ItemAmount[] };

export const HAND_RECIPES: readonly RecipeDef[] = recipesAt('hand');
export const WORKBENCH_RECIPES: readonly RecipeDef[] = recipesAt('workbench');
/** Everything the workbench screen offers: its own recipes first, then every hand recipe too. */
export const BENCH_RECIPES: readonly RecipeDef[] = [...WORKBENCH_RECIPES, ...HAND_RECIPES];

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;
const isTally = (sources: readonly Inventory[] | ItemTally): sources is ItemTally => sources instanceof Map;

/** Sums duplicate entries and multiplies by `times`. */
export function mergeAmounts(list: readonly ItemAmount[], times = 1): ItemAmount[] {
  const merged: ItemAmount[] = [];
  for (const entry of list) {
    const known = merged.find((m) => m.item === entry.item);
    if (known) known.count += entry.count * times;
    else merged.push({ item: entry.item, count: entry.count * times });
  }
  return merged;
}

/** Counts everything in the given inventories (an inventory listed twice counts once). */
export function tally(sources: readonly Inventory[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const inv of new Set(sources)) {
    for (const s of inv.slots) if (s) counts.set(s.item, (counts.get(s.item) ?? 0) + s.count);
  }
  return counts;
}

function countIn(sources: readonly Inventory[] | ItemTally, item: string): number {
  if (isTally(sources)) return sources.get(item) ?? 0;
  let total = 0;
  for (const inv of new Set(sources)) total += inv.count(item);
  return total;
}

/** Have / need for a plain ingredient list (a recipe's inputs, a furnace upgrade cost), made `times` over. */
export function ingredientStatus(inputs: readonly ItemAmount[], sources: readonly Inventory[] | ItemTally, times = 1): Availability {
  const ingredients = mergeAmounts(inputs, times).map((need) => {
    const have = countIn(sources, need.item);
    return { item: need.item, need: need.count, have, ok: have >= need.count };
  });
  return { ok: ingredients.every((i) => i.ok), ingredients };
}

/** Have / need per ingredient of a recipe across the sources. */
export function availability(recipe: CraftRecipe, sources: readonly Inventory[] | ItemTally, times = 1): Availability {
  return ingredientStatus(recipe.inputs, sources, times);
}

const missingOf = (status: Availability): ItemAmount[] =>
  status.ingredients.filter((i) => !i.ok).map((i) => ({ item: i.item, count: i.need - i.have }));

function removeAll(need: readonly ItemAmount[], sources: readonly Inventory[]): void {
  for (const n of need) {
    let left = n.count;
    for (const inv of sources) {
      if (left <= 0) break;
      left -= inv.remove(n.item, left);
    }
  }
}

function batched<T>(inventories: readonly Inventory[], fn: () => T, index = 0): T {
  return index >= inventories.length ? fn() : inventories[index].batch(() => batched(inventories, fn, index + 1));
}

/**
 * Takes a list of ingredients from the sources in order. Atomic: when anything is missing nothing is taken
 * and false is returned.
 */
export function takeIngredients(inputs: readonly ItemAmount[], sources: readonly Inventory[], times = 1): boolean {
  const unique = [...new Set(sources)];
  if (!ingredientStatus(inputs, unique, times).ok) return false;
  batched(unique, () => removeAll(mergeAmounts(inputs, times), unique));
  return true;
}

/** Whether the outputs fit into the destination once the ingredients are gone (they may free slots in it). */
function outputsFit(need: readonly ItemAmount[], made: readonly ItemAmount[], sources: readonly Inventory[], destination: Inventory): boolean {
  if (!sources.includes(destination)) return destination.canFit(made);
  const trial = destination.clone();
  for (const n of need) {
    let left = n.count;
    for (const inv of sources) {
      if (left <= 0) break;
      left -= inv === destination ? trial.remove(n.item, left) : Math.min(left, inv.count(n.item));
    }
  }
  for (const m of made) if (trial.add(m.item, m.count) > 0) return false;
  return true;
}

const outputsOf = (recipe: CraftRecipe, times: number): ItemAmount[] =>
  mergeAmounts([recipe.output, ...(recipe.byproducts ?? [])], times);

function describe(list: readonly ItemAmount[]): string {
  return list.map((m) => `${m.count} ${nameOf(m.item)}`).join(', ');
}

/**
 * Makes a recipe `times` over. Atomic: either every ingredient is taken (sources in order) and every output is
 * added to the destination, or nothing changes and the result says why.
 */
export function craft(recipe: CraftRecipe, sources: readonly Inventory[], destination: Inventory, times = 1): CraftResult {
  const n = Math.floor(times);
  if (!(n >= 1)) return { ok: false, reason: 'Nothing to make', missing: [] };
  const unique = [...new Set(sources)];
  const status = ingredientStatus(recipe.inputs, unique, n);
  if (!status.ok) {
    const missing = missingOf(status);
    return { ok: false, reason: `Missing ${describe(missing)}`, missing };
  }
  const need = mergeAmounts(recipe.inputs, n);
  const made = outputsOf(recipe, n);
  if (!outputsFit(need, made, unique, destination)) {
    return { ok: false, reason: `No room for ${describe(made)}`, missing: [] };
  }
  batched([...unique, destination], () => {
    removeAll(need, unique);
    for (const m of made) destination.add(m.item, m.count);
  });
  return { ok: true, made };
}

/**
 * How many times in a row the recipe can be made right now, at most `limit`. With a destination the outputs
 * must fit as well; 0 means a single craft would be refused. `counts` may pass a tally of the same sources
 * that was built once for a whole recipe list.
 */
export function maxCraftable(
  recipe: CraftRecipe,
  sources: readonly Inventory[],
  destination?: Inventory,
  limit = Infinity,
  counts?: ItemTally,
): number {
  const have = counts ?? sources;
  let n = Math.floor(limit);
  for (const need of mergeAmounts(recipe.inputs)) n = Math.min(n, Math.floor(countIn(have, need.item) / need.count));
  if (!(n >= 1) || !destination) return Math.max(0, n);
  const single = !recipe.byproducts || recipe.byproducts.length === 0;
  // Enough free room even before the ingredients leave: the common case, and it needs no dry run.
  if (single && destination.space(recipe.output.item) >= recipe.output.count * n) return n;
  const unique = [...new Set(sources)];
  const fits = (k: number): boolean => outputsFit(mergeAmounts(recipe.inputs, k), outputsOf(recipe, k), unique, destination);
  if (!fits(1)) return 0;
  if (!Number.isFinite(n)) return 1;
  let lo = 1;
  let hi = n;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface PlayerCraftOptions {
  /** Further ingredient sources after the player's own inventory (crates near the station). */
  crates?: readonly Inventory[];
  times?: number;
  /** Sound to request on success. Default 'craft'; null for none. */
  sfx?: SfxName | null;
}

/**
 * A craft by the player at a station: ingredients from the player's inventory first, then the crates; outputs
 * into the player's inventory. On success emits 'item:made' for every output (and the sound).
 */
export function craftByPlayer(player: PlayerState, recipe: RecipeDef, options: PlayerCraftOptions = {}): CraftResult {
  const sources = [player.inventory, ...(options.crates ?? [])];
  const result = craft(recipe, sources, player.inventory, options.times ?? 1);
  if (!result.ok) return result;
  for (const m of result.made) {
    player.bus.emit('item:made', { item: m.item, count: m.count, station: recipe.station, recipeId: recipe.id });
  }
  const sfx = options.sfx === undefined ? 'craft' : options.sfx;
  if (sfx) player.bus.emit('sfx', { name: sfx });
  return result;
}
