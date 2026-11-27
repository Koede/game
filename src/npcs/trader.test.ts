import { describe, expect, it } from 'vitest';
import { itemOrNull, lootTableById, lootTableItems } from '../core/registry';
import { STRUCTURE_DEFS } from '../world/structureDefs';
import { VISITORS } from './data';
import { lifeRig } from './life.rig';
import { findPath, walkable } from './nav';
import { TRADER, TRADER_RUMOURS } from './scripts/trader';
import { TRADER_GATE, TRADER_SETTLE } from './routines';
import {
  TRADER_CYCLE, TRADER_MAX_AGE, TRADER_STAY, traderBank, traderHere, traderPrice, traderStock, traderVisitIn, traderVisitOn, traderWant,
} from './trader';

const SEED = 42;
/** Times of day (see core/constants.ts): dusk 0.59..0.64, night from 0.64, dawn before 0.05, day in between. */
const DUSK = 0.61;
const NIGHT = 0.8;
const MORNING = 0.02;

describe('the trader schedule (pure)', () => {
  it('arrives once every few days, at dusk, and stays three nights', () => {
    for (let k = 0; k < 40; k++) {
      const v = traderVisitIn(SEED, k);
      expect(v.start === 1 + k * TRADER_CYCLE || v.start === 2 + k * TRADER_CYCLE).toBe(true);
      expect(v.leave - v.start).toBe(TRADER_STAY);
      expect(traderVisitIn(SEED, k)).toEqual(v);
    }
  });

  it('never overlaps two visits, and a visit covers exactly its own days', () => {
    for (let day = 1; day <= 200; day++) {
      const v = traderVisitOn(SEED, day);
      if (v) {
        expect(day >= v.start && day <= v.leave).toBe(true);
      }
    }
    for (let k = 0; k < 40; k++) expect(traderVisitIn(SEED, k).leave).toBeLessThan(traderVisitIn(SEED, k + 1).start);
  });

  it('is deterministic by seed and day, and differs between worlds', () => {
    const starts = (seed: number) => Array.from({ length: 12 }, (_, k) => traderVisitIn(seed, k).start);
    expect(starts(SEED)).toEqual(starts(SEED));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) seen.add(starts(seed).join());
    expect(seen.size).toBeGreaterThan(5);
    expect(traderVisitOn(SEED, 0)).toBeNull();
  });

  it('is here from dusk of its first day until the morning it leaves, and not at all in the day of the start', () => {
    const v = traderVisitIn(SEED, 0);
    expect(traderHere(v, v.start, 'morning')).toBe(false);
    expect(traderHere(v, v.start, 'day')).toBe(false);
    expect(traderHere(v, v.start, 'evening')).toBe(true);
    expect(traderHere(v, v.start, 'night')).toBe(true);
    for (let d = v.start + 1; d < v.leave; d++) for (const p of ['morning', 'day', 'evening', 'night'] as const) expect(traderHere(v, d, p)).toBe(true);
    expect(traderHere(v, v.leave, 'morning')).toBe(false);
    expect(traderHere(v, v.leave, 'night')).toBe(false);
  });

  it('has a visit every four to six days on average (sparse, not always there)', () => {
    let visits = 0;
    let days = 0;
    for (let day = 1; day <= 100; day++) {
      days++;
      if (traderVisitOn(SEED, day)?.start === day) visits++;
    }
    expect(visits).toBeGreaterThanOrEqual(15);
    expect(visits).toBeLessThanOrEqual(25);
    expect(days).toBe(100);
  });
});

describe('the trader stock and want (pure, seeded by world and visit)', () => {
  const starts = Array.from({ length: 40 }, (_, k) => traderVisitIn(SEED, k).start);
  const commonItems = new Set(lootTableItems(lootTableById('trader_common')));
  const rareItems = new Set(lootTableItems(lootTableById('trader_rare')));

  it('is fixed per visit and has three to five distinct items with exactly one rare line', () => {
    for (const s of starts.slice(0, 12)) {
      const a = traderStock(SEED, s);
      expect(traderStock(SEED, s)).toEqual(a);
      expect(a.length).toBeGreaterThanOrEqual(4);
      expect(a.length).toBeLessThanOrEqual(5);
      expect(new Set(a.map((l) => l.item)).size).toBe(a.length);
      expect(a.filter((l) => l.rare)).toHaveLength(1);
      expect(a[a.length - 1].rare).toBe(true);
    }
  });

  it('draws the everyday lines from trader_common and the rare line from trader_rare, within the age cap', () => {
    for (const s of starts) {
      for (const l of traderStock(SEED, s)) {
        expect(itemOrNull(l.item), l.item).toBeTruthy();
        expect(itemOrNull(l.item)!.age, l.item).toBeLessThanOrEqual(TRADER_MAX_AGE);
        expect((l.rare ? rareItems : commonItems).has(l.item), l.item).toBe(true);
        expect(l.count).toBeGreaterThanOrEqual(1);
        expect(l.price).toBeGreaterThanOrEqual(2);
        expect(l.price).toBe(traderPrice(l.item, l.rare));
      }
    }
  });

  it('changes from visit to visit', () => {
    const sets = new Set(starts.map((s) => traderStock(SEED, s).map((l) => l.item).join()));
    expect(sets.size).toBeGreaterThan(10);
  });

  it('asks for one item they do not sell, at a bonus over its price', () => {
    for (const s of starts.slice(0, 20)) {
      const stock = traderStock(SEED, s).map((l) => l.item);
      const w = traderWant(SEED, s, stock);
      expect(traderWant(SEED, s, stock)).toEqual(w);
      expect(stock.includes(w.item)).toBe(false);
      expect(itemOrNull(w.item), w.item).toBeTruthy();
      expect(w.count).toBeGreaterThanOrEqual(2);
      expect(w.coin).toBeGreaterThan(0);
      expect(w.ask).toContain(w.item.replace(/_/g, ' '));
    }
  });

  it('has rumours that name real structures (src/world/structureDefs.ts), and only real placeholders', () => {
    const names = new Set(STRUCTURE_DEFS.map((d) => d.name));
    for (const t of TRADER_RUMOURS) expect(t.split('{place}').length).toBe(2);
    for (const s of starts.slice(0, 10)) {
      const b = traderBank(SEED, s);
      const rumours = b.rare.filter((l) => !TRADER.rare.includes(l));
      expect(rumours.length).toBeGreaterThanOrEqual(1);
      for (const r of rumours) {
        expect(r).not.toContain('{');
        const named = [...names].find((n) => r.includes(n));
        expect(named, r).toBeTruthy();
      }
      expect(b.idle.length).toBeGreaterThan(TRADER.idle.length);
      expect(traderBank(SEED, s)).toEqual(b);
    }
  });

  it('has a gate and a stall in the yard that are walkable and joined by a path', () => {
    expect(walkable(TRADER_GATE[0], TRADER_GATE[2])).toBe(true);
    expect(walkable(TRADER_SETTLE[0], TRADER_SETTLE[2])).toBe(true);
    expect(findPath([TRADER_GATE[0], TRADER_GATE[2]], [TRADER_SETTLE[0], TRADER_SETTLE[2]])).not.toBeNull();
    const pell = VISITORS.find((n) => n.role === 'trader')!;
    expect(pell.kind).toBe('person');
    expect(pell.bank).toBe(TRADER);
  });
});

describe('the trader in the tavern (manager)', () => {
  const v = traderVisitIn(SEED, 0);
  const shown = (npcs: { views(): { role: string }[] }) => npcs.views().some((x) => x.role === 'trader');
  const pos = (npcs: { views(): { role: string; x: number; z: number }[] }) => {
    const x = npcs.views().find((n) => n.role === 'trader')!;
    return { x: x.x, z: x.z };
  };
  const yardX = (c: readonly [number, number, number]) => 100 + c[0] + 0.5;
  const yardZ = (c: readonly [number, number, number]) => 100 + c[2] + 0.5;

  it('arrives at dusk of its start day and is not there in the morning', () => {
    const { npcs, state } = lifeRig({ seed: SEED, day: v.start, tod: MORNING });
    expect(shown(npcs)).toBe(false);
    state.tod = DUSK;
    expect(shown(npcs)).toBe(true);
  });

  it('walks in from the gate to the stall, and says so when it arrives', () => {
    const { npcs, state, toasts } = lifeRig({ seed: SEED, day: v.start, tod: MORNING });
    npcs.tick(0.5); // hidden at the gate
    state.tod = DUSK;
    expect(pos(npcs).x).toBeCloseTo(yardX(TRADER_GATE), 1);
    expect(pos(npcs).z).toBeCloseTo(yardZ(TRADER_GATE), 1);
    npcs.tick(0.1);
    expect(toasts.some((t) => t.includes('comes up the road'))).toBe(true);
    for (let i = 0; i < 80; i++) npcs.tick(0.25);
    expect(pos(npcs).x).toBeCloseTo(yardX(TRADER_SETTLE), 1);
    expect(pos(npcs).z).toBeCloseTo(yardZ(TRADER_SETTLE), 1);
  });

  it('leaves at sunrise: walks out to the gate and is gone', () => {
    const { npcs, state, toasts } = lifeRig({ seed: SEED, day: v.start, tod: DUSK });
    for (let i = 0; i < 80; i++) npcs.tick(0.25); // in the yard
    state.day = v.leave;
    state.tod = MORNING;
    npcs.tick(0.1);
    expect(toasts.some((t) => t.includes('walks the goat back down the road'))).toBe(true);
    expect(shown(npcs)).toBe(true); // still walking out
    for (let i = 0; i < 80; i++) npcs.tick(0.25);
    expect(shown(npcs)).toBe(false);
    expect(npcs.trader()).not.toBeNull();
    expect(npcs.trader()!.here).toBe(false);
  });

  it('is not there between visits, and its stock is gone with the visit', () => {
    let gap = 1;
    while (traderVisitOn(SEED, gap) !== null) gap++;
    const { npcs, state } = lifeRig({ seed: SEED, day: gap, tod: DUSK });
    expect(npcs.trader()).toBeNull();
    expect(shown(npcs)).toBe(false);
    expect(npcs.toJSON().trader).toBeUndefined();
    state.day = v.start;
    expect(npcs.trader()!.start).toBe(v.start);
  });

  it('sells by the stall: one Use pitches a line, a second Use inside the window buys one unit', () => {
    const { npcs, says, state } = lifeRig({ seed: SEED, day: v.start, tod: NIGHT, coins: 500 });
    const pell = VISITORS.find((n) => n.role === 'trader')!;
    const first = npcs.trader()!.stock[0];
    npcs.speak(pell);
    expect(npcs.trader()!.stock[0].left).toBe(first.left);
    expect(says.some((s) => s.text.includes('left at'))).toBe(true);
    npcs.speak(pell);
    expect(npcs.trader()!.stock[0].left).toBe(first.left - 1);
    expect(npcs.coins).toBe(500 - first.price);
    expect(state.pack[first.item]).toBe(1);
  });

  it('refuses without the coin and leaves the stock alone', () => {
    const { npcs, state } = lifeRig({ seed: SEED, day: v.start, tod: NIGHT, coins: 0 });
    const pell = VISITORS.find((n) => n.role === 'trader')!;
    const before = npcs.trader()!.stock.map((s) => s.left);
    npcs.speak(pell);
    npcs.speak(pell);
    expect(npcs.trader()!.stock.map((s) => s.left)).toEqual(before);
    expect(npcs.coins).toBe(0);
    expect(state.pack[npcs.trader()!.stock[0].item] ?? 0).toBe(0);
  });

  it('takes the wanted item in full for its bonus, once per visit', () => {
    const want = firstWant();
    const { npcs, state } = lifeRig({ seed: SEED, day: v.start, tod: NIGHT, held: { item: want.item, count: want.count } });
    const pell = VISITORS.find((n) => n.role === 'trader')!;
    npcs.speak(pell);
    expect(npcs.coins).toBe(want.coin);
    expect(state.held).toBeNull();
    expect(npcs.trader()!.wantDone).toBe(true);
    npcs.speak(pell);
    expect(npcs.coins).toBe(want.coin);
  });

  it('asks for more when the wanted item is short, and pays nothing', () => {
    const want = firstWant();
    const { npcs, state } = lifeRig({ seed: SEED, day: v.start, tod: NIGHT, held: { item: want.item, count: 1 } });
    const pell = VISITORS.find((n) => n.role === 'trader')!;
    npcs.speak(pell);
    expect(npcs.coins).toBe(0);
    expect(state.held?.count).toBe(1);
    expect(npcs.trader()!.wantDone).toBe(false);
  });

  it('keeps the stock left and the favour done when saved mid-visit and loaded', () => {
    const a = lifeRig({ seed: SEED, day: v.start, tod: NIGHT, coins: 500 });
    const pell = VISITORS.find((n) => n.role === 'trader')!;
    a.npcs.speak(pell);
    a.npcs.speak(pell);
    const saved = JSON.parse(JSON.stringify(a.npcs.toJSON()));
    expect(saved.trader.visit).toBe(v.start);
    const b = lifeRig({ seed: SEED, day: v.start, tod: NIGHT, coins: 500 });
    b.npcs.load(saved);
    expect(b.npcs.trader()!.stock.map((s) => s.left)).toEqual(a.npcs.trader()!.stock.map((s) => s.left));
    expect(b.npcs.trader()!.stock.map((s) => s.item)).toEqual(a.npcs.trader()!.stock.map((s) => s.item));
    expect(b.npcs.trader()!.wantDone).toBe(a.npcs.trader()!.wantDone);
  });
});

/** The want of the first visit (the stock and want do not depend on the rig, only on the seed and the day). */
function firstWant() {
  return lifeRig({ seed: SEED, day: traderVisitIn(SEED, 0).start, tod: NIGHT }).npcs.trader()!.want;
}
