/**
 * Cold peaks (docs/api/hotsprings.md): the air thins and chills above PEAK_START_Y, so a climb costs warmth by day and
 * night, in every biome, until a fire, a coat or a hot spring is reached. Pure; survival.ts adds it as a 'frost' drain.
 */
/** Altitude where the chill starts and where it is full strength. */
export const PEAK_START_Y = 58;
export const PEAK_FULL_Y = 74;
/** Warmth per second lost at full strength (about 1.7 x the frostfell's day drain). */
export const PEAK_DRAIN = 0.35;

/** Warmth drain per second at height `y`: 0 below the start, rising smoothly to PEAK_DRAIN. */
export function peakDrain(y: number): number {
  if (y <= PEAK_START_Y) return 0;
  const t = Math.min(1, (y - PEAK_START_Y) / (PEAK_FULL_Y - PEAK_START_Y));
  return PEAK_DRAIN * t * t * (3 - 2 * t);
}
