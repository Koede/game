/**
 * Vis (docs/api/magic.md): the raw magic a rod holds, one pool per primal aspect. A rod drinks vis from the land and from
 * wellsprings; a compound aspect drawn splits into its primals. Arcane work at the Rune Desk and every focus cast is paid
 * in vis. Essentia (aspects in vials and jars) is something else: it comes out of the crucible. Pure functions.
 */
import { aspectInfo, PRIMALS, type Aspect, type Aspects } from './aspects';

export type Primal = (typeof PRIMALS)[number];
export type Vis = Record<Primal, number>;

export const emptyVis = (): Vis => ({ cinder: 0, loam: 0, brook: 0, gale: 0, rune: 0, rift: 0 });
export const isPrimal = (a: Aspect): a is Primal => (PRIMALS as readonly string[]).includes(a);

/** The primal vis an aspect cost comes to: every compound broken down into its parts, recursively. */
export function primalsOf(cost: Aspects): Partial<Vis> {
  const out: Partial<Vis> = {};
  const add = (a: Aspect, n: number): void => {
    if (isPrimal(a)) {
      out[a] = (out[a] ?? 0) + n;
      return;
    }
    const parts = aspectInfo(a).parts;
    if (parts) for (const p of parts) add(p, n);
  };
  for (const [a, n] of Object.entries(cost) as [Aspect, number][]) if (n > 0) add(a, n);
  return out;
}

/** What `cost` lacks in `have` (primal -> missing units); empty when it can be paid. */
export function visShort(cost: Partial<Vis>, have: Vis): Partial<Vis> {
  const out: Partial<Vis> = {};
  for (const [p, n] of Object.entries(cost) as [Primal, number][]) if (have[p] < n) out[p] = n - Math.floor(have[p]);
  return out;
}

export const visText = (v: Partial<Vis>): string =>
  (Object.entries(v) as [Primal, number][]).filter(([, n]) => n > 0).map(([p, n]) => `${aspectInfo(p).name} ${Math.floor(n)}`).join(', ');
