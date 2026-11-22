import { describe, expect, it } from 'vitest';
import { usesText } from './forgeRows';
import { nextAction } from './firebox';
import { MAX_FURNACE_TIER } from '../../../core/registry';

describe('furnace simplification', () => {
  it('says what a recipe uses in one short line', () => {
    expect(usesText([])).toBe('');
    expect(usesText([{ name: 'Firebrick', need: 4 }])).toBe('Uses 4 Firebrick');
    expect(usesText([{ name: 'Clay', need: 1 }, { name: 'Sand', need: 2 }])).toBe('Uses Clay, 2 Sand');
    expect(usesText([1, 2, 3, 4, 5].map((n) => ({ name: `Part${n}`, need: 1 })))).toBe('Uses Part1, Part2, Part3 +2');
  });

  it('points at one next action: light when there is fuel, the bellows while it is slow, nothing when ignited', () => {
    const view = (o: Record<string, unknown>) => ({ ignited: false, lit: false, fuelItems: 0, tempC: 20, targetC: 900, draft: 0, ...o }) as Parameters<typeof nextAction>[0];
    expect(nextAction(view({}), false)).toBeNull();
    expect(nextAction(view({}), true)).toBe('light');
    expect(nextAction(view({ fuelItems: 3 }), false)).toBe('light');
    expect(nextAction(view({ lit: true, fuelItems: 3 }), false)).toBe('pump');
    expect(nextAction(view({ lit: true, fuelItems: 3, draft: 0.9 }), false)).toBeNull();
    expect(nextAction(view({ lit: true, tempC: 890 }), false)).toBeNull();
    expect(nextAction(view({ ignited: true }), true)).toBeNull();
    expect(MAX_FURNACE_TIER).toBeGreaterThan(1);
  });
});
