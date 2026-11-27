/**
 * Daily and seasonal goals: a small side track, separate from the age goals (objectives.ts), that never touches them.
 *
 * Three daily goals rotate every in-game day and a pair of seasonal goals runs for one season (seasons.ts), both read
 * from IN-GAME days (the clock), never the wall clock. Progress is the growth of numbers the game already keeps
 * (made, placed, broken, drinks, ground explored) since the day or season began, so nothing here listens to the bus.
 *
 * Rewards are generic slots: `item` (handed over like an objective reward, held back until the pack has room) and
 * `cosmetic` (a keepsake: collected, listed in the Hearth Log, one worn as the Log's title) and `blueprint`
 * (emits `blueprint:grant` with the id on the bus; the blueprints feature owns what it unlocks).
 *
 * DOM-free. Saved as an optional `dailyGoals` field of the world save: older saves simply start a fresh track.
 */
import type { GameBus } from '../core/context';
import { itemOrNull } from '../core/registry';
import type { ItemAmount } from '../core/types';
import { DAYS_PER_SEASON, SEASONS, seasonOf, type Season } from '../sim/seasons';

export type GoalMetric = 'made' | 'placed' | 'broken' | 'drunk' | 'explored' | 'brewed' | 'cast' | 'jobs' | 'meals';
/** The metrics every save has; the later ones are filled in from the current facts when missing. */
const METRICS: readonly GoalMetric[] = ['made', 'placed', 'broken', 'drunk', 'explored'];
export type GoalFacts = Record<GoalMetric, number>;

export type Reward = { kind: 'item'; item: string; count: number } | { kind: 'cosmetic'; id: string } | { kind: 'blueprint'; id: string };

export interface GoalSpec {
  id: string;
  text: string;
  metric: GoalMetric;
  target: number;
  reward: Reward;
}

export interface Keepsake {
  id: string;
  name: string;
  text: string;
}

const item = (it: string, count: number): Reward => ({ kind: 'item', item: it, count });

/** Small tasks for one day; the reward is a pinch of dye or a few stained planks. */
export const DAILY_POOL: readonly GoalSpec[] = [
  { id: 'd_make_5', text: 'Make 5 things', metric: 'made', target: 5, reward: item('white_dye', 2) },
  { id: 'd_make_12', text: 'Make 12 things', metric: 'made', target: 12, reward: item('yellow_dye', 3) },
  { id: 'd_place_20', text: 'Place 20 blocks', metric: 'placed', target: 20, reward: item('green_dye', 2) },
  { id: 'd_place_60', text: 'Place 60 blocks', metric: 'placed', target: 60, reward: item('blue_dye', 3) },
  { id: 'd_break_30', text: 'Break 30 blocks', metric: 'broken', target: 30, reward: item('black_dye', 2) },
  { id: 'd_break_90', text: 'Break 90 blocks', metric: 'broken', target: 90, reward: item('red_dye', 3) },
  { id: 'd_drink_1', text: 'Drink something warm or cool', metric: 'drunk', target: 1, reward: item('white_dye', 2) },
  { id: 'd_drink_3', text: 'Drink 3 cups', metric: 'drunk', target: 3, reward: item('yellow_dye', 3) },
  { id: 'd_walk_800', text: 'Learn 800 blocks of new ground', metric: 'explored', target: 800, reward: item('green_dye', 2) },
  { id: 'd_brew_2', text: 'Brew 2 cups at the hearth', metric: 'brewed', target: 2, reward: item('green_dye', 3) },
  { id: 'd_cast_2', text: 'Pour 2 castings', metric: 'cast', target: 2, reward: item('black_dye', 3) },
  { id: 'd_jobs_5', text: 'Let your machines finish 5 jobs', metric: 'jobs', target: 5, reward: item('blue_dye', 3) },
  { id: 'd_meals_3', text: 'Eat 3 meals', metric: 'meals', target: 3, reward: item('yellow_dye', 2) },
  { id: 'd_walk_2500', text: 'Learn 2,500 blocks of new ground', metric: 'explored', target: 2500, reward: item('blue_dye', 3) },
];

export const DAILY_COUNT = 3;

/** The rare ones: one drops (by the day's luck) when all three of a day's goals are done. */
export const DAILY_KEEPSAKES: readonly Keepsake[] = [
  { id: 'k_ember_bead', name: 'Ember Bead', text: 'A bead that keeps a little of yesterday\'s fire.' },
  { id: 'k_moth_charm', name: 'Moth Charm', text: 'Paper wings, cut at the hearth.' },
  { id: 'k_lamp_tag', name: 'Lamp Tag', text: 'A tin tag from a lamp that burned all night.' },
  { id: 'k_clay_fox', name: 'Clay Fox', text: 'A small fox, fired a little crooked.' },
  { id: 'k_pebble_ring', name: 'Pebble Ring', text: 'A ring of river pebbles.' },
  { id: 'k_sooty_mitt', name: 'Sooty Mitten', text: 'Proof of a hard day at the forge.' },
];

const seasonal = (id: string, text: string, metric: GoalMetric, target: number, key: string): GoalSpec => ({ id, text, metric, target, reward: { kind: 'cosmetic', id: key } });

/** Two per season, harder than the dailies, each earning a keepsake of that season. */
export const SEASONAL_GOALS: Readonly<Record<Season, readonly GoalSpec[]>> = {
  spring: [
    seasonal('s_spring_make', 'Make 30 things this spring', 'made', 30, 'k_blossom_pin'),
    seasonal('s_spring_walk', 'Learn 3,000 blocks of ground this spring', 'explored', 3000, 'k_rain_boots'),
  ],
  summer: [
    seasonal('s_summer_place', 'Place 200 blocks this summer', 'placed', 200, 'k_sun_hat'),
    seasonal('s_summer_drink', 'Drink 4 cups this summer', 'drunk', 4, 'k_cool_cup'),
  ],
  autumn: [
    seasonal('s_autumn_break', 'Break 300 blocks this autumn', 'broken', 300, 'k_leaf_crown'),
    seasonal('s_autumn_make', 'Make 40 things this autumn', 'made', 40, 'k_harvest_knot'),
  ],
  winter: [
    seasonal('s_winter_drink', 'Drink 5 cups this winter', 'drunk', 5, 'k_frost_scarf'),
    { id: 's_winter_place', text: 'Place 150 blocks this winter', metric: 'placed', target: 150, reward: { kind: 'blueprint', id: 'stone_hut' } },
  ],
};

export const SEASONAL_KEEPSAKES: readonly Keepsake[] = [
  { id: 'k_blossom_pin', name: 'Blossom Pin', text: 'A first-flower pin for the collar.' },
  { id: 'k_rain_boots', name: 'Rain Boots Charm', text: 'Tiny boots that splash on their own.' },
  { id: 'k_sun_hat', name: 'Sun Hat', text: 'Wide-brimmed, bleached by a long summer.' },
  { id: 'k_cool_cup', name: 'Cool Cup', text: 'Stays cold in the hottest week.' },
  { id: 'k_leaf_crown', name: 'Leaf Crown', text: 'Woven from the first red leaves.' },
  { id: 'k_harvest_knot', name: 'Harvest Knot', text: 'Straw tied up at the end of the year.' },
  { id: 'k_frost_scarf', name: 'Frost Scarf', text: 'Warm, and white as the first snow.' },
];

export const KEEPSAKES: readonly Keepsake[] = [...DAILY_KEEPSAKES, ...SEASONAL_KEEPSAKES];
export const keepsakeOf = (id: string): Keepsake | undefined => KEEPSAKES.find((k) => k.id === id);

/** Pack space missing for the bonus: a handful of stained planks to build with. */
const BONUS_FALLBACK: Reward = item('white_stained_plank', 8);

export interface GoalView {
  id: string;
  text: string;
  current: number;
  target: number;
  fraction: number;
  done: boolean;
  reward: Reward;
}

export interface DailyGoalsSnapshot {
  day: number;
  base: GoalFacts;
  done: string[];
  bonusGiven: boolean;
  /** `year:season`, e.g. "0:spring". */
  season: string;
  seasonBase: GoalFacts;
  seasonDone: string[];
  /** Season keys whose goals have already paid out, so a reload never pays twice. */
  paid: string[];
  keepsakes: string[];
  worn: string | null;
  pending: ItemAmount[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFacts = (v: unknown): v is GoalFacts => isRecord(v) && METRICS.every((m) => typeof v[m] === 'number' && Number.isFinite(v[m]));
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

export function isDailyGoalsSnapshot(v: unknown): v is DailyGoalsSnapshot {
  return (
    isRecord(v) &&
    typeof v.day === 'number' &&
    isFacts(v.base) &&
    isStrings(v.done) &&
    typeof v.bonusGiven === 'boolean' &&
    typeof v.season === 'string' &&
    isFacts(v.seasonBase) &&
    isStrings(v.seasonDone) &&
    isStrings(v.paid) &&
    isStrings(v.keepsakes) &&
    (v.worn === null || typeof v.worn === 'string') &&
    Array.isArray(v.pending) &&
    v.pending.every((p) => isRecord(p) && typeof p.item === 'string' && typeof p.count === 'number')
  );
}

/** A small deterministic hash of a few numbers (the world seed, the day, a salt) to 0..1. */
export function luck(...n: number[]): number {
  let h = 0x9e3779b9;
  for (const x of n) {
    h = Math.imul(h ^ (Math.floor(x) | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 0x100000000;
}

/** The day's goals: DAILY_COUNT of the pool, never two of one kind, the same for a given seed and day. */
export function dailyFor(seed: number, day: number): GoalSpec[] {
  const order = DAILY_POOL.map((g, i) => ({ g, k: luck(seed, day, i + 1) })).sort((a, b) => a.k - b.k);
  const out: GoalSpec[] = [];
  for (const { g } of order) {
    if (out.length >= DAILY_COUNT) break;
    if (!out.some((o) => o.metric === g.metric)) out.push(g);
  }
  return out;
}

/** `year:season` of 1-based clock day `day`. */
export function seasonKeyOf(day: number): string {
  const d = Math.max(1, Math.floor(day));
  return `${Math.floor((d - 1) / (DAYS_PER_SEASON * SEASONS.length))}:${seasonOf(d)}`;
}

const seasonFromKey = (key: string): Season => (key.split(':')[1] as Season) ?? 'spring';

export interface DailyGoalsDeps {
  bus: GameBus;
  seed: number;
  day: () => number;
  facts: () => GoalFacts;
  /** Gives items to the player; returns how many did not fit. */
  give: (item: string, count: number) => number;
}

export class DailyGoals {
  private day = 0;
  private base: GoalFacts | null = null;
  private done = new Set<string>();
  private bonusGiven = false;
  private season = '';
  private seasonBase: GoalFacts | null = null;
  private seasonDone = new Set<string>();
  private paid = new Set<string>();
  private owned: string[] = [];
  private wornId: string | null = null;
  private pending: ItemAmount[] = [];
  private sinceCheck = 1;

  constructor(private readonly d: DailyGoalsDeps) {}

  get keepsakes(): readonly string[] {
    return this.owned;
  }

  get worn(): string | null {
    return this.wornId;
  }

  wear(id: string | null): void {
    if (id === null || this.owned.includes(id)) this.wornId = id;
  }

  /** Re-checks about once a second; returns nothing, announces through the bus. */
  tick(dt: number): void {
    this.sinceCheck += dt;
    if (this.sinceCheck < 1) return;
    this.sinceCheck = 0;
    this.sync();
  }

  /** Rotates the day and season when the clock has turned, then completes whatever is met. */
  sync(): void {
    const day = this.d.day();
    const f = this.d.facts();
    this.deliverPending();
    const sKey = seasonKeyOf(day);
    if (this.base === null || day !== this.day) {
      const fresh = this.base !== null;
      this.day = day;
      this.base = { ...f };
      this.done.clear();
      this.bonusGiven = false;
      if (fresh) this.d.bus.emit('toast', { text: 'New daily goals in the Hearth Log', kind: 'good' });
    }
    if (this.seasonBase === null || sKey !== this.season) {
      this.season = sKey;
      this.seasonBase = { ...f };
      this.seasonDone.clear();
    }
    for (const g of dailyFor(this.d.seed, this.day)) {
      if (this.done.has(g.id) || this.gain(g, this.base, f) < g.target) continue;
      this.done.add(g.id);
      this.grant(g.reward, `Daily goal: ${g.text}`);
    }
    if (!this.bonusGiven && dailyFor(this.d.seed, this.day).every((g) => this.done.has(g.id))) {
      this.bonusGiven = true;
      this.grant(this.bonusReward(), 'All three daily goals done');
    }
    const season = seasonFromKey(this.season);
    for (const g of SEASONAL_GOALS[season]) {
      if (this.seasonDone.has(g.id) || this.paid.has(`${this.season}:${g.id}`) || this.gain(g, this.seasonBase, f) < g.target) continue;
      this.seasonDone.add(g.id);
      this.paid.add(`${this.season}:${g.id}`);
      this.grant(g.reward, `Seasonal goal: ${g.text}`);
    }
  }

  private gain(g: GoalSpec, base: GoalFacts, f: GoalFacts): number {
    return Math.max(0, f[g.metric] - (base[g.metric] ?? f[g.metric]));
  }

  /** A day's bonus: a keepsake not yet owned (picked by the day's luck), else a bundle of planks. */
  private bonusReward(): Reward {
    const left = DAILY_KEEPSAKES.filter((k) => !this.owned.includes(k.id));
    if (left.length === 0) return BONUS_FALLBACK;
    return { kind: 'cosmetic', id: left[Math.floor(luck(this.d.seed, this.day, 99) * left.length) % left.length].id };
  }

  private grant(r: Reward, reason: string): void {
    const bus = this.d.bus;
    if (r.kind === 'blueprint') {
      bus.emit('blueprint:grant', { id: r.id });
      bus.emit('toast', { text: `${reason} - blueprint: ${r.id.replace(/_/g, ' ')}`, kind: 'good' });
      return;
    }
    if (r.kind === 'cosmetic') {
      const k = keepsakeOf(r.id);
      if (k && !this.owned.includes(k.id)) {
        this.owned.push(k.id);
        if (this.wornId === null) this.wornId = k.id;
        bus.emit('toast', { text: `${reason} - keepsake: ${k.name}`, kind: 'good' });
        bus.emit('sfx', { name: 'objective' });
      }
      return;
    }
    const def = itemOrNull(r.item);
    if (!def) return;
    const left = this.d.give(r.item, r.count);
    if (left > 0) this.pending.push({ item: r.item, count: left });
    bus.emit('toast', { text: `${reason} - ${r.count} ${def.name}`, kind: 'good' });
  }

  private deliverPending(): void {
    if (this.pending.length === 0) return;
    for (const p of this.pending) p.count = this.d.give(p.item, p.count);
    this.pending = this.pending.filter((p) => p.count > 0);
  }

  private view(g: GoalSpec, base: GoalFacts | null, done: ReadonlySet<string>): GoalView {
    const f = this.d.facts();
    const current = done.has(g.id) ? g.target : Math.min(g.target, base ? this.gain(g, base, f) : 0);
    return { id: g.id, text: g.text, current, target: g.target, fraction: g.target > 0 ? current / g.target : 1, done: done.has(g.id), reward: g.reward };
  }

  /** Today's goals with their progress (the pick is made even before the first sync). */
  daily(): GoalView[] {
    return dailyFor(this.d.seed, this.d.day()).map((g) => this.view(g, this.base, this.done));
  }

  /** This season's goals with their progress. */
  seasonal(): { season: Season; daysLeft: number; goals: GoalView[] } {
    const day = this.d.day();
    const season = seasonOf(day);
    const inSeason = (Math.max(1, Math.floor(day)) - 1) % DAYS_PER_SEASON;
    const paid = new Set(SEASONAL_GOALS[season].filter((g) => this.paid.has(`${seasonKeyOf(day)}:${g.id}`)).map((g) => g.id));
    return { season, daysLeft: DAYS_PER_SEASON - inSeason, goals: SEASONAL_GOALS[season].map((g) => this.view(g, this.seasonBase, paid)) };
  }

  /** Daily goals finished today / whether today's keepsake bonus has been paid. */
  get bonusPaid(): boolean {
    return this.bonusGiven;
  }

  toJSON(): DailyGoalsSnapshot {
    const zero: GoalFacts = { made: 0, placed: 0, broken: 0, drunk: 0, explored: 0, brewed: 0, cast: 0, jobs: 0, meals: 0 };
    return {
      day: this.day,
      base: { ...(this.base ?? zero) },
      done: [...this.done],
      bonusGiven: this.bonusGiven,
      season: this.season,
      seasonBase: { ...(this.seasonBase ?? zero) },
      seasonDone: [...this.seasonDone],
      paid: [...this.paid],
      keepsakes: [...this.owned],
      worn: this.wornId,
      pending: this.pending.map((p) => ({ ...p })),
    };
  }

  load(s: DailyGoalsSnapshot): void {
    this.day = s.day;
    this.base = { ...s.base } as GoalFacts;
    this.done = new Set(s.done);
    this.bonusGiven = s.bonusGiven;
    this.season = s.season;
    this.seasonBase = { ...s.seasonBase } as GoalFacts;
    this.seasonDone = new Set(s.seasonDone);
    this.paid = new Set(s.paid);
    this.owned = s.keepsakes.filter((id) => keepsakeOf(id) !== undefined);
    this.wornId = s.worn !== null && this.owned.includes(s.worn) ? s.worn : null;
    this.pending = s.pending.filter((p) => itemOrNull(p.item) !== null).map((p) => ({ ...p }));
  }
}
