/**
 * Ambient temperature, one function the cold rules read (docs/api/winter.md). The heat-zones work exposes its own
 * temperature API; until it lands this file holds the stub: a season, the hour and the weather give a number in
 * degrees C, and `setTemperatureProvider` lets heat zones answer instead for any place it knows (null = no opinion).
 * Pure and DOM-free.
 */
import { seasonOf, type Season } from './seasons';

/** Open-air degrees C by season in daylight. */
export const SEASON_BASE_C: Readonly<Record<Season, number>> = { spring: 9, summer: 20, autumn: 6, winter: -6 };
/** Colder after dark. */
export const NIGHT_DELTA_C = -6;
/** Falling snow chills further. */
export const SNOW_DELTA_C = -2;
/** A roof over the head keeps this much of the cold off. */
export const SHELTER_DELTA_C = 6;

export interface TemperatureQuery {
  x: number;
  y: number;
  z: number;
  /** 1-based clock day. */
  day: number;
  night: boolean;
  snowing: boolean;
  /** Open sky overhead (no roof). */
  exposed: boolean;
}

/** Heat zones plug in here: return degrees C for the place, or null to fall back to the seasonal stub. */
export type TemperatureProvider = (q: TemperatureQuery) => number | null;

let provider: TemperatureProvider | null = null;

/** Installs (or with null removes) the heat-zones provider. */
export function setTemperatureProvider(p: TemperatureProvider | null): void {
  provider = p;
}

/** The stub: season, hour, snow and shelter only. */
export function stubTemperature(q: TemperatureQuery): number {
  let t = SEASON_BASE_C[seasonOf(q.day)];
  if (q.night) t += NIGHT_DELTA_C;
  if (q.snowing && q.exposed) t += SNOW_DELTA_C;
  if (!q.exposed) t += SHELTER_DELTA_C;
  return t;
}

/** Degrees C at a place: the provider's answer when it gives one, else the stub. */
export function temperatureAt(q: TemperatureQuery): number {
  const t = provider?.(q);
  return t === null || t === undefined ? stubTemperature(q) : t;
}
