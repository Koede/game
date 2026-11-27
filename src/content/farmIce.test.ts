import { describe, expect, it } from 'vitest';
import { item, recipe } from '../core/registry';

describe('ice uses', () => {
  it('melts to water in a pail and freezes into berry ice', () => {
    const melt = recipe('melt_ice');
    expect(melt?.inputs.map((i) => i.item).sort()).toEqual(['ice', 'pail']);
    expect(melt?.output.item).toBe('water_pail');
    expect(item('berry_ice').food?.hunger).toBe(4);
    expect(recipe('berry_ice')?.inputs.map((i) => i.item)).toContain('ice');
  });
});
