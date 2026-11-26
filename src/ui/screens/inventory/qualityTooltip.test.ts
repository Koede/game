import { describe, expect, it } from 'vitest';
import { ENCHANTS } from '../../../core/enchant';
import { itemOrNull } from '../../../core/registry';
import { dishEffect, dishLabel } from '../../../game/cookingQuality';
import { makeEnchantedStack, makeStack, maxDurabilityOf } from '../../../game/inventory';
import { qualityEffect, qualityLabel } from '../../../game/toolQuality';
import { enchantEffectLine, itemCard, slotView, stackName } from './slotViews';

const pickName = itemOrNull('iron_pickaxe')!.name;
const breadName = itemOrNull('bread')!.name;

describe('quality labels', () => {
  it('tools are Fine or Masterwork, never a food word', () => {
    expect(qualityLabel(makeStack('iron_pickaxe', 1, 10))).toBe('');
    expect(qualityLabel(makeStack('iron_pickaxe', 1, 10, 1))).toBe('Fine');
    expect(qualityLabel(makeStack('iron_pickaxe', 1, 10, 2))).toBe('Masterwork');
    expect(qualityLabel(makeStack('bread', 1, undefined, 1))).toBe('');
  });

  it('dishes are Tasty or Exquisite, never a tool word', () => {
    expect(dishLabel(makeStack('bread', 1))).toBe('');
    expect(dishLabel(makeStack('bread', 1, undefined, 1))).toBe('Tasty');
    expect(dishLabel(makeStack('bread', 1, undefined, 2))).toBe('Exquisite');
    expect(dishLabel(makeStack('iron_pickaxe', 1, 10, 1))).toBe('');
  });

  it('effect lines say what the quality gives', () => {
    expect(qualityEffect(0)).toBe('');
    expect(qualityEffect(1)).toBe('Fine: 25% more uses');
    expect(qualityEffect(2)).toBe('Masterwork: 60% more uses');
    expect(dishEffect(0)).toBe('');
    expect(dishEffect(1)).toBe('Tasty: 20% more food, buffs last 1.5x');
    expect(dishEffect(2)).toBe('Exquisite: 50% more food, buffs last 2x');
  });
});

describe('stack names and tooltip text', () => {
  it('names carry the quality in front', () => {
    expect(stackName(makeStack('iron_pickaxe', 1, 10))).toBe(pickName);
    expect(stackName(makeStack('iron_pickaxe', 1, 10, 2))).toBe(`Masterwork ${pickName}`);
    expect(stackName(makeStack('bread', 3, undefined, 1))).toBe(`Tasty ${breadName}`);
  });

  it('a fine tool card shows its name, quality and uses out of its own best', () => {
    const max = maxDurabilityOf('iron_pickaxe', 1)!;
    const card = itemCard(makeStack('iron_pickaxe', 1, max, 1));
    expect(card.title).toBe(`Fine ${pickName}`);
    expect(card.rows).toContainEqual(['Quality', 'Fine: 25% more uses']);
    expect(card.rows).toContainEqual(['Uses left', `${max} / ${max}`]);
    expect(slotView(makeStack('iron_pickaxe', 1, max, 1))?.durability).toBe(1);
    expect(slotView(makeStack('iron_pickaxe', 1, max, 1))?.name).toBe(`Fine ${pickName}`);
  });

  it('a tasty dish card shows its name and quality; a plain one shows neither', () => {
    const card = itemCard(makeStack('bread', 2, undefined, 1));
    expect(card.title).toBe(`Tasty ${breadName}`);
    expect(card.rows).toContainEqual(['Quality', 'Tasty: 20% more food, buffs last 1.5x']);
    const plain = itemCard(makeStack('bread', 2));
    expect(plain.title).toBe(breadName);
    expect(plain.rows?.some(([l]) => l === 'Quality')).toBe(false);
  });

  it('enchant lines carry level and a one-line effect', () => {
    const card = itemCard(makeEnchantedStack('iron_pickaxe', { veinseeker: 2, bounty: 3 }));
    expect(card.lines).toContainEqual(expect.objectContaining({ text: 'Veinseeker II', effect: 'Breaks 6 more blocks of an ore vein' }));
    expect(card.lines).toContainEqual(expect.objectContaining({ text: 'Bounty III', effect: '30% chance of an extra drop' }));
  });

  it('every enchant at every level has a short effect line', () => {
    for (const e of ENCHANTS) {
      for (let lv = 1; lv <= e.max; lv++) {
        const line = enchantEffectLine(e.key, lv);
        expect(line.length, `${e.key} ${lv}`).toBeGreaterThan(5);
        expect(line.length, `${e.key} ${lv}`).toBeLessThanOrEqual(60);
      }
    }
    expect(enchantEffectLine('magnet', 1)).toBe('Drops fly to you from 3 blocks');
    expect(enchantEffectLine('featherfall', 2)).toBe('No fall damage; hold Jump to glide');
    expect(enchantEffectLine('lightstep', 3)).toBe('A trail of light that lasts 6 s');
    expect(enchantEffectLine('nope', 1)).toBe('');
  });
});
