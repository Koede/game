import { describe, expect, it } from 'vitest';
import { howToTopics } from './howto';

describe('How to Play covers the newer systems', () => {
  const topics = howToTopics();
  const found = (word: string): string[] => [...new Set(topics.filter((t) => new RegExp(word, 'i').test(t.text)).map((t) => t.section))];

  it.each(['bees?', 'greenhouse', 'caves?', 'caravan', 'photo mode', 'blueprint', 'pneumatic', 'lift', 'telegraph', 'jobs'])('mentions %s', (word) => {
    expect(found(word).length).toBeGreaterThan(0);
  });
  it('keeps them under their own sections', () => {
    expect(found('caravan')).toContain('Settling in');
    expect(found('beehive')).toContain('Further afield');
  });
});
