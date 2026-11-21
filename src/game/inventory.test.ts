import { describe, expect, it } from 'vitest';
import type { Slot } from '../core/types';
import { Inventory, canMerge, makeStack, stackLimit } from './inventory';
import { mergeSlots, moveHalf, moveOne, moveStack, quickMove, swapSlots, transfer } from './transfer';

describe('Inventory', () => {
  it('stacks onto existing stacks first, respects the stack limit and returns the leftover', () => {
    const inv = new Inventory(3);
    inv.set(1, makeStack('plank', 90));
    expect(inv.add('plank', 20)).toBe(0);
    expect(inv.get(1)).toEqual({ item: 'plank', count: 99 });
    expect(inv.get(0)).toEqual({ item: 'plank', count: 11 });
    inv.set(2, makeStack('stick', 5));
    // Room left: 88 in slot 0 only.
    expect(inv.add('plank', 100)).toBe(12);
    expect(inv.count('plank')).toBe(198);
    expect(inv.add('plank', 1)).toBe(1);
    expect(inv.add('stick', 0)).toBe(0);
    expect(inv.space('stick')).toBe(94);
  });

  it('never stacks tools and keeps their durability', () => {
    const inv = new Inventory(4);
    expect(stackLimit('flint_pickaxe')).toBe(1);
    expect(inv.add('flint_pickaxe', 2)).toBe(0);
    expect(inv.get(0)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 64 });
    expect(inv.get(1)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 64 });
    inv.add('flint_pickaxe', 1, 10);
    expect(inv.get(2)?.durability).toBe(10);
    expect(inv.add('flint_pickaxe', 2)).toBe(1);
    expect(canMerge(inv.get(0)!, inv.get(1)!)).toBe(false);
    expect(inv.removeAt(2)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 10 });
  });

  it('removes from the last slots first, counts and checks', () => {
    const inv = new Inventory(3);
    inv.set(0, makeStack('stick', 5));
    inv.set(2, makeStack('stick', 4));
    expect(inv.has('stick', 9)).toBe(true);
    expect(inv.has('stick', 10)).toBe(false);
    expect(inv.remove('stick', 6)).toBe(6);
    expect(inv.get(2)).toBeNull();
    expect(inv.get(0)?.count).toBe(3);
    expect(inv.remove('stick', 10)).toBe(3);
    expect(inv.isEmpty()).toBe(true);
    expect(inv.firstEmpty()).toBe(0);
    expect(inv.remove('stick', 1)).toBe(0);
  });

  it('canFit checks several amounts at once', () => {
    const inv = new Inventory(2);
    inv.set(0, makeStack('plank', 98));
    expect(inv.canFit({ item: 'plank', count: 100 })).toBe(true);
    expect(inv.canFit({ item: 'plank', count: 101 })).toBe(false);
    expect(inv.canFit([{ item: 'plank', count: 1 }, { item: 'stick', count: 99 }])).toBe(true);
    expect(inv.canFit([{ item: 'plank', count: 2 }, { item: 'stick', count: 1 }])).toBe(false);
    expect(inv.canFit([])).toBe(true);
    // A dry run must not change anything.
    expect(inv.toJSON()).toEqual([{ item: 'plank', count: 98 }, null]);
    inv.clear();
    expect(inv.firstEmpty()).toBe(0);
    expect(inv.canFit([{ item: 'flint_pickaxe', count: 2 }])).toBe(true);
    expect(inv.canFit([{ item: 'flint_pickaxe', count: 3 }])).toBe(false);
  });

  it('honours the accept rule in every operation that puts items in', () => {
    const inv = new Inventory(2, { accept: (item, slot) => slot !== 0 || item === 'coal' });
    expect(inv.add('stick', 3)).toBe(0);
    expect(inv.get(0)).toBeNull();
    expect(inv.get(1)).toEqual({ item: 'stick', count: 3 });
    expect(inv.space('stick')).toBe(96);
    expect(inv.space('coal')).toBe(99);
    expect(inv.canFit({ item: 'stick', count: 97 })).toBe(false);
    const other = new Inventory(2);
    other.set(0, makeStack('plank', 4));
    other.set(1, makeStack('coal', 4));
    expect(moveStack(other, 0, inv, 0)).toBe(0);
    expect(moveOne(other, 0, inv, 0)).toBe(0);
    expect(swapSlots(other, 0, inv, 0)).toBe(false);
    expect(moveStack(other, 1, inv, 0)).toBe(4);
    // The plank could only go to slot 1, which holds sticks.
    expect(quickMove(other, 0, inv)).toBe(0);
    // Trading the coal for planks is refused: slot 0 only takes coal.
    expect(swapSlots(inv, 0, other, 0)).toBe(false);
    expect(other.get(0)).toEqual({ item: 'plank', count: 4 });
  });

  it('take-only inventories give but never receive', () => {
    const out = new Inventory(2, { takeOnly: true });
    out.set(0, makeStack('copper_ingot', 5));
    const pack = new Inventory(2);
    pack.set(0, makeStack('copper_ingot', 1));
    pack.set(1, makeStack('stick', 1));
    expect(out.add('copper_ingot', 1)).toBe(1);
    expect(out.space('copper_ingot')).toBe(0);
    expect(out.canFit({ item: 'copper_ingot', count: 1 })).toBe(false);
    expect(moveStack(pack, 0, out, 0)).toBe(0);
    expect(moveStack(pack, 0, out, 1)).toBe(0);
    expect(quickMove(pack, 1, out)).toBe(0);
    // Clicking a different item onto an output slot must not swap it in.
    expect(moveStack(out, 0, pack, 1)).toBe(0);
    expect(moveStack(out, 0, pack, 0)).toBe(5);
    expect(pack.get(0)).toEqual({ item: 'copper_ingot', count: 6 });
    expect(out.isEmpty()).toBe(true);
  });

  it('wraps an external array: writes go both ways and the array is the saved state', () => {
    const slots: Slot[] = [null, { item: 'coal', count: 2 }, null];
    const inv = Inventory.over(slots);
    expect(inv.slots).toBe(slots);
    expect(inv.size).toBe(3);
    expect(inv.count('coal')).toBe(2);
    inv.add('coal', 3);
    inv.add('stick', 7);
    expect(slots[1]).toEqual({ item: 'coal', count: 5 });
    expect(slots[0]).toEqual({ item: 'stick', count: 7 });
    slots[2] = { item: 'plank', count: 9 };
    expect(inv.count('plank')).toBe(9);
    expect(inv.remove('plank', 9)).toBe(9);
    expect(slots[2]).toBeNull();
    expect(JSON.stringify(slots)).toBe(JSON.stringify(inv.toJSON()));
    const restored = Inventory.fromJSON(JSON.parse(JSON.stringify(slots)) as Slot[]);
    expect(restored.toJSON()).toEqual(slots);
    expect(new Inventory(slots).slots).toBe(slots);
  });

  it('notifies listeners once per operation and once per batch', () => {
    const inv = new Inventory(4);
    let calls = 0;
    const off = inv.onChange(() => calls++);
    inv.add('stick', 2);
    expect(calls).toBe(1);
    inv.remove('plank', 1);
    expect(calls).toBe(1);
    inv.batch(() => {
      inv.add('plank', 3);
      inv.remove('stick', 1);
      inv.batch(() => inv.add('coal', 1));
    });
    expect(calls).toBe(2);
    inv.batch(() => inv.remove('flint', 1));
    expect(calls).toBe(2);
    off();
    inv.clear();
    expect(calls).toBe(2);
  });

  it('round-trips through JSON and cleans broken data', () => {
    const inv = new Inventory(4);
    inv.add('plank', 120);
    inv.add('flint_pickaxe', 1, 33);
    const copy = Inventory.fromJSON(JSON.parse(JSON.stringify(inv)) as Slot[]);
    expect(copy.toJSON()).toEqual(inv.toJSON());
    expect(copy.toJSON()).not.toBe(inv.slots);
    const dirty = [
      { item: 'no_such_item', count: 3 },
      { item: 'plank', count: 500 },
      { item: 'flint_pickaxe', count: 1, durability: 9999 },
      { item: 'stick', count: 0 },
      { item: 'coal', count: 1 },
    ] as Slot[];
    const loaded = new Inventory(4);
    loaded.load(dirty);
    expect(loaded.toJSON()).toEqual([null, { item: 'plank', count: 99 }, { item: 'flint_pickaxe', count: 1, durability: 64 }, null]);
  });
});

describe('slot operations', () => {
  const pair = (): [Inventory, Inventory] => [new Inventory(4), new Inventory(4)];

  it('moveStack drops into an empty slot, merges with overflow, or swaps', () => {
    const [a, b] = pair();
    a.set(0, makeStack('plank', 60));
    expect(moveStack(a, 0, b, 2)).toBe(60);
    expect(a.get(0)).toBeNull();
    a.set(0, makeStack('plank', 60));
    expect(moveStack(a, 0, b, 2)).toBe(39);
    expect(b.get(2)?.count).toBe(99);
    expect(a.get(0)?.count).toBe(21);
    // Target full of the same item: the stacks trade places (a no-op in effect, but never a loss).
    expect(moveStack(a, 0, b, 2)).toBe(21);
    expect(a.get(0)?.count).toBe(99);
    expect(b.get(2)?.count).toBe(21);
    b.set(3, makeStack('stick', 5));
    expect(moveStack(a, 0, b, 3)).toBe(99);
    expect(a.get(0)).toEqual({ item: 'stick', count: 5 });
    expect(b.get(3)).toEqual({ item: 'plank', count: 99 });
    expect(moveStack(a, 1, b, 0)).toBe(0);
    expect(moveStack(a, 0, a, 0)).toBe(0);
    expect(a.count('plank') + b.count('plank')).toBe(120);
  });

  it('moveHalf rounds up, moveOne moves one, mergeSlots only tops up', () => {
    const [a, b] = pair();
    a.set(0, makeStack('coal', 7));
    expect(moveHalf(a, 0, b, 0)).toBe(4);
    expect(a.get(0)?.count).toBe(3);
    expect(moveOne(a, 0, b, 0)).toBe(1);
    expect(b.get(0)?.count).toBe(5);
    expect(moveOne(a, 0, b, 1)).toBe(1);
    expect(a.get(0)?.count).toBe(1);
    expect(moveHalf(a, 0, a, 3)).toBe(1);
    expect(a.get(0)).toBeNull();
    b.set(2, makeStack('stick', 1));
    expect(moveOne(b, 0, b, 2)).toBe(0);
    expect(moveHalf(b, 0, b, 2)).toBe(0);
    expect(mergeSlots(b, 0, b, 2)).toBe(0);
    expect(mergeSlots(b, 0, b, 3)).toBe(0);
    expect(mergeSlots(b, 1, b, 0)).toBe(1);
    expect(b.get(0)?.count).toBe(6);
    expect(transfer(b, 0, b, 3, 2)).toBe(2);
    expect(b.get(3)).toEqual({ item: 'coal', count: 2 });
  });

  it('tools keep their durability when they move and never merge', () => {
    const [a, b] = pair();
    a.add('flint_pickaxe', 1, 12);
    b.add('flint_pickaxe', 1, 50);
    expect(moveOne(a, 0, b, 0)).toBe(0);
    expect(mergeSlots(a, 0, b, 0)).toBe(0);
    expect(moveStack(a, 0, b, 0)).toBe(1);
    expect(a.get(0)?.durability).toBe(50);
    expect(b.get(0)?.durability).toBe(12);
    expect(moveHalf(b, 0, a, 3)).toBe(1);
    expect(a.get(3)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 12 });
    expect(quickMove(a, 3, b)).toBe(1);
    expect(b.get(0)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 12 });
  });

  it('quickMove fills existing stacks first, moves what fits and handles full inventories', () => {
    const [a, b] = pair();
    a.set(0, makeStack('plank', 50));
    b.set(0, makeStack('stick', 99));
    b.set(1, makeStack('plank', 80));
    b.set(2, makeStack('stick', 99));
    b.set(3, makeStack('plank', 95));
    expect(quickMove(a, 0, b)).toBe(23);
    expect(a.get(0)?.count).toBe(27);
    expect(b.count('plank')).toBe(198);
    expect(quickMove(a, 0, b)).toBe(0);
    expect(a.get(0)?.count).toBe(27);
    expect(quickMove(a, 1, b)).toBe(0);
  });

  it('quickMove within one inventory moves between slot ranges (hotbar <-> backpack)', () => {
    const inv = new Inventory(6);
    inv.set(0, makeStack('coal', 10));
    inv.set(4, makeStack('coal', 95));
    expect(quickMove(inv, 0, inv, 3, 6)).toBe(10);
    expect(inv.get(0)).toBeNull();
    expect(inv.get(4)?.count).toBe(99);
    expect(inv.get(3)?.count).toBe(6);
    // A slot already inside the target range stays put.
    expect(quickMove(inv, 3, inv, 3, 6)).toBe(0);
    expect(quickMove(inv, 3, inv, 0, 3)).toBe(6);
    expect(inv.get(0)?.count).toBe(6);
  });

  it('swapSlots trades any two slots', () => {
    const [a, b] = pair();
    a.set(0, makeStack('coal', 3));
    expect(swapSlots(a, 0, b, 1)).toBe(true);
    expect(a.get(0)).toBeNull();
    expect(b.get(1)).toEqual({ item: 'coal', count: 3 });
    expect(swapSlots(a, 0, b, 0)).toBe(false);
    expect(swapSlots(b, 1, b, 1)).toBe(false);
    expect(swapSlots(b, 1, a, 9)).toBe(false);
  });
});
