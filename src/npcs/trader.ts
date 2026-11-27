/**
 * The wandering trader (docs/plans/wandering-trader.md, phases 1-3). Pure and DOM-free: the schedule, the stock, the wanted item and
 * the per-visit phrase bank are functions of the world seed and the day, so they can be planned around and tested.
 *
 * Schedule: a visit every few days. Cycle k covers days 1 + 5k .. 5 + 5k; the visit starts on day 1 + 5k or 2 + 5k (by seed), at
 * dusk, and stays three nights: it leaves at sunrise three days later. Visits never overlap. Stock is drawn from the named loot
 * tables trader_common (three or four distinct goods) and trader_rare (one good), seeded by the world and the visit's start day, so
 * it is the same every time the visit is on.
 */
import { hash32, mulberry32 } from '../core/math';
import { itemOrNull, lootTableById, rollLoot } from '../core/registry';
import { STRUCTURE_DEFS } from '../world/structureDefs';
import type { Phase } from './dialogue';
import { priceOf } from './economy';
import { TRADER, TRADER_RUMOURS } from './scripts/trader';
import type { PhraseBank } from './scripts/types';

export const TRADER_CYCLE = 5;
export const TRADER_STAY = 3;
/** Stock sits one age ahead of Ember at most (the same cap as the tavern's named tables). */
export const TRADER_MAX_AGE = 1;

/** A visit: the day it arrives (at dusk) and the day it leaves (at sunrise). */
export interface TraderVisit {
  start: number;
  leave: number;
}

/** The visit of cycle `cycle` (0-based). */
export function traderVisitIn(seed: number, cycle: number): TraderVisit {
  const start = 1 + cycle * TRADER_CYCLE + (hash32(seed, cycle, 0x7ad0) % 2);
  return { start, leave: start + TRADER_STAY };
}

/** The visit that covers `day` (arrival through departure day), or null between visits. */
export function traderVisitOn(seed: number, day: number): TraderVisit | null {
  const d = Math.floor(day);
  if (!(d >= 1)) return null;
  const k = Math.floor((d - 1) / TRADER_CYCLE);
  for (const c of [k - 1, k]) {
    if (c < 0) continue;
    const v = traderVisitIn(seed, c);
    if (d >= v.start && d <= v.leave) return v;
  }
  return null;
}

/**
 * Whether the trader is in the yard on `day` in `phase`: from dusk of the start day, all the way through the nights, until the
 * departure day (who walks out of the yard in the morning and is no longer here).
 */
export function traderHere(v: TraderVisit, day: number, phase: Phase): boolean {
  if (day < v.start || day >= v.leave) return false;
  if (day === v.start) return phase === 'evening' || phase === 'night';
  return true;
}

export interface TraderLine {
  item: string;
  /** Units on the stall when the visit starts. */
  count: number;
  /** Coin for one unit. */
  price: number;
  rare: boolean;
}

/** What one unit costs at the stall: a markup on what Old Bram would pay, much more for the rare line. */
export function traderPrice(item: string, rare: boolean): number {
  return Math.max(2, Math.round(priceOf(item) * (rare ? 5 : 3)));
}

/** The stock of a visit: three or four everyday goods (distinct items) and one rare good. Same for the same seed and start day. */
export function traderStock(seed: number, start: number): TraderLine[] {
  const rng = mulberry32(hash32(seed, start, 0x7ad1));
  const wanted = 3 + Math.floor(rng() * 2);
  const seen = new Set<string>();
  const lines: TraderLine[] = [];
  for (const s of rollLoot(lootTableById('trader_common'), rng)) {
    if (lines.length >= wanted) break;
    if (seen.has(s.item)) continue;
    seen.add(s.item);
    lines.push({ item: s.item, count: s.count, price: traderPrice(s.item, false), rare: false });
  }
  const rare = rollLoot(lootTableById('trader_rare'), rng)[0];
  if (rare && !seen.has(rare.item)) lines.push({ item: rare.item, count: rare.count, price: traderPrice(rare.item, true), rare: true });
  return lines;
}

/** Items the trader may ask for (a favour): everyday goods the player is likely to carry. */
const WANT_POOL: readonly string[] = ['bread', 'cord', 'glass_vial', 'coal', 'hide', 'wheat_seeds', 'flint', 'potato', 'torch', 'charcoal'];

export interface TraderWant {
  item: string;
  /** How many the trader asks for. */
  count: number;
  /** What the favour pays: well above what Old Bram would give. */
  coin: number;
  /** The note the trader says when asked (what the player can do about it). */
  ask: string;
}

/** The one item the trader wants this visit, never one they are selling. */
export function traderWant(seed: number, start: number, stock: readonly string[]): TraderWant {
  const rng = mulberry32(hash32(seed, start, 0x7ad2));
  const pool = WANT_POOL.filter((k) => !stock.includes(k) && itemOrNull(k));
  const item = pool[Math.floor(rng() * pool.length)];
  const count = 2 + Math.floor(rng() * 2);
  const name = (itemOrNull(item)?.name ?? item.replace(/_/g, ' ')).toLowerCase();
  const coin = Math.round(priceOf(item) * count * 2.5) + 4;
  return { item, count, coin, ask: `Pell wants ${count} ${name} this visit, and will pay ${coin} for them. A favour, if you have them to spare.` };
}

/**
 * The phrase bank for one visit: the standing bank plus three rumours, each naming a real structure (src/world/structureDefs.ts).
 * The rumours sit in the idle and the rare pools.
 */
export function traderBank(seed: number, start: number): PhraseBank {
  const rng = mulberry32(hash32(seed, start, 0x7ad3));
  const places = STRUCTURE_DEFS.map((d) => d.name);
  const picked = new Set<number>();
  const rumours: string[] = [];
  while (rumours.length < 3 && picked.size < places.length) {
    const i = Math.floor(rng() * places.length);
    if (picked.has(i)) continue;
    picked.add(i);
    rumours.push(TRADER_RUMOURS[Math.floor(rng() * TRADER_RUMOURS.length)].replace('{place}', places[i]));
  }
  return { ...TRADER, idle: [...TRADER.idle, ...rumours], rare: [...TRADER.rare, ...rumours] };
}
