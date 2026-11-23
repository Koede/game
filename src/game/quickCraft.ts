/**
 * Quick-craft (docs/api/assist.md): make a hand recipe from the pack alone without opening a screen, and repeat the last hand recipe
 * made (by any route: this, or the inventory screen) in one tap. Pure rules; the HUD chip is src/ui/hud/quickCraft.ts.
 */
import { recipe as recipeById } from '../core/registry';
import type { RecipeDef } from '../core/types';
import { HAND_RECIPES, craftByPlayer, maxCraftable, tally, type CraftResult } from './crafting';
import type { PlayerState } from './playerState';

export const handRecipe = (id: string | null | undefined): RecipeDef | null => {
  const r = id ? recipeById(id) : null;
  return r && r.station === 'hand' ? r : null;
};

/** Makes a hand recipe `times` over from the pack (as many as fit, at least one is tried). Records it as the last hand recipe on success. */
export function quickCraft(player: PlayerState, id: string, times = 1): CraftResult {
  const recipe = handRecipe(id);
  if (!recipe) return { ok: false, reason: 'That cannot be made by hand', missing: [] };
  const n = Math.max(1, Math.min(Math.floor(times) || 1, maxCraftable(recipe, [player.inventory], player.inventory, times)));
  return craftByPlayer(player, recipe, { times: n });
}

/** Makes the last hand recipe once more; null when there is none yet. */
export function repeatLastHand(player: PlayerState): CraftResult | null {
  const last = handRecipe(player.assist.lastHand);
  return last ? quickCraft(player, last.id, 1) : null;
}

export interface QuickEntry {
  recipe: RecipeDef;
  /** Times it can be made right now from the pack. */
  available: number;
}

/** Hand recipes the pack can make right now, one per product, the last made first, then authored order; at most `limit`. */
export function quickList(player: PlayerState, limit = 8): QuickEntry[] {
  const counts = tally([player.inventory]);
  const seen = new Set<string>();
  const out: QuickEntry[] = [];
  const last = handRecipe(player.assist.lastHand);
  for (const recipe of last ? [last, ...HAND_RECIPES] : HAND_RECIPES) {
    if (seen.has(recipe.output.item)) continue;
    const available = maxCraftable(recipe, [player.inventory], player.inventory, 99, counts);
    if (available < 1) continue;
    seen.add(recipe.output.item);
    out.push({ recipe, available });
    if (out.length >= limit) break;
  }
  return out;
}
