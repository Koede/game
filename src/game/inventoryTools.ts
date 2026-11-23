/**
 * Inventory housekeeping for the player's pack (docs/api/inventory.md): sort and merge a range of slots, move every stack
 * of one item at once, and the favourite slots both of them leave alone. Pure functions over `Inventory`.
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

const ORDER = ['tool', 'weapon', 'armor', 'food', 'fuel', 'material', 'machine', 'misc'];
const rank = (item: string): number => {
  const i = ORDER.indexOf(itemOrNull(item)?.category ?? 'misc');
  return i < 0 ? ORDER.length : i;
};

/**
 * Merges stacks of the same item (tools with wear stay separate) and packs everything to the front of [start, end) in
 * category, then item order. Favourite slots stay exactly where they are. Returns how many slots it freed.
 */
export function sortRange(inv: Inventory, start: number, end = inv.size): number {
  const fav = favouritesOf(inv);
  const idx: number[] = [];
  for (let i = start; i < Math.min(end, inv.size); i++) if (!fav.has(i)) idx.push(i);
  const stacks: NonNullable<Slot>[] = [];
  for (const i of idx) {
    const s = inv.slots[i];
    if (s) stacks.push(cloneStack(s));
  }
  const merged: NonNullable<Slot>[] = [];
  for (const s of stacks) {
    let left = s.count;
    for (const m of merged) {
      if (left <= 0) break;
      if (!canMerge(m, s) || m.count >= stackLimit(m.item)) continue;
      const put = Math.min(left, stackLimit(m.item) - m.count);
      m.count += put;
      left -= put;
    }
    while (left > 0) {
      const n = Math.min(left, stackLimit(s.item));
      merged.push({ ...s, count: n });
      left -= n;
    }
  }
  merged.sort((a, b) => rank(a.item) - rank(b.item) || a.item.localeCompare(b.item) || b.count - a.count || (b.durability ?? 0) - (a.durability ?? 0));
  inv.batch(() => {
    idx.forEach((slot, k) => {
      inv.slots[slot] = merged[k] ?? null;
    });
    inv.notifyChanged();
  });
  return stacks.length - merged.length;
}

/** Moves every stack of `item` out of `from` (favourites stay) into the destinations in order. Returns how many moved. */
export function moveAllOf(from: Inventory, item: string, to: readonly { inventory: Inventory; start: number; end: number }[]): number {
  const fav = favouritesOf(from);
  let moved = 0;
  for (let i = 0; i < from.size; i++) {
    const s = from.slots[i];
    if (!s || s.item !== item || fav.has(i)) continue;
    for (const t of to) {
      if (!from.slots[i]) break;
      moved += quickMove(from, i, t.inventory, t.start, t.end);
    }
  }
  return moved;
}
