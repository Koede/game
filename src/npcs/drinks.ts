/**
 * Rosa's drinks (docs/api/npcs.md): a warming ale, a bracing tea and a strong brew, each a short buff through the game's own buff
 * system (Well-Warmed, the tea and coffee drink buffs, flat elixir strength). The strong brew is rationed: two a day, then Rosa
 * cuts you off. The host applies the buff (`NpcHost.grantBuff`).
 */
import type { DrinkBuff } from '../core/types';
import type { Service } from './services';

export type TavernBuff = 'well_warmed' | DrinkBuff | 'strength';

export interface DrinkSpec {
  id: string;
  name: string;
  cost: number;
  /** Everything it gives, in seconds (strength: +1 flat). */
  buffs: readonly { buff: TavernBuff; s: number }[];
  /** Said with the pitch. */
  blurb: string;
  /** Said when it is handed over. */
  serve: string;
  /** Most a day (0 = no limit). */
  perDay: number;
}

export const DRINKS: readonly DrinkSpec[] = [
  { id: 'ale', name: 'Warming ale', cost: 6, buffs: [{ buff: 'well_warmed', s: 240 }], blurb: 'a mug of warming ale (the cold stays off you a while)', serve: 'Warm from the barrel. Do not tell the others it is watered.', perDay: 0 },
  { id: 'tea', name: 'Bracing tea', cost: 5, buffs: [{ buff: 'mending', s: 150 }], blurb: 'a pot of bracing tea (cuts heal faster)', serve: 'Sip it slow. It knits things.', perDay: 0 },
  { id: 'brew', name: 'Strong brew', cost: 14, buffs: [{ buff: 'vigor', s: 120 }, { buff: 'strength', s: 120 }], blurb: 'a strong brew (you hit harder and mine faster, for two minutes)', serve: 'That one bites back. Mind your elbows.', perDay: 2 },
];

export const drinkById = (id: string): DrinkSpec | undefined => DRINKS.find((d) => d.id === id);

/** Drinks served today, per id; resets when the day changes. */
export interface DrinkLog {
  day: number;
  n: Record<string, number>;
}

export const servedToday = (log: DrinkLog, id: string, day: number): number => (log.day === day ? log.n[id] ?? 0 : 0);

export function drinkService(spec: DrinkSpec, log: () => DrinkLog): Service {
  return {
    id: `drink:${spec.id}`,
    cost: () => spec.cost,
    pitch: (p) => (spec.perDay > 0 && servedToday(log(), spec.id, p.day()) >= spec.perDay ? null : `${spec.cost} coin for ${spec.blurb}. Use me again to say yes.`),
    accept: (p) => {
      const l = log();
      const day = p.day();
      if (spec.perDay > 0 && servedToday(l, spec.id, day) >= spec.perDay) return 'That is your limit for today. Have the tea.';
      if (!p.host?.grantBuff) return 'The kettle is on the blink. Another time.';
      if (p.coins() < spec.cost) return `${spec.cost} coin, love, and you carry ${p.coins()}.`;
      p.spend(spec.cost);
      if (l.day !== day) {
        l.day = day;
        l.n = {};
      }
      l.n[spec.id] = (l.n[spec.id] ?? 0) + 1;
      for (const b of spec.buffs) p.host.grantBuff(b.buff, b.s);
      p.toast(`${spec.name}: ${spec.buffs.map((b) => `${b.buff.replace('_', ' ')} ${Math.round(b.s / 60 * 10) / 10} min`).join(', ')} (-${spec.cost} coin, ${p.coins()} left)`);
      return spec.serve;
    },
  };
}
