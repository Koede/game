import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { SCROLLS, foundFlag } from './scrolls';
import { LOOT_TABLES } from '../content/loot';
import { itemOrNull } from '../core/registry';
import { WARD_SCALE } from './magic';
import { hasFlag } from './research';

describe('research scrolls', () => {
  it('are items, found in the deep ruins only', () => {
    for (const s of SCROLLS) {
      expect(itemOrNull(s.item)).not.toBeNull();
      expect(LOOT_TABLES.find((t) => t.tier === 'deep')!.entries.some((e) => e.item === s.item)).toBe(true);
      expect(LOOT_TABLES.find((t) => t.tier === 'near')!.entries.some((e) => e.item === s.item)).toBe(false);
    }
    expect(WARD_SCALE).toBe(0.5);
  });

  it('reading one finds it, gives lore, flags its effect, and a second is refused', () => {
    const t = setup();
    t.hold('scroll_ledger', 2);
    const before = t.magic.research.lore.rift ?? 0;
    expect(t.magic.use(null)).toBe('worked');
    expect(t.magic.isFound('ledger')).toBe(true);
    expect(hasFlag(t.magic.research, 'warp_ease')).toBe(true);
    expect(t.magic.research.lore.rift).toBe(before + 2);
    expect(t.player.inventory.count('scroll_ledger')).toBe(1);
    t.player.selectedSlot = 1;
    expect(t.magic.use(null)).toBe('refused');
    expect(t.magic.hiddenFound().map((h) => h.id)).toEqual(['ledger']);
    expect(t.magic.notebook().hidden()).toHaveLength(1);
  });

  it('scanning a particular thing for the first time uncovers one, and it survives a save', () => {
    const t = setup();
    t.hold('field_notebook');
    t.put(3, 1, 3, 'glass');
    const tgt = t.at(3, 1, 3);
    for (let i = 0; i < 8; i++) {
      t.magic.tick(0.25);
      t.magic.use(tgt);
    }
    expect(t.magic.isFound('verses')).toBe(true);
    expect(t.magic.research.flags).toContain(foundFlag('verses'));
    const u = setup();
    u.magic.load(JSON.parse(JSON.stringify(t.magic.toJSON())));
    expect(u.magic.isFound('verses')).toBe(true);
    expect(hasFlag(u.magic.research, 'long_sight')).toBe(true);
  });

  it('Warp ease lets warp drain over time', () => {
    const t = setup();
    t.hold('scroll_ledger');
    t.magic.use(null);
    t.magic.addWarp(3);
    const w = t.magic.warp;
    for (let i = 0; i < 125; i++) t.magic.tick(1);
    expect(t.magic.warp).toBeLessThan(w);
  });
});
