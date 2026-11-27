import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { BASE_VALUE, BUY_SHARE, CARAVAN_EVERY, CURRENCY, MAX_DEMAND, MIN_DEMAND, RARE_GOODS, RARE_PRICE, Caravan, caravanHere, caravanStock, demandFor, nextCaravanDay, wantedGoods } from './caravan';
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

describe('caravan market: supply, demand and prices', () => {
  it('demand stays in bounds, is stable per visit, and moves between visits', () => {
    const seen = new Set<number>();
    for (let day = 3; day < 300; day += CARAVAN_EVERY) {
      for (const k of Object.keys(BASE_VALUE)) {
        const d = demandFor(k, day);
        expect(d).toBeGreaterThanOrEqual(MIN_DEMAND);
        expect(d).toBeLessThanOrEqual(MAX_DEMAND);
        expect(demandFor(k, day)).toBe(d);
        // days between visits quote the coming visit
        expect(demandFor(k, day - 1)).toBe(d);
        seen.add(d);
      }
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(demandFor('bedrock_nonsense', 3)).toBe(0);
  });

  it('names a couple of wanted goods each visit that pay more than usual', () => {
    const counts = new Map<string, number>();
    for (let day = 3; day < 400; day += CARAVAN_EVERY) {
      const w = wantedGoods(day);
      expect(w).toHaveLength(2);
      expect(new Set(w).size).toBe(2);
      for (const k of w) {
        expect(BASE_VALUE[k], k).toBeDefined();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    // the asks rotate over the goods instead of always naming the same ones
    expect(counts.size).toBeGreaterThan(Object.keys(BASE_VALUE).length / 2);
    // on average a wanted good is in more demand than the rest
    let wanted = 0;
    let other = 0;
    let nw = 0;
    let no = 0;
    for (let day = 3; day < 400; day += CARAVAN_EVERY) {
      const w = wantedGoods(day);
      for (const k of Object.keys(BASE_VALUE)) {
        if (w.includes(k)) (wanted += demandFor(k, day)), nw++;
        else (other += demandFor(k, day)), no++;
      }
    }
    expect(wanted / nw).toBeGreaterThan(other / no + 0.1);
  });

  it('the screen-facing caravan pays the demand-adjusted price and reports it', () => {
    const c = new Caravan();
    c.setDay(3);
    const [k] = c.wanted();
    expect(c.demand(k)).toBe(demandFor(k, 3));
    expect(c.buyPrice(k)).toBeCloseTo(BASE_VALUE[k] * BUY_SHARE * demandFor(k, 3), 3);
  });

  it('trend arrows compare against the last visit, and your own glut shows as falling', () => {
    const c = new Caravan();
    c.setDay(3);
    for (const k of Object.keys(BASE_VALUE)) expect(c.trend(k)).toBe('steady'); // no history yet
    c.setDay(8);
    let ups = 0;
    let downs = 0;
    for (const k of Object.keys(BASE_VALUE)) {
      const t = c.trend(k);
      const ratio = demandFor(k, 8) / demandFor(k, 3);
      if (t === 'up') (ups++, expect(ratio).toBeGreaterThan(1));
      if (t === 'down') (downs++, expect(ratio).toBeLessThan(1));
    }
    expect(ups + downs).toBeGreaterThan(0);
    const inv = new Inventory(20);
    inv.add('iron_ingot', 60);
    c.sell(inv, 'iron_ingot', 40);
    expect(c.trend('iron_ingot')).toBe('down');
  });

  it('buying a rare good makes it dearer on later visits, and that fades', () => {
    const c = new Caravan();
    c.setDay(8);
    const good = caravanStock(8)[0];
    const inv = new Inventory(20);
    inv.add(CURRENCY, 900);
    const before = RARE_PRICE[good.item];
    expect(c.buy(inv, good.item, good.left)).toMatchObject({ ok: true });
    expect(c.rareDemandOf(good.item)).toBeGreaterThan(0);
    const pushed = c.rareDemandOf(good.item);
    c.setDay(20);
    expect(c.rareDemandOf(good.item)).toBeLessThan(pushed);
    expect(c.rareDemandOf(good.item)).toBeGreaterThan(0);
    // find a later visit that stocks it and check the markup is there
    const fresh = new Caravan();
    for (let day = 13; day < 400; day += CARAVAN_EVERY) {
      const line = caravanStock(day).find((l) => l.item === good.item);
      if (!line) continue;
      c.setDay(day);
      fresh.setDay(day);
      if (c.rareDemandOf(good.item) > 0.02) expect(c.sellPrice(good.item)).toBeGreaterThan(fresh.sellPrice(good.item));
      break;
    }
    c.setDay(2000);
    expect(c.rareDemandOf(good.item)).toBe(0);
    expect(before).toBeGreaterThan(0);
  });

  it('saves and restores market memory; old saves without it still load', () => {
    const c = new Caravan();
    c.setDay(3);
    c.setDay(8);
    const good = caravanStock(8)[0];
    const inv = new Inventory(20);
    inv.add(CURRENCY, 500);
    c.buy(inv, good.item, 1);
    const back = Caravan.fromJSON(JSON.parse(JSON.stringify(c.toJSON())));
    expect(back.rareDemandOf(good.item)).toBe(c.rareDemandOf(good.item));
    for (const k of Object.keys(BASE_VALUE)) expect(back.trend(k)).toBe(c.trend(k));
    const old = Caravan.fromJSON({ surplus: {}, day: 8, bought: {}, visit: 8 });
    expect(old.rareDemandOf(good.item)).toBe(0);
    expect(old.trend('iron_ingot')).toBe('steady');
    expect(() => Caravan.fromJSON({ rareDemand: { sulfur: -1, wheat: 2 } as never, lastQuote: 'x' as never })).not.toThrow();
  });
});
