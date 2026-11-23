import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { HIDDEN_RECIPES, RecipeBook } from './discovery';
import { Inventory } from './inventory';

const pack = (...items: [string, number][]): Inventory => {
  const inv = new Inventory(12);
  for (const [k, n] of items) inv.add(k, n);
  return inv;
};

describe('recipe discovery', () => {
  it('only names real items and has unique ids', () => {
    expect(new Set(HIDDEN_RECIPES.map((r) => r.id)).size).toBe(HIDDEN_RECIPES.length);
    for (const r of HIDDEN_RECIPES) for (const a of [...r.inputs, r.output]) expect(itemOrNull(a.item), a.item).not.toBeNull();
  });

  it('discovers a hidden recipe in any order, consuming the parts', () => {
    const book = new RecipeBook();
    const inv = pack(['pine_resin', 1], ['fiber', 3]);
    const r = book.experiment('workbench', [{ item: 'pine_resin', count: 1 }, { item: 'fiber', count: 3 }], inv);
    expect(r.kind).toBe('discovered');
    expect(inv.count('cord')).toBe(4);
    expect(inv.count('fiber')).toBe(0);
    expect(book.knows('waxed_cord')).toBe(true);
    expect(book.entries().find((e) => e.id === 'waxed_cord')!.found).toBe(true);
  });

  it('wrong station is nothing; a near try hints, costs nothing and fills the riddle', () => {
    const book = new RecipeBook();
    const inv = pack(['pine_resin', 5], ['fiber', 9]);
    expect(book.experiment('furnace', [{ item: 'fiber', count: 3 }, { item: 'pine_resin', count: 1 }], inv).kind).toBe('nothing');
    expect(book.experiment('workbench', [{ item: 'fiber', count: 2 }, { item: 'pine_resin', count: 1 }], inv).kind).toBe('close');
    expect(inv.count('fiber')).toBe(9);
    expect(book.entries().find((e) => e.id === 'waxed_cord')!.text).toMatch(/resin/i);
    expect(book.experiment('workbench', [{ item: 'stick', count: 1 }], inv).kind).toBe('nothing');
    expect(book.experiment('workbench', [], inv).kind).toBe('empty');
  });

  it('cannot discover what you cannot afford; repeats are known; the book saves', () => {
    const book = new RecipeBook();
    const parts = [{ item: 'fiber', count: 3 }, { item: 'pine_resin', count: 1 }];
    expect(book.experiment('workbench', parts, pack(['fiber', 1])).kind).toBe('nothing');
    expect(book.count).toBe(0);
    const rich = pack(['fiber', 6], ['pine_resin', 2]);
    book.experiment('workbench', parts, rich);
    expect(book.experiment('workbench', parts, rich).kind).toBe('known');
    const back = RecipeBook.fromJSON(JSON.parse(JSON.stringify(book.toJSON())));
    expect(back.knows('waxed_cord')).toBe(true);
    expect(RecipeBook.fromJSON({ found: ['nope', 7 as never] }).count).toBe(0);
  });
});
