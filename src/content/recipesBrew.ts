/**
 * Recipes of brewing (BREWING_PLAN 3, 11.1). All at furnace tier 1: the Clay Furnace. Crucible recipes need unique
 * inputs, so the cup and cone are forge recipes (clay already smelts to firebrick). Appended after every older recipe.
 */
import type { RecipeSpec } from '../core/types';
import { amount, amounts } from './amounts';

const smelt = (output: string, input: string, minTempC: number, timeS: number): RecipeSpec => ({
  id: output, station: 'furnace', kind: 'smelt', inputs: [amount(input)], output: amount(output), minTempC, timeS, minTier: 1, age: 0,
});
const forge = (output: string, inputs: string, minTempC: number): RecipeSpec => ({
  id: amount(output).item, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier: 1, age: 0,
});
const bench = (output: string, inputs: string): RecipeSpec => ({
  id: amount(output).item, station: 'workbench', inputs: amounts(inputs), output: amount(output), age: 0,
});

export const BREW_RECIPES: RecipeSpec[] = [
  forge('2 clay_cup', '1 clay', 400),
  forge('drip_cone', '1 clay, 1 fiber', 400),
  forge('kettle_pot', '3 copper_ingot', 600),
  smelt('dried_tea', 'tea_leaves', 150, 5),
  smelt('black_tea', 'dried_tea', 250, 6),
  smelt('roasted_beans', 'coffee_cherries', 220, 8),
  // The one dark roast step: 400 C needs charcoal or the bellows in a Clay Furnace.
  smelt('dark_beans', 'roasted_beans', 400, 8),
  bench('ground_coffee', '2 roasted_beans'),
  bench('ground_dark_coffee', '2 dark_beans'),
  bench('berry_tea_blend', '1 dried_tea, 2 wildberries'),
  bench('2 trail_blend', '1 ground_coffee, 1 ground_dark_coffee'),
];
