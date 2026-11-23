/**
 * Tavern upkeep (docs/api/npcs.md): hand Rosa your own food and brews and she stocks the bar. While the tavern is open (day and
 * evening) she sells one unit every SELL_EVERY_S and keeps the takings in her till; a night asleep or away sells a handful too.
 * Rosa keeps the books: what is in the till, what the bar has earned in all. The player collects the till, and the earnings fund
 * upgrades: a stage (unlocks the festival's dance floor show and sells faster) and two more guest rooms (lodgers pay rent each day).
 */
import { itemOrNull } from '../core/registry';
import type { Service, TavernPort } from './services';

export const STOCK_MAX = 40;
export const SELL_EVERY_S = 20;
/** The most she sells in one unattended night or absence. */
export const OVERNIGHT_SALES = 6;
/** What a customer pays over what the item is worth to the bar. */
export const MARKUP = 1.5;
/** A day's rent per extra room. */
export const ROOM_RENT = 4;

/** What one unit of `item` is worth to the bar, or 0 when it is not food or a brew. */
export function stockValue(item: string): number {
  const it = itemOrNull(item);
  if (!it) return 0;
  if (it.drink) return Math.max(2, Math.round(4 + it.drink.buffS / 60));
  if (it.food) return Math.max(2, Math.round(2 + it.food.hunger * 0.25 + (it.food.buffS ? it.food.buffS / 120 : 0)));
  return 0;
}

export interface Upgrade {
  id: 'stage' | 'rooms2' | 'rooms3';
  name: string;
  /** Coin it costs. */
  cost: number;
  /** The bar must have earned this much in all before Rosa will talk about it. */
  earned: number;
  /** An upgrade that must be built first. */
  needs?: Upgrade['id'];
  blurb: string;
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'stage', name: 'a stage', cost: 120, earned: 40, blurb: 'a stage by the jukebox: the bar sells a third faster and the festival has a dance floor show' },
  { id: 'rooms2', name: 'a second guest room', cost: 90, earned: 30, blurb: 'a second guest room: a lodger pays 4 coin rent a day into the till' },
  { id: 'rooms3', name: 'a third guest room', cost: 160, earned: 90, needs: 'rooms2', blurb: 'a third guest room: another 4 coin rent a day' },
];

export interface UpkeepSnapshot {
  stock: Record<string, number>;
  till: number;
  earned: number;
  built: string[];
  sold: number;
}

export class Upkeep {
  /** Units on the bar by item key. */
  stock: Record<string, number> = {};
  /** Coin Rosa holds for the player. */
  till = 0;
  /** Coin the bar has taken in all. */
  earned = 0;
  sold = 0;
  built = new Set<string>();
  private sellS = 0;
  private lastDay = 0;

  units(): number {
    return Object.values(this.stock).reduce((a, b) => a + b, 0);
  }

  rooms(): number {
    return 1 + (this.built.has('rooms2') ? 1 : 0) + (this.built.has('rooms3') ? 1 : 0);
  }

  /** Puts up to `count` of `item` on the bar; returns how many were taken (0 when it is no stock or the bar is full). */
  add(item: string, count: number): number {
    if (stockValue(item) <= 0) return 0;
    const take = Math.max(0, Math.min(count, STOCK_MAX - this.units()));
    if (take > 0) this.stock[item] = (this.stock[item] ?? 0) + take;
    return take;
  }

  /** Sells one unit (the one there is most of); returns the coin taken or 0. */
  private sellOne(rng: () => number): number {
    const keys = Object.keys(this.stock).filter((k) => this.stock[k] > 0);
    if (keys.length === 0) return 0;
    const k = keys[Math.min(keys.length - 1, Math.floor(rng() * keys.length))];
    this.stock[k]--;
    if (this.stock[k] <= 0) delete this.stock[k];
    const coin = Math.max(1, Math.round(stockValue(k) * MARKUP));
    this.till += coin;
    this.earned += coin;
    this.sold++;
    return coin;
  }

  /** Open hours: time passes while customers come. */
  tick(dt: number, open: boolean, rng: () => number): number {
    if (!open) return 0;
    this.sellS += dt * (this.built.has('stage') ? 4 / 3 : 1);
    let got = 0;
    while (this.sellS >= SELL_EVERY_S) {
      this.sellS -= SELL_EVERY_S;
      got += this.sellOne(rng);
    }
    return got;
  }

  /** The day turned (or several, asleep or away): a night's sales and the lodgers' rent. Returns coin added to the till. */
  dayRoll(day: number, rng: () => number): number {
    if (this.lastDay === 0) {
      this.lastDay = day;
      return 0;
    }
    const days = Math.max(0, Math.min(day - this.lastDay, 5));
    this.lastDay = day;
    let got = 0;
    for (let d = 0; d < days; d++) {
      for (let i = 0; i < OVERNIGHT_SALES; i++) got += this.sellOne(rng);
      const rent = (this.rooms() - 1) * ROOM_RENT;
      this.till += rent;
      this.earned += rent;
      got += rent;
    }
    return got;
  }

  /** Takes everything from the till. */
  collect(): number {
    const c = Math.floor(this.till);
    this.till -= c;
    return c;
  }

  /** The next upgrade Rosa will talk about (earned enough, prerequisites built, not built yet). */
  nextUpgrade(): Upgrade | null {
    return UPGRADES.find((u) => !this.built.has(u.id) && this.earned >= u.earned && (!u.needs || this.built.has(u.needs))) ?? null;
  }

  toJSON(): UpkeepSnapshot {
    return { stock: { ...this.stock }, till: this.till, earned: this.earned, built: [...this.built], sold: this.sold };
  }

  load(raw: unknown): void {
    this.stock = {};
    this.till = 0;
    this.earned = 0;
    this.sold = 0;
    this.built = new Set();
    this.sellS = 0;
    this.lastDay = 0;
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<UpkeepSnapshot>;
    if (r.stock && typeof r.stock === 'object') for (const [k, v] of Object.entries(r.stock)) if (stockValue(k) > 0 && typeof v === 'number' && v > 0) this.stock[k] = Math.floor(v);
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);
    this.till = num(r.till);
    this.earned = num(r.earned);
    this.sold = Math.floor(num(r.sold));
    for (const b of Array.isArray(r.built) ? r.built : []) if (UPGRADES.some((u) => u.id === b)) this.built.add(b);
  }
}

/** Rosa's till and upgrades as menu offers. */
export function upkeepServices(u: () => Upkeep): Service[] {
  const collect: Service = {
    id: 'till',
    cost: () => 0,
    pitch: () => (u().till >= 1 ? `Your bar has taken ${Math.floor(u().till)} coin since you last asked (${u().earned} in all). Use me again to collect it.` : null),
    accept: (p) => {
      const c = u().collect();
      if (c <= 0) return 'The till is empty. Give it an hour.';
      p.earn(c);
      p.toast(`Rosa hands you the till: +${c} coin (${p.coins()} now)`);
      return 'Counted twice. Mind it.';
    },
  };
  const upgrade: Service = {
    id: 'upgrade',
    cost: () => u().nextUpgrade()?.cost ?? 0,
    pitch: () => {
      const n = u().nextUpgrade();
      return n ? `The bar has earned enough to think big: ${n.blurb}. ${n.cost} coin, and I will see it done. Use me again to say yes.` : null;
    },
    accept: (p) => {
      const n = u().nextUpgrade();
      if (!n) return 'Nothing to build yet. Keep the bar stocked.';
      // The till counts toward it first, then your purse.
      const fromTill = Math.min(Math.floor(u().till), n.cost);
      if (fromTill + p.coins() < n.cost) return `${n.cost} coin for ${n.name}, love. Till and purse together are ${fromTill + p.coins()}.`;
      u().till -= fromTill;
      p.spend(n.cost - fromTill);
      u().built.add(n.id);
      p.toast(`Rosa has ${n.name} built (-${n.cost} coin${fromTill ? `, ${fromTill} of it from the till` : ''})`);
      return `There. ${n.name[0].toUpperCase()}${n.name.slice(1)}. The regulars will talk of nothing else.`;
    },
  };
  return [collect, upgrade];
}

/** A short line on the bar's books for Rosa's chatter. */
export const ledgerLine = (u: Upkeep): string =>
  `The books: ${u.units()} on the bar, ${Math.floor(u.till)} in the till, ${u.earned} taken in all, ${u.sold} sold, ${u.rooms()} room${u.rooms() === 1 ? '' : 's'}.`;

/** What Rosa says to stocking, in a port's voice. */
export function stockLine(p: TavernPort, item: string, took: number, value: number): void {
  p.toast(`Rosa stocks ${took} ${item.replace(/_/g, ' ')} on the bar (about ${Math.max(1, Math.round(value * MARKUP))} coin each as it sells)`);
}
