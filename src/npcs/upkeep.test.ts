import { describe, expect, it } from 'vitest';
import { ITEMS } from '../core/registry';
import { lifeRig } from './life.rig';
import { MARKUP, OVERNIGHT_SALES, ROOM_RENT, SELL_EVERY_S, STOCK_MAX, UPGRADES, Upkeep, stockValue } from './upkeep';

const seq = (): (() => number) => {
  let i = 0;
  return () => ((i += 0.318) % 1);
};
const drinkKey = ITEMS.find((i) => i.drink)!.key;

describe('stock value', () => {
  it('prices food and brews, and nothing else', () => {
    expect(stockValue('hearth_stew')).toBeGreaterThanOrEqual(2);
    expect(stockValue(drinkKey)).toBeGreaterThanOrEqual(4);
    expect(stockValue('coal')).toBe(0);
    expect(stockValue('no_such_thing')).toBe(0);
  });
});

describe('the bar', () => {
  it('stocks up to its capacity and refuses what is not food', () => {
    const u = new Upkeep();
    expect(u.add('coal', 5)).toBe(0);
    expect(u.add('sweet_bun', 30)).toBe(30);
    expect(u.add(drinkKey, 30)).toBe(STOCK_MAX - 30);
    expect(u.units()).toBe(STOCK_MAX);
    expect(u.add('sweet_bun', 1)).toBe(0);
  });

  it('sells one unit every SELL_EVERY_S while open, never when closed, and a stage sells faster', () => {
    const u = new Upkeep();
    u.add('sweet_bun', 10);
    expect(u.tick(SELL_EVERY_S * 5, false, seq())).toBe(0);
    expect(u.units()).toBe(10);
    const got = u.tick(SELL_EVERY_S * 3, true, seq());
    expect(u.units()).toBe(7);
    expect(u.till).toBe(got);
    expect(got).toBe(3 * Math.max(1, Math.round(stockValue('sweet_bun') * MARKUP)));
    expect(u.earned).toBe(got);
    const fast = new Upkeep();
    fast.built.add('stage');
    fast.add('sweet_bun', 20);
    fast.tick(SELL_EVERY_S * 3, true, seq());
    expect(fast.units()).toBe(20 - 4);
  });

  it('sells a night and collects rent for each extra room when the day turns', () => {
    const u = new Upkeep();
    u.add('sweet_bun', 20);
    u.built.add('rooms2');
    expect(u.dayRoll(5, seq())).toBe(0); // first sight of the clock
    const got = u.dayRoll(6, seq());
    expect(u.units()).toBe(20 - OVERNIGHT_SALES);
    expect(got).toBe(u.till);
    expect(u.till).toBeGreaterThanOrEqual(ROOM_RENT + OVERNIGHT_SALES);
    expect(u.collect()).toBe(Math.floor(got));
    expect(u.till).toBeLessThan(1);
  });

  it('opens upgrades in order as the bar earns, and survives a save', () => {
    const u = new Upkeep();
    expect(u.nextUpgrade()).toBeNull();
    u.earned = 35;
    expect(u.nextUpgrade()?.id).toBe('rooms2');
    u.earned = 45;
    expect(u.nextUpgrade()?.id).toBe('stage');
    u.built.add('stage');
    u.earned = 100;
    expect(u.nextUpgrade()?.id).toBe('rooms2');
    u.built.add('rooms2');
    expect(u.nextUpgrade()?.id).toBe('rooms3');
    u.built.add('rooms3');
    expect(u.nextUpgrade()).toBeNull();
    expect(u.rooms()).toBe(3);
    u.add('sweet_bun', 4);
    const c = new Upkeep();
    c.load(JSON.parse(JSON.stringify(u.toJSON())));
    expect(c.toJSON()).toEqual(u.toJSON());
    c.load({ stock: { coal: 5, sweet_bun: 'x' }, built: ['nope', 'stage'], till: -4 });
    expect(c.units()).toBe(0);
    expect([...c.built]).toEqual(['stage']);
    expect(c.till).toBe(0);
    expect(UPGRADES.length).toBe(3);
  });
});

describe('Rosa and the bar', () => {
  it('stocks what you hold (not what she likes as a daily gift) and takes the day\'s takings to the till', () => {
    const r = lifeRig({ coins: 0, tod: 0.3 });
    r.npcs.speak(r.by('rosa')); // welcome gift first
    r.state.held = { item: 'sweet_bun', count: 6 };
    r.npcs.speak(r.by('rosa'));
    expect(r.state.held).toBeNull();
    expect(r.npcs.barStock()).toBe(6);
    for (let i = 0; i < 200; i++) r.npcs.tick(1);
    expect(r.npcs.till()).toBeGreaterThan(0);
    r.npcs.tick(30);
    r.toasts.length = 0;
    r.npcs.serviceMenu().buy('till', r.npcs.servicePort('rosa'));
    expect(r.npcs.coins).toBeGreaterThan(0);
    expect(r.npcs.till()).toBeLessThan(1);
  });

  it('turns the stocked favourite into a gift once a day and into stock after', () => {
    const r = lifeRig({ coins: 0, tod: 0.3 });
    r.npcs.speak(r.by('rosa'));
    r.state.held = { item: 'bread', count: 3 };
    r.npcs.speak(r.by('rosa')); // a gift: trust
    expect(r.npcs.barStock()).toBe(0);
    expect(r.npcs.trustOf('rosa')).toBeGreaterThan(0);
    r.state.held = { item: 'bread', count: 2 };
    r.npcs.speak(r.by('rosa')); // already gifted today: stock
    expect(r.npcs.barStock()).toBe(2);
  });

  it('builds an upgrade from the till and the purse once the bar has earned it', () => {
    const r = lifeRig({ coins: 200, tod: 0.3 });
    const menu = r.npcs.serviceMenu();
    const port = r.npcs.servicePort('rosa');
    expect(menu.buy('upgrade', port)).toBeNull(); // not earned yet
    r.npcs.load({ ...r.npcs.toJSON(), upkeep: { stock: {}, till: 10, earned: 45, built: [], sold: 9 } });
    r.npcs.coins = 200;
    expect(menu.buy('upgrade', port)).toMatch(/stage/i);
    expect(r.npcs.coins).toBe(200 - 120 + 10);
    expect(r.npcs.upgrades()).toHaveLength(1);
  });
});
