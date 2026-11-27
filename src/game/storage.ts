/**
 * Storage network (docs/api/storage.md): labelled chests that auto-sort. A chest's label is a category ("food",
 * "tools", ...) or one exact item key; unlabelled chests take what is left. `sortInto` sends an item to the best
 * chest: exact-item label, then category label, then a chest already holding it, then an unlabelled one. Pure.
 */
import { itemOrNull } from '../core/registry';
import type { Inventory } from './inventory';

export const CATEGORY_LABELS = ['tools', 'food', 'materials', 'fuel', 'blocks', 'machines', 'misc'] as const;
export type CategoryLabel = (typeof CATEGORY_LABELS)[number];
/** Chebyshev radius around an opened chest that counts as its network. */
export const NETWORK_RADIUS = 12;

export interface Chest {
  /** Stable id, e.g. "x,y,z". */
  id: string;
  /** '' = unlabelled. */
  label: string;
  inv: Inventory;
}

export function categoryOf(item: string): CategoryLabel {
  const def = itemOrNull(item);
  if (!def) return 'misc';
  if (def.tool || def.armour) return 'tools';
  switch (def.category) {
    case 'food': return 'food';
    case 'material': case 'component': case 'resource': return 'materials';
    case 'fuel': return 'fuel';
    case 'block': return 'blocks';
    case 'machine': return 'machines';
    case 'tool': return 'tools';
    default: return 'misc';
  }
}

/** A label that is valid: empty, a category, or a real item key. */
export const validLabel = (label: string): boolean =>
  label === '' || (CATEGORY_LABELS as readonly string[]).includes(label) || itemOrNull(label) !== null;

export const labelName = (label: string): string =>
  label === '' ? 'Unlabelled' : (CATEGORY_LABELS as readonly string[]).includes(label) ? label[0].toUpperCase() + label.slice(1) : itemOrNull(label)?.name ?? label;

/** 4 exact item, 3 category, 2 holds it already (unlabelled), 1 unlabelled, 0 never. */
function score(c: Chest, item: string): number {
  if (c.label === item) return 4;
  if (c.label === categoryOf(item)) return 3;
  if (c.label !== '') return 0;
  return c.inv.count(item) > 0 ? 2 : 1;
}

/** Chests that may take the item, best first (ties keep the given order). */
export function chestsFor(chests: readonly Chest[], item: string): Chest[] {
  return chests
    .map((c, i) => ({ c, s: score(c, item), i }))
    .filter((e) => e.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((e) => e.c);
}

/** Puts `count` of `item` into the network; returns how many did NOT fit. */
export function sortInto(chests: readonly Chest[], item: string, count: number): number {
  let left = count;
  for (const c of chestsFor(chests, item)) {
    if (left <= 0) break;
    left = c.inv.add(item, left);
  }
  return left;
}

/**
 * Moves whole stacks from slots [from, to) of `source` into the network (tools keep their durability and quality).
 * Returns how many items moved. The hotbar is normally excluded by `from`.
 */
export function sortPack(source: Inventory, chests: readonly Chest[], from = 0, to = source.size): number {
  let moved = 0;
  for (let i = from; i < to; i++) {
    const s = source.get(i);
    if (!s) continue;
    for (const c of chestsFor(chests, s.item)) {
      const cur = source.get(i);
      if (!cur) break;
      const left = c.inv.add(cur.item, cur.count, cur.durability, 0, c.inv.size, cur.quality, cur.enchants);
      const took = cur.count - left;
      if (took > 0) {
        moved += took;
        source.removeAt(i, took);
      }
      if (left === 0) break;
    }
  }
  return moved;
}

export interface ContentLine {
  item: string;
  total: number;
  /** Labels of the chests holding it. */
  where: string[];
}

/** The simple contents screen's data: every item in the network with its total, sorted by name. */
export function contents(chests: readonly Chest[]): ContentLine[] {
  const map = new Map<string, ContentLine>();
  for (const c of chests) {
    for (const s of c.inv.slots) {
      if (!s) continue;
      const line = map.get(s.item) ?? { item: s.item, total: 0, where: [] };
      line.total += s.count;
      const w = labelName(c.label);
      if (!line.where.includes(w)) line.where.push(w);
      map.set(s.item, line);
    }
  }
  return [...map.values()].sort((a, b) => (itemOrNull(a.item)?.name ?? a.item).localeCompare(itemOrNull(b.item)?.name ?? b.item));
}
