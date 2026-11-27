import { describe, expect, it } from 'vitest';
import { craft } from './crafting';
import { Inventory, maxDurabilityOf, cloneStack } from './inventory';
import { transfer } from './transfer';
import { applyQuality, repairMaterial, repairTool, rollQuality, wearFraction } from './toolQuality';
import { recipe } from '../core/registry';

describe('tool quality', () => {
  it('rolls masterwork, fine, plain by odds and skill widens them', () => {
    expect(rollQuality(0.01)).toBe(2);
    expect(rollQuality(0.1)).toBe(1);
    expect(rollQuality(0.9)).toBe(0);
    expect(rollQuality(0.27, 0)).toBe(0);
    expect(rollQuality(0.27, 1)).toBe(1);
  });

  it('well-made tools hold more durability and keep it through inventories', () => {
    const base = maxDurabilityOf('iron_pickaxe')!;
    expect(maxDurabilityOf('iron_pickaxe', 2)!).toBeGreaterThan(maxDurabilityOf('iron_pickaxe', 1)!);
    expect(maxDurabilityOf('iron_pickaxe', 1)!).toBeGreaterThan(base);
    const a = new Inventory(4);
    a.add('iron_pickaxe', 1, undefined, 0, 4, 2);
    expect(a.slots[0]).toMatchObject({ quality: 2, durability: maxDurabilityOf('iron_pickaxe', 2) });
    const b = new Inventory(4);
    transfer(a, 0, b, 0);
    expect(b.slots[0]!.quality).toBe(2);
    expect(cloneStack(b.slots[0]!).quality).toBe(2);
    const round = Inventory.fromJSON(b.toJSON());
    expect(round.slots[0]!.durability).toBe(maxDurabilityOf('iron_pickaxe', 2));
  });

  it('crafting a tool at a quality stamps the stack', () => {
    const inv = new Inventory(8);
    const r = recipe('flint_pickaxe')!;
    for (const i of r.inputs) inv.add(i.item, i.count);
    expect(craft(r, [inv], inv, 1, 1).ok).toBe(true);
    const tool = inv.slots.find((s) => s?.item === 'flint_pickaxe')!;
    expect(tool.quality).toBe(1);
    expect(tool.durability).toBe(maxDurabilityOf('flint_pickaxe', 1));
  });

  it('repairs with the tool material, a quarter per unit, never past the best', () => {
    expect(repairMaterial('iron_pickaxe')).toBe('iron_ingot');
    expect(repairMaterial('bread')).toBeNull();
    const inv = new Inventory(8);
    const tool = applyQuality({ item: 'iron_pickaxe', count: 1, durability: 10 }, 1);
    tool.durability = 10;
    expect(wearFraction(tool)!).toBeGreaterThan(0.9);
    expect(repairTool(tool, [inv])).toMatchObject({ ok: false });
    inv.add('iron_ingot', 2);
    const r = repairTool(tool, [inv]);
    expect(r).toMatchObject({ ok: true, used: 2 });
    expect(tool.durability).toBeCloseTo(10 + 2 * Math.round(maxDurabilityOf('iron_pickaxe', 1)! * 0.25), 5);
    inv.add('iron_ingot', 9);
    repairTool(tool, [inv]);
    expect(tool.durability).toBe(maxDurabilityOf('iron_pickaxe', 1));
    expect(inv.count('iron_ingot')).toBeGreaterThan(5);
    expect(repairTool(tool, [inv])).toMatchObject({ ok: false });
  });
});
