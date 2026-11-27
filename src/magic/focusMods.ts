/**
 * Focus upgrade modifiers (docs/api/magic.md): three kinds of rune item applied at an Arcane Workbench or Rune Desk, each
 * stacking to MOD_MAX levels per focus. Reach lengthens what a focus can touch, power makes its effect stronger, cost lowers
 * the vis it takes. Pure tuning functions.
 */
export type ModKind = 'reach' | 'power' | 'cost';
export interface ModSpec { key: string; kind: ModKind; name: string; text: string }
export type FocusLevels = Record<ModKind, number>;

export const MOD_MAX = 3;
export const MODS: readonly ModSpec[] = [
  { key: 'focus_mod_reach', kind: 'reach', name: 'Rune of Reach', text: 'Reach: the Kindling and Light foci touch four blocks farther a level, the Blinking focus two.' },
  { key: 'focus_mod_power', kind: 'power', name: 'Rune of Power', text: 'Power: Kindling adds half a minute of fire a level; Warding is stronger and lasts ten seconds longer.' },
  { key: 'focus_mod_cost', kind: 'cost', name: 'Rune of Thrift', text: 'Thrift: every focus takes a seventh less vis a level (never less than one).' },
];

export const freshLevels = (): FocusLevels => ({ reach: 0, power: 0, cost: 0 });
export const modKind = (item: string): ModKind | null => MODS.find((m) => m.key === item)?.kind ?? null;

/** Vis cost of one primal after the Thrift levels. */
export const thriftCost = (n: number, level: number): number => Math.max(1, Math.floor(n * (1 - level / 7)));
/** How far (blocks) the Kindling and Light foci reach. */
export const rayReach = (level: number): number => 5 + 4 * level;
export const blinkRange = (base: number, level: number): number => base + 2 * level;
/** Warding: damage factor and seconds. */
export const wardTuning = (baseScale: number, baseS: number, power: number): { scale: number; seconds: number } => ({
  scale: Math.max(0.3, baseScale - 0.07 * power), seconds: baseS + 10 * power,
});
export const kindleBurnS = (power: number): number => 30 * power;
