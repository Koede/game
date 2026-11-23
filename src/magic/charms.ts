/**
 * Rune-etched charms (docs/api/magic.md): small things made at the Arcane Workbench that work while they are carried in the
 * pack, one effect each, no charge. Pure table plus the fold of what is carried into factors.
 */
export interface CharmSpec { key: string; name: string; effect: 'damage' | 'speed' | 'food'; factor: number; text: string }

export const CHARMS: readonly CharmSpec[] = [
  { key: 'charm_ward', name: 'Charm of Warding', effect: 'damage', factor: 0.85, text: 'Carried, every blow you take is a sixth lighter.' },
  { key: 'charm_speed', name: 'Charm of Haste', effect: 'speed', factor: 1.1, text: 'Carried, you walk and run a tenth faster.' },
  { key: 'charm_hunger', name: 'Charm of Plenty', effect: 'food', factor: 0.75, text: 'Carried, hunger comes a quarter slower.' },
];

export interface BodyFactors { damage: number; speed: number; food: number }

/** The factors the charms carried give; one of each kind counts however many are carried. */
export function charmFactors(has: (item: string) => boolean): BodyFactors {
  const out: BodyFactors = { damage: 1, speed: 1, food: 1 };
  for (const c of CHARMS) if (has(c.key)) out[c.effect] *= c.factor;
  return out;
}
