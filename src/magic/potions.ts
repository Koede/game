/**
 * Magic potions (docs/api/magic.md): brewed at the crucible (ALCHEMY rows brew_*: a catalyst dropped in while the pot holds
 * the essentia), drunk with Use. A draught runs for `seconds` and changes one factor of the body; Clarity is instant.
 */
export type PotionEffect = 'speed' | 'damage' | 'regen' | 'warp';
export interface PotionSpec { key: string; name: string; effect: PotionEffect; factor: number; seconds: number; text: string }

export const POTIONS: readonly PotionSpec[] = [
  { key: 'potion_haste', name: 'Draught of Haste', effect: 'speed', factor: 1.25, seconds: 120, text: 'A quarter faster on your feet for two minutes.' },
  { key: 'potion_stoneskin', name: 'Draught of Stoneskin', effect: 'damage', factor: 0.7, seconds: 120, text: 'Blows land three tenths lighter for two minutes.' },
  { key: 'potion_mending', name: 'Draught of Mending', effect: 'regen', factor: 1.6, seconds: 180, text: 'Health returns half again as quickly for three minutes.' },
  { key: 'potion_clarity', name: 'Draught of Clarity', effect: 'warp', factor: 2, seconds: 0, text: 'Lifts two points of warp at once.' },
];

export const potionSpec = (item: string | null | undefined): PotionSpec | null => POTIONS.find((p) => p.key === item) ?? null;

export interface PotionFactors { speed: number; damage: number; regen: number }

/** Factors of the draughts still running (`left`: potion key -> seconds). A second draught of the kind refreshes, never stacks. */
export function potionFactors(left: Readonly<Record<string, number>>): PotionFactors {
  const out: PotionFactors = { speed: 1, damage: 1, regen: 1 };
  for (const p of POTIONS) if ((left[p.key] ?? 0) > 0 && p.effect !== 'warp') out[p.effect] *= p.factor;
  return out;
}
