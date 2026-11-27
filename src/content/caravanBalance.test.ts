import { describe, expect, it } from 'vitest';
import { BASE_VALUE, BUY_SHARE, CURRENCY, MAX_DEMAND, RARE_GOODS, RARE_PRICE, Caravan, demandFor } from '../game/caravan';
import { Inventory } from '../game/inventory';
import { costTable } from './timeModel';

/** Balance bounds for the trade caravan against the time model (docs/advice/balance-economy.md). */
describe('caravan prices fit the time model', () => {
  for (const tier of [3, 4, 5]) {
    const { cost } = costTable(tier);
    const copper = cost.get(CURRENCY)!;

    it(`tier ${tier}: selling never beats mining the copper it pays`, () => {
      for (const [item, value] of Object.entries(BASE_VALUE)) {
        const c = cost.get(item);
        if (c === undefined) continue;
        // coins paid, in the expert seconds those coins would have cost, against the seconds the item cost
        // at the highest demand the market can reach (a wanted good on a good day)
        expect(value * BUY_SHARE * MAX_DEMAND * copper, `${item} pays ${value} coin`).toBeLessThanOrEqual(c * 1.0 + 1e-6);
      }
    });

    it(`tier ${tier}: a routed item is not worth less than a third of its time cost`, () => {
      for (const [item, value] of Object.entries(BASE_VALUE)) {
        const c = cost.get(item);
        if (c === undefined || c < 1) continue; // sub-second crops sit on the 0.05 floor
        expect(value * copper, item).toBeGreaterThanOrEqual(c * 0.7);
        expect(value * copper, item).toBeLessThanOrEqual(c * 1.5);
      }
    });

    it(`tier ${tier}: rare goods cost at least 1.5x what they take to make`, () => {
      for (const [item, price] of Object.entries(RARE_PRICE)) {
        const c = cost.get(item);
        if (c === undefined) continue;
        expect(price * copper, item).toBeGreaterThanOrEqual(c * 1.5);
      }
    });
  }

  it('the caravan never buys its own rare goods (no round trip)', () => {
    for (const k of RARE_GOODS) expect(BASE_VALUE[k], k).toBeUndefined();
  });

  it('flooding a market halves the price within a few dozen units, and it recovers', () => {
    const c = new Caravan();
    c.setDay(3);
    const inv = new Inventory(40);
    inv.add('iron_ingot', 200);
    const first = c.buyPrice('iron_ingot');
    expect(c.sell(inv, 'iron_ingot', 12)).toMatchObject({ ok: true });
    expect(c.buyPrice('iron_ingot')).toBeLessThan(first * 0.55);
    c.setDay(8);
    c.setDay(13);
    c.setDay(18);
    // recovered against that day's market (demand drifts between visits)
    expect(c.buyPrice('iron_ingot')).toBeGreaterThan(first * 0.9 * (demandFor('iron_ingot', 18) / demandFor('iron_ingot', 3)));
  });

  it('sell-and-rebuy is a net loss on every item', () => {
    const c = new Caravan();
    c.setDay(3);
    for (const item of Object.keys(BASE_VALUE)) {
      const inv = new Inventory(40);
      inv.add(item, 1000);
      const r = c.sell(inv, item, 1000);
      if (!r.ok) continue;
      expect(r.price).toBeLessThanOrEqual(1000 * BASE_VALUE[item] * BUY_SHARE * MAX_DEMAND + 1e-6);
    }
  });
});
