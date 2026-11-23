/**
 * Recipe helper logic (docs/api/assist.md): what a pinned recipe still lacks, split by where the rest is (pack, nearby
 * chests), and how many recipes each station could make right now from the ingredients at hand. Pure; no DOM.
 */
import { recipesAt } from '../core/registry';
import type { RecipeDef } from '../core/types';
import { maxCraftable, mergeAmounts, tally } from './crafting';
import type { Inventory } from './inventory';

export interface PinnedIngredient {
  item: string;
  need: number;
  inPack: number;
  inChests: number;
  /** Still lacking after the pack and the chests (0 = enough). */
  missing: number;
}

export interface PinnedStatus {
  recipeId: string;
  output: string;
  ingredients: PinnedIngredient[];
  /** Every ingredient is within reach (pack plus chests). */
  ready: boolean;
  /** Ready from the pack alone. */
  readyFromPack: boolean;
}

export function pinnedStatus(recipe: RecipeDef, pack: Inventory, chests: readonly Inventory[] = []): PinnedStatus {
  const packTally = tally([pack]);
  const chestTally = tally(chests.filter((c) => c !== pack));
  const ingredients = mergeAmounts(recipe.inputs).map((need) => {
    const inPack = packTally.get(need.item) ?? 0;
    const inChests = chestTally.get(need.item) ?? 0;
    return { item: need.item, need: need.count, inPack, inChests, missing: Math.max(0, need.count - inPack - inChests) };
  });
  return {
    recipeId: recipe.id,
    output: recipe.output.item,
    ingredients,
    ready: ingredients.every((i) => i.missing === 0),
    readyFromPack: ingredients.every((i) => i.inPack >= i.need),
  };
}

export interface StationReady {
  station: string;
  /** Distinct products whose ingredients are all at hand (heat, tier and power are not checked here). */
  count: number;
}

/** Stations the "can make now" line reports, in order. */
export const HELPER_STATIONS: readonly string[] = ['hand', 'workbench', 'furnace'];

export function canMakeNow(sources: readonly Inventory[], stations: readonly string[] = HELPER_STATIONS): StationReady[] {
  const counts = tally(sources);
  return stations.map((station) => {
    const products = new Set<string>();
    for (const r of recipesAt(station)) {
      if (!products.has(r.output.item) && maxCraftable(r, sources, undefined, 1, counts) >= 1) products.add(r.output.item);
    }
    return { station, count: products.size };
  });
}
