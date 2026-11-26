/**
 * Trade caravans (docs/api/caravan.md). A merchant train arrives on certain days with a few rare goods and buys
 * surplus. Prices are fitted to the time model and are paid and asked in CURRENCY items and shift with what you sell: every unit sold adds surplus,
 * which lowers that item's price and fades 25% each day. Stock is deterministic per arrival day. Pure; DOM-free.
 */
import { itemOrNull } from '../core/registry';
import type { Inventory } from './inventory';

export const CURRENCY = 'copper_ingot';
/** A caravan arrives every CARAVAN_EVERY days, on the day where `day % CARAVAN_EVERY === CARAVAN_OFFSET`. */
export const CARAVAN_EVERY = 5;
export const CARAVAN_OFFSET = 3;
/** Share of the surplus that is gone after one day. */
export const SURPLUS_FADE = 0.25;
/** The caravan pays this share of an item's base value (it is a buyer, never a source of free coin). */
export const BUY_SHARE = 0.6;

/**
 * What the caravan buys, as a value in CURRENCY (copper ingots, fractions allowed). Fitted to the time model
 * (src/content/timeModel.ts, docs/advice/balance-economy.md): value = expert seconds to make the item / expert
 * seconds to make one copper ingot, so selling can never beat mining copper. Goods the model cannot route (animal
 * and plant leaves, cooked food) are guesses marked `A`. Floor 0.05 so a stack of crops still pays a little.
 * A rare good the caravan itself brings is NOT in here: it never buys its own stock back (no round trip).
 */
export const BASE_VALUE: Readonly<Record<string, number>> = {
  wheat: 0.11, potato: 0.05, carrot: 0.05, flour: 0.34, bread: 0.48, hide: 2.25, leather: 5, cloth: 0.71, fiber: 0.05, cord: 0.34,
  coal: 0.4, charcoal: 0.73, flint: 0.22, tin_ingot: 1.03, bronze_ingot: 1.12, iron_ingot: 0.91, steel_ingot: 1.61, glass_beaker: 0.39,
  // no route in the time model (A)
  pine_resin: 0.5, sugar: 0.8, raw_chop: 1.5, cooked_chop: 2, hearth_stew: 4,
};

/** Rare goods the caravan brings, and what ONE costs in CURRENCY before the low-stock markup. Each is at least 1.5x its time-model cost. */
export const RARE_PRICE: Readonly<Record<string, number>> = {
  tea_cutting: 22, coffee_cutting: 22, sulfur: 16, silica: 14, lithium_salt: 48, tungsten_powder: 64, magnet_ring: 72, fused_quartz: 56, yellowcake: 88,
};

export const RARE_GOODS: readonly string[] = Object.keys(RARE_PRICE);

export interface CaravanSave {
  surplus: Record<string, number>;
  /** Day the surplus was last faded to. */
  day: number;
  /** Units already bought from this visit, by item. */
  bought: Record<string, number>;
  visit: number;
}

export interface StockLine {
  item: string;
  left: number;
}

export type TradeResult = { ok: true; count: number; price: number } | { ok: false; reason: string };

/** Whether a caravan is in town on this day number. */
export const caravanHere = (day: number): boolean => day >= 0 && day % CARAVAN_EVERY === CARAVAN_OFFSET;

/** Day of the next arrival at or after `day`. */
export const nextCaravanDay = (day: number): number => {
  const d = Math.max(0, Math.floor(day));
  return d + ((CARAVAN_OFFSET - (d % CARAVAN_EVERY) + CARAVAN_EVERY) % CARAVAN_EVERY);
};

const hash = (n: number): number => {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
};

/** What the visit on `day` carries: three distinct rare goods, a few of each. Same every time for the same day. */
export function caravanStock(day: number): StockLine[] {
  if (!caravanHere(day)) return [];
  const pool = [...RARE_GOODS].filter((k) => itemOrNull(k));
  const lines: StockLine[] = [];
  let h = hash(day + 1);
  while (lines.length < 3 && pool.length > 0) {
    const i = h % pool.length;
    const item = pool.splice(i, 1)[0];
    h = hash(h);
    lines.push({ item, left: 2 + (h % 4) });
    h = hash(h);
  }
  return lines;
}

export class Caravan {
  private surplus = new Map<string, number>();
  private bought = new Map<string, number>();
  private lastDay = 0;
  private visit = -1;

  /** Fades surplus for the days that passed and starts a fresh visit when a new arrival day comes. Call as the day changes. */
  setDay(day: number): void {
    const d = Math.floor(day);
    if (d > this.lastDay) {
      const keep = Math.pow(1 - SURPLUS_FADE, d - this.lastDay);
      for (const [k, v] of this.surplus) {
        const nv = v * keep;
        if (nv < 0.05) this.surplus.delete(k);
        else this.surplus.set(k, nv);
      }
      this.lastDay = d;
    }
    if (caravanHere(d) && d !== this.visit) {
      this.visit = d;
      this.bought.clear();
    }
  }

  get day(): number {
    return this.lastDay;
  }

  present(): boolean {
    return caravanHere(this.lastDay);
  }

  surplusOf(item: string): number {
    return this.surplus.get(item) ?? 0;
  }

  /** What the caravan pays for ONE of `item` right now (0: not interested), falling as surplus piles up. */
  buyPrice(item: string, extra = 0): number {
    const base = BASE_VALUE[item];
    if (!base) return 0;
    const saturation = 1 / (1 + (this.surplusOf(item) + extra) / 12);
    return Math.round(base * BUY_SHARE * saturation * 1000) / 1000;
  }

  /** What one unit of its own stock costs. Rarer (fewer left) is dearer. */
  sellPrice(item: string): number {
    const base = RARE_PRICE[item];
    if (!base) return 0;
    const left = this.stock().find((s) => s.item === item)?.left ?? 0;
    return Math.max(1, Math.round(base * (1 + Math.max(0, 3 - left) * 0.1)));
  }

  /** Stock still on the carts today. */
  stock(): StockLine[] {
    if (!this.present()) return [];
    return caravanStock(this.lastDay)
      .map((l) => ({ item: l.item, left: l.left - (this.bought.get(l.item) ?? 0) }))
      .filter((l) => l.left > 0);
  }

  /** Sells up to `count` of `item` from `inv` for currency. Each unit sold lowers the next one's price. */
  sell(inv: Inventory, item: string, count: number): TradeResult {
    if (!this.present()) return { ok: false, reason: 'No caravan in town' };
    if (!BASE_VALUE[item]) return { ok: false, reason: 'They have no use for that' };
    const n = Math.min(Math.floor(count), inv.count(item));
    if (!(n >= 1)) return { ok: false, reason: 'You have none to sell' };
    let total = 0;
    for (let i = 0; i < n; i++) total += this.buyPrice(item, i);
    // Coins are whole ingots: the odd fraction is the caravan's. A lot too small to pay one is refused, not eaten.
    total = Math.floor(total + 1e-9);
    if (total < 1) return { ok: false, reason: 'Worth less than a copper ingot. Sell more at once' };
    inv.remove(item, n);
    const unpaid = inv.add(CURRENCY, total);
    if (unpaid > 0) {
      inv.remove(CURRENCY, total - unpaid);
      inv.add(item, n);
      return { ok: false, reason: 'No room for the payment' };
    }
    this.surplus.set(item, this.surplusOf(item) + n);
    return { ok: true, count: n, price: total };
  }

  /** Buys `count` of a stocked rare good with currency from `inv`. */
  buy(inv: Inventory, item: string, count: number): TradeResult {
    const line = this.stock().find((s) => s.item === item);
    if (!line) return { ok: false, reason: 'Not for sale' };
    const n = Math.min(Math.floor(count), line.left);
    if (!(n >= 1)) return { ok: false, reason: 'Nothing to buy' };
    const price = this.sellPrice(item) * n;
    if (inv.count(CURRENCY) < price) return { ok: false, reason: `Costs ${price} ${itemOrNull(CURRENCY)?.name ?? CURRENCY}` };
    if (inv.space(item) < n) return { ok: false, reason: 'No room in your pack' };
    inv.remove(CURRENCY, price);
    inv.add(item, n);
    this.bought.set(item, (this.bought.get(item) ?? 0) + n);
    return { ok: true, count: n, price };
  }

  toJSON(): CaravanSave {
    return { surplus: Object.fromEntries(this.surplus), day: this.lastDay, bought: Object.fromEntries(this.bought), visit: this.visit };
  }

  /** Replaces this caravan's state from a save (missing or damaged data leaves it fresh). */
  load(raw: Partial<CaravanSave> | null | undefined): void {
    const c = Caravan.fromJSON(raw);
    this.surplus = c.surplus;
    this.bought = c.bought;
    this.lastDay = c.lastDay;
    this.visit = c.visit;
  }

  static fromJSON(raw: Partial<CaravanSave> | null | undefined): Caravan {
    const c = new Caravan();
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    for (const [k, v] of Object.entries(raw?.surplus ?? {})) if (BASE_VALUE[k] && num(v)) c.surplus.set(k, v);
    for (const [k, v] of Object.entries(raw?.bought ?? {})) if (itemOrNull(k) && num(v)) c.bought.set(k, v);
    if (num(raw?.day)) c.lastDay = Math.floor(raw.day);
    if (typeof raw?.visit === 'number') c.visit = Math.floor(raw.visit);
    return c;
  }
}
