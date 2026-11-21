import { describe, expect, it } from 'vitest';
import { DRINK_BUFF_KEYS } from '../../core/brewing';
import type { DrinkBuff } from '../../core/types';
import { DRINK_GLYPHS, chipDensity, drinkChips } from './drinkBuffs';

const timers = (left: Partial<Record<DrinkBuff, number>>) => ({ timeLeftS: (b: DrinkBuff): number => left[b] ?? 0 });

describe('drink buff chips', () => {
  it('shows nothing while no drink runs', () => {
    expect(drinkChips(timers({}))).toEqual([]);
  });

  it('a running drink is a chip with its name, the time left and the effect in the title', () => {
    expect(drinkChips(timers({ swift: 161 }))).toEqual([
      { buff: 'swift', family: 'coffee', glyph: 'bolt', name: 'Swift', time: '2:41', title: 'Swift: Walk, sprint and swim 20% faster' },
    ]);
  });

  it('lists the tea before the coffee, whatever order they were drunk in', () => {
    const chips = drinkChips(timers({ vigor: 90, mending: 10 }));
    expect(chips.map((c) => `${c.name} ${c.time}`)).toEqual(['Mending 0:10', 'Vigor 1:30']);
  });

  it('each of the six has its own glyph, none of them the warmth flame or the food bowl', () => {
    const glyphs = DRINK_BUFF_KEYS.map((k) => DRINK_GLYPHS[k]);
    expect(new Set(glyphs).size).toBe(6);
    expect(glyphs).not.toContain('flame');
    expect(glyphs).not.toContain('bowl');
  });

  it('the row gets denser as chips are added: full alone, compact from two, tight from four', () => {
    expect([0, 1, 2, 3, 4, 5].map(chipDensity)).toEqual(['full', 'full', 'compact', 'compact', 'tight', 'tight']);
  });
});
