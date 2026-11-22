/**
 * Renamed or removed item keys. Item, fluid, aspect, objective, flag, research and recipe keys are NEVER deleted or
 * renamed silently: a rename adds `OLD: 'new'` here, a removal maps to a replacement item (or `scrap_metal`). Loads
 * go through `canonicalItemKey` (core/registry) so an old save keeps its items; keys that resolve to nothing are
 * counted (`takeLostItems`) so the player is told once instead of items vanishing in silence.
 */
export const ITEM_ALIASES: Readonly<Record<string, string>> = {
  // 'old_key': 'new_key',
};

const lost = new Map<string, number>();

/** Records an item key a load could not resolve (kept for one toast and a diag line). */
export function noteLostItem(key: string): void {
  lost.set(key, (lost.get(key) ?? 0) + 1);
}

/** The unresolved keys seen since the last call (key -> stacks), and forgets them. */
export function takeLostItems(): Map<string, number> {
  const out = new Map(lost);
  lost.clear();
  return out;
}
