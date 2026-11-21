import { describe, expect, it } from 'vitest';
import { fuelQueueHint, heatRoute } from './fuelText';

describe('fuel advice', () => {
  it('says when a hotter fuel waits behind a cooler one', () => {
    const queue = [{ item: 'charcoal', count: 14 }, { item: 'coke', count: 12 }];
    expect(fuelQueueHint('charcoal', queue)).toBe('Coke waits behind 14 Charcoal - take the charcoal out to burn hotter');
    expect(fuelQueueHint(null, queue)).toBe('Coke waits behind 14 Charcoal - take the charcoal out to burn hotter');
    expect(fuelQueueHint('coke', [{ item: 'coke', count: 3 }, { item: 'charcoal', count: 14 }])).toBeNull();
    expect(fuelQueueHint('charcoal', [null, { item: 'coke', count: 12 }])).toBeNull();
    expect(fuelQueueHint(null, [null, null])).toBeNull();
  });

  it('names the coolest fuel that reaches a heat, with and without the bellows', () => {
    expect(heatRoute(800, false)).toBe('charcoal, or logs with the bellows');
    expect(heatRoute(1400, false)).toBe('coke, or coal with the bellows');
    expect(heatRoute(1400, true)).toBe('coke, or coal with the bellows, or electric heat');
    expect(heatRoute(2000, true)).toBe('electric heat');
    expect(heatRoute(2000, false)).toBe('a hotter furnace');
  });
});
