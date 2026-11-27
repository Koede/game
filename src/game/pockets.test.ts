import { describe, expect, it } from 'vitest';
import { Inventory, makeStack } from './inventory';
import { POCKET_CAP, addPocket, bagSections, canAddPocket, defaultPockets, pocketOf, pocketsOf, sanitizePockets, setPockets, splitPack } from './pockets';

const names = (ps: { name: string }[]) => ps.map((p) => p.name);

describe('pockets', () => {
  it('a new pack is one pocket, the whole backpack', () => {
    expect(defaultPockets()).toEqual([{ name: 'Backpack', start: 9, end: 36 }]);
    expect(pocketsOf(new Inventory(36))).toEqual(defaultPockets());
    expect(bagSections(new Inventory(36))).toEqual([{ start: 0, end: 9 }, { start: 9, end: 36 }]);
  });

  it('each pouch cuts the largest pocket in two, with the names in order, up to the cap', () => {
    let ps = defaultPockets();
    ps = addPocket(ps)!;
    expect(names(ps)).toEqual(['Tools', 'Food']);
    expect(ps.map((p) => [p.start, p.end])).toEqual([[9, 23], [23, 36]]);
    // The largest pocket is cut next (Tools, 14 slots), so the names run by position, each the first unused.
    ps = addPocket(ps)!;
    expect(names(ps)).toEqual(['Tools', 'Building', 'Food']);
    ps = addPocket(ps)!;
    expect(names(ps)).toEqual(['Tools', 'Building', 'Food', 'Misc']);
    expect(ps.length).toBe(POCKET_CAP);
    expect(canAddPocket(ps)).toBe(false);
    expect(addPocket(ps)).toBeNull();
    // Every slot of the pack stays in exactly one pocket.
    for (let i = 9; i < 36; i++) expect(pocketOf(ps, i)).not.toBeNull();
    expect(pocketOf(ps, 3)).toBeNull();
  });

  it('a pocket of one slot cannot be cut', () => {
    const tiny = [{ name: 'A', start: 9, end: 10 }, { name: 'B', start: 10, end: 11 }];
    expect(addPocket(tiny)).toBeNull();
    expect(canAddPocket(tiny)).toBe(false);
  });

  it('splitPack changes only the inventory it is given, and reports the cap', () => {
    const bag = new Inventory(36);
    bag.set(20, makeStack('stone', 3));
    expect(splitPack(bag)).not.toBeNull();
    expect(pocketsOf(bag).length).toBe(2);
    expect(bag.get(20)).toEqual({ item: 'stone', count: 3 });
    splitPack(bag);
    splitPack(bag);
    expect(splitPack(bag)).toBeNull();
    expect(pocketsOf(bag).length).toBe(POCKET_CAP);
  });

  it('a saved list is checked: a clean split is kept, anything else is the default', () => {
    const good = [{ name: 'Food', start: 9, end: 20 }, { name: 'Tools', start: 20, end: 36 }];
    expect(sanitizePockets(good)).toEqual(good);
    expect(sanitizePockets(undefined)).toEqual(defaultPockets());
    expect(sanitizePockets([{ name: 'X', start: 9, end: 20 }])).toEqual(defaultPockets());
    expect(sanitizePockets([{ name: 'X', start: 10, end: 36 }])).toEqual(defaultPockets());
    expect(sanitizePockets([{ name: 'X', start: 9, end: 30 }, { name: 'Y', start: 30, end: 36 }, { name: 'Z', start: 36, end: 36 }])).toEqual(defaultPockets());
    expect(sanitizePockets('nope')).toEqual(defaultPockets());
    const long = sanitizePockets([{ name: '  a very long pocket name  ', start: 9, end: 36 }]);
    expect(long[0].name.length).toBeLessThanOrEqual(12);
    expect(sanitizePockets([{ name: 7, start: 9, end: 36 }])[0].name).toBe('Pocket 1');
  });

  it('setPockets applies a save to one inventory', () => {
    const bag = new Inventory(36);
    setPockets(bag, [{ name: 'Food', start: 9, end: 20 }, { name: 'Misc', start: 20, end: 36 }]);
    expect(names(pocketsOf(bag))).toEqual(['Food', 'Misc']);
    expect(bagSections(bag).map((s) => s.end)).toEqual([9, 20, 36]);
  });
});
