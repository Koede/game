/**
 * Warm rooms (docs/api/thermal.md): people drift towards the warmth on cold evenings and nights, and a warm home is a content one.
 * Pure helpers over a temperature function; the manager feeds `NpcHost.temperatureAt` in, contentment.ts is untouched (callers add
 * `warmthDelta` to a contentment score). Never blocks anything: it only picks between spots a routine already allows.
 */
import { COMFORT_C, COLD_C } from '../game/thermal';

export type Spot = readonly [number, number, number];
export type TempAt = (x: number, y: number, z: number) => number;

/** A person standing where it is at or below this is unhappy about it. */
export const CHILLED_C = COLD_C;
/** A routine spot this cold sends its owner looking for a warmer one nearby. */
export const SEEK_BELOW_C = 10;
/** The warmest candidate must beat the routine spot by this much to be worth moving for. */
export const SEEK_GAIN_C = 3;

/**
 * Where to stand: `routine` unless it is cold and one of `candidates` (spots the routines already use, in the same coordinates)
 * is clearly warmer. `at` converts a spot to its temperature.
 */
export function warmerSpot(routine: Spot, candidates: readonly Spot[], at: TempAt): Spot {
  const here = at(routine[0], routine[1], routine[2]);
  if (here >= SEEK_BELOW_C) return routine;
  let best = routine;
  let bestC = here;
  for (const c of candidates) {
    const t = at(c[0], c[1], c[2]);
    if (t > bestC + SEEK_GAIN_C - 1e-9 && t > bestC) {
      best = c;
      bestC = t;
    }
  }
  return bestC >= here + SEEK_GAIN_C ? best : routine;
}

/**
 * How a person's contentment shifts with the temperature of their home, in [-0.3, 0.3] and only on hard (on normal a cold home is
 * merely not warm: 0, a warm one still pleases). Add it to `contentment().score` and clamp.
 */
export function warmthDelta(tempC: number, hard: boolean): number {
  if (tempC >= COMFORT_C) return Math.min(0.3, 0.1 + (tempC - COMFORT_C) * 0.01);
  if (!hard) return 0;
  if (tempC >= CHILLED_C) return 0;
  return Math.max(-0.3, -0.1 - (CHILLED_C - tempC) * 0.02);
}

/** The line for the contentment panel. Null when the temperature earns no comment. */
export function warmthReason(tempC: number, hard: boolean): string | null {
  const d = warmthDelta(tempC, hard);
  return d > 0 ? 'likes a warm room' : d < 0 ? 'dislikes the cold' : null;
}
