/**
 * What the crates of the Old Works ruins hold (spec 14). src/world rolls a table with `rollLoot` from the registry
 * when it places a ruin's crate, seeded from the world seed and the crate's position.
 *
 * 'near' ruins (on the surface, within RUIN_DEEP_DISTANCE of spawn) give modest Ember Age help: the stuff of a first
 * furnace, a first fire and a first field, now and then a bucket or a flint tool. 'deep' ruins (far away, or buried
 * below the sea) are richer: metal, cable and the occasional thermopile - never anything past the Forge Age, so a
 * lucky find speeds the climb without skipping it (content tests hold both tables to that).
 */
import type { LootTableSpec } from '../core/types';

export const LOOT_TABLES: LootTableSpec[] = [
  {
    tier: 'near',
    rolls: [3, 5],
    entries: [
      { item: 'rubble', count: [4, 8], weight: 14 },
      { item: 'clay', count: [2, 4], weight: 12 },
      { item: 'coal', count: [2, 5], weight: 10 },
      { item: 'copper_ore', count: [2, 4], weight: 10 },
      { item: 'tin_ore', count: [1, 3], weight: 8 },
      { item: 'wheat_seeds', count: [2, 4], weight: 8 },
      { item: 'flint', count: [1, 3], weight: 6 },
      { item: 'charcoal', count: [2, 4], weight: 6 },
      { item: 'torch', count: [2, 4], weight: 6 },
      { item: 'potato', count: [1, 3], weight: 5 },
      { item: 'pail', count: 1, weight: 3 },
      { item: 'flint_pickaxe', count: 1, weight: 2 },
      { item: 'flint_axe', count: 1, weight: 2 },
      { item: 'flint_shovel', count: 1, weight: 2 },
    ],
  },
  {
    tier: 'deep',
    rolls: [3, 6],
    entries: [
      { item: 'coal', count: [4, 8], weight: 10 },
      { item: 'iron_ore', count: [2, 5], weight: 10 },
      { item: 'copper_ingot', count: [2, 4], weight: 8 },
      { item: 'iron_ingot', count: [1, 3], weight: 6 },
      { item: 'tin_ingot', count: [1, 3], weight: 6 },
      { item: 'copper_wire', count: [3, 6], weight: 6 },
      { item: 'copper_cable', count: [3, 6], weight: 6 },
      { item: 'firebrick', count: [2, 6], weight: 6 },
      { item: 'bronze_ingot', count: [1, 3], weight: 5 },
      { item: 'wheat_seeds', count: [3, 6], weight: 4 },
      { item: 'lamp', count: 1, weight: 3 },
      { item: 'thermopile', count: 1, weight: 2 },
      { item: 'bronze_bucket', count: 1, weight: 2 },
      { item: 'bronze_pickaxe', count: 1, weight: 2 },
      // Hidden research (src/magic/scrolls.ts): rare, and optional like all magic.
      { item: 'scroll_ledger', count: 1, weight: 1 },
      { item: 'scroll_verses', count: 1, weight: 1 },
      { item: 'scroll_margin', count: 1, weight: 1 },
    ],
  },
];
