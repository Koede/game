import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { FAVOURS, FAVOUR_DAYS, FAVOUR_SLOTS, FavourBoard } from './favours';
import { NPCS } from './data';
import { lifeRig } from './life.rig';

const seq = (): (() => number) => {
  let i = 0;
  return () => ((i += 0.318) % 1);
};

describe('favour data', () => {
  it('asks for real items, from real people, with a payoff', () => {
    expect(new Set(FAVOURS.map((f) => f.id)).size).toBe(FAVOURS.length);
    const people = new Set(NPCS.filter((n) => n.kind === 'person').map((n) => n.id));
    for (const f of FAVOURS) {
      expect(itemOrNull(f.item), f.id).toBeTruthy();
      expect(people.has(f.who), f.id).toBe(true);
      expect(f.count).toBeGreaterThan(0);
      expect(f.coin + f.trust, f.id).toBeGreaterThan(0);
    }
  });
});

describe('the favour board', () => {
  it('pins three, rolls them over after their days and does not repeat a done favour at once', () => {
    const b = new FavourBoard();
    const r = seq();
    expect(b.refresh(1, r)).toBe(true);
    expect(b.pinned).toHaveLength(FAVOUR_SLOTS);
    expect(b.refresh(1, r)).toBe(false);
    const first = b.pinned.map((p) => p.id);
    b.refresh(1 + FAVOUR_DAYS, r);
    expect(b.pinned).toHaveLength(FAVOUR_SLOTS);
    expect(b.pinned.every((p) => p.day === 1 + FAVOUR_DAYS)).toBe(true);
    expect(b.pinned.some((p) => first.includes(p.id))).toBe(true); // the pool is small; old ones may come back
    const f = b.list()[0];
    b.complete(f.id, 5);
    expect(b.total).toBe(1);
    expect(b.pinned.some((p) => p.id === f.id)).toBe(false);
    b.refresh(6, r);
    expect(b.pinned.some((p) => p.id === f.id)).toBe(false);
  });

  it('matches a stack by item and count, and survives a round trip', () => {
    const b = new FavourBoard();
    b.refresh(2, seq());
    const f = b.list()[0];
    expect(b.matching(f.item, f.count)?.id).toBe(f.id);
    expect(b.matching(f.item, f.count - 1)).toBeNull();
    expect(b.wanting(f.item)?.id).toBe(f.id);
    const c = new FavourBoard();
    c.load(JSON.parse(JSON.stringify(b.toJSON())));
    expect(c.pinned).toEqual(b.pinned);
    c.load({ pinned: [['nope', 1], 7], total: 'x' });
    expect(c.pinned).toEqual([]);
  });
});

describe('favours on the quest board', () => {
  it('hands the item in at the board for coin and trust, and keeps bounties separate', () => {
    const r = lifeRig({ coins: 0, tod: 0.3 });
    r.npcs.tick(0.1); // pins today's favours
    const f = r.npcs.pinnedFavours()[0];
    expect(f).toBeTruthy();
    r.state.held = { item: f.item, count: f.count + 2 };
    const t0 = r.npcs.trustOf(f.who);
    r.npcs.speak(r.by('board'));
    expect(r.npcs.coins).toBe(f.coin);
    expect(r.npcs.trustOf(f.who)).toBe(t0 + f.trust);
    expect(r.state.held?.count).toBe(2);
    expect(r.npcs.pinnedFavours().some((x) => x.id === f.id)).toBe(false);
    expect(r.npcs.pendingBounties()).toEqual([]);
  });

  it('asks for more when the stack is short, and lists what is pinned on an empty hand', () => {
    const r = lifeRig({ coins: 0, tod: 0.3 });
    r.npcs.tick(0.1);
    const f = r.npcs.pinnedFavours()[0];
    r.state.held = { item: f.item, count: f.count - 1 };
    if (f.count > 1) {
      r.npcs.speak(r.by('board'));
      expect(r.npcs.coins).toBe(0);
      expect(r.toasts.join('|')).toContain(`${f.count}`);
    }
    r.state.held = null;
    r.toasts.length = 0;
    r.npcs.speak(r.by('board'));
    expect(r.toasts.join('|')).toContain('Favours pinned');
  });

  it('saves the pinned favours', () => {
    const a = lifeRig({ tod: 0.3 });
    a.npcs.tick(0.1);
    const snap = JSON.parse(JSON.stringify(a.npcs.toJSON()));
    const b = lifeRig({ tod: 0.3 });
    b.npcs.load(snap);
    expect(b.npcs.pinnedFavours().map((f) => f.id)).toEqual(a.npcs.pinnedFavours().map((f) => f.id));
  });
});
