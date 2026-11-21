/**
 * Recipes of the Ember handwork (docs/api/handwork-content.md section 6). Stroke recipes name the station block as their
 * `station` and carry `strokes`; timed ones (trough, rack, alloy pot) carry `timeS`. The recipes these REPLACE (planks,
 * sticks, flour, copper wire, bronze, bronze tools) are gone from recipes.ts. Appended after every older recipe.
 */
import type { RecipeSpec } from '../core/types';
import { amount, amounts } from './amounts';

const age = 0;
const hand = (id: string, output: string, inputs: string): RecipeSpec => ({ id, station: 'hand', inputs: amounts(inputs), output: amount(output), age });
const bench = (id: string, output: string, inputs: string, byproducts?: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age, ...(byproducts ? { byproducts: amounts(byproducts) } : {}),
});
const smelt = (id: string, output: string, input: string, minTempC: number, timeS: number): RecipeSpec => ({
  id, station: 'furnace', kind: 'smelt', inputs: [amount(input)], output: amount(output), minTempC, timeS, minTier: 1, age,
});
const forge = (output: string, inputs: string, minTempC: number): RecipeSpec => ({
  id: amount(output).item, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier: 1, age,
});
const strokes = (id: string, station: string, output: string, inputs: string, n: number, extra: Partial<RecipeSpec> = {}): RecipeSpec => ({
  id, station, inputs: amounts(inputs), output: amount(output), strokes: n, age, ...extra,
});
const timed = (id: string, station: string, output: string, inputs: string, timeS: number, extra: Partial<RecipeSpec> = {}): RecipeSpec => ({
  id, station, inputs: amounts(inputs), output: amount(output), timeS, age, ...extra,
});

/** Clay worked on the table: four strokes a piece. */
const CLAY_STROKES = 4;
const CLAY_PIECES: Array<[output: string, count: number, clay: number]> = [
  ['unfired_cup', 2, 2], ['unfired_cone', 2, 2], ['unfired_alloy_pot', 1, 4], ['unfired_ingot_mould', 1, 2],
  ['unfired_pickaxe_mould', 1, 3], ['unfired_axe_mould', 1, 3], ['unfired_shovel_mould', 1, 3], ['unfired_hoe_mould', 1, 3], ['unfired_maul_mould', 1, 3],
];
/** Fired in a crucible: [fired item, unfired item, recipe id]. */
const FIRED: Array<[string, string, string]> = [
  ['clay_cup', 'unfired_cup', 'clay_cup_fired'], ['drip_cone', 'unfired_cone', 'drip_cone_fired'], ['alloy_pot', 'unfired_alloy_pot', 'alloy_pot'],
  ['ingot_mould', 'unfired_ingot_mould', 'ingot_mould'], ['pickaxe_mould', 'unfired_pickaxe_mould', 'pickaxe_mould'],
  ['axe_mould', 'unfired_axe_mould', 'axe_mould'], ['shovel_mould', 'unfired_shovel_mould', 'shovel_mould'],
  ['hoe_mould', 'unfired_hoe_mould', 'hoe_mould'], ['maul_mould', 'unfired_maul_mould', 'maul_mould'],
];

/** A bronze tool: its cast head, two sticks and cord. */
const tool = (kind: string, sticks = 2): RecipeSpec => bench(`bronze_${kind}`, `bronze_${kind}`, `1 bronze_${kind}_head, ${sticks} stick, 1 cord`);

export const HAND_RECIPES: RecipeSpec[] = [
  // The stations themselves.
  hand('chopping_block', 'chopping_block', '1 oak_log'),
  hand('chopping_block_pine', 'chopping_block', '1 pine_log'),
  hand('drying_rack', 'drying_rack', '3 stick, 1 cord'),
  hand('flint_hammer', 'flint_hammer', '2 flint, 2 stick, 1 cord'),
  bench('hand_quern', 'hand_quern', '2 stone_brick, 1 stick'),
  bench('stone_anvil', 'stone_anvil', '3 stone_brick'),
  bench('clay_table', 'clay_table', '2 plank, 1 clay'),
  bench('loom', 'loom', '4 plank, 2 stick, 2 cord'),
  bench('tanning_trough', 'tanning_trough', '4 plank, 1 water_pail', '1 pail'),
  bench('bronze_hammer', 'bronze_hammer', '2 bronze_ingot, 2 stick, 1 cord'),
  forge('mortar', '1 clay', 400),
  forge('casting_bench', '2 stone_brick, 1 clay', 400),
  // Tools: a cast head, sticks and cord (these replace the instant forge recipes).
  tool('pickaxe'), tool('axe'), tool('shovel'), tool('hoe'), tool('maul'),

  // Chopping Block: the axe doubles strokes and yields six planks, not four.
  strokes('plank', 'chopping_block', '4 plank', '1 oak_log', 3, { toolOutput: amount('6 plank') }),
  strokes('plank_pine', 'chopping_block', '4 plank', '1 pine_log', 3, { toolOutput: amount('6 plank') }),
  strokes('stick', 'chopping_block', '4 stick', '1 plank', 2),
  // Hand Quern.
  strokes('flour', 'hand_quern', 'flour', '1 wheat', 6),
  // Stone Anvil: plates and wire (hot work halves the strokes).
  strokes('copper_plate', 'stone_anvil', 'copper_plate', '2 copper_ingot', 8),
  strokes('bronze_plate', 'stone_anvil', 'bronze_plate', '2 bronze_ingot', 8),
  strokes('copper_wire', 'stone_anvil', '3 copper_wire', '1 copper_ingot', 6),
  // Mortar: ore stretching, a second portion 35% of the time.
  strokes('crushed_copper_mortar', 'mortar', 'crushed_copper', '1 copper_ore', 8, { bonus: { ...amount('crushed_copper'), chance: 0.35 } }),
  strokes('crushed_tin_mortar', 'mortar', 'crushed_tin', '1 tin_ore', 8, { bonus: { ...amount('crushed_tin'), chance: 0.35 } }),
  // Loom.
  strokes('cloth', 'loom', 'cloth', '4 fiber', 10),
  // Clay Table.
  ...CLAY_PIECES.map(([out, count, clay]) => strokes(out, 'clay_table', `${count} ${out}`, `${clay} clay`, CLAY_STROKES)),
  // Timed: the trough, the rack and the alloy pot.
  timed('soaked_hide', 'tanning_trough', '2 soaked_hide', '2 hide', 60),
  timed('leather', 'drying_rack', '2 leather', '2 soaked_hide', 120),
  timed('bronze_ingot_alloy', 'alloy_pot', '4 bronze_ingot', '3 copper_ingot, 1 tin_ingot', 8, { minTempC: 800 }),
  // Firing and re-smelting in the crucible.
  ...FIRED.map(([out, from, id]) => smelt(id, out, from, 500, 8)),
  smelt('copper_ingot_bloom', 'copper_ingot', 'copper_bloom', 700, 6),
  smelt('tin_ingot_bloom', 'tin_ingot', 'tin_bloom', 250, 5),
  smelt('bronze_ingot_bloom', 'bronze_ingot', 'bronze_bloom', 800, 6),
];
