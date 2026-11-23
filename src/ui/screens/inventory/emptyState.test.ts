import { describe, expect, it } from 'vitest';
import { rangeIsEmpty } from './emptyState';

describe('rangeIsEmpty', () => {
  it('looks only inside the range', () => {
    const slots = [{ item: 'plank' }, null, null, undefined, { item: 'stone' }];
    expect(rangeIsEmpty(slots, 1, 3)).toBe(true);
    expect(rangeIsEmpty(slots, 1, 4)).toBe(false);
    expect(rangeIsEmpty(slots, 9, 4)).toBe(true);
  });
});
