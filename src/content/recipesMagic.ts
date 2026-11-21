/**
 * Recipes of Essentia & Research (docs/OVERHAUL_PLAN.md B). The notebook is a hand recipe from minute one; the vial,
 * rod and jar are gated by research (src/magic/entries.ts `unlocks.recipes`), checked in game/crafting.ts.
 */
import type { RecipeSpec } from '../core/types';
import { amount, amounts } from './amounts';

export const MAGIC_RECIPES: RecipeSpec[] = [
  { id: 'field_notebook', station: 'hand', inputs: amounts('1 plank, 3 fiber, 1 charcoal'), output: amount('field_notebook'), age: 0 },
  { id: 'vis_rod', station: 'workbench', inputs: amounts('2 stick, 1 glass_vial, 1 copper_ingot'), output: amount('vis_rod'), age: 0 },
  { id: 'essentia_jar', station: 'workbench', inputs: amounts('3 glass, 1 plank'), output: amount('essentia_jar'), age: 0 },
  {
    id: 'glass_vial', station: 'furnace', kind: 'forge', inputs: amounts('1 glass'), output: amount('4 glass_vial'),
    minTempC: 650, minTier: 1, age: 0,
  },
];
