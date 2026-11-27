/**
 * Achievements: small, quiet milestones read from numbers the game already keeps (stats, goals, age, ground explored).
 * DOM-free. `tick(dt)` re-checks once a second; a new one raises a toast and is remembered in the save with the day it was earned.
 */
import type { GameBus } from '../core/context';

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
  /** Whether a goal (objective id) is done. */
  goalDone: (id: string) => boolean;
  /** Whether a progress flag has been raised (till, rest, ignite...). */
  flag: (flag: string) => boolean;
}

export interface AchievementSpec {
  id: string;
  name: string;
  text: string;
  /** Checked once a second against the numbers the game keeps; may be omitted for event-only ones. */
  test?: (f: ProgressFacts) => boolean;
  /** Listens for a one-off moment (first photo, first legendary hit...) and calls `award` when it happens. */
  watch?: (bus: GameBus, award: () => void) => () => void;
}

const goal = (id: string) => (f: ProgressFacts): boolean => f.goalDone(id);

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
  { id: 'age_4', name: 'Split the Atom', text: 'Reach the fifth age.', test: (f) => f.age >= 4 },
  { id: 'first_fire', name: 'First Fire', text: 'Light your furnace.', test: goal('light_furnace') },
  { id: 'farmer', name: 'Green Thumb', text: 'Till the soil and plant seeds.', test: (f) => f.flag('tilled') && f.goalDone('plant_seeds') },
  { id: 'baker', name: 'Daily Bread', text: 'Bake bread.', test: goal('bake_bread') },
  { id: 'bronzesmith', name: 'Bronzesmith', text: 'Forge bronze.', test: goal('make_bronze') },
  { id: 'salvager', name: 'Scrapper', text: 'Salvage an automaton.', test: goal('salvage_automaton') },
  { id: 'steelmaker', name: 'Steelmaker', text: 'Forge steel.', test: goal('make_steel') },
  { id: 'lights_on', name: 'Let There Be Light', text: 'Make electricity and light a lamp.', test: goal('place_lamp') },
  { id: 'power_2kw', name: 'Powered Up', text: 'Generate 2 kW.', test: goal('generate_2kw') },
  { id: 'circuitry', name: 'Circuitry', text: 'Make circuits.', test: goal('make_circuits') },
  { id: 'lumberjack', name: 'Timber!', text: 'Fell a whole tree with a chainsaw.', test: (f) => f.flag('felled_tree') },
  { id: 'tractor', name: 'Farm Machinery', text: 'Take a tractor out.', test: (f) => f.flag('drove_tractor') },
  { id: 'plasma', name: 'Plasma Hearth', text: 'Build the Plasma Furnace.', test: goal('plasma_furnace') },
  { id: 'fission', name: 'Splitting Hairs', text: 'Build a fission pile.', test: goal('place_fission_pile') },
  { id: 'star_core', name: 'Heart of a Star', text: 'Forge the star core.', test: goal('make_star_core') },
  { id: 'ignited', name: 'Starlit', text: 'Ignite the Starhearth.', test: (f) => f.flag('ignited') },
  { id: 'brewer', name: 'Brewmaster', text: 'Brew a drink in a cup.', watch: (b, award) => b.on('brew:done', award) },
  { id: 'photographer', name: 'Say Cheese', text: 'Take a photo in photo mode.', watch: (b, award) => b.on('photo:snap', award) },
  { id: 'plans', name: 'Drawn Up', text: 'Learn a building plan (blueprint).', watch: (b, award) => b.on('blueprint:grant', award) },
  { id: 'legend', name: 'Legend in Hand', text: 'Land a legendary weapon\'s special move.', watch: (b, award) => b.on('legendary:proc', award) },
  { id: 'air', name: 'Hot Air', text: 'Use a compressor or other air block.', watch: (b, award) => b.on('air:use', award) },
  { id: 'chimney', name: 'Sweep Chimneys', text: 'Sweep a chimney with a stick.', watch: (b, award) => b.on('disaster:sweep', award) },
  { id: 'cast', name: 'Molten Metal', text: 'Pour metal into a mould.', watch: (b, award) => b.on('cast:poured', award) },
  { id: 'home', name: 'Warm Room', text: 'Enclose a heated room around a furnace.', watch: (b, award) => b.on('hearth:formed', award) },
  { id: 'neighbour', name: 'Good Neighbour', text: 'Have someone move into the lodge.', watch: (b, award) => b.on('town:note', (e) => { if (e.key.startsWith('town:arrived:')) award(); }) },
  { id: 'three_homes', name: 'A Home for Three', text: 'Finish the camp goal \'Make a home for three\'.', watch: (b, award) => b.on('town:note', (e) => { if (e.key === 'camp:three_neighbours') award(); }) },
  { id: 'long_haul', name: 'Long Haul', text: 'Play for two hours.', test: (f) => f.playTimeS >= 7200 },
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
    for (const a of ACHIEVEMENTS) if (a.watch) this.offs.push(a.watch(bus, () => this.award(a)));
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }

  /** Unlocks one by an event, once, with the day from the facts. */
  private award(a: AchievementSpec): void {
    if (this.got.has(a.id)) return;
    this.got.set(a.id, this.facts().day);
    this.bus.emit('toast', { text: `Achievement: ${a.name}`, kind: 'good' });
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
      if (this.got.has(a.id) || !a.test || !a.test(f)) continue;
      this.got.set(a.id, f.day);
      fresh.push(a);
      this.bus.emit('toast', { text: `Achievement: ${a.name}`, kind: 'good' });
    }
    return fresh;
  }

  toJSON(): AchievementsSnapshot {
    return { unlocked: Object.fromEntries(this.got) };
  }

  load(s: AchievementsSnapshot): void {
    this.got.clear();
    for (const [id, day] of Object.entries(s.unlocked)) if (ACHIEVEMENTS.some((a) => a.id === id)) this.got.set(id, day);
  }
}
