import { describe, expect, it } from 'vitest';
import { addEnchant, canEnchant, effectiveEnchantLevel, enchantLevel, enchantLines, enchantStack, isEnchanted, sanitizeEnchants } from './enchant';
import { itemOrNull } from './registry';
import { Inventory, canMerge, cloneStack, makeEnchantedStack, makeStack } from '../game/inventory';
import { quickMove, transfer } from '../game/transfer';

describe('enchant registry helpers', () => {
  it('enchantLevel reads 0 for plain, empty and unknown', () => {
    expect(enchantLevel(null, 'magnet')).toBe(0);
    expect(enchantLevel({ item: 'iron_pickaxe', count: 1 }, 'magnet')).toBe(0);
    expect(enchantLevel({ item: 'iron_pickaxe', count: 1, enchants: { magnet: 2 } }, 'magnet')).toBe(2);
    expect(enchantLevel({ item: 'iron_pickaxe', count: 1, enchants: { magnet: 2 } }, 'nope')).toBe(0);
  });

  it('sanitizes: unknown keys dropped, levels clamped, junk ignored', () => {
    expect(sanitizeEnchants({ veinseeker: 9, magnet: 0, ghost: 2, x: 'a' })).toEqual({ veinseeker: 3 });
    expect(sanitizeEnchants({ magnet: 1.9 })).toEqual({ magnet: 1 });
    expect(sanitizeEnchants({ magnet: -1 })).toBeUndefined();
    expect(sanitizeEnchants([1, 2])).toBeUndefined();
    expect(sanitizeEnchants(undefined)).toBeUndefined();
  });

  it('addEnchant keeps the higher level and clamps', () => {
    expect(addEnchant({ magnet: 2 }, 'magnet', 1)).toEqual({ magnet: 2 });
    expect(addEnchant({ magnet: 1 }, 'magnet', 7)).toEqual({ magnet: 3 });
    expect(addEnchant(undefined, 'ghost', 1)).toBeUndefined();
  });

  it('enchantStack respects what the item can take', () => {
    const pick = makeStack('iron_pickaxe', 1, 100);
    expect(enchantStack(pick, 'veinseeker', 2)).toBe(true);
    expect(pick.enchants).toEqual({ veinseeker: 2 });
    const axe = makeStack('iron_axe', 1, 100);
    expect(enchantStack(axe, 'veinseeker', 1)).toBe(false);
    expect(axe.enchants).toBeUndefined();
    expect(enchantStack(axe, 'magnet', 1)).toBe(true);
    const stick = makeStack('stick', 4);
    expect(enchantStack(stick, 'magnet', 1)).toBe(false);
    expect(canEnchant(itemOrNull('chainsaw'), 'magnet')).toBe(false);
  });

  it('tooltip lines name and colour each enchant', () => {
    const s = makeEnchantedStack('iron_pickaxe', { veinseeker: 2, magnet: 3 });
    const lines = enchantLines(s);
    expect(lines.map((l) => l.text)).toEqual(['Veinseeker II', 'Magnet III']);
    expect(lines[0].colour).toMatch(/^#/);
    expect(lines[0].aspect).toBe('vein');
    expect(enchantLines(makeStack('stick', 1))).toEqual([]);
    expect(isEnchanted(s)).toBe(true);
  });
});

describe('enchants on stacks and inventories', () => {
  it('clone copies deeply, merge refuses', () => {
    const a = makeEnchantedStack('iron_pickaxe', { magnet: 1 });
    const c = cloneStack(a);
    expect(c.enchants).toEqual({ magnet: 1 });
    c.enchants!.magnet = 3;
    expect(a.enchants).toEqual({ magnet: 1 });
    expect(canMerge(makeStack('stick', 1), makeStack('stick', 1))).toBe(true);
    expect(canMerge({ item: 'stick', count: 1, enchants: { magnet: 1 } }, makeStack('stick', 1))).toBe(false);
    expect(canMerge(makeStack('stick', 1), { item: 'stick', count: 1, enchants: { magnet: 1 } })).toBe(false);
  });

  it('save round trip keeps enchants; an old save loads unchanged; junk is cleaned', () => {
    const inv = new Inventory(4);
    inv.set(0, makeEnchantedStack('iron_pickaxe', { veinseeker: 3, magnet: 1 }));
    inv.set(1, makeStack('stick', 5));
    const json = JSON.parse(JSON.stringify(inv.toJSON()));
    const back = Inventory.fromJSON(json);
    expect(back.get(0)?.enchants).toEqual({ veinseeker: 3, magnet: 1 });
    expect(back.get(1)).toEqual({ item: 'stick', count: 5 });
    const old = Inventory.fromJSON([{ item: 'iron_pickaxe', count: 1, durability: 50 }, null]);
    expect(old.get(0)).toEqual({ item: 'iron_pickaxe', count: 1, durability: 50 });
    const dirty = Inventory.fromJSON([{ item: 'iron_pickaxe', count: 1, durability: 50, enchants: { veinseeker: 99, bogus: 1, magnet: 'x' } } as never]);
    expect(dirty.get(0)?.enchants).toEqual({ veinseeker: 3 });
    const none = Inventory.fromJSON([{ item: 'iron_pickaxe', count: 1, durability: 50, enchants: { bogus: 1 } } as never]);
    expect(none.get(0)?.enchants).toBeUndefined();
  });

  it('transfers and quick-moves carry the enchants', () => {
    const a = new Inventory(3);
    const b = new Inventory(3);
    a.set(0, makeEnchantedStack('iron_pickaxe', { magnet: 2 }));
    expect(transfer(a, 0, b, 1)).toBe(1);
    expect(b.get(1)?.enchants).toEqual({ magnet: 2 });
    expect(quickMove(b, 1, a, 0, 3)).toBe(1);
    expect(a.get(0)?.enchants).toEqual({ magnet: 2 });
    expect(a.removeAt(0)?.enchants).toEqual({ magnet: 2 });
  });

  it('add never tops a plain stack up with an enchanted one', () => {
    const inv = new Inventory(2);
    inv.add('stick', 3);
    expect(inv.add('stick', 1, undefined, 0, 2, undefined, { magnet: 1 })).toBe(0);
    expect(inv.get(0)?.count).toBe(3);
    expect(inv.get(1)?.enchants).toEqual({ magnet: 1 });
  });
});

describe('masterwork tools run an enchant one level higher', () => {
  it('adds one level, never past the maximum and never from nothing', () => {
    const plain = { item: 'bronze_pickaxe', count: 1, enchants: { veinseeker: 2 } };
    expect(effectiveEnchantLevel(plain, 'veinseeker')).toBe(2);
    expect(effectiveEnchantLevel({ ...plain, quality: 1 }, 'veinseeker')).toBe(2);
    expect(effectiveEnchantLevel({ ...plain, quality: 2 }, 'veinseeker')).toBe(3);
    expect(effectiveEnchantLevel({ ...plain, quality: 2, enchants: { veinseeker: 3 } }, 'veinseeker')).toBe(3);
    expect(effectiveEnchantLevel({ ...plain, quality: 2, enchants: { ember: 1 } }, 'ember')).toBe(1);
    expect(effectiveEnchantLevel({ ...plain, quality: 2 }, 'magnet')).toBe(0);
  });
});
