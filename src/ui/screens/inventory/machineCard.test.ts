import { describe, expect, it } from 'vitest';
import { itemCard } from './slotViews';

const rows = (item: string): Record<string, string> => Object.fromEntries(itemCard({ item, count: 1 }).rows ?? []);

describe('machine and container cards carry their numbers', () => {
  it('a generator says what it makes, a consumer what it draws, a battery what it stores', () => {
    expect(rows('solar_panel').Makes).toMatch(/W$/);
    expect(rows('crusher').Draws).toMatch(/W$/);
    expect(rows('battery').Stores).toMatch(/J$/);
  });
  it('a pail says what and how much it holds', () => {
    expect(rows('water_pail').Holds).toBe('Water, 1000 L (one bucket)');
  });
  it('plain items get no machine rows', () => {
    expect(rows('stick').Makes).toBeUndefined();
  });
});

describe('the kerosene lamp', () => {
  it('is not advertised as a power source', () => {
    expect(rows('kerosene_lamp').Makes).toBeUndefined();
  });
});
