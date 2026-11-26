import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBOARD_CONTROLS, EXTRAS } from './howto';

describe('How to Play', () => {
  it('explains Photo, Emote and What next', () => {
    const text = EXTRAS.map((t) => t.text);
    expect(text.map((t) => t.split(':')[0])).toEqual(['Photo', 'Emote', 'What next']);
    expect(text[0]).toMatch(/press P/);
    expect(text[1]).toMatch(/press G/);
    expect(text[2]).toMatch(/What next\?/);
  });

  it('lists the emote and photo keys', () => {
    const keys = DEFAULT_KEYBOARD_CONTROLS.map((l) => l.keys.join(' '));
    expect(keys).toContain('G');
    expect(keys).toContain('P');
  });
});
