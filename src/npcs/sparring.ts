/**
 * Sparring with Gruk (docs/api/npcs.md): pay coin for a bout in the hall. Every bout trains a small combat skill (`sparLevel`, 0..5
 * from bouts fought) and a win pays loot that improves with the skill; you win more often as it grows. A bout leaves you warmed
 * up (a short flat-strength buff through the host). Gruk fights three bouts a day, then needs his supper. Friends of Gruk pay less.
 */
import type { Service, TavernPort } from './services';

export const SPAR_COST = 12;
export const SPAR_FRIEND_COST = 9;
export const SPAR_FRIEND_TRUST = 20;
export const SPAR_PER_DAY = 3;
export const SPAR_MAX_LEVEL = 5;
/** Bouts fought at which each level (1..5) is reached. */
export const SPAR_LEVELS: readonly number[] = [3, 8, 15, 25, 40];

export interface SparState {
  /** Bouts fought, all time. */
  xp: number;
  /** The day of today's tally and the bouts fought that day. */
  day: number;
  today: number;
}

export const sparLevel = (xp: number): number => SPAR_LEVELS.filter((t) => xp >= t).length;
export const sparCost = (gruk: number): number => (gruk >= SPAR_FRIEND_TRUST ? SPAR_FRIEND_COST : SPAR_COST);
/** Chance of winning a bout at a skill level. */
export const winChance = (level: number): number => Math.min(0.9, 0.4 + level * 0.1);
/** Seconds of flat strength a bout leaves (win or lose). */
export const warmUpS = (level: number): number => 45 + level * 30;

export interface Loot {
  item: string;
  count: number;
}

/** Winnings by skill level; one is drawn. */
export const LOOT: readonly (readonly Loot[])[] = [
  [{ item: 'coal', count: 3 }, { item: 'stick', count: 6 }, { item: 'copper_ingot', count: 1 }],
  [{ item: 'coal', count: 5 }, { item: 'copper_ingot', count: 2 }, { item: 'tin_ingot', count: 1 }],
  [{ item: 'iron_ingot', count: 1 }, { item: 'coal', count: 6 }, { item: 'tin_ingot', count: 2 }],
  [{ item: 'iron_ingot', count: 2 }, { item: 'copper_ingot', count: 3 }],
  [{ item: 'iron_ingot', count: 3 }, { item: 'bronze_ingot', count: 1 }],
  [{ item: 'iron_ingot', count: 4 }, { item: 'bronze_ingot', count: 2 }],
];

export const WIN_LINES = ['Good. You hit like a door that holds a grudge.', 'Gruk is on the floor. Gruk is pleased.', 'Again some day. Take this.'];
export const LOSE_LINES = ['Too slow. Gruk sat on you. It is how we teach.', 'You go down. You get up. That is the whole lesson.', 'Not yet. Come again when you are less soft.'];

/** The result of one bout, decided by the rng (a roll for the fight, a roll for the loot). */
export function fight(level: number, rng: () => number): { won: boolean; loot: Loot | null } {
  const won = rng() < winChance(level);
  if (!won) return { won, loot: null };
  const pool = LOOT[Math.min(level, LOOT.length - 1)];
  return { won, loot: pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] };
}

const pick = (xs: readonly string[], rng: () => number): string => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

export function sparService(state: () => SparState): Service {
  const left = (p: TavernPort): number => SPAR_PER_DAY - (state().day === p.day() ? state().today : 0);
  return {
    id: 'spar',
    cost: (p) => sparCost(p.trust('gruk')),
    pitch: (p) => {
      if (left(p) <= 0) return 'Gruk is done for today. Supper first. Come back tomorrow.';
      const lv = sparLevel(state().xp);
      return `Spar? ${sparCost(p.trust('gruk'))} coin, no weapons, no blood. You are skill ${lv} of ${SPAR_MAX_LEVEL}. Use me again to put up your fists.`;
    },
    accept: (p) => {
      const s = state();
      if (left(p) <= 0) return 'Gruk is done for today. Supper first.';
      const c = sparCost(p.trust('gruk'));
      if (p.coins() < c) return `${c} coin to spar, and you carry ${p.coins()}. Gruk does not fight for free.`;
      p.spend(c);
      if (s.day !== p.day()) {
        s.day = p.day();
        s.today = 0;
      }
      s.today++;
      const before = sparLevel(s.xp);
      s.xp++;
      const after = sparLevel(s.xp);
      const r = fight(before, p.rng);
      p.host?.grantBuff?.('strength', warmUpS(after));
      const parts = [r.won ? 'You won the bout.' : 'You lost the bout.'];
      if (r.loot) {
        p.host?.give(r.loot.item, r.loot.count);
        parts.push(`Gruk hands you ${r.loot.count} ${r.loot.item.replace(/_/g, ' ')}.`);
      }
      if (after > before) {
        parts.push(`Your sparring skill rises to ${after}.`);
        p.addTrust('gruk', 2);
      }
      p.toast(`${parts.join(' ')} (-${c} coin, ${p.coins()} left; warmed up for ${warmUpS(after)} s)`);
      return pick(r.won ? WIN_LINES : LOSE_LINES, p.rng);
    },
  };
}
