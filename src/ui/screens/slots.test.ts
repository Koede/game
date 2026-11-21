import { describe, expect, it } from 'vitest';
import { Inventory } from '../../game/inventory';
import { SlotInteraction, slotView } from './slots';

const items = (inv: Inventory) => inv.slots.map((s) => (s ? `${s.item}:${s.count}` : '-'));

function setup() {
  const bag = new Inventory(6);
  const fuel = new Inventory(2, { accept: (item) => item === 'coal' || item === 'stick' });
  const out = new Inventory(1, { takeOnly: true });
  const ui = new SlotInteraction();
  ui.addGroup({ id: 'bag', label: 'Bag', inventory: bag, size: 6 });
  ui.addGroup({ id: 'fuel', label: 'Fuel', inventory: fuel, size: 2 });
  ui.addGroup({ id: 'out', label: 'Output', inventory: out, size: 1 });
  return { bag, fuel, out, ui };
}

describe('SlotInteraction - tap to pick, tap to drop', () => {
  it('picks a filled slot, ignores empty ones, and puts back on a second tap', () => {
    const { bag, ui } = setup();
    bag.set(0, { item: 'coal', count: 10 });
    expect(ui.primary('bag', 3)).toBe('none');
    expect(ui.primary('bag', 0)).toBe('picked');
    expect(ui.picked).toEqual({ group: 'bag', index: 0, half: false });
    expect(ui.primary('bag', 0)).toBe('cancelled');
    expect(ui.picked).toBeNull();
  });

  it('drops into an empty slot, merges onto the same item, swaps different items', () => {
    const { bag, ui } = setup();
    bag.set(0, { item: 'coal', count: 10 });
    bag.set(1, { item: 'coal', count: 95 });
    bag.set(2, { item: 'flint', count: 3 });
    ui.primary('bag', 0);
    expect(ui.primary('bag', 4)).toBe('moved');
    expect(items(bag)).toEqual(['-', 'coal:95', 'flint:3', '-', 'coal:10', '-']);
    ui.primary('bag', 4);
    expect(ui.primary('bag', 1)).toBe('moved');
    expect(items(bag)).toEqual(['-', 'coal:99', 'flint:3', '-', 'coal:6', '-']);
    ui.primary('bag', 4);
    expect(ui.primary('bag', 2)).toBe('moved');
    expect(items(bag)).toEqual(['-', 'coal:99', 'coal:6', '-', 'flint:3', '-']);
    expect(ui.picked).toBeNull();
  });

  it('moves between inventories honouring accept rules and take-only slots', () => {
    const { bag, fuel, out, ui } = setup();
    bag.set(0, { item: 'flint', count: 3 });
    bag.set(1, { item: 'coal', count: 4 });
    out.set(0, { item: 'copper_ingot', count: 2 });
    ui.primary('bag', 0);
    expect(ui.canDrop('fuel', 0)).toBe(false);
    expect(ui.primary('fuel', 0)).toBe('refused');
    expect(ui.picked).not.toBeNull();
    ui.primary('bag', 0); // put back
    ui.primary('bag', 1);
    expect(ui.canDrop('fuel', 0)).toBe(true);
    expect(ui.canDrop('out', 0)).toBe(false);
    expect(ui.primary('fuel', 0)).toBe('moved');
    expect(items(fuel)).toEqual(['coal:4', '-']);
    // Taking from an output works; putting into it never does.
    ui.primary('out', 0);
    expect(ui.primary('bag', 5)).toBe('moved');
    expect(items(out)).toEqual(['-']);
    expect(items(bag)[5]).toBe('copper_ingot:2');
  });

  it('switches the pick to a filled target that cannot take the picked stack', () => {
    const { bag, fuel, ui } = setup();
    fuel.set(0, { item: 'coal', count: 2 });
    bag.set(0, { item: 'flint', count: 3 });
    ui.primary('bag', 0);
    expect(ui.primary('fuel', 0)).toBe('picked');
    expect(ui.picked).toEqual({ group: 'fuel', index: 0, half: false });
  });
});

describe('SlotInteraction - half, one, quick move', () => {
  it('right-click / long-press picks half; on the picked slot it toggles half then cancels', () => {
    const { bag, ui } = setup();
    bag.set(0, { item: 'coal', count: 9 });
    expect(ui.secondary('bag', 0)).toBe('picked');
    expect(ui.picked?.half).toBe(true);
    expect(ui.primary('bag', 3)).toBe('moved');
    expect(items(bag)).toEqual(['coal:4', '-', '-', 'coal:5', '-', '-']);
    ui.primary('bag', 0);
    expect(ui.secondary('bag', 0)).toBe('picked');
    expect(ui.picked?.half).toBe(true);
    expect(ui.secondary('bag', 0)).toBe('cancelled');
  });

  it('with a pick, secondary on another slot drops one and keeps the pick until empty', () => {
    const { bag, ui } = setup();
    bag.set(0, { item: 'coal', count: 2 });
    ui.primary('bag', 0);
    expect(ui.secondary('bag', 1)).toBe('moved');
    expect(ui.picked).not.toBeNull();
    expect(ui.secondary('bag', 2)).toBe('moved');
    expect(ui.picked).toBeNull();
    expect(items(bag)).toEqual(['-', 'coal:1', 'coal:1', '-', '-', '-']);
  });

  it('quick move sends a stack to the other inventories in binding order, where they accept it', () => {
    const { bag, fuel, ui } = setup();
    bag.set(0, { item: 'coal', count: 99 });
    expect(ui.quickMove('bag', 0)).toBe('moved');
    expect(items(fuel)).toEqual(['coal:99', '-']);
    bag.set(1, { item: 'flint', count: 2 });
    expect(ui.quickMove('bag', 1)).toBe('refused');
    expect(ui.quickMove('fuel', 0)).toBe('moved');
    expect(items(bag)[0]).toBe('coal:99');
  });

  it('quick move inside one inventory uses explicit ranges (hotbar <-> backpack)', () => {
    const inv = new Inventory(6);
    const ui = new SlotInteraction();
    ui.addGroup({ id: 'hotbar', label: 'Hotbar', inventory: inv, start: 0, size: 2 });
    ui.addGroup({ id: 'pack', label: 'Backpack', inventory: inv, start: 2, size: 4 });
    inv.set(0, { item: 'torch', count: 4 });
    expect(ui.quickMove('hotbar', 0)).toBe('moved');
    expect(items(inv)).toEqual(['-', '-', 'torch:4', '-', '-', '-']);
    expect(ui.quickMove('pack', 2)).toBe('moved');
    expect(items(inv)[0]).toBe('torch:4');
  });

  it('sendPicked moves the picked stack to one group and keeps tool durability', () => {
    const { bag, ui } = setup();
    const chest = new Inventory(3);
    ui.addGroup({ id: 'chest', label: 'Crate', inventory: chest, size: 3 });
    bag.set(2, { item: 'flint_pickaxe', count: 1, durability: 17 });
    ui.primary('bag', 2);
    expect(ui.sendPicked('chest')).toBe('moved');
    expect(chest.slots[0]).toEqual({ item: 'flint_pickaxe', count: 1, durability: 17 });
    expect(ui.picked).toBeNull();
  });

  it('drops a pick whose slot emptied underneath it', () => {
    const { fuel, ui } = setup();
    fuel.set(0, { item: 'coal', count: 1 });
    ui.primary('fuel', 0);
    fuel.set(0, null);
    ui.validate();
    expect(ui.picked).toBeNull();
  });
});

describe('slotView', () => {
  it('shows tool wear as a fraction and keeps plain stacks plain', () => {
    expect(slotView(null)).toBeNull();
    expect(slotView({ item: 'coal', count: 3 })).toMatchObject({ item: 'coal', count: 3, durability: undefined, name: 'Coal' });
    expect(slotView({ item: 'flint_pickaxe', count: 1, durability: 32 })?.durability).toBeCloseTo(0.5);
  });
});
