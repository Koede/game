import { describe, expect, it } from 'vitest';
import { Inventory } from './inventory';
import { favouritesOf, moveAllOf, setFavourites, sortRange, toggleFavourite } from './inventoryTools';

describe('sortRange', () => {
  it('merges partial stacks and packs them, tools first', () => {
    const inv = new Inventory(8);
    inv.set(1, { item: 'plank', count: 10 });
    inv.set(3, { item: 'stone', count: 5 });
    inv.set(5, { item: 'plank', count: 20 });
    inv.set(6, { item: 'flint_pickaxe', count: 1, durability: 30 });
    const freed = sortRange(inv, 0);
    expect(freed).toBe(1);
    expect(inv.get(0)?.item).toBe('flint_pickaxe');
    expect(inv.count('plank')).toBe(30);
    expect(inv.slots.filter(Boolean).length).toBe(3);
    expect(inv.slots.slice(3).every((s) => s === null)).toBe(true);
  });

  it('leaves favourites where they are and slots outside the range alone', () => {
    const inv = new Inventory(6);
    inv.set(0, { item: 'stone', count: 3 });
    inv.set(2, { item: 'plank', count: 4 });
    inv.set(4, { item: 'plank', count: 4 });
    toggleFavourite(inv, 4);
    sortRange(inv, 1);
    expect(inv.get(0)).toEqual({ item: 'stone', count: 3 });
    expect(inv.get(4)).toEqual({ item: 'plank', count: 4 });
    expect(inv.get(1)).toEqual({ item: 'plank', count: 4 });
    expect(inv.count('plank')).toBe(8);
  });

  it('never loses or invents anything', () => {
    const inv = new Inventory(12);
    for (let i = 0; i < 12; i += 2) inv.set(i, { item: i % 4 ? 'plank' : 'dirt', count: 7 + i });
    const before = inv.count('plank') + inv.count('dirt');
    sortRange(inv, 0);
    expect(inv.count('plank') + inv.count('dirt')).toBe(before);
  });
});

describe('favourites and move-all', () => {
  it('toggles only slots that hold something, and saves and clamps', () => {
    const inv = new Inventory(4);
    expect(toggleFavourite(inv, 1)).toBe(false);
    inv.set(1, { item: 'plank', count: 1 });
    expect(toggleFavourite(inv, 1)).toBe(true);
    expect(toggleFavourite(inv, 1)).toBe(false);
    setFavourites(inv, [0, 3, 9, -1, 'x', 1.5]);
    expect([...favouritesOf(inv)].sort()).toEqual([0, 3]);
  });

  it('moves every stack of one item, skipping favourites', () => {
    const from = new Inventory(6);
    const to = new Inventory(6);
    from.set(0, { item: 'plank', count: 5 });
    from.set(2, { item: 'plank', count: 6 });
    from.set(3, { item: 'stone', count: 9 });
    from.set(4, { item: 'plank', count: 7 });
    toggleFavourite(from, 4);
    const moved = moveAllOf(from, 'plank', [{ inventory: to, start: 0, end: 6 }]);
    expect(moved).toBe(11);
    expect(to.count('plank')).toBe(11);
    expect(from.count('plank')).toBe(7);
    expect(from.count('stone')).toBe(9);
  });
});
