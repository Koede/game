import { describe, expect, it } from 'vitest';
import { Inventory } from './inventory';
import { categoryOf, chestsFor, contents, sortInto, sortPack, validLabel, type Chest } from './storage';

const chest = (id: string, label = ''): Chest => ({ id, label, inv: new Inventory(4) });

describe('storage network', () => {
  it('knows categories and valid labels', () => {
    expect(categoryOf('iron_pickaxe')).toBe('tools');
    expect(categoryOf('bread')).toBe('food');
    expect(categoryOf('iron_ingot')).toBe('materials');
    expect(validLabel('food')).toBe(true);
    expect(validLabel('iron_ingot')).toBe(true);
    expect(validLabel('nonsense_thing')).toBe(false);
  });

  it('prefers exact item, then category, then a chest that holds it, then unlabelled; never a wrong label', () => {
    const exact = chest('a', 'bread');
    const food = chest('b', 'food');
    const tools = chest('c', 'tools');
    const holds = chest('d');
    const plain = chest('e');
    holds.inv.add('bread', 1);
    expect(chestsFor([plain, holds, tools, food, exact], 'bread').map((c) => c.id)).toEqual(['a', 'b', 'd', 'e']);
    expect(chestsFor([tools], 'bread')).toEqual([]);
  });

  it('sorts a pack, keeping the hotbar, and spills to the next chest when one is full', () => {
    const food = chest('f', 'food');
    const rest = chest('r');
    const pack = new Inventory(12);
    pack.add('bread', 5);
    pack.slots[10] = { item: 'bread', count: 99 };
    pack.slots[11] = { item: 'iron_pickaxe', count: 1, durability: 40, quality: 1 };
    const moved = sortPack(pack, [rest, food], 9);
    expect(moved).toBe(100);
    expect(pack.count('bread')).toBe(5);
    expect(food.inv.count('bread')).toBe(99);
    expect(rest.inv.slots.find((s) => s?.item === 'iron_pickaxe')).toMatchObject({ durability: 40, quality: 1 });
  });

  it('sortInto reports what does not fit, and contents totals across chests', () => {
    const a = chest('a', 'food');
    const b = chest('b');
    expect(sortInto([a], 'bread', 1000)).toBeGreaterThan(0);
    b.inv.add('bread', 3);
    b.inv.add('coal', 2);
    const c = contents([a, b]);
    expect(c.find((l) => l.item === 'bread')).toMatchObject({ total: a.inv.count('bread') + 3, where: ['Food', 'Unlabelled'] });
    expect(c.map((l) => l.item)).toContain('coal');
  });
});
