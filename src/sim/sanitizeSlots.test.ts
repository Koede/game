import { describe, expect, it } from 'vitest';
import { tableCrateEntity } from '../world/ruinCrates';
import { sanitizeEntity } from './sanitize';

describe('sanitizing a crate keeps what makes a tool special', () => {
  it('leaves quality and enchants on stored tools, and drops illegal ones', () => {
    const e = tableCrateEntity(1234, 0, 5, 0, 'cave_boss');
    const before = JSON.stringify(e.slots);
    expect(sanitizeEntity(e)).toBe('ok');
    expect(JSON.stringify(e.slots)).toBe(before);
    const pick = e.slots.find((s) => s?.item === 'iron_pickaxe')!;
    expect(pick.quality).toBe(2);
    expect(pick.enchants).toEqual({ veinseeker: 2, magnet: 1 });
    // Junk is cleaned, not kept.
    pick.quality = 7 as never;
    pick.enchants = { veinseeker: 99, nonsense: 1 };
    expect(sanitizeEntity(e)).toBe('repaired');
    const fixed = e.slots.find((s) => s?.item === 'iron_pickaxe')!;
    expect(fixed.quality).toBeUndefined();
    expect(fixed.enchants?.nonsense).toBeUndefined();
  });
});
