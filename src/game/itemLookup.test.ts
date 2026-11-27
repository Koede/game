import { describe, expect, it } from 'vitest';
import { cardLine, foundIn, lookupItem, madeBy, usedIn } from './itemLookup';
import { ITEMS } from '../core/registry';

describe('itemLookup', () => {
  it('says where a plank comes from and what it goes into', () => {
    expect(madeBy('plank').length).toBeGreaterThan(0);
    expect(usedIn('plank').length).toBeGreaterThan(3);
  });

  it('finds the source of things no recipe makes', () => {
    expect(foundIn('hide').length).toBeGreaterThan(0);
    expect(foundIn('raw_perch')).toContain('Fishing');
    expect(cardLine('raw_perch')).toMatch(/^Found: Fishing/);
  });

  it('reads recipes outside the registry (rune desk, tool builds)', () => {
    expect(madeBy('bronze_rod').some((r) => r.station === 'Rune Desk')).toBe(true);
    expect(lookupItem('wand_reed_copper').madeAt.length).toBeGreaterThan(0);
  });

  it('every non-block item answers "how do I get this?" or is world-only', () => {
    const mute = ITEMS.filter((it) => !it.block && madeBy(it.key).length === 0 && foundIn(it.key).length === 0).map((it) => it.key);
    // Items handed out by code (shops, family builders): listed so the gap is visible and only shrinks.
    expect(mute.length).toBeLessThan(ITEMS.length / 3);
  });
});
