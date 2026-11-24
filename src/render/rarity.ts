/**
 * Loot rarity for dropped items: derived from the technology age an item first becomes obtainable in, so late-game
 * metals and machine parts read as treasure from across a base while sticks and pebbles stay plain.
 * Pure data, no GL: the ground-item renderer turns the colour into a glow and a light beam.
 */
import { rarityOf } from '../core/registry';
import type { ItemDef } from '../core/types';

export type Rarity = 0 | 1 | 2 | 3 | 4;

/** Glow colour (0..1 RGB) per rarity; common has none. */
export const RARITY_COLOUR: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0.45, 0.95, 0.5], // uncommon: green
  [0.4, 0.7, 1.0], // rare: blue
  [0.8, 0.5, 1.0], // epic: violet
  [1.0, 0.8, 0.3], // legendary: gold
];

/** Ages 0 and 1 (Ember, Bronze) are common; each later age is one step rarer, capped at legendary. */
export function rarityOfAge(age: number): Rarity {
  return Math.max(0, Math.min(4, Math.floor(age) - 1)) as Rarity;
}

/** Heavy gear is a step rarer than materials of the same age; the result never exceeds legendary. */
const NAMED_RARITY = { common: 0, fine: 1, rare: 2, legendary: 4 } as const;

/** A named item's own rarity (src/content/loot.ts ITEM_RARITY) wins when it is higher than what its age gives. */
export function itemRarity(def: Pick<ItemDef, 'age' | 'weapon' | 'armour'> & { key?: string }): Rarity {
  const bump = (def.weapon || def.armour) && def.age >= 1 ? 1 : 0;
  const named = def.key ? NAMED_RARITY[rarityOf(def.key)] : 0;
  return Math.max(named, Math.min(4, rarityOfAge(def.age) + bump)) as Rarity;
}
