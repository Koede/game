/**
 * The seasonal festival (docs/api/npcs.md): the last day of each season (SEASON_DAYS days of Thaw, Bloom, Harvest and Frost) the
 * tavern holds a festival night, from dusk until dawn. The jukebox plays and the dancers dance. Rosa runs three contests, each
 * entered once per festival: dance (just show up), cooking (hold your best dish) and brewing (hold your best tea or coffee). Four
 * regulars judge each, scoring 1..10 by their tastes and how much they like you; a stage in the hall (upkeep) helps the dance.
 */
import { itemOrNull } from '../core/registry';
import type { Phase } from './dialogue';
import { LIKES, tierOf } from './friendship';
import type { Service } from './services';
import { stockValue } from './upkeep';

export const SEASON_DAYS = 8;
export const SEASONS = ['Thaw', 'Bloom', 'Harvest', 'Frost'] as const;

export type Contest = 'dance' | 'cook' | 'brew';
export const CONTESTS: readonly Contest[] = ['dance', 'cook', 'brew'];

export const JUDGES: Readonly<Record<Contest, readonly string[]>> = {
  dance: ['mara', 'orrin', 'bram', 'gruk'],
  cook: ['rosa', 'gruk', 'bram', 'mara'],
  brew: ['rosa', 'mara', 'orrin', 'gruk'],
};

export function seasonOf(day: number): { name: string; index: number; dayIn: number } {
  const d = Math.max(1, Math.floor(day)) - 1;
  const season = Math.floor(d / SEASON_DAYS);
  return { name: SEASONS[season % SEASONS.length], index: season, dayIn: (d % SEASON_DAYS) + 1 };
}

/** The last day of a season is the festival. */
export const festivalDay = (day: number): boolean => Math.max(1, Math.floor(day)) % SEASON_DAYS === 0;
/** Days until the next festival day (0 on it). */
export const daysToFestival = (day: number): number => (SEASON_DAYS - (Math.max(1, Math.floor(day)) % SEASON_DAYS)) % SEASON_DAYS;
/** The festival night runs from dusk to dawn of a festival day. */
export const festivalOn = (day: number, phase: Phase): boolean => festivalDay(day) && (phase === 'evening' || phase === 'night');

export interface Entry {
  contest: Contest;
  /** The dish or drink (cook, brew); null for the dance. */
  item: string | null;
  /** Trust per judge id. */
  trust: (id: string) => number;
  stage: boolean;
}

/** One judge's mark, 1..10. */
export function judgeScore(judge: string, e: Entry, rng: () => number): number {
  let s: number;
  if (e.contest === 'dance') s = (judge === 'gruk' ? 3 : 4) + (e.stage ? 1 : 0) + Math.floor(rng() * 3);
  else {
    const q = e.item ? stockValue(e.item) : 0;
    s = Math.max(2, Math.min(6, 2 + q * 0.5)) + Math.floor(rng() * 2) + (e.item && LIKES[judge]?.includes(e.item) ? 2 : 0);
  }
  s += Math.floor(tierOf(e.trust(judge)) * 0.5 + 0.5 * (tierOf(e.trust(judge)) > 0 ? 1 : 0));
  return Math.max(1, Math.min(10, Math.round(s)));
}

export interface Medal {
  name: 'gold' | 'silver' | 'bronze' | 'none';
  coin: number;
  trust: number;
}

/** Prize for a total out of 40. */
export function medalFor(total: number): Medal {
  if (total >= 30) return { name: 'gold', coin: 40, trust: 3 };
  if (total >= 22) return { name: 'silver', coin: 20, trust: 2 };
  if (total >= 14) return { name: 'bronze', coin: 8, trust: 1 };
  return { name: 'none', coin: 0, trust: 1 };
}

export interface Judged {
  marks: [string, number][];
  total: number;
  medal: Medal;
}

export function judge(e: Entry, rng: () => number): Judged {
  const marks = JUDGES[e.contest].map((j): [string, number] => [j, judgeScore(j, e, rng)]);
  const total = marks.reduce((a, [, m]) => a + m, 0);
  return { marks, total, medal: medalFor(total) };
}

export interface FestivalState {
  /** The festival day each contest was last entered. */
  entered: Partial<Record<Contest, number>>;
  gold: number;
  silver: number;
  bronze: number;
  /** The festival turned the jukebox on (and will turn it off at dawn). */
  juke: boolean;
}

export const newFestivalState = (): FestivalState => ({ entered: {}, gold: 0, silver: 0, bronze: 0, juke: false });

const NAME: Record<Contest, string> = { dance: 'dance contest', cook: 'cooking contest', brew: 'brewing contest' };
const HOW: Record<Contest, string> = {
  dance: 'Just step up, the floor is yours.',
  cook: 'Hold your best dish and use me again; I take one plate to the judges.',
  brew: 'Hold your best tea or coffee and use me again; I take one cup to the judges.',
};

/** True when the held item suits the contest. */
export function suits(contest: Contest, item: string | null): boolean {
  if (contest === 'dance') return true;
  const it = item ? itemOrNull(item) : null;
  if (!it) return false;
  return contest === 'brew' ? !!it.drink : !!it.food && !it.drink;
}

export function festivalServices(state: () => FestivalState, stage: () => boolean): Service[] {
  return CONTESTS.map((c): Service => ({
    id: `fest:${c}`,
    cost: () => 0,
    pitch: (p) => {
      if (!festivalOn(p.day(), p.phase()) || state().entered[c] === p.day()) return null;
      return `The ${NAME[c]} is open tonight: four judges, gold, silver or bronze. ${HOW[c]}`;
    },
    accept: (p) => {
      if (!festivalOn(p.day(), p.phase())) return 'The festival is for its own night, love.';
      const st = state();
      if (st.entered[c] === p.day()) return 'You have entered that one tonight. Let someone else win.';
      const held = c === 'dance' ? null : p.host?.held() ?? null;
      if (c !== 'dance' && (!held || !suits(c, held.item))) return c === 'cook' ? 'Hold a dish for the cooking contest and use me again.' : 'Hold a tea or coffee for the brewing contest and use me again.';
      st.entered[c] = p.day();
      if (held) p.host?.takeHeld(1);
      const r = judge({ contest: c, item: held?.item ?? null, trust: (id) => p.trust(id), stage: stage() }, p.rng);
      const m = r.medal;
      if (m.name === 'gold') st.gold++;
      else if (m.name === 'silver') st.silver++;
      else if (m.name === 'bronze') st.bronze++;
      p.earn(m.coin);
      for (const [j] of r.marks) p.addTrust(j, m.trust);
      const names = r.marks.map(([j, s]) => `${j[0].toUpperCase()}${j.slice(1)} ${s}`).join(', ');
      p.toast(`The ${NAME[c]}: ${names}. ${r.total} of 40: ${m.name === 'none' ? 'no medal, but the judges liked the effort' : `${m.name} medal, +${m.coin} coin`}.`);
      return m.name === 'gold' ? 'Gold! Somebody get the lamps.' : m.name === 'none' ? 'Next season, love. There is always a next season.' : 'Well done. Well done!';
    },
  }));
}
