/**
 * Pinned favours (docs/api/npcs.md): small item requests the regulars pin to the quest board, apart from the progression bounties.
 * Three are up at a time and a new one is pinned each day; each stays up for FAVOUR_DAYS. Use the board with the item in hand
 * (the whole count asked) to hand it over: it pays coin, trust with whoever asked, or both. The pool is fixed data; which favours
 * are pinned on a given day comes from the manager's rng.
 */
export interface Favour {
  id: string;
  /** NPC id of whoever asks. */
  who: string;
  item: string;
  count: number;
  coin: number;
  /** Trust paid to `who`. */
  trust: number;
  /** What the note on the board says. */
  ask: string;
  /** What they say when it is delivered. */
  thanks: string;
}

export const FAVOUR_SLOTS = 3;
export const FAVOUR_DAYS = 3;

export const FAVOURS: readonly Favour[] = [
  { id: 'rosa-bread', who: 'rosa', item: 'bread', count: 2, coin: 6, trust: 3, ask: 'Rosa wants 2 bread for the lunch rush.', thanks: 'Still warm? Lovely. Here is your coin.' },
  { id: 'rosa-stew', who: 'rosa', item: 'hearth_stew', count: 1, coin: 0, trust: 6, ask: 'Rosa: one hearth stew, to check yours against mine.', thanks: 'Mine is better. Yours is very nearly as good.' },
  { id: 'rosa-sugar', who: 'rosa', item: 'sugar', count: 3, coin: 8, trust: 2, ask: 'Rosa needs 3 sugar before the sweet buns.', thanks: 'Sunshine that learned to sit still. Thank you.' },
  { id: 'gruk-coal', who: 'gruk', item: 'coal', count: 6, coin: 5, trust: 4, ask: 'Gruk: 6 coal. The anvil is thirsty.', thanks: 'Good coal. Gruk remembers.' },
  { id: 'gruk-iron', who: 'gruk', item: 'iron_ingot', count: 2, coin: 12, trust: 3, ask: 'Gruk wants 2 iron ingots. Will pay.', thanks: 'Heavy and honest. Gruk likes you.' },
  { id: 'orrin-copper', who: 'orrin', item: 'copper_ingot', count: 3, coin: 10, trust: 3, ask: 'Orrin seeks 3 copper ingots for a small experiment.', thanks: 'Splendid. Do not stand too close to the experiment.' },
  { id: 'orrin-glass', who: 'orrin', item: 'glass', count: 4, coin: 9, trust: 2, ask: 'Orrin: 4 glass, any clarity, for lenses.', thanks: 'Cloudy, but I can polish it. Thank you.' },
  { id: 'mara-vial', who: 'mara', item: 'glass_vial', count: 2, coin: 8, trust: 4, ask: 'Mara asks for 2 glass vials. She blew too few.', thanks: 'Thank you. They are never quite round enough, and that is perfect.' },
  { id: 'veyra-charcoal', who: 'veyra', item: 'charcoal', count: 5, coin: 7, trust: 3, ask: 'Veyra needs 5 charcoal to clear a tincture.', thanks: 'Dry and finely grained. You can be trusted with fuel, apparently.' },
  { id: 'veyra-vial', who: 'veyra', item: 'glass_vial', count: 3, coin: 9, trust: 3, ask: 'Veyra: 3 empty glass vials, spotless.', thanks: 'Spotless. Almost. I will pretend that was the light.' },
  { id: 'bram-log', who: 'bram', item: 'oak_log', count: 4, coin: 6, trust: 4, ask: 'Old Bram: 4 oak logs for the lean-to fire.', thanks: 'The fire will last till spring now. Mostly.' },
  { id: 'bram-stick', who: 'bram', item: 'stick', count: 8, coin: 4, trust: 3, ask: 'Old Bram would like 8 sticks. For kindling, he says.', thanks: 'Kindling. Yes. That is what they are for.' },
];

export const favourById = (id: string): Favour | undefined => FAVOURS.find((f) => f.id === id);

export interface Pinned {
  id: string;
  /** The day it was pinned. */
  day: number;
}

/** What is on the board and which favours were done lately (so they are not asked again straight away). */
export class FavourBoard {
  pinned: Pinned[] = [];
  /** Day each favour was last handed in. */
  done: Record<string, number> = {};
  /** Favours handed in over the whole game. */
  total = 0;
  private lastDay = 0;

  /** Drops expired notes and pins new ones for `day` (only from people `canAsk` allows: the ones who live here). Returns true when the board changed. */
  refresh(day: number, rng: () => number, canAsk: (who: string) => boolean = () => true): boolean {
    if (day === this.lastDay) return false;
    this.lastDay = day;
    const before = this.pinned.map((p) => p.id).join();
    this.pinned = this.pinned.filter((p) => day - p.day < FAVOUR_DAYS);
    const have = new Set(this.pinned.map((p) => p.id));
    const free = FAVOURS.filter((f) => !have.has(f.id) && canAsk(f.who) && day - (this.done[f.id] ?? -99) >= FAVOUR_DAYS);
    while (this.pinned.length < FAVOUR_SLOTS && free.length > 0) {
      const f = free.splice(Math.min(free.length - 1, Math.floor(rng() * free.length)), 1)[0];
      this.pinned.push({ id: f.id, day });
    }
    return this.pinned.map((p) => p.id).join() !== before;
  }

  list(): Favour[] {
    return this.pinned.map((p) => favourById(p.id)).filter((f): f is Favour => !!f);
  }

  /** The pinned favour that wants `item` and for which `count` is enough, or null. */
  matching(item: string, count: number): Favour | null {
    return this.list().find((f) => f.item === item && count >= f.count) ?? null;
  }

  /** Any pinned favour for the item, whatever the count (to say "you need more"). */
  wanting(item: string): Favour | null {
    return this.list().find((f) => f.item === item) ?? null;
  }

  complete(id: string, day: number): void {
    this.pinned = this.pinned.filter((p) => p.id !== id);
    this.done[id] = day;
    this.total++;
  }

  toJSON(): { pinned: [string, number][]; done: Record<string, number>; total: number; last: number } {
    return { pinned: this.pinned.map((p) => [p.id, p.day]), done: { ...this.done }, total: this.total, last: this.lastDay };
  }

  load(raw: unknown): void {
    this.pinned = [];
    this.done = {};
    this.total = 0;
    this.lastDay = 0;
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<ReturnType<FavourBoard['toJSON']>>;
    for (const e of Array.isArray(r.pinned) ? r.pinned : []) {
      if (Array.isArray(e) && typeof e[0] === 'string' && favourById(e[0]) && Number.isFinite(e[1])) this.pinned.push({ id: e[0], day: e[1] });
    }
    this.pinned = this.pinned.slice(0, FAVOUR_SLOTS);
    if (r.done && typeof r.done === 'object') for (const [k, v] of Object.entries(r.done)) if (typeof v === 'number' && Number.isFinite(v)) this.done[k] = v;
    this.total = typeof r.total === 'number' && Number.isFinite(r.total) ? Math.max(0, Math.floor(r.total)) : 0;
    this.lastDay = typeof r.last === 'number' && Number.isFinite(r.last) ? r.last : 0;
  }
}
