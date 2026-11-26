import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { BASE_VALUE, CURRENCY, RARE_GOODS, Caravan, caravanHere, caravanStock, nextCaravanDay } from './caravan';
import { Inventory } from './inventory';

describe('trade caravans', () => {
  it('only names real items', () => {
    for (const k of [...Object.keys(BASE_VALUE), ...RARE_GOODS, CURRENCY]) expect(itemOrNull(k), k).not.toBeNull();
  });

  it('arrives on schedule with stable stock of three rare goods', () => {
    expect(caravanHere(3)).toBe(true);
    expect(caravanHere(4)).toBe(false);
    expect(nextCaravanDay(4)).toBe(8);
    expect(nextCaravanDay(3)).toBe(3);
    const s = caravanStock(8);
    expect(s).toHaveLength(3);
    expect(new Set(s.map((l) => l.item)).size).toBe(3);
    expect(caravanStock(8)).toEqual(s);
    expect(caravanStock(9)).toEqual([]);
  });

  it('refuses trade when no caravan is in town', () => {
    const c = new Caravan();
    c.setDay(4);
    const inv = new Inventory(10);
    inv.add('wheat', 5);
    expect(c.sell(inv, 'wheat', 5)).toMatchObject({ ok: false });
  });

  it('selling surplus pays less and less, and the price recovers over days', () => {
    const c = new Caravan();
    c.setDay(3);
    const inv = new Inventory(20);
    inv.add('iron_ingot', 40);
    const first = c.buyPrice('iron_ingot');
    const r = c.sell(inv, 'iron_ingot', 30);
    expect(r.ok).toBe(true);
    expect(inv.count(CURRENCY)).toBe(r.ok ? r.price : -1);
    expect(r.ok && r.price).toBeLessThan(first * 30);
    expect(c.buyPrice('iron_ingot')).toBeLessThan(first);
    const flooded = c.buyPrice('iron_ingot');
    c.setDay(13);
    expect(c.buyPrice('iron_ingot')).toBeGreaterThan(flooded);
    expect(c.sell(inv, 'bedrock_nonsense', 1)).toMatchObject({ ok: false });
  });

  it('buys rare goods with currency, limited by stock and funds', () => {
    const c = new Caravan();
    c.setDay(8);
    const good = caravanStock(8)[0];
    const inv = new Inventory(20);
    expect(c.buy(inv, good.item, 1)).toMatchObject({ ok: false });
    inv.add(CURRENCY, 700);
    const r = c.buy(inv, good.item, 99);
    expect(r.ok).toBe(true);
    expect(inv.count(good.item)).toBe(good.left);
    expect(c.stock().find((s) => s.item === good.item)).toBeUndefined();
    expect(c.buy(inv, 'wheat', 1)).toMatchObject({ ok: false });
  });

  it('saves and restores prices', () => {
    const c = new Caravan();
    c.setDay(3);
    const inv = new Inventory(8);
    inv.add('bread', 10);
    c.sell(inv, 'bread', 10);
    const back = Caravan.fromJSON(JSON.parse(JSON.stringify(c.toJSON())));
    expect(back.buyPrice('bread')).toBe(c.buyPrice('bread'));
    expect(back.present()).toBe(true);
  });

  it('loads a save from before prices were fitted, dropping keys that are no longer bought', () => {
    const c = Caravan.fromJSON({ surplus: { iron_ingot: 4, lithium_salt: 9, nonsense: 1 }, day: 8, bought: { sulfur: 1 }, visit: 8 });
    expect(c.surplusOf('iron_ingot')).toBe(4);
    expect(c.surplusOf('lithium_salt')).toBe(0);
    expect(Caravan.fromJSON(undefined).present()).toBe(false);
    expect(() => Caravan.fromJSON({ surplus: 'x' as never, day: -5 })).not.toThrow();
  });

  it('refuses a lot worth less than one coin instead of eating the goods', () => {
    const c = new Caravan();
    c.setDay(3);
    const inv = new Inventory(8);
    inv.add('potato', 3);
    expect(c.sell(inv, 'potato', 3)).toMatchObject({ ok: false });
    expect(inv.count('potato')).toBe(3);
    inv.add('bread', 8);
    expect(c.sell(inv, 'bread', 8)).toMatchObject({ ok: true });
  });
});
