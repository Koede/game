import { describe, expect, it } from 'vitest';
import { cardRows, lookupItem } from '../../../game/itemLookup';
import { itemCard } from '../inventory/slotViews';

describe('item card lookup rows', () => {
  it('a plank card says where it is made and what uses it', () => {
    const card = itemCard({ item: 'plank', count: 1 });
    expect(card.rows?.some(([k]) => k === 'Made at')).toBe(true);
    expect(card.rows?.some(([k]) => k === 'Used in')).toBe(true);
  });

  it('a found-only item says where it is found', () => {
    expect(cardRows('raw_perch')[0]).toEqual(['Found', expect.stringContaining('Fishing')]);
  });

  it('the page data for an item is complete', () => {
    const info = lookupItem('copper_ingot');
    expect(info.name).toBe('Copper Ingot');
    expect(info.madeAt.length + info.foundAt.length).toBeGreaterThan(0);
    expect(info.usedFor.length).toBeGreaterThan(0);
  });
});
