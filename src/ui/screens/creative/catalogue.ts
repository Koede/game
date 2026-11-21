/** The Dev Mode item catalogue: every registry item once, grouped by `ItemSpec.category`, searchable. DOM-free. */
import { ITEMS } from '../../../core/registry';
import type { ItemCategory } from '../../../core/types';
import { stackLimit, type Inventory } from '../../../game/inventory';

export type CreativeTabId = 'all' | 'block' | 'material' | 'tool' | 'food' | 'machine' | 'fuel' | 'misc';

export interface CreativeTab {
  id: CreativeTabId;
  label: string;
  /** The item categories that land in this tab. */
  categories: readonly ItemCategory[];
}

/** 'all' first, then one tab per group; every ItemCategory belongs to exactly one group. */
export const CREATIVE_TABS: readonly CreativeTab[] = [
  { id: 'all', label: 'All', categories: [] },
  { id: 'block', label: 'Blocks', categories: ['block'] },
  { id: 'material', label: 'Materials', categories: ['resource', 'material', 'component'] },
  { id: 'tool', label: 'Tools', categories: ['tool'] },
  { id: 'food', label: 'Food', categories: ['food'] },
  { id: 'machine', label: 'Machines', categories: ['machine'] },
  { id: 'fuel', label: 'Fuel', categories: ['fuel'] },
  { id: 'misc', label: 'Misc', categories: ['misc'] },
];

export interface CatalogueEntry {
  key: string;
  name: string;
  desc: string;
  category: ItemCategory;
  tab: Exclude<CreativeTabId, 'all'>;
  /** Lower-cased "name key desc" for the search. */
  haystack: string;
}

/** The tab an item category belongs to (anything unknown goes to Misc). */
export function tabOfCategory(category: ItemCategory): Exclude<CreativeTabId, 'all'> {
  for (const tab of CREATIVE_TABS) if (tab.id !== 'all' && tab.categories.includes(category)) return tab.id as Exclude<CreativeTabId, 'all'>;
  return 'misc';
}

/** Every item of the registry, in registry order, exactly once. */
export function buildCatalogue(items: readonly { key: string; name: string; desc?: string; category: ItemCategory }[] = ITEMS): CatalogueEntry[] {
  return items.map((it) => ({
    key: it.key,
    name: it.name,
    desc: it.desc ?? '',
    category: it.category,
    tab: tabOfCategory(it.category),
    haystack: `${it.name} ${it.key.replace(/_/g, ' ')} ${it.desc ?? ''}`.toLowerCase(),
  }));
}

/** Entries of a tab that match every word of the query (case-insensitive; name, key and description). */
export function filterCatalogue(entries: readonly CatalogueEntry[], tab: CreativeTabId, query: string): CatalogueEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => (tab === 'all' || e.tab === tab) && words.every((w) => e.haystack.includes(w)));
}

/** How many entries each tab holds for the current query (the tab badges). */
export function tabCounts(entries: readonly CatalogueEntry[], query: string): Record<CreativeTabId, number> {
  const counts = {} as Record<CreativeTabId, number>;
  for (const tab of CREATIVE_TABS) counts[tab.id] = filterCatalogue(entries, tab.id, query).length;
  return counts;
}

/** Puts one item (or a full stack) into the pack. Returns how many did not fit. */
export function grantItem(inventory: Inventory, key: string, full: boolean): number {
  return inventory.add(key, full ? stackLimit(key) : 1);
}

/** The trash slot: empties one inventory slot. Returns whether anything was removed. */
export function clearSlot(inventory: Inventory, index: number): boolean {
  if (!inventory.slots[index]) return false;
  inventory.set(index, null);
  return true;
}
