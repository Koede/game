/**
 * Pockets: the player's backpack divided into named sections (docs/api/inventory.md, "Moves"). A pocket is a contiguous
 * range of backpack slots with a name. Pockets only GROUP slots: no item moves when one is added, and sorting and
 * "add all matching" work inside one pocket by default. The hotbar is not split; it is always one section of its own.
 *
 * A new pack has one pocket (the whole backpack, named "Backpack"), so nothing changes for a player who has no pouch.
 * Each Belt Pouch (content/items) splits the largest pocket in two, up to POCKET_CAP pockets; the names come from
 * POCKET_NAMES in turn: Tools, Food, Building, Misc.
 */
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../core/constants';
import type { Inventory } from './inventory';

/** The Belt Pouch: crafted at the workbench; sewn into the pack from the carry bar, it adds one pocket. */
export const POUCH_ITEM = 'belt_pouch';

export interface Pocket {
  name: string;
  /** First inventory slot (inclusive). */
  start: number;
  /** One past the last slot (exclusive). */
  end: number;
}

export const DEFAULT_POCKET_NAME = 'Backpack';
export const POCKET_NAMES: readonly string[] = ['Tools', 'Food', 'Building', 'Misc'];
/** Most pockets a pack can be split into (the four names above). */
export const POCKET_CAP = 4;
export const POCKET_NAME_MAX = 12;

/** The pack as one pocket: the default, and what an old save gets. */
export function defaultPockets(start = HOTBAR_SIZE, end = INVENTORY_SIZE): Pocket[] {
  return [{ name: DEFAULT_POCKET_NAME, start, end }];
}

/**
 * A saved pocket list, checked against the pack range: a contiguous split that covers [start, end) with at most
 * POCKET_CAP pockets. Anything else (broken, gaps, too many) falls back to the single default pocket.
 */
export function sanitizePockets(raw: unknown, start = HOTBAR_SIZE, end = INVENTORY_SIZE): Pocket[] {
  const fallback = defaultPockets(start, end);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > POCKET_CAP) return fallback;
  const out: Pocket[] = [];
  let at = start;
  for (const p of raw as unknown[]) {
    if (!p || typeof p !== 'object') return fallback;
    const rec = p as Record<string, unknown>;
    const e = rec.end;
    if (rec.start !== at || typeof e !== 'number' || !Number.isInteger(e) || e <= at || e > end) return fallback;
    const name = typeof rec.name === 'string' ? rec.name.trim().slice(0, POCKET_NAME_MAX) : '';
    out.push({ name: name || `Pocket ${out.length + 1}`, start: at, end: e });
    at = e;
  }
  return at === end ? out : fallback;
}

/** The pocket holding a slot, or null (the hotbar, or a slot outside the pack). */
export function pocketOf(pockets: readonly Pocket[], slot: number): Pocket | null {
  return pockets.find((p) => slot >= p.start && slot < p.end) ?? null;
}

/** Whether a pouch can still add a pocket. */
export const canAddPocket = (pockets: readonly Pocket[]): boolean => pockets.length < POCKET_CAP && pockets.some((p) => p.end - p.start >= 2);

/**
 * The pockets after one more pouch: the largest pocket is cut in two (its items stay where they are). The two halves
 * take fresh names; the default "Backpack" name is replaced by the first two names. Null at the cap or when no pocket
 * is big enough to cut.
 */
export function addPocket(pockets: readonly Pocket[]): Pocket[] | null {
  if (!canAddPocket(pockets)) return null;
  let best = -1;
  pockets.forEach((p, i) => {
    const size = p.end - p.start;
    if (size >= 2 && (best < 0 || size > pockets[best].end - pockets[best].start)) best = i;
  });
  const cut = pockets[best];
  const taken = new Set(pockets.map((p) => p.name));
  const fresh = (): string => POCKET_NAMES.find((n) => !taken.has(n)) ?? `Pocket ${pockets.length + 2}`;
  const mid = cut.start + Math.ceil((cut.end - cut.start) / 2);
  const leftName = cut.name === DEFAULT_POCKET_NAME ? fresh() : cut.name;
  taken.add(leftName);
  const rightName = fresh();
  const out: Pocket[] = [];
  pockets.forEach((p, i) => {
    if (i !== best) out.push({ ...p });
    else out.push({ name: leftName, start: cut.start, end: mid }, { name: rightName, start: mid, end: cut.end });
  });
  return out;
}

/** Pocket list per inventory. Only the player's backpack ever has one; any other inventory reads as one default pocket. */
const pockets = new WeakMap<Inventory, Pocket[]>();

/** The pockets of an inventory's backpack (the default single pocket until a save or a pouch changes it). */
export function pocketsOf(inv: Inventory): Pocket[] {
  return pockets.get(inv) ?? defaultPockets(HOTBAR_SIZE, inv.size);
}

/** Replaces the pockets from a save (anything broken becomes the default single pocket). */
export function setPockets(inv: Inventory, raw: unknown): void {
  pockets.set(inv, sanitizePockets(raw, HOTBAR_SIZE, inv.size));
}

/** Splits one pocket more into an inventory's pack. Returns the new pockets, or null when it cannot (cap reached). */
export function splitPack(inv: Inventory): Pocket[] | null {
  const next = addPocket(pocketsOf(inv));
  if (next) pockets.set(inv, next);
  return next;
}

/**
 * The sections the bulk move (Shift, two-finger tap) cycles through: the hotbar first, then each pocket in order. An
 * inventory without pockets is hotbar + backpack, exactly what the bag already did.
 */
export function bagSections(inv: Inventory): { start: number; end: number }[] {
  return [{ start: 0, end: HOTBAR_SIZE }, ...pocketsOf(inv).map((p) => ({ start: p.start, end: p.end }))];
}

/**
 * Sews one Belt Pouch from a slot into the backpack: one pocket more, the pouch is used up. Returns false when the slot is
 * not a pouch, the pack is at the cap, or no pocket is big enough to cut (nothing changes then).
 */
export function sewPocket(inv: Inventory, slot: number): boolean {
  const s = inv.slots[slot];
  if (!s || s.item !== POUCH_ITEM || inv.locked.has(slot) || !canAddPocket(pocketsOf(inv))) return false;
  if (!splitPack(inv)) return false;
  inv.removeAt(slot, 1);
  return true;
}
