import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { itemRarity, rarityOfAge, RARITY_COLOUR } from './rarity';

describe('rarity', () => {
  it('early ages are common and later ones climb to legendary', () => {
    expect([0, 1, 2, 3, 4, 5].map(rarityOfAge)).toEqual([0, 0, 1, 2, 3, 4]);
    expect(rarityOfAge(9)).toBe(4);
    expect(rarityOfAge(-1)).toBe(0);
  });
  it('gear is a step rarer than plain items of its age, capped', () => {
    expect(itemRarity({ age: 2 })).toBe(1);
    expect(itemRarity({ age: 2, armour: { slot: 'chest' } as never })).toBe(2);
    expect(itemRarity({ age: 5, weapon: { damage: 1 } as never })).toBe(4);
    expect(itemRarity({ age: 0, weapon: { damage: 1 } as never })).toBe(0);
  });
  it('has a colour per rarity and real items resolve', () => {
    expect(RARITY_COLOUR).toHaveLength(5);
    const stick = itemOrNull('stick');
    expect(stick && itemRarity(stick)).toBe(0);
  });
});
