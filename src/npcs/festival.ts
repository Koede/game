/**
 * The seasonal festivals (docs/api/npcs.md): the last day of each season (sim/seasons.ts: DAYS_PER_SEASON days of spring, summer,
 * autumn and winter) the town gathers at the tavern for that season's festival, from dusk until dawn: the Sowing Fair, the Midsummer
 * Bonfire, the Harvest Fair and Lantern Night. The jukebox plays and the dancers dance. Rosa runs the three standing contests (dance,
 * cooking, brewing) and the festival's own one (seeds and flowers, the biggest catch, the heaviest basket, the brightest lantern),
 * each entered once per festival. Four regulars judge each, scoring 1..10 by quality, their tastes and how much they like you; a stage
 * in the hall (upkeep) helps the dance. Medals pay coin, trust and town standing; the festival's keepsakes are seasonal goals
 * (game/dailyGoals.ts), and word of a good night draws the next newcomer sooner (moveIn.ts).
 */
import { itemOrNull } from '../core/registry';
import { DAYS_PER_SEASON, SEASONS as YEAR, seasonOf as yearSeason, type Season } from '../sim/seasons';
import type { Phase } from './dialogue';
import { LIKES, tierOf } from './friendship';
import type { Service } from './services';
import { stockValue } from './upkeep';

/** One calendar with the crops and the weather: a season is DAYS_PER_SEASON clock days. */
export const SEASON_DAYS = DAYS_PER_SEASON;
export const SEASONS = YEAR;

/** The standing contests of every festival, and the four festivals' own. */
export type Signature = 'sow' | 'fish' | 'crop' | 'lantern';
export type Contest = 'dance' | 'cook' | 'brew' | Signature;
export const STANDING: readonly Contest[] = ['dance', 'cook', 'brew'];
export const CONTESTS: readonly Contest[] = ['dance', 'cook', 'brew', 'sow', 'fish', 'crop', 'lantern'];

export interface FestivalDef {
  season: Season;
  name: string;
  /** The festival's own contest. */
  signature: Signature;
  /** What the town does that night (the opening toast). */
  blurb: string;
  /** Rosa's morning reminder on the day. */
  tonight: string;
  /** Town standing for a podium in the festival's own contest (gold, silver, bronze). */
  rep: readonly [number, number, number];
}

export const FESTIVALS: Readonly<Record<Season, FestivalDef>> = {
  spring: { season: 'spring', name: 'Sowing Fair', signature: 'sow', blurb: 'seed bags are swapped, flowers judged, and the first ale of the year is poured', tonight: 'bring a bag of seeds or a rare flower for the show', rep: [6, 4, 2] },
  summer: { season: 'summer', name: 'Midsummer Bonfire', signature: 'fish', blurb: 'a bonfire in the yard, music till dawn, and the year\'s best catch weighed by the fire', tonight: 'bring your best fish for the catch', rep: [6, 4, 2] },
  autumn: { season: 'autumn', name: 'Harvest Fair', signature: 'crop', blurb: 'the year\'s harvest is weighed, the hall is hung with sheaves, and the heaviest basket wins', tonight: 'bring a full basket of wheat, potatoes or carrots', rep: [8, 5, 3] },
  winter: { season: 'winter', name: 'Lantern Night', signature: 'lantern', blurb: 'every window is lit, lanterns are hung on strings, and the brightest one is crowned', tonight: 'bring your brightest light: a torch, a lamp or a kerosene lantern', rep: [6, 4, 2] },
};

/** The festival held on the last day of the season of `day`. */
export const festivalOf = (day: number): FestivalDef => FESTIVALS[yearSeason(day)];

export function seasonOf(day: number): { season: Season; name: string; index: number; dayIn: number } {
  const d = Math.max(1, Math.floor(day)) - 1;
  const season = Math.floor(d / SEASON_DAYS);
  const s = SEASONS[season % SEASONS.length];
  return { season: s, name: s[0].toUpperCase() + s.slice(1), index: season, dayIn: (d % SEASON_DAYS) + 1 };
}

/** The last day of a season is the festival. */
export const festivalDay = (day: number): boolean => Math.max(1, Math.floor(day)) % SEASON_DAYS === 0;
/** Days until the next festival day (0 on it). */
export const daysToFestival = (day: number): number => (SEASON_DAYS - (Math.max(1, Math.floor(day)) % SEASON_DAYS)) % SEASON_DAYS;
/** The festival night runs from dusk to dawn of a festival day. */
export const festivalOn = (day: number, phase: Phase): boolean => festivalDay(day) && (phase === 'evening' || phase === 'night');
/** The contests open on festival day `day`: the three standing ones and that season's own. */
export const contestsOn = (day: number): readonly Contest[] => [...STANDING, festivalOf(day).signature];

/** One line for the Town page: tonight's festival, or the next one and how far off it is. */
export function festivalLine(day: number, open: boolean): string {
  const f = festivalOf(day + daysToFestival(day));
  const n = daysToFestival(day);
  if (n === 0) return open ? `Tonight: the ${f.name} at the Hearth & Anvil, from dusk. ${cap(f.tonight)}.` : `Today is the ${f.name}. The town gathers once the Hearth & Anvil stands and three people live here.`;
  return `Next festival: the ${f.name}, in ${n} day${n === 1 ? '' : 's'}. ${cap(f.tonight)}.`;
}
const cap = (t: string): string => t[0].toUpperCase() + t.slice(1);

export const JUDGES: Readonly<Record<Contest, readonly string[]>> = {
  dance: ['mara', 'orrin', 'bram', 'gruk'],
  cook: ['rosa', 'gruk', 'bram', 'mara'],
  brew: ['rosa', 'mara', 'orrin', 'gruk'],
  sow: ['bram', 'mara', 'rosa', 'gruk'],
  fish: ['bram', 'gruk', 'rosa', 'orrin'],
  crop: ['rosa', 'bram', 'gruk', 'mara'],
  lantern: ['orrin', 'mara', 'rosa', 'bram'],
};

/** How rare each fish is at the Bonfire (cooked counts the same). */
export const FISH_POINTS: Readonly<Record<string, number>> = {
  perch: 2, carp: 3, trout: 3, eel: 4, crayfish: 4, pike: 5, salmon: 5, whitefish: 6, glowfin: 7,
};
/** How bright a light is on Lantern Night. */
export const LIGHT_POINTS: Readonly<Record<string, number>> = { torch: 2, lamp: 5, signal_lamp: 5, kerosene_lamp: 7 };
/** The rare flowers of the Sowing Fair's flower show. */
export const FLOWER_POINTS: Readonly<Record<string, number>> = { ember_poppy: 7, frost_lily: 7 };
const SEEDS = new Set(['wheat_seeds', 'plant_seeds']);
const CROPS = new Set(['wheat', 'potato', 'carrot']);
const fishKind = (item: string): string | null => {
  const m = /^(raw|cooked)_([a-z]+)$/.exec(item);
  return m && FISH_POINTS[m[2]] !== undefined ? m[2] : null;
};

/**
 * Quality 0..7 of what is held up for a festival's own contest (0: it does not suit). Seeds and the harvest are shown by the
 * bagful (a bigger stack scores more), a fish by how rare it is, a light by how bright, a rare flower on its own.
 */
export function signatureQuality(contest: Signature, item: string | null, count: number): number {
  if (!item) return 0;
  const n = Math.max(0, Math.floor(count));
  switch (contest) {
    case 'sow':
      if (FLOWER_POINTS[item]) return FLOWER_POINTS[item];
      return SEEDS.has(item) ? Math.min(6, 1 + Math.floor(n / 6)) : 0;
    case 'crop':
      return CROPS.has(item) ? Math.min(7, 1 + Math.floor(n / 8)) : 0;
    case 'fish': {
      const k = fishKind(item);
      return k ? FISH_POINTS[k] : 0;
    }
    case 'lantern':
      return LIGHT_POINTS[item] ?? 0;
  }
}

export const isSignature = (c: Contest): c is Signature => c === 'sow' || c === 'fish' || c === 'crop' || c === 'lantern';

export interface Entry {
  contest: Contest;
  /** The dish, drink or show piece; null for the dance. */
  item: string | null;
  /** How many are held (the seed bag and the harvest basket score by it). */
  count?: number;
  /** Trust per judge id. */
  trust: (id: string) => number;
  stage: boolean;
}

/** One judge's mark, 1..10. */
export function judgeScore(judge: string, e: Entry, rng: () => number): number {
  let s: number;
  if (e.contest === 'dance') s = (judge === 'gruk' ? 3 : 4) + (e.stage ? 1 : 0) + Math.floor(rng() * 3);
  else if (isSignature(e.contest)) s = 1 + signatureQuality(e.contest, e.item, e.count ?? 1) + Math.floor(rng() * 2) + (e.item && LIKES[judge]?.includes(e.item) ? 1 : 0);
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
  /** Contests entered, all time (the seasonal goals read it). */
  entries: number;
  /** Golds in a festival's own contest, all time (the seasonal trophy goals read it). */
  crowns: number;
  /** The last festival day the player entered anything: word of it draws the next newcomer (moveIn.ts). */
  lastDay: number;
  /** The festival turned the jukebox on (and will turn it off at dawn). */
  juke: boolean;
}

export const newFestivalState = (): FestivalState => ({ entered: {}, gold: 0, silver: 0, bronze: 0, entries: 0, crowns: 0, lastDay: 0, juke: false });

export const CONTEST_NAME: Readonly<Record<Contest, string>> = {
  dance: 'dance contest', cook: 'cooking contest', brew: 'brewing contest',
  sow: 'seed and flower show', fish: 'Bonfire catch', crop: 'harvest basket', lantern: 'lantern crowning',
};
const NAME = CONTEST_NAME;
const HOW: Record<Contest, string> = {
  dance: 'Just step up, the floor is yours.',
  cook: 'Hold your best dish and use me again; I take one plate to the judges.',
  brew: 'Hold your best tea or coffee and use me again; I take one cup to the judges.',
  sow: 'Hold a bag of seeds (the fuller the better) or a rare flower and use me again. You keep them.',
  fish: 'Hold your best fish, raw or cooked, and use me again. The rarer the better; it goes on the fire.',
  crop: 'Hold a basket of wheat, potatoes or carrots and use me again. The heavier the better, and you keep it.',
  lantern: 'Hold your brightest light and use me again: a torch, a lamp, a kerosene lantern. You keep it.',
};
const WANT: Record<Contest, string> = {
  dance: '', cook: 'Hold a dish for the cooking contest and use me again.', brew: 'Hold a tea or coffee for the brewing contest and use me again.',
  sow: 'Hold seeds or a rare flower for the show and use me again.', fish: 'Hold a fish for the catch and use me again.',
  crop: 'Hold wheat, potatoes or carrots for the basket and use me again.', lantern: 'Hold a torch or a lamp for the crowning and use me again.',
};

/** True when the held item suits the contest. */
export function suits(contest: Contest, item: string | null): boolean {
  if (contest === 'dance') return true;
  if (isSignature(contest)) return signatureQuality(contest, item, 1) > 0;
  const it = item ? itemOrNull(item) : null;
  if (!it) return false;
  return contest === 'brew' ? !!it.drink : !!it.food && !it.drink;
}

export interface FestivalHooks {
  /** A stage stands in the hall (helps the dance). */
  stage(): boolean;
  /** Raises the town's standing (buildBoard.ts reputation). */
  addRep?(n: number): void;
}

export function festivalServices(state: () => FestivalState, hooks: FestivalHooks): Service[] {
  return CONTESTS.map((c): Service => ({
    id: `fest:${c}`,
    cost: () => 0,
    pitch: (p) => {
      if (!festivalOn(p.day(), p.phase()) || !contestsOn(p.day()).includes(c) || state().entered[c] === p.day()) return null;
      const f = festivalOf(p.day());
      return isSignature(c)
        ? `The ${f.name}'s own contest is open: the ${NAME[c]}. Four judges, gold, silver or bronze, and the town remembers a winner. ${HOW[c]}`
        : `The ${NAME[c]} is open tonight: four judges, gold, silver or bronze. ${HOW[c]}`;
    },
    accept: (p) => {
      if (!festivalOn(p.day(), p.phase())) return 'The festival is for its own night, love.';
      if (!contestsOn(p.day()).includes(c)) return `That one belongs to another season. Tonight is the ${festivalOf(p.day()).name}.`;
      const st = state();
      if (st.entered[c] === p.day()) return 'You have entered that one tonight. Let someone else win.';
      const held = c === 'dance' ? null : p.host?.held() ?? null;
      if (c !== 'dance' && (!held || !suits(c, held.item))) return WANT[c];
      st.entered[c] = p.day();
      st.entries++;
      st.lastDay = p.day();
      // Dishes, cups and the fish are used up; the seed bag, the basket and the lantern are only shown.
      if (held && (c === 'cook' || c === 'brew' || c === 'fish')) p.host?.takeHeld(1);
      const r = judge({ contest: c, item: held?.item ?? null, count: held?.count ?? 1, trust: (id) => p.trust(id), stage: hooks.stage() }, p.rng);
      const m = r.medal;
      if (m.name === 'gold') st.gold++;
      else if (m.name === 'silver') st.silver++;
      else if (m.name === 'bronze') st.bronze++;
      if (m.name === 'gold' && isSignature(c)) st.crowns++;
      p.earn(m.coin);
      for (const [j] of r.marks) p.addTrust(j, m.trust);
      const rep = isSignature(c) && m.name !== 'none' ? festivalOf(p.day()).rep[m.name === 'gold' ? 0 : m.name === 'silver' ? 1 : 2] : 0;
      if (rep > 0) hooks.addRep?.(rep);
      const names = r.marks.map(([j, s]) => `${j[0].toUpperCase()}${j.slice(1)} ${s}`).join(', ');
      p.toast(`The ${NAME[c]}: ${names}. ${r.total} of 40: ${m.name === 'none' ? 'no medal, but the judges liked the effort' : `${m.name} medal, +${m.coin} coin${rep ? `, +${rep} town standing` : ''}`}.`);
      if (m.name === 'gold' && isSignature(c)) return `Gold at the ${festivalOf(p.day()).name}! They will be talking about this one all season.`;
      return m.name === 'gold' ? 'Gold! Somebody get the lamps.' : m.name === 'none' ? 'Next season, love. There is always a next season.' : 'Well done. Well done!';
    },
  }));
}
