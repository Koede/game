import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../../core/registry';
import { Inventory, stackLimit } from '../../../game/inventory';
import { buildCatalogue, clearSlot, CREATIVE_TABS, filterCatalogue, grantItem, tabCounts, tabOfCategory } from './catalogue';

const ENTRIES = buildCatalogue();

describe('creative catalogue', () => {
  it('lists every registry item exactly once', () => {
    expect(ENTRIES.length).toBe(ITEMS.length);
    expect(new Set(ENTRIES.map((e) => e.key)).size).toBe(ITEMS.length);
    expect(ENTRIES.map((e) => e.key)).toEqual(ITEMS.map((i) => i.key));
  });

  it('puts every item in exactly one real tab, and the tabs add up to All', () => {
    const counts = tabCounts(ENTRIES, '');
    const real = CREATIVE_TABS.filter((t) => t.id !== 'all');
    expect(real.reduce((n, t) => n + counts[t.id], 0)).toBe(ITEMS.length);
    expect(counts.all).toBe(ITEMS.length);
    for (const t of real) expect(filterCatalogue(ENTRIES, t.id, '').every((e) => e.tab === t.id)).toBe(true);
  });

  it('derives the tab from the item category and fills the main tabs', () => {
    for (const e of ENTRIES) expect(tabOfCategory(e.category)).toBe(e.tab);
    const tabOf = (key: string) => ENTRIES.find((e) => e.key === key)?.tab;
    expect(tabOf('flint_pickaxe')).toBe('tool');
    expect(tabOf('coal')).toBe('fuel');
    expect(tabOf('copper_ingot')).toBe('material');
    for (const tab of ['block', 'material', 'tool', 'food', 'machine'] as const) expect(filterCatalogue(ENTRIES, tab, '').length).toBeGreaterThan(0);
  });

  it('searches name, key and description, case-insensitively, every word must match', () => {
    const hits = filterCatalogue(ENTRIES, 'all', 'COPPER ingot');
    expect(hits.map((e) => e.key)).toContain('copper_ingot');
    expect(hits.every((e) => /copper/i.test(e.haystack) && /ingot/i.test(e.haystack))).toBe(true);
    expect(filterCatalogue(ENTRIES, 'all', 'zzzz-no-such-thing')).toEqual([]);
    expect(filterCatalogue(ENTRIES, 'tool', 'copper_ingot')).toEqual([]);
    expect(filterCatalogue(ENTRIES, 'all', '   ').length).toBe(ITEMS.length);
  });

  it('grants one or a full stack and clears a slot', () => {
    const inv = new Inventory(36);
    expect(grantItem(inv, 'coal', false)).toBe(0);
    expect(inv.count('coal')).toBe(1);
    expect(grantItem(inv, 'cord', true)).toBe(0);
    expect(inv.count('cord')).toBe(stackLimit('cord'));
    expect(grantItem(inv, 'flint_pickaxe', true)).toBe(0);
    expect(inv.count('flint_pickaxe')).toBe(1);
    expect(clearSlot(inv, 0)).toBe(true);
    expect(clearSlot(inv, 0)).toBe(false);
  });

  it('reports what did not fit when the pack is full', () => {
    const inv = new Inventory(1);
    expect(grantItem(inv, 'flint_pickaxe', false)).toBe(0);
    expect(grantItem(inv, 'flint_pickaxe', false)).toBe(1);
  });
});
