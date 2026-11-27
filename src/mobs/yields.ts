/**
 * What a living animal gives without dying (docs/SYNERGY_TOOLS.md): a goat gives milk to a pail or beaker and wool to
 * shears or a blade, each on its own per-animal timer. The timers are seconds LEFT (never a timestamp), saved with the
 * animal, so a reload keeps a freshly milked goat waiting. Babies give nothing.
 */
import type { Mob } from './types';

export type YieldKind = 'milk' | 'wool' | 'egg';

/** Seconds a goat takes to give again. */
export const YIELD_COOLDOWN_S: Readonly<Record<YieldKind, number>> = { milk: 300, wool: 600, egg: 300 };
/** Species that give each yield. */
export const YIELDING_SPECIES: Readonly<Record<YieldKind, readonly string[]>> = { milk: ['goat'], wool: ['goat'], egg: ['hen'] };

export const yields = (species: string, kind: YieldKind): boolean => YIELDING_SPECIES[kind].includes(species);

/** Why an animal gives nothing right now (for a toast), or null when it will. */
export function yieldRefusal(m: Mob | undefined, kind: YieldKind): string | null {
  if (!m || m.state === 'dying') return 'Nothing there';
  const name = m.spec.name.toLowerCase();
  if (!yields(m.spec.key, kind)) return `A ${name} gives no ${kind}`;
  if (m.baby) return `This ${name} is too young`;
  const left = kind === 'milk' ? m.milkS : kind === 'wool' ? m.woolS : m.eggS;
  if (left > 0) {
    if (kind === 'milk') return `This ${name} was milked a while ago (${Math.ceil(left)} s)`;
    return kind === 'wool' ? `This ${name} is still shorn (${Math.ceil(left)} s)` : `This ${name} has no egg yet (${Math.ceil(left)} s)`;
  }
  return null;
}

/** True while a goat is shorn (the renderer may draw it thinner). */
export const isShorn = (m: Mob): boolean => m.woolS > 0;
