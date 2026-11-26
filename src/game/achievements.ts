/**
 * Achievements: small, quiet milestones read from numbers the game already keeps (stats, goals, age, ground explored),
 * plus "firsts" earned the moment a feature's event fires (a fish landed, a waypoint trip, a treasure dug, an enchant, a pet).
 * DOM-free. `tick(dt)` re-checks once a second; a new one raises a toast and is remembered in the save with the day it was earned.
 */
import type { GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';

/** Everything an achievement may ask about. */
export interface ProgressFacts {
  age: number;
  goalsDone: number;
  made: number;
  placed: number;
  broken: number;
  deaths: number;
  day: number;
  blocksSeen: number;
  playTimeS: number;
  /** Distinct drinks drunk. */
  drinks: number;
}

export interface AchievementSpec {
  id: string;
  name: string;
  text: string;
  /** Read from the progress facts once a second. */
  test?: (f: ProgressFacts) => boolean;
  /** Or earned the first time this bus event fires. */
  on?: keyof GameEvents;
}

export const ACHIEVEMENTS: readonly AchievementSpec[] = [
  { id: 'first_steps', name: 'First Steps', text: 'Break your first block.', test: (f) => f.broken >= 1 },
  { id: 'builder', name: 'Builder', text: 'Place 100 blocks.', test: (f) => f.placed >= 100 },
  { id: 'quarry', name: 'Quarryman', text: 'Break 500 blocks.', test: (f) => f.broken >= 500 },
  { id: 'maker', name: 'Maker', text: 'Make 25 things by hand or at a bench.', test: (f) => f.made >= 25 },
  { id: 'wanderer', name: 'Wanderer', text: 'Learn 50,000 blocks of ground by walking it.', test: (f) => f.blocksSeen >= 50_000 },
  { id: 'far_wanderer', name: 'Far Wanderer', text: 'Learn 500,000 blocks of ground.', test: (f) => f.blocksSeen >= 500_000 },
  { id: 'week', name: 'A Week Alive', text: 'Reach day 8.', test: (f) => f.day >= 8 },
  { id: 'goals_10', name: 'Following the Thread', text: 'Finish 10 goals.', test: (f) => f.goalsDone >= 10 },
  { id: 'goals_30', name: 'Well Along', text: 'Finish 30 goals.', test: (f) => f.goalsDone >= 30 },
  { id: 'age_1', name: 'Out of the Embers', text: 'Reach the second age.', test: (f) => f.age >= 1 },
  { id: 'age_2', name: 'Iron Will', text: 'Reach the third age.', test: (f) => f.age >= 2 },
  { id: 'age_3', name: 'Spark of Current', text: 'Reach the fourth age.', test: (f) => f.age >= 3 },
  { id: 'age_5', name: 'Hearthwatt', text: 'Reach the last age.', test: (f) => f.age >= 5 },
  { id: 'bruised', name: 'Learned the Hard Way', text: 'Die once.', test: (f) => f.deaths >= 1 },
  { id: 'taster', name: 'Taster', text: 'Drink three different drinks.', test: (f) => f.drinks >= 3 },
  { id: 'long_haul', name: 'Long Haul', text: 'Play for two hours.', test: (f) => f.playTimeS >= 7200 },
  // ---- firsts, earned by the feature's own event ----
  { id: 'first_fish', name: 'Gone Fishing', text: 'Land your first fish.', on: 'fish:caught' },
  { id: 'first_waypoint', name: 'Stepping Stones', text: 'Travel through a waypoint stone.', on: 'waypoint:travelled' },
  { id: 'first_treasure', name: 'X Marks the Spot', text: 'Dig up a buried treasure crate.', on: 'treasure:dug' },
  { id: 'first_enchant', name: 'Written in Light', text: 'Enchant an item at the altar.', on: 'enchant:applied' },
  { id: 'first_pet', name: 'Faithful Friend', text: 'Win a stray animal over.', on: 'pet:tamed' },
  { id: 'first_town_building', name: 'Raising the Roof', text: 'See Gruk finish a town building.', on: 'town:built' },
  { id: 'first_bounty', name: 'Hauling for Gruk', text: 'Fill a build bounty.', on: 'town:bounty' },
];

export interface AchievementsSnapshot {
  /** id -> in-game day earned. */
  unlocked: Record<string, number>;
}

export function isAchievementsSnapshot(v: unknown): v is AchievementsSnapshot {
  if (typeof v !== 'object' || v === null) return false;
  const u = (v as { unlocked?: unknown }).unlocked;
  return typeof u === 'object' && u !== null && !Array.isArray(u) && Object.values(u).every((d) => typeof d === 'number');
}

/** How far a world has got, 0..5, for the title scene: just the age. */
export const titleStage = (age: number | undefined): number => Math.min(5, Math.max(0, Math.floor(age ?? 0) || 0));

export class Achievements {
  private readonly got = new Map<string, number>();
  private sinceCheck = 0;

  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly bus: GameBus,
    private readonly facts: () => ProgressFacts,
  ) {
    for (const a of ACHIEVEMENTS) if (a.on) this.offs.push(bus.on(a.on, () => this.unlock(a)));
  }

  has(id: string): boolean {
    return this.got.has(id);
  }

  get count(): number {
    return this.got.size;
  }

  /** Re-checks at most once a second; returns the specs unlocked by this call. */
  tick(dt: number): AchievementSpec[] {
    this.sinceCheck += dt;
    if (this.sinceCheck < 1) return [];
    this.sinceCheck = 0;
    return this.check();
  }

  check(): AchievementSpec[] {
    const f = this.facts();
    const fresh: AchievementSpec[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.got.has(a.id) || !a.test?.(f)) continue;
      this.award(a, f.day);
      fresh.push(a);
    }
    return fresh;
  }

  /** Earns an event achievement now (no-op when already earned). Returns true when it was new. */
  private unlock(a: AchievementSpec): boolean {
    if (this.got.has(a.id)) return false;
    this.award(a, this.facts().day);
    return true;
  }

  private award(a: AchievementSpec, day: number): void {
    this.got.set(a.id, day);
    this.bus.emit('toast', { text: `Achievement: ${a.name}`, kind: 'good' });
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }

  toJSON(): AchievementsSnapshot {
    return { unlocked: Object.fromEntries(this.got) };
  }

  load(s: AchievementsSnapshot): void {
    this.got.clear();
    for (const [id, day] of Object.entries(s.unlocked)) if (ACHIEVEMENTS.some((a) => a.id === id)) this.got.set(id, day);
  }
}
