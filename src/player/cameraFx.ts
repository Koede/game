/** Small camera effects (pure maths; the controller applies them). All of them are skipped with Reduce motion. */

/** A landing from lower than this makes no dip at all. */
export const LAND_DIP_FROM = 0.7;
/** The deepest dip, in blocks. */
export const LAND_DIP_MAX = 0.16;

/** How far the eye sinks for a landing after falling `fell` blocks (0 for a hop, capped for a big drop). */
export function landingDip(fell: number): number {
  if (!(fell > LAND_DIP_FROM)) return 0;
  return Math.min(LAND_DIP_MAX, 0.03 + (fell - LAND_DIP_FROM) * 0.03);
}

/** Eases `value` back towards 0 with the given rate (1/s). */
export const settle = (value: number, rate: number, dt: number): number => {
  const next = value * Math.exp(-rate * dt);
  return Math.abs(next) < 1e-4 ? 0 : next;
};
