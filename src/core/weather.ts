/**
 * Pure lookups that turn the shared weather contract (WeatherState in types.ts, numbers in constants.ts) into
 * the values each module needs, so the game, simulation, renderer and audio all read the sky the same way.
 * Deciding WHEN the weather changes is src/game's job; nothing here keeps state.
 */
import {
  BIOME_PRECIPITATION, MOON_FIRST_PHASE, MOON_PHASES, NIGHT_LIGHT_FULL_MOON, NIGHT_LIGHT_NEW_MOON, SNOW_LINE_Y,
  WET_MIN_INTENSITY,
} from './constants';
import { lerp, mod } from './math';
import type { BiomeKey, Precipitation, WeatherKind, WeatherState } from './types';

/** What falls at a place in this weather: nothing unless it rains or storms; then dust, snow or rain. */
export function precipitationFor(kind: WeatherKind, biome: BiomeKey, y: number): Precipitation {
  if (kind !== 'rain' && kind !== 'storm') return 'none';
  const local = BIOME_PRECIPITATION[biome];
  if (local === 'rain' && y >= SNOW_LINE_Y) return 'snow';
  return local;
}

/** True when rain or snow falls hard enough to soak: chills the player and exposed furnaces, waters crops. */
export const isWet = (p: Precipitation, intensity: number): boolean => (p === 'rain' || p === 'snow') && intensity >= WET_MIN_INTENSITY;

/**
 * A per-state number (one of the WEATHER_* tables) eased across the current change: the value of `previous`
 * at blend 0, of `kind` at blend 1.
 */
export function weatherValue(table: Readonly<Record<WeatherKind, number>>, w: Pick<WeatherState, 'kind' | 'previous' | 'blend'>): number {
  if (w.blend >= 1) return table[w.kind];
  return w.blend > 0 ? lerp(table[w.previous], table[w.kind], w.blend) : table[w.previous];
}

/**
 * Moon phase (0..7, 0 = new, 4 = full) of a day, counting days from the start of the world (day 0 is the first
 * day; a night belongs to the day whose sunset began it).
 */
export const moonPhase = (day: number): number => mod(Math.floor(day) + MOON_FIRST_PHASE, MOON_PHASES);

/** Lit fraction of the moon's disc, 0 (new) .. 1 (full), for drawing the phase. */
export const moonIllumination = (phase: number): number => (1 - Math.cos((2 * Math.PI * phase) / MOON_PHASES)) / 2;

/** Sunlight factor at the darkest of night for a moon phase: 0.04 at new moon .. 0.12 at full moon. */
export const nightLight = (phase: number): number => lerp(NIGHT_LIGHT_NEW_MOON, NIGHT_LIGHT_FULL_MOON, moonIllumination(phase));
