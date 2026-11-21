/**
 * Turns hand / workbench recipes into RecipeList rows with have/need figures, and makes them. DOM-free.
 * Ingredients come from the player's inventory first, then any crates near the station.
 */
import { itemOrNull } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import { craftByPlayer, maxCraftable, mergeAmounts, tally, type CraftResult, type ItemTally } from '../../../game/crafting';
import type { Inventory } from '../../../game/inventory';
import type { PlayerState } from '../../../game/playerState';
import type { RecipeRowView } from '../../kit/recipe';
import { productBadges } from '../food';

export const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;

/** The most crafts one tap of the batch button asks for. */
export const BATCH = 5;

/** One row: what it makes, have/need per ingredient, how many can be made now, and why not. */
export function recipeRowView(recipe: RecipeDef, sources: readonly Inventory[], destination: Inventory, counts: ItemTally): RecipeRowView {
  const ingredients = mergeAmounts(recipe.inputs).map((need) => ({
    item: need.item,
    name: nameOf(need.item),
    have: counts.get(need.item) ?? 0,
    need: need.count,
  }));
  const available = maxCraftable(recipe, sources, destination, 99, counts);
  let reason: string | undefined;
  if (available === 0) {
    const missing = ingredients.filter((i) => i.have < i.need);
    reason =
      missing.length > 0
        ? `Missing ${missing.map((i) => `${i.need - i.have} ${i.name}`).join(', ')}`
        : `No room for ${nameOf(recipe.output.item)} - free a slot`;
  }
  return {
    id: recipe.id,
    item: recipe.output.item,
    name: nameOf(recipe.output.item),
    count: recipe.output.count,
    requirements: productBadges(recipe),
    ingredients,
    available,
    reason,
  };
}

/**
 * Rows for a whole list, in authored order (rows never jump around under the player's finger). Variants that make
 * the same item (planks from oak or pine logs) share one row: the variant that can be made most often, else the first.
 */
export function recipeRows(recipes: readonly RecipeDef[], sources: readonly Inventory[], destination: Inventory): RecipeRowView[] {
  const counts = tally(sources);
  const byOutput = new Map<string, RecipeRowView>();
  const order: string[] = [];
  for (const r of recipes) {
    const view = recipeRowView(r, sources, destination, counts);
    const key = r.output.item;
    const best = byOutput.get(key);
    if (!best) order.push(key);
    if (!best || view.available > best.available) byOutput.set(key, view);
  }
  return order.map((key) => byOutput.get(key) as RecipeRowView);
}

/** Makes a recipe `times` times (as many as possible up to that), from the player and the given crates. */
export function makeRecipe(player: PlayerState, recipe: RecipeDef, times: number, crates: readonly Inventory[]): CraftResult {
  const sources = [player.inventory, ...crates];
  const n = Math.max(1, Math.min(times, maxCraftable(recipe, sources, player.inventory, times)));
  return craftByPlayer(player, recipe, { crates, times: n });
}
