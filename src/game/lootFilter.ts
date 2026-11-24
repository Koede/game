/**
 * Loot filter (Settings.lootFilter): 'all' picks up every drop as before; 'junk' leaves the junk lying where it is (rubble,
 * dirt, seeds, sand, gravel), so a player who digs a lot is not walked over by heaps of it. Pure, shared by the pickup
 * (game/groundItems.ts) and the settings screen.
 */
export type LootFilter = 'all' | 'junk';
export const LOOT_FILTERS: readonly LootFilter[] = ['all', 'junk'];

/** Items the 'junk' filter leaves behind. Any seeds count (wheat_seeds, and any *_seeds added later). */
export const JUNK_ITEMS: ReadonlySet<string> = new Set(['rubble', 'dirt', 'sand', 'gravel']);
const SEEDS = /(^|_)seeds?$/;

export const isLootFilter = (v: unknown): v is LootFilter => typeof v === 'string' && (LOOT_FILTERS as readonly string[]).includes(v);

/** True for the rubbish the 'junk' filter ignores. */
export const isJunk = (item: string): boolean => JUNK_ITEMS.has(item) || SEEDS.test(item);

/** Whether the filter lets the player pick `item` up. */
export const takesItem = (filter: LootFilter, item: string): boolean => filter === 'all' || !isJunk(item);
