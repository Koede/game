/**
 * Trade caravans (docs/api/caravan.md). A merchant train arrives on certain days with a few rare goods and buys
 * surplus. Prices are paid and asked in CURRENCY items and shift with what you sell: every unit sold adds surplus,
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
/** The caravan pays this share of an item's base value, and asks this multiple for its own goods. */
export const BUY_SHARE = 0.6;
export const SELL_MARKUP = 1.6;

/** Base value in currency of everything the caravan will buy. Append only. */
export const BASE_VALUE: Readonly<Record<string, number>> = {
  wheat: 1, potato: 1, carrot: 1, flour: 2, bread: 3, hide: 3, leather: 6, cloth: 5, fiber: 1, cord: 2,
  pine_resin: 3, sugar: 4, raw_chop: 3, cooked_chop: 5, hearth_stew: 9, coal: 2, charcoal: 2, flint: 1,
  tin_ingot: 6, bronze_ingot: 9, iron_ingot: 12, steel_ingot: 24, glass_beaker: 8,
  // rare goods the caravan brings
  tea_cutting: 14, coffee_cutting: 14, sulfur: 10, silica: 9, lithium_salt: 30, tungsten_powder: 40, yellowcake: 55,
  magnet_ring: 45, fused_quartz: 35,
};

export const RARE_GOODS: readonly string[] = [
  'tea_cutting', 'coffee_cutting', 'sulfur', 'silica', 'lithium_salt', 'tungsten_powder', 'magnet_ring', 'fused_quartz', 'yellowcake',
];

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
    return Math.max(1, Math.round(base * BUY_SHARE * saturation));
  }

  /** What one unit of its own stock costs. Rarer (fewer left) is dearer. */
  sellPrice(item: string): number {
    const base = BASE_VALUE[item];
    if (!base) return 0;
    const left = this.stock().find((s) => s.item === item)?.left ?? 0;
    return Math.max(1, Math.round(base * SELL_MARKUP * (1 + Math.max(0, 3 - left) * 0.1)));
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
