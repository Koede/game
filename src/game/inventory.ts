/**
 * A fixed number of item slots with stacking rules. An Inventory either owns its slot array or WRAPS one that
 * lives somewhere else (a machine's slots on its block entity): it then reads and writes that array directly,
 * so the array itself is always the saved state.
 *
 * Operations between two slots (the click / tap interactions of the UI) are in ./transfer.
 */
import { copyEnchants, enchantStack, sanitizeEnchants } from '../core/enchant';
import { canonicalItemKey, itemOrNull } from '../core/registry';
import type { ItemAmount, ItemStack, Slot } from '../core/types';

/** Decides whether an item may be put into a slot of this inventory. Taking out is never restricted. */
export type AcceptRule = (item: string, slot: number) => boolean;

export interface InventoryOptions {
  accept?: AcceptRule;
  /** Nothing can be put in (machine output slots). */
  takeOnly?: boolean;
}

const UNKNOWN_ITEM_STACK = 99;

/** Most items of this kind one slot holds. Tools never stack, whatever their item definition says. */
export function stackLimit(item: string): number {
  const def = itemOrNull(item);
  if (!def) return UNKNOWN_ITEM_STACK;
  return def.tool || def.mould ? 1 : def.stack;
}

/**
 * Fresh durability: a tool's uses, a worn item's wear, a mould's pours, or the seconds a cooling container
 * (a boiling pail) lasts. Undefined for anything that does not wear down.
 */
export const fullDurability = (item: string): number | undefined => {
  const def = itemOrNull(item);
  return def?.tool?.durability ?? def?.wear ?? def?.mould?.pours ?? def?.cools?.afterS;
};

/** Durability a well-made tool holds over a plain one (docs/api/tool-quality.md). */
export const QUALITY_DURABILITY_MULT: Readonly<Record<1 | 2, number>> = { 1: 1.25, 2: 1.6 };

/** Most durability this item can hold at this workmanship. */
export const maxDurabilityOf = (item: string, quality?: 1 | 2): number | undefined => {
  const full = fullDurability(item);
  return full === undefined ? undefined : Math.round(full * (quality ? QUALITY_DURABILITY_MULT[quality] : 1));
};

export const makeStack = (item: string, count: number, durability?: number, quality?: 1 | 2, enchants?: Record<string, number>): ItemStack => {
  const s: ItemStack = durability === undefined ? { item, count } : { item, count, durability };
  if (quality) s.quality = quality;
  const e = copyEnchants(enchants);
  if (e) s.enchants = e;
  return s;
};

export const cloneStack = (stack: ItemStack): ItemStack => makeStack(stack.item, stack.count, stack.durability, stack.quality, stack.enchants);

/**
 * A fresh stack of `item` carrying enchants, e.g. loot's Orrin's Spare Pick: `makeEnchantedStack('iron_pickaxe', { veinseeker: 1 })`.
 * Full durability, sanitised (unknown keys dropped, levels clamped) and only the enchants the item can take (enchantStack's rule).
 */
export const makeEnchantedStack = (item: string, enchants: Record<string, number>, count = 1): ItemStack => {
  const s = makeStack(item, count, fullDurability(item));
  for (const [key, level] of Object.entries(sanitizeEnchants(enchants) ?? {})) enchantStack(s, key, level);
  return s;
};

/** True when items from `b` may be added onto stack `a`. */
export const canMerge = (a: ItemStack, b: ItemStack): boolean =>
  a.item === b.item && a.durability === undefined && b.durability === undefined && a.quality === b.quality && !a.enchants && !b.enchants && stackLimit(a.item) > 1;

/** A slot as it may be stored: unknown items and broken data become empty, counts and durability are clamped. */
function sanitize(raw: Slot | undefined): Slot {
  if (!raw || typeof raw.item !== 'string') return null;
  const item = canonicalItemKey(raw.item);
  if (item === null) return null;
  const count = Math.min(Math.floor(raw.count), stackLimit(item));
  if (!(count > 0)) return null;
  const full = fullDurability(item);
  const def = itemOrNull(item);
  const quality = (raw.quality === 1 || raw.quality === 2) && (def?.tool || def?.food) ? raw.quality : undefined;
  // Enchants only on items that can hold them; unknown keys dropped, levels clamped (src/core/enchant.ts).
  const enchants = sanitizeEnchants(raw.enchants);
  const out: NonNullable<Slot> = { item, count };
  if (full !== undefined) {
    const max = maxDurabilityOf(item, quality) ?? full;
    out.durability = typeof raw.durability === 'number' ? Math.min(Math.max(raw.durability, 1), max) : max;
  }
  if (quality) out.quality = quality;
  if (enchants) out.enchants = enchants;
  return out;
}

export class Inventory {
  readonly slots: Slot[];
  accept: AcceptRule | null;
  takeOnly: boolean;
  private readonly listeners = new Set<() => void>();
  private batchDepth = 0;
  private pending = false;

  /** A number allocates that many empty slots; an array is adopted as it is and written through to. */
  constructor(sizeOrSlots: number | Slot[], options: InventoryOptions = {}) {
    this.slots = typeof sizeOrSlots === 'number' ? new Array<Slot>(sizeOrSlots).fill(null) : sizeOrSlots;
    this.accept = options.accept ?? null;
    this.takeOnly = options.takeOnly ?? false;
  }

  /** Wraps an existing slot array without copying it. */
  static over(slots: Slot[], options?: InventoryOptions): Inventory {
    return new Inventory(slots, options);
  }

  static fromJSON(snapshot: readonly Slot[], options?: InventoryOptions): Inventory {
    const inv = new Inventory(snapshot.length, options);
    inv.load(snapshot);
    return inv;
  }

  get size(): number {
    return this.slots.length;
  }

  get(slot: number): Slot {
    return this.slots[slot] ?? null;
  }

  /** Writes a slot directly, ignoring the accept rule and take-only (loading, debugging, the UI's cursor). */
  set(slot: number, stack: Slot): void {
    if (slot < 0 || slot >= this.slots.length) return;
    this.slots[slot] = stack;
    this.notifyChanged();
  }

  /** Whether `item` may be put into `slot` (take-only and the accept rule; not whether there is room). */
  accepts(item: string, slot: number): boolean {
    return !this.takeOnly && slot >= 0 && slot < this.slots.length && (this.accept === null || this.accept(item, slot));
  }

  /**
   * Adds items, topping up existing stacks before using empty slots, optionally only within slots [start, end).
   * Tools, moulds and cooling containers get full durability unless one is given. Returns how many did NOT fit.
   */
  add(item: string, count = 1, durability?: number, start = 0, end = this.slots.length, quality?: 1 | 2, enchants?: Record<string, number>): number {
    let left = Math.floor(count);
    if (left <= 0) return 0;
    if (this.takeOnly) return left;
    const slots = this.slots;
    const ench = copyEnchants(enchants);
    const limit = ench ? 1 : stackLimit(item);
    const full = fullDurability(item);
    const qdef = itemOrNull(item);
    const q = qdef?.tool || qdef?.food ? quality : undefined;
    const top = full === undefined ? undefined : maxDurabilityOf(item, q)!;
    const dur = top === undefined ? undefined : Math.min(Math.max(durability ?? top, 1), top);
    const from = Math.max(0, start);
    const to = Math.min(slots.length, end);
    const before = left;
    if (dur === undefined && limit > 1) {
      for (let i = from; i < to && left > 0; i++) {
        const s = slots[i];
        if (!s || s.item !== item || s.durability !== undefined || s.quality !== q || s.enchants || s.count >= limit || !this.accepts(item, i)) continue;
        const n = Math.min(limit - s.count, left);
        s.count += n;
        left -= n;
      }
    }
    for (let i = from; i < to && left > 0; i++) {
      if (slots[i] || !this.accepts(item, i)) continue;
      const n = Math.min(limit, left);
      slots[i] = makeStack(item, n, dur, q, ench);
      left -= n;
    }
    if (left !== before) this.notifyChanged();
    return left;
  }

  /** Removes up to `count` items, emptying the last slots first so the hotbar is touched last. Returns how many were removed. */
  remove(item: string, count = 1): number {
    let left = Math.floor(count);
    if (left <= 0) return 0;
    const slots = this.slots;
    const before = left;
    for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
      const s = slots[i];
      if (!s || s.item !== item) continue;
      const n = Math.min(s.count, left);
      s.count -= n;
      left -= n;
      if (s.count <= 0) slots[i] = null;
    }
    if (left !== before) this.notifyChanged();
    return before - left;
  }

  /** Takes up to `count` items out of one slot (the whole stack by default). Durability travels with the tool. */
  removeAt(slot: number, count = Infinity): ItemStack | null {
    const s = this.slots[slot];
    const n = s ? Math.floor(Math.min(count, s.count)) : 0;
    if (!s || n <= 0) return null;
    s.count -= n;
    if (s.count <= 0) this.slots[slot] = null;
    this.notifyChanged();
    return makeStack(s.item, n, s.durability, s.quality, s.enchants);
  }

  count(item: string): number {
    let total = 0;
    for (const s of this.slots) if (s && s.item === item) total += s.count;
    return total;
  }

  has(item: string, count = 1): boolean {
    return this.count(item) >= count;
  }

  /** How many more of `item` could be added right now. */
  space(item: string): number {
    if (this.takeOnly) return 0;
    const limit = stackLimit(item);
    const stackable = limit > 1;
    let room = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s) {
        if (this.accepts(item, i)) room += limit;
      } else if (stackable && s.item === item && s.durability === undefined && !s.enchants && s.count < limit && this.accepts(item, i)) {
        room += limit - s.count;
      }
    }
    return room;
  }

  /** Whether everything listed would fit at the same time. */
  canFit(items: ItemAmount | readonly ItemAmount[]): boolean {
    const list: readonly ItemAmount[] = 'item' in items ? [items] : items;
    if (list.length === 0) return true;
    if (list.length === 1) return this.space(list[0].item) >= list[0].count;
    const trial = this.clone();
    for (const it of list) if (trial.add(it.item, it.count) > 0) return false;
    return true;
  }

  /** Index of the first empty slot, or -1. */
  firstEmpty(): number {
    for (let i = 0; i < this.slots.length; i++) if (!this.slots[i]) return i;
    return -1;
  }

  isEmpty(): boolean {
    return this.slots.every((s) => !s);
  }

  clear(): void {
    if (this.isEmpty()) return;
    this.slots.fill(null);
    this.notifyChanged();
  }

  /** A detached copy with the same rules and no listeners (dry runs). */
  clone(): Inventory {
    const copy = new Inventory(this.slots.map((s) => (s ? cloneStack(s) : null)));
    copy.accept = this.accept;
    copy.takeOnly = this.takeOnly;
    return copy;
  }

  /** Subscribes to changes made through this object (not to direct writes into a wrapped array). */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Tells the listeners the contents changed. Called by every operation; call it after writing `slots` directly. */
  notifyChanged(): void {
    if (this.batchDepth > 0) {
      this.pending = true;
      return;
    }
    for (const fn of [...this.listeners]) fn();
  }

  /** Runs several operations and notifies the listeners once at the end, if anything changed. */
  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.pending) {
        this.pending = false;
        this.notifyChanged();
      }
    }
  }

  toJSON(): Slot[] {
    return this.slots.map((s) => (s ? cloneStack(s) : null));
  }

  /** Replaces the contents in place (the size stays what it is). Unknown items are dropped. */
  load(snapshot: readonly Slot[]): void {
    for (let i = 0; i < this.slots.length; i++) this.slots[i] = sanitize(snapshot[i]);
    this.notifyChanged();
  }
}
