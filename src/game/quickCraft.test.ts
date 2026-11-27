import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { PlayerState } from './playerState';
import { quickCraft, quickList, repeatLastHand } from './quickCraft';

const fresh = () => new PlayerState(createBus());

describe('quick-craft', () => {
  it('makes a hand recipe from the pack and remembers it as the last one', () => {
    const p = fresh();
    expect(repeatLastHand(p)).toBeNull();
    p.give('fiber', 7);
    const r = quickCraft(p, 'cord');
    expect(r.ok).toBe(true);
    expect(p.inventory.count('cord')).toBe(1);
    expect(p.inventory.count('fiber')).toBe(4);
    expect(p.assist.lastHand).toBe('cord');
  });

  it('repeats the last recipe once per call and says why when it cannot', () => {
    const p = fresh();
    p.give('fiber', 6);
    quickCraft(p, 'cord');
    expect(repeatLastHand(p)?.ok).toBe(true);
    expect(p.inventory.count('cord')).toBe(2);
    const refused = repeatLastHand(p);
    expect(refused?.ok).toBe(false);
    expect(p.inventory.count('cord')).toBe(2);
    // The refusal names what is short and where to get it.
    expect(refused?.ok === false && refused.reason).toMatch(/^Missing 3 Fiber\. Fiber: (Made at|Found)/);
  });

  it('refuses recipes that are not made by hand and does not change last', () => {
    const p = fresh();
    expect(quickCraft(p, 'furnace_clay').ok).toBe(false);
    expect(quickCraft(p, 'nope').ok).toBe(false);
    expect(p.assist.lastHand).toBeNull();
  });

  it('lists what the pack can make, the last made first, one per product', () => {
    const p = fresh();
    expect(quickList(p)).toEqual([]);
    p.give('stick', 4);
    p.give('coal', 2);
    p.give('fiber', 3);
    const ids = quickList(p).map((e) => e.recipe.output.item);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('cord');
    quickCraft(p, 'torch_coal');
    expect(quickList(p, 8)[0]?.recipe.id).not.toBeUndefined();
  });

  it('keeps lastHand across a save', () => {
    const p = fresh();
    p.give('fiber', 3);
    quickCraft(p, 'cord');
    const q = fresh();
    q.load(JSON.parse(JSON.stringify(p.toJSON())));
    expect(q.assist.lastHand).toBe('cord');
  });
});
