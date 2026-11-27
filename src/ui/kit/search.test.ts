import { describe, expect, it } from 'vitest';
import { howToTopics } from '../menus/howto';
import { matches, queryWords } from './search';

describe('menu search', () => {
  it('splits a query into lower-case words', () => {
    expect(queryWords('  Hand-Quern, wheat ')).toEqual(['hand', 'quern', 'wheat']);
    expect(queryWords('   ')).toEqual([]);
  });
  it('matches everything for an empty query and needs every word otherwise', () => {
    expect(matches('', 'anything')).toBe(true);
    expect(matches('furnace heat', 'The Furnace is the heart. Heat first.')).toBe(true);
    expect(matches('furnace banana', 'The Furnace is the heart')).toBe(false);
    expect(matches('ord', undefined, 'Aspects')).toBe(false);
  });
  it('finds How to Play lines by section and text', () => {
    const topics = howToTopics();
    expect(topics.some((t) => matches('bellows', t.section, t.text))).toBe(true);
    expect(topics.filter((t) => matches('emberbound', t.section, t.text)).length).toBeGreaterThan(3);
    expect(topics.some((t) => t.section === 'Controls')).toBe(true);
  });
});
