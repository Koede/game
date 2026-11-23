/**
 * Slot-to-slot operations between any two inventories (or within one): everything the UI needs for click / tap
 * item handling. Each honours the destination's accept rule and take-only flag, keeps a tool's durability with
 * the tool, and never lets a slot exceed the item's stack limit.
 */
import { canMerge, makeStack, stackLimit, type Inventory } from './inventory';

function notify(a: Inventory, b: Inventory): void {
  a.notifyChanged();
  if (b !== a) b.notifyChanged();
}

/**
 * Moves up to `count` items from one slot into another: into an empty slot or onto a stack of the same item.
 * Never swaps. Returns how many items moved.
 */
export function transfer(from: Inventory, fromSlot: number, to: Inventory, toSlot: number, count = Infinity): number {
  const src = from.slots[fromSlot];
  if (!src || (from === to && fromSlot === toSlot) || !to.accepts(src.item, toSlot)) return 0;
  const dst = to.slots[toSlot];
  let n = Math.floor(Math.min(count, src.count));
  if (!dst) n = Math.min(n, stackLimit(src.item));
  else if (canMerge(dst, src)) n = Math.min(n, stackLimit(src.item) - dst.count);
  else return 0;
  if (n <= 0) return 0;
  if (dst) dst.count += n;
  else to.slots[toSlot] = makeStack(src.item, n, src.durability, src.quality);
  src.count -= n;
  if (src.count <= 0) from.slots[fromSlot] = null;
  notify(from, to);
  return n;
}

/** Exchanges the contents of two slots (either may be empty). Both sides must accept what they receive. */
export function swapSlots(from: Inventory, fromSlot: number, to: Inventory, toSlot: number): boolean {
  const a = from.slots[fromSlot] ?? null;
  const b = to.slots[toSlot] ?? null;
  if ((!a && !b) || (from === to && fromSlot === toSlot)) return false;
  if (fromSlot < 0 || fromSlot >= from.size || toSlot < 0 || toSlot >= to.size) return false;
  if (a && !to.accepts(a.item, toSlot)) return false;
  if (b && !from.accepts(b.item, fromSlot)) return false;
  from.slots[fromSlot] = b;
  to.slots[toSlot] = a;
  notify(from, to);
  return true;
}

/**
 * The primary click: puts the whole stack down on the target slot. An empty target takes it, a stack of the
 * same item absorbs what fits, anything else trades places with it. Returns how many items left the source slot.
 */
export function moveStack(from: Inventory, fromSlot: number, to: Inventory, toSlot: number): number {
  const src = from.slots[fromSlot];
  if (!src) return 0;
  const total = src.count;
  const moved = transfer(from, fromSlot, to, toSlot);
  if (moved > 0) return moved;
  return swapSlots(from, fromSlot, to, toSlot) ? total : 0;
}

/** Moves half of a stack (rounded up) into an empty slot or onto the same item. */
export function moveHalf(from: Inventory, fromSlot: number, to: Inventory, toSlot: number): number {
  const src = from.slots[fromSlot];
  return src ? transfer(from, fromSlot, to, toSlot, Math.ceil(src.count / 2)) : 0;
}

/** Moves a single item into an empty slot or onto the same item. */
export function moveOne(from: Inventory, fromSlot: number, to: Inventory, toSlot: number): number {
  return transfer(from, fromSlot, to, toSlot, 1);
}

/** Tops up the target stack from the source stack; does nothing unless both hold the same stackable item. */
export function mergeSlots(from: Inventory, fromSlot: number, to: Inventory, toSlot: number): number {
  const src = from.slots[fromSlot];
  const dst = to.slots[toSlot];
  return src && dst && canMerge(dst, src) ? transfer(from, fromSlot, to, toSlot) : 0;
}

/**
 * Sends a stack into another inventory wherever it fits (existing stacks first), optionally only into slots
 * [start, end) - which also allows hotbar <-> backpack moves inside one inventory. Returns how many items moved.
 */
export function quickMove(from: Inventory, fromSlot: number, to: Inventory, start = 0, end = to.size): number {
  const src = from.slots[fromSlot];
  if (!src || (from === to && fromSlot >= start && fromSlot < end)) return 0;
  const count = src.count;
  return from.batch(() =>
    to.batch(() => {
      const moved = count - to.add(src.item, count, src.durability, start, end, src.quality);
      if (moved > 0) from.removeAt(fromSlot, moved);
      return moved;
    }),
  );
}
