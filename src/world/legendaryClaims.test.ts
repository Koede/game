import { describe, expect, it } from 'vitest';
import { LEGENDARIES } from '../content/legendary';
import { enchantLevel } from '../core/enchant';
import { LegendaryClaims } from './legendaryClaims';

describe('legendary claims', () => {
  it('give a weapon only to a place whose own hash passes, and never the same weapon twice', () => {
    const c = new LegendaryClaims(() => 1234);
    const got: string[] = [];
    for (let i = 0; i < 4000; i++) {
      const w = c.roll('ruin', i * 7, 20, i * 13, 0.2);
      if (w) got.push(w);
    }
    expect(got.length).toBe(LEGENDARIES.filter((l) => l.source === 'ruin').length); // every ruin weapon, once each
    expect(new Set(got).size).toBe(got.length);
    expect(c.roll('ruin', 1, 1, 1, 1)).toBeNull(); // none left
    expect(c.left('boss').length).toBe(2);
  });

  it('are deterministic for a given world and place, and a boss always holds one while any are left', () => {
    const a = new LegendaryClaims(() => 9);
    const b = new LegendaryClaims(() => 9);
    expect(a.roll('boss', 4, 5, 6)).toBe(b.roll('boss', 4, 5, 6));
    expect(a.roll('boss', 8, 9, 10)).not.toBeNull();
    expect(a.roll('boss', 1, 2, 3)).toBeNull(); // both boss weapons are placed
  });

  it('save and load, ignoring junk', () => {
    const a = new LegendaryClaims(() => 5);
    const w = a.roll('boss', 1, 1, 1)!;
    const b = new LegendaryClaims(() => 5);
    b.load(JSON.parse(JSON.stringify(a.toJSON())));
    expect(b.has(w)).toBe(true);
    const c = new LegendaryClaims(() => 5);
    c.load({ v: 1, claimed: ['emberfang', 'ghost', 3] });
    expect(c.count).toBe(1);
    c.load('junk');
    expect(c.count).toBe(0);
    c.load({ v: 2, claimed: ['emberfang'] });
    expect(c.count).toBe(0);
  });

  it('hand over the finished stack: full durability and the fixed enchants', () => {
    const s = LegendaryClaims.stackOf('gale_reed');
    expect(s.item).toBe('gale_reed');
    expect(s.durability).toBe(320);
    expect(enchantLevel(s, 'featherfall')).toBe(2);
  });
});
