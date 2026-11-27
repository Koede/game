/**
 * Inventory housekeeping for the player's pack (docs/api/inventory.md): sort and merge a range of slots, move every stack
 * of one item at once, and the favourite and locked slots both of them leave alone. Pure functions over `Inventory`.
 */
import { itemOrNull } from '../core/registry';
import type { Slot } from '../core/types';
import { canMerge, cloneStack, stackLimit, type Inventory } from './inventory';
import { quickMove } from './transfer';

/** Favourite slots of an inventory: sort and "move all" never touch them. Kept per inventory so every screen sees them. */
const favourites = new WeakMap<Inventory, Set<number>>();

export function favouritesOf(inv: Inventory): Set<number> {
  let s = favourites.get(inv);
  if (!s) favourites.set(inv, (s = new Set()));
  return s;
}

export const isFavourite = (inv: Inventory, slot: number): boolean => favouritesOf(inv).has(slot);

/** Marks or unmarks a slot (only a slot holding something can be a favourite). Returns whether it is one now. */
export function toggleFavourite(inv: Inventory, slot: number): boolean {
  const fav = favouritesOf(inv);
  if (fav.has(slot)) fav.delete(slot);
  else if (inv.slots[slot]) fav.add(slot);
  inv.notifyChanged();
  return fav.has(slot);
}

/** Replaces the favourites from a save (anything off the inventory is dropped). */
export function setFavourites(inv: Inventory, slots: readonly unknown[] | undefined): void {
  const fav = favouritesOf(inv);
  fav.clear();
  for (const n of slots ?? []) if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < inv.size) fav.add(n);
}

/** Locks or unlocks a slot (see Inventory.locked). Returns whether it is locked now. */
export function toggleLock(inv: Inventory, slot: number): boolean {
  if (slot < 0 || slot >= inv.size) return false;
  if (inv.locked.has(slot)) inv.locked.delete(slot);
  else inv.locked.add(slot);
  inv.notifyChanged();
  return inv.locked.has(slot);
}

/**
 * How a range is sorted. 'kind': category, then tool tier (best first), then name (the default). 'recent': the most
 * recently picked up stack first, then 'kind' for ties.
 */
export type SortMode = 'kind' | 'recent';

const modes = new WeakMap<Inventory, SortMode>();
export const sortModeOf = (inv: Inventory): SortMode => modes.get(inv) ?? 'kind';
/** The sort order the Sort button uses for this inventory. A display choice: it is not saved. */
export const setSortMode = (inv: Inventory, mode: SortMode): void => void modes.set(inv, mode);

/** Pack order: tools and gear first, then what is eaten or burnt, then raw and worked materials, blocks, machines, odds and ends. */
const ORDER = ['tool', 'armour', 'food', 'fuel', 'material', 'component', 'resource', 'block', 'machine', 'misc'];
const rank = (item: string): number => {
  const def = itemOrNull(item);
  // Worn gear carries its own spec but sits in 'misc' (padded coat, cuirass): it sorts with the tools.
  const group = def?.armour ? 'armour' : def?.category ?? 'misc';
  const i = ORDER.indexOf(group);
  return i < 0 ? ORDER.length : i;
};
const tierOf = (item: string): number => itemOrNull(item)?.tool?.tier ?? 0;

/** The 'kind' order: category, tier (higher first), name, count, then the more worn last. */
const byKind = (a: NonNullable<Slot>, b: NonNullable<Slot>): number =>
  rank(a.item) - rank(b.item) || tierOf(b.item) - tierOf(a.item) || a.item.localeCompare(b.item) || b.count - a.count || (b.durability ?? 0) - (a.durability ?? 0);

/**
 * Merges stacks of the same item (tools with wear stay separate) and packs everything to the front of [start, end)
 * in the chosen order. Favourite and locked slots stay exactly where they are. Each stack keeps the newest pickup tick
 * of the stacks it came from. Returns how many slots it freed.
 */
export function sortRange(inv: Inventory, start: number, end = inv.size, mode: SortMode = sortModeOf(inv)): number {
  const fav = favouritesOf(inv);
  const idx: number[] = [];
  for (let i = start; i < Math.min(end, inv.size); i++) if (!fav.has(i) && !inv.locked.has(i)) idx.push(i);
  const stacks: { s: NonNullable<Slot>; tick: number }[] = [];
  for (const i of idx) {
    const s = inv.slots[i];
    if (s) stacks.push({ s: cloneStack(s), tick: inv.tickOf(i) });
  }
  const merged: { s: NonNullable<Slot>; tick: number }[] = [];
  for (const { s, tick } of stacks) {
    let left = s.count;
    for (const m of merged) {
      if (left <= 0) break;
      if (!canMerge(m.s, s) || m.s.count >= stackLimit(m.s.item)) continue;
      const put = Math.min(left, stackLimit(m.s.item) - m.s.count);
      m.s.count += put;
      m.tick = Math.max(m.tick, tick);
      left -= put;
    }
    while (left > 0) {
      const n = Math.min(left, stackLimit(s.item));
      merged.push({ s: { ...s, count: n }, tick });
      left -= n;
    }
  }
  merged.sort(
    mode === 'recent' ? (a, b) => b.tick - a.tick || byKind(a.s, b.s) : (a, b) => byKind(a.s, b.s),
  );
  inv.batch(() => {
    idx.forEach((slot, k) => {
      const m = merged[k];
      inv.slots[slot] = m ? m.s : null;
      inv.setTick(slot, m ? m.tick : 0);
    });
    inv.notifyChanged();
  });
  return stacks.length - merged.length;
}

/**
 * Moves every stack of `item` out of `from` (favourite and locked slots stay) into the destinations in order. Returns
 * how many moved.
 */
export function moveAllOf(from: Inventory, item: string, to: readonly { inventory: Inventory; start: number; end: number }[]): number {
  const fav = favouritesOf(from);
  let moved = 0;
  for (let i = 0; i < from.size; i++) {
    const s = from.slots[i];
    if (!s || s.item !== item || fav.has(i) || from.locked.has(i)) continue;
    for (const t of to) {
      if (!from.slots[i]) break;
      moved += quickMove(from, i, t.inventory, t.start, t.end);
    }
  }
  return moved;
}
