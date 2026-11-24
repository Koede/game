/**
 * Player moves beyond one click (docs/api/inventory.md, "Moves"): spread a held stack over several slots, gather every
 * matching stack into one slot, send a whole stack round the bag's sections, and the one-step undo of the last move.
 * Pure functions over `Inventory`; the slot controller in src/ui/screens/slots.ts only decides which of these to call.
 *
 * Locked slots (Inventory.locked) and favourites are respected everywhere here: nothing is taken out of a locked slot,
 * and the locked slot itself takes nothing in (Inventory.accepts says no).
 */
import { canMerge, makeStack, stackLimit, type InventorySnapshot, type Inventory } from './inventory';
import { favouritesOf } from './inventoryTools';
import { quickMove } from './transfer';

export interface SlotTarget {
  inventory: Inventory;
  slot: number;
}

/**
 * Spreads a held stack over several slots: each empty or matching slot (in the order given) gets an even share of what
 * is left, a share it cannot hold passes on to the next. The source slot empties as far as it was spread; anything
 * no target can hold stays where it is. Returns how many items moved.
 */
export function distributeStack(from: Inventory, fromSlot: number, targets: readonly SlotTarget[]): number {
  const src = from.slots[fromSlot];
  if (!src || from.locked.has(fromSlot)) return 0;
  const limit = stackLimit(src.item);
  const dests: { inventory: Inventory; slot: number; room: number }[] = [];
  const used = new Map<Inventory, Set<number>>();
  for (const t of targets) {
    if (t.inventory === from && t.slot === fromSlot) continue;
    if (!t.inventory.accepts(src.item, t.slot)) continue;
    const dst = t.inventory.slots[t.slot];
    if (dst && !canMerge(dst, src)) continue;
    const room = dst ? limit - dst.count : limit;
    if (room <= 0) continue;
    let slots = used.get(t.inventory);
    if (!slots) used.set(t.inventory, (slots = new Set()));
    if (slots.has(t.slot)) continue;
    slots.add(t.slot);
    dests.push({ inventory: t.inventory, slot: t.slot, room });
  }
  if (dests.length === 0) return 0;
  // Even shares: each target takes the ceiling of what is left over the targets still to come, capped by its room.
  const plan: number[] = [];
  let left = src.count;
  for (let k = 0; k < dests.length && left > 0; k++) {
    const share = Math.min(dests[k].room, Math.ceil(left / (dests.length - k)));
    plan.push(share);
    left -= share;
  }
  const total = plan.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const touched = new Set<Inventory>([from]);
  const srcTick = from.tickOf(fromSlot);
  plan.forEach((n, k) => {
    if (n <= 0) return;
    const d = dests[k];
    touched.add(d.inventory);
    const cur = d.inventory.slots[d.slot];
    if (cur) {
      cur.count += n;
      d.inventory.setTick(d.slot, Math.max(d.inventory.tickOf(d.slot), srcTick));
    } else {
      d.inventory.slots[d.slot] = makeStack(src.item, n, src.durability, src.quality, src.enchants);
      d.inventory.setTick(d.slot, srcTick);
    }
  });
  src.count -= total;
  if (src.count <= 0) {
    from.slots[fromSlot] = null;
    from.setTick(fromSlot, 0);
  }
  for (const inv of touched) inv.notifyChanged();
  return total;
}

/**
 * The stacks that gather into `target` from [start, end) of its inventory, and how many items each gives. Tools with
 * wear, enchanted and quality stacks never merge (canMerge); favourites and locked slots stay where they are.
 */
function planGather(inv: Inventory, target: number, start: number, end: number): { slot: number; n: number }[] {
  const dst = inv.slots[target];
  if (!dst || inv.locked.has(target) || !inv.accepts(dst.item, target)) return [];
  const favs = favouritesOf(inv);
  const limit = stackLimit(dst.item);
  let room = limit - dst.count;
  const plan: { slot: number; n: number }[] = [];
  for (let i = Math.max(0, start); i < Math.min(end, inv.size) && room > 0; i++) {
    const s = inv.slots[i];
    if (i === target || !s || favs.has(i) || inv.locked.has(i) || !canMerge(dst, s)) continue;
    const n = Math.min(s.count, room);
    plan.push({ slot: i, n });
    room -= n;
  }
  return plan;
}

/** How many items `gatherMatching` would move right now (nothing is moved): the carry bar shows the button only when > 0. */
export function gatherable(inv: Inventory, target: number, start: number, end: number): number {
  return planGather(inv, target, start, end).reduce((sum, p) => sum + p.n, 0);
}

/**
 * Gathers every stack that can merge into  from [start, end) of the same inventory, up to the stack limit.
 * Returns how many items moved onto the target.
 */
export function gatherMatching(inv: Inventory, target: number, start: number, end: number): number {
  const dst = inv.slots[target];
  let moved = 0;
  for (const { slot, n } of planGather(inv, target, start, end)) {
    const s = inv.slots[slot]!;
    dst!.count += n;
    moved += n;
    s.count -= n;
    inv.setTick(target, Math.max(inv.tickOf(target), inv.tickOf(slot)));
    if (s.count <= 0) {
      inv.slots[slot] = null;
      inv.setTick(slot, 0);
    }
  }
  if (moved > 0) inv.notifyChanged();
  return moved;
}

export interface Section {
  start: number;
  end: number;
}

/**
 * The bulk move (Shift on desktop, a two-finger tap on a phone): the whole stack goes to the next section in order
 * that takes it (the hotbar, then each pocket, wrapping round), and what does not fit there goes on to the one after.
 * Returns how many items moved.
 */
export function sectionMove(inv: Inventory, slot: number, sections: readonly Section[]): number {
  if (!inv.slots[slot] || inv.locked.has(slot)) return 0;
  const here = sections.findIndex((s) => slot >= s.start && slot < s.end);
  if (here < 0) return 0;
  let moved = 0;
  for (let k = 1; k < sections.length && inv.slots[slot]; k++) {
    const sec = sections[(here + k) % sections.length];
    moved += quickMove(inv, slot, inv, sec.start, sec.end);
  }
  return moved;
}

/**
 * One step of undo for the player's moves. `record` runs a move and, when it changed anything, keeps the state from
 * before and after it. `undo` puts the earlier state back, but only while the bag still looks as the move left it:
 * anything that arrived since (a pickup, a craft, a drop) makes the step stale, and it is then dropped rather than
 * undone over it. Sorting is not recorded. Cleared when the bag closes (`clear`), and never saved.
 */
export class MoveHistory {
  private last: { invs: Inventory[]; before: InventorySnapshot[]; after: string[] } | null = null;

  /** Whether one step can be taken back right now (the bag is still as the last move left it). */
  get canUndo(): boolean {
    const last = this.last;
    return last !== null && last.invs.every((inv, k) => JSON.stringify(inv.snapshot()) === last.after[k]);
  }

  record<T>(invs: readonly Inventory[], move: () => T): T {
    const uniq = [...new Set(invs)];
    const before = uniq.map((inv) => inv.snapshot());
    const out = move();
    const after = uniq.map((inv) => JSON.stringify(inv.snapshot()));
    const changed = uniq.some((_, k) => JSON.stringify(before[k]) !== after[k]);
    this.last = changed ? { invs: uniq, before, after } : null;
    return out;
  }

  undo(): boolean {
    const last = this.last;
    this.last = null;
    if (!last || !last.invs.every((inv, k) => JSON.stringify(inv.snapshot()) === last.after[k])) return false;
    last.invs.forEach((inv, k) => inv.restore(last.before[k]));
    return true;
  }

  clear(): void {
    this.last = null;
  }
}
