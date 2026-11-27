import { describe, expect, it } from 'vitest';
import { PHOTO_FILTERS, filterById, nextFilter } from './photoFilters';

describe('photo filters', () => {
  it('starts natural and cycles through every filter back to the start', () => {
    expect(PHOTO_FILTERS[0].css).toBe('none');
    let f = PHOTO_FILTERS[0];
    const seen = [f.id];
    for (let i = 0; i < PHOTO_FILTERS.length; i++) {
      f = nextFilter(f.id);
      seen.push(f.id);
    }
    expect(new Set(seen).size).toBe(PHOTO_FILTERS.length);
    expect(seen[seen.length - 1]).toBe(PHOTO_FILTERS[0].id);
  });
  it('treats an unknown id as natural', () => {
    expect(filterById('nope').id).toBe('natural');
    expect(nextFilter('nope').id).toBe('natural');
  });
  it('has unique ids', () => {
    expect(new Set(PHOTO_FILTERS.map((f) => f.id)).size).toBe(PHOTO_FILTERS.length);
  });
});
