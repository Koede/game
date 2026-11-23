/**
 * The crucible (docs/api/magic.md): a pot of water over heat. Items dropped in dissolve into their aspects as essentia;
 * a catalyst dropped in while the right essentia is there turns into something else (ALCHEMY); an empty vial dipped in
 * bottles one vial of the richest aspect. More than CRUCIBLE_CAP units boils away as flux. Pure functions on a plain state.
 */
import { ASPECT_LIST, type Aspect, type Aspects } from './aspects';
import { shortfall } from './essentiaNet';

export const CRUCIBLE_CAP = 64;

export interface CrucibleState { water: boolean; ess: Aspects }
export const freshCrucible = (): CrucibleState => ({ water: false, ess: {} });

export const crucibleTotal = (c: CrucibleState): number => ASPECT_LIST.reduce((s, a) => s + (c.ess[a] ?? 0), 0);

/** Adds an item's aspects; returns how many units boiled away over the cap. */
export function dissolve(c: CrucibleState, fingerprint: Aspects): number {
  let spilled = 0;
  for (const a of ASPECT_LIST) {
    const n = fingerprint[a] ?? 0;
    if (n <= 0) continue;
    const room = CRUCIBLE_CAP - crucibleTotal(c);
    const kept = Math.max(0, Math.min(n, room));
    if (kept > 0) c.ess[a] = (c.ess[a] ?? 0) + kept;
    spilled += n - kept;
  }
  return spilled;
}

/** Takes `units` of the richest aspect that has that many; returns it, or null. */
export function bottle(c: CrucibleState, units: number): Aspect | null {
  let best: Aspect | null = null;
  for (const a of ASPECT_LIST) if ((c.ess[a] ?? 0) >= units && (!best || (c.ess[a] ?? 0) > (c.ess[best] ?? 0))) best = a;
  if (!best) return null;
  take(c, { [best]: units });
  return best;
}

export const canPay = (c: CrucibleState, cost: Aspects): boolean => Object.keys(shortfall(cost, c.ess)).length === 0;

export function take(c: CrucibleState, cost: Aspects): void {
  for (const [a, n] of Object.entries(cost) as [Aspect, number][]) {
    const left = (c.ess[a] ?? 0) - n;
    if (left > 0) c.ess[a] = left;
    else delete c.ess[a];
  }
}
