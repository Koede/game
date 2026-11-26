import { describe, expect, it } from 'vitest';
import { AGES, OBJECTIVES } from '../../core/registry';
import { DEFAULT_AGES } from '../menus/title';
import { ageShortName, goalKicker } from './goal';

describe('goal tracker wording (phone-ux H4)', () => {
  it('counts goals within their age, never against the whole list', () => {
    const first = goalKicker(OBJECTIVES[0]);
    const emberGoals = OBJECTIVES.filter((o) => o.age === 0).length;
    expect(first).toEqual({ kicker: 'Age 1 - Ember', step: `1/${emberGoals}` });
    for (const o of OBJECTIVES) {
      const { kicker, step } = goalKicker(o);
      expect(kicker).toBe(`Age ${o.age + 1} - ${ageShortName(o.age)}`);
      expect(kicker).not.toMatch(/ of /);
      const [n, of] = step.split('/').map(Number);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(of);
      expect(of).toBeLessThan(OBJECTIVES.length);
    }
  });

  it('names every age by its short name, and the title lists all six', () => {
    expect(AGES.map((_, i) => ageShortName(i))).toEqual(['Ember', 'Bronze', 'Forge', 'Current', 'Atomic', 'Star']);
    expect(DEFAULT_AGES).toEqual(['Ember', 'Bronze', 'Forge', 'Current', 'Atomic', 'Star']);
  });
});
