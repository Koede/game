/**
 * Daily routines (docs/api/npcs.md): where each person of the tavern stands in each part of the day, tavern-local block
 * coordinates (feet). The manager walks them from one spot to the next at WALK_SPEED. Props never move. Every spot is air over
 * plank (or dirt in the yard); the tests check it against the layout.
 */
import type { Phase } from './dialogue';

export type Spot = readonly [number, number, number];
export const WALK_SPEED = 1.1;

export const ROUTINES: Readonly<Record<string, Readonly<Record<Phase, Spot>>>> = {
  mara: { morning: [10, 1, 3], day: [9, 1, 4], evening: [8, 1, 3], night: [10, 1, 3] },
  rosa: { morning: [6, 1, 6], day: [4, 1, 6], evening: [6, 1, 6], night: [7, 1, 6] },
  gruk: { morning: [2, 1, 3], day: [2, 1, 4], evening: [3, 1, 3], night: [2, 1, 3] },
  orrin: { morning: [10, 1, 6], day: [9, 1, 6], evening: [10, 1, 4], night: [10, 1, 6] },
  veyra: { morning: [4, 1, 2], day: [4, 1, 3], evening: [5, 1, 2], night: [2, 1, 1] },
  bram: { morning: [7, 1, 11], day: [4, 1, 11], evening: [7, 1, 12], night: [7, 1, 11] },
};

/**
 * The wandering trader (trader.ts): the road comes in at the yard's south-east corner (the gate, where they arrive and leave) and
 * the stall stands in the yard's east half, clear of Old Bram's lean-to and the stairwell. Not in ROUTINES: the manager walks them
 * between these two spots as they come and go.
 */
export const TRADER_GATE: Spot = [12, 1, 13];
export const TRADER_SETTLE: Spot = [10, 1, 12];

/** Where the dancers gather while the jukebox plays: the floor in front of it (Gruk does not dance). */
export const DANCE_SPOTS: Readonly<Record<string, Spot>> = {
  mara: [6, 1, 3], rosa: [8, 1, 3], orrin: [10, 1, 3], veyra: [4, 1, 3], bram: [7, 1, 4],
};

/** Where the town gathers on a festival night beside the dancers: Gruk does not dance, but he comes in to watch by the floor. */
export const FEST_SPOTS: Readonly<Record<string, Spot>> = { gruk: [5, 1, 4] };

/** Where `id` should stand in `phase`, or null for someone without a routine (props). */
export const spotFor = (id: string, phase: Phase): Spot | null => ROUTINES[id]?.[phase] ?? null;

/** Moves `from` toward `to` by at most `step` blocks (x and z; the floor height follows the target). */
export function walk(from: readonly [number, number], to: readonly [number, number], step: number): [number, number] {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const d = Math.hypot(dx, dz);
  if (d <= step || d < 1e-6) return [to[0], to[1]];
  return [from[0] + (dx / d) * step, from[1] + (dz / d) * step];
}
