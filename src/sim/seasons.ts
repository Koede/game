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

/** "Autumn, day 4 of 6" for a HUD tooltip or a log header. */
export function seasonLine(day: number): string {
  const s = seasonOf(day);
  return `${s[0].toUpperCase()}${s.slice(1)}, day ${dayOfSeason(day)} of ${DAYS_PER_SEASON}`;
}

/** Growth multiplier per crop and season: wheat loves summer, carrots and potatoes autumn; spring is the baseline. */
export const CROP_SEASON: Readonly<Record<string, Readonly<Record<Season, number>>>> = {
  wheat: { spring: 1, summer: 1.25, autumn: 1, winter: 0.3 },
  potato: { spring: 1, summer: 0.9, autumn: 1.15, winter: 0.4 },
  carrot: { spring: 1, summer: 0.8, autumn: 1.25, winter: 0.6 },
};

/** Winter growth of a crop under a roof on a hard-winter world when no temperature is known (tests, no heat zones). */
export const GREENHOUSE_SCALE = 0.8;

/** A roofed crop whose air is at least this warm is in a heated greenhouse: it grows at full pace in any season. */
export const GREENHOUSE_WARM_C = 10;
/** Growth in a heated greenhouse: never slower than spring, whatever the season (a crop keeps a better season's pace). */
export const GREENHOUSE_GROWTH = 1;
/** Below this a roofed crop on a hard-winter world freezes in winter: an unheated greenhouse only keeps the snow off. */
export const FROST_C = 0;
/** Winter growth of a roofed crop on a hard-winter world above freezing but short of GREENHOUSE_WARM_C (a cold frame). */
export const COLD_FRAME_SCALE = 0.35;

/**
 * Where a crop stands for growth: 'open' sky, a heated 'greenhouse' (roofed and warm), a 'cold' roofed spot (a cold frame:
 * kept dry, short of the warmth that makes a greenhouse) or 'frozen' (exposed or roofed below FROST_C, hard-winter winter only).
 */
export type Shelter = 'open' | 'greenhouse' | 'cold' | 'frozen';

/** The shelter of a crop: `exposed` = nothing over it, `tempC` = the air at it (undefined = not known: treated as cold). */
export function shelterOf(season: Season, exposed: boolean, tempC: number | undefined, hardWinter = false): Shelter {
  const hardFreeze = hardWinter && season === 'winter';
  if (exposed) return hardFreeze ? 'frozen' : 'open';
  if (tempC !== undefined && tempC >= GREENHOUSE_WARM_C) return 'greenhouse';
  if (hardFreeze && tempC !== undefined && tempC < FROST_C) return 'frozen';
  return 'cold';
}

/**
 * Growth multiplier of `crop` in `season` (1 for crops the table does not know), slowed by snow on it. On a hard-winter
 * world (`hardWinter`, docs/api/winter.md) an exposed crop is frozen solid in winter (0). Under a roof the air temperature
 * `tempC` decides (docs/api/greenhouse.md): at GREENHOUSE_WARM_C or more it is a heated greenhouse and grows at
 * GREENHOUSE_GROWTH or its season's pace if better, in every season and on every world; a hard winter freezes a roofed crop
 * below FROST_C and slows one in between to COLD_FRAME_SCALE. Without a temperature a roofed crop in a hard winter grows at
 * GREENHOUSE_SCALE, as before heat mattered.
 */
export function cropScale(season: Season, crop: string, snowing: boolean, hardWinter = false, exposed = true, tempC?: number): number {
  const base = CROP_SEASON[crop]?.[season] ?? 1;
  const shelter = shelterOf(season, exposed, tempC, hardWinter);
  if (shelter === 'frozen') return 0;
  if (shelter === 'greenhouse') return Math.max(base, GREENHOUSE_GROWTH);
  if (hardWinter && season === 'winter') return tempC === undefined ? GREENHOUSE_SCALE : COLD_FRAME_SCALE;
  return Math.max(MIN_SCALE, base * (snowing && exposed ? SNOW_GROWTH : 1));
}

/** One line for the toast at the turn of a season. */
export const SEASON_BLURB: Readonly<Record<Season, string>> = {
  spring: 'Spring: crops start at their ordinary pace; the rains come often.',
  summer: 'Summer: wheat grows fastest, carrots sulk in the heat.',
  autumn: 'Autumn: carrots and potatoes thrive; harvest before the frost.',
  winter: 'Winter: crops crawl and snow slows them further. Roof a field with glass and heat it, or live off the larder.',
};
