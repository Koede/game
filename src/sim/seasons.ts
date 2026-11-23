/**
 * Seasons (docs/api/seasons.md): the year turns every DAYS_PER_SEASON clock days (spring first) and changes how fast
 * each crop grows; snow falling on a crop slows it further. Pure rules: the crop field reads `cropScale`, the
 * weathering layer (src/game/weathering.ts) announces the turn of the season and fills buckets in the rain.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const DAYS_PER_SEASON = 6;
/** Growth multiplier while snow falls on an exposed crop. */
export const SNOW_GROWTH = 0.5;
/** Growth never falls below this, so a crop is slowed in winter and never frozen asleep. */
export const MIN_SCALE = 0.15;

/** The season of 1-based clock day `day`. */
export function seasonOf(day: number): Season {
  return SEASONS[Math.floor((Math.max(1, Math.floor(day)) - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

/** Day within the season, 1..DAYS_PER_SEASON. */
export const dayOfSeason = (day: number): number => ((Math.max(1, Math.floor(day)) - 1) % DAYS_PER_SEASON) + 1;

/** Growth multiplier per crop and season: wheat loves summer, carrots and potatoes autumn; spring is the baseline. */
export const CROP_SEASON: Readonly<Record<string, Readonly<Record<Season, number>>>> = {
  wheat: { spring: 1, summer: 1.25, autumn: 1, winter: 0.3 },
  potato: { spring: 1, summer: 0.9, autumn: 1.15, winter: 0.4 },
  carrot: { spring: 1, summer: 0.8, autumn: 1.25, winter: 0.6 },
};

/** Growth multiplier of `crop` in `season` (1 for crops the table does not know), slowed by snow on it. */
export function cropScale(season: Season, crop: string, snowing: boolean): number {
  const base = CROP_SEASON[crop]?.[season] ?? 1;
  return Math.max(MIN_SCALE, base * (snowing ? SNOW_GROWTH : 1));
}

/** One line for the toast at the turn of a season. */
export const SEASON_BLURB: Readonly<Record<Season, string>> = {
  spring: 'Spring: crops start at their ordinary pace; the rains come often.',
  summer: 'Summer: wheat grows fastest, carrots sulk in the heat.',
  autumn: 'Autumn: carrots and potatoes thrive; harvest before the frost.',
  winter: 'Winter: crops crawl and snow slows them further. Roof your fields or live off the larder.',
};
