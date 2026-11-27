import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { recipe } from '../core/registry';
import { craftByPlayer } from './crafting';
import { PlayerState } from './playerState';

describe('discovery, caravan and heat wiring', () => {
  it('the recipe book and caravan ride the player save', () => {
    const p = new PlayerState(createBus());
    p.book.learn('waxed_cord');
    p.caravan.setDay(3);
    p.inventory.add('bread', 10);
    p.caravan.sell(p.inventory, 'bread', 10);
    const snap = JSON.parse(JSON.stringify(p.toJSON()));
    const q = new PlayerState(createBus());
    q.load(snap);
    expect(q.book.knows('waxed_cord')).toBe(true);
    expect(q.caravan.present()).toBe(true);
    expect(q.caravan.buyPrice('bread')).toBe(p.caravan.buyPrice('bread'));
    const old = new PlayerState(createBus());
    delete snap.book;
    delete snap.caravan;
    old.load(snap);
    expect(old.book.count).toBe(0);
  });

  it('a stew forged at the right heat comes out better than a cold one', () => {
    const r = recipe('hearth_stew')!;
    const make = (heatC: number) => {
      const p = new PlayerState(createBus());
      for (const i of r.inputs) p.inventory.add(i.item, i.count);
      craftByPlayer(p, r, { heatC });
      return p.inventory.slots.find((s) => s?.item === 'hearth_stew')!;
    };
    expect(make(150).quality ?? 0).toBeGreaterThan(make(700).quality ?? 0);
  });
});
