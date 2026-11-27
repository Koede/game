import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { recipe } from '../core/registry';
import { PlayerState } from './playerState';
import { Inventory } from './inventory';
import { canMakeNow, pinnedStatus } from './recipeHelper';

describe('pinnedStatus', () => {
  it('splits ingredients between pack and chests and reports what is missing', () => {
    const pack = new Inventory(36);
    const chest = new Inventory(27);
    pack.add('fiber', 1);
    chest.add('fiber', 1);
    const st = pinnedStatus(recipe('cord')!, pack, [chest]);
    expect(st.ingredients).toEqual([{ item: 'fiber', need: 3, inPack: 1, inChests: 1, missing: 1 }]);
    expect(st.ready).toBe(false);
    chest.add('fiber', 1);
    const ok = pinnedStatus(recipe('cord')!, pack, [chest]);
    expect(ok).toMatchObject({ ready: true, readyFromPack: false });
    pack.add('fiber', 2);
    expect(pinnedStatus(recipe('cord')!, pack, [chest]).readyFromPack).toBe(true);
  });

  it('counts a chest listed as the pack only once', () => {
    const pack = new Inventory(36);
    pack.add('fiber', 3);
    expect(pinnedStatus(recipe('cord')!, pack, [pack]).ingredients[0].inChests).toBe(0);
  });
});

describe('canMakeNow', () => {
  it('counts distinct products per station from the sources', () => {
    const pack = new Inventory(36);
    expect(canMakeNow([pack]).find((s) => s.station === 'hand')?.count).toBe(0);
    pack.add('fiber', 7);
    const hand = canMakeNow([pack]).find((s) => s.station === 'hand')!;
    expect(hand.count).toBeGreaterThanOrEqual(1);
    const chest = new Inventory(27);
    chest.add('stick', 4);
    chest.add('coal', 2);
    expect(canMakeNow([pack, chest]).find((s) => s.station === 'hand')!.count).toBeGreaterThan(hand.count);
  });
});

describe('PlayAssist pin', () => {
  it('toggles, ignores unknown ids and round-trips through the player snapshot', () => {
    const p = new PlayerState(createBus());
    expect(p.assist.togglePin('cord')).toBe('cord');
    expect(p.assist.togglePin('nonsense')).toBe('cord');
    const snap = JSON.parse(JSON.stringify(p.toJSON()));
    const q = new PlayerState(createBus());
    q.load(snap);
    expect(q.assist.pinned).toBe('cord');
    expect(p.assist.togglePin('cord')).toBeNull();
    delete snap.assist;
    q.load(snap);
    expect(q.assist.pinned).toBeNull();
  });
});
