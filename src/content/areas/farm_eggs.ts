/**
 * Hen eggs: a hen gives an egg to an empty hand once every five minutes (src/mobs/yields.ts, src/player/animals.ts).
 * Raw, an egg is a thin snack; fried at a barely warm furnace it is a real meal, and it stretches dough and enriches cakes.
 * Data only.
 */
import type { AreaContent } from '../area';
import type { ItemSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const age = 0;
const forge = (id: string, output: string, inputs: string, minTempC: number): RecipeSpec => ({
  id, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier: 1, age,
});
const bench = (id: string, output: string, inputs: string, byproducts: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age, byproducts: amounts(byproducts),
});
const fry = (id: string, output: string, input: string, minTempC: number, timeS: number): RecipeSpec => ({
  id, station: 'furnace', kind: 'smelt', inputs: [amount(input)], output: amount(output), minTempC, timeS, minTier: 1, age,
});
const egg: ItemSpec[] = [
  { key: 'egg', name: 'Egg', desc: 'A warm brown egg. Use an empty hand on a hen to take one (she lays another in five minutes). Eat it raw, fry it, or beat it into dough.', category: 'food', age, stack: 16, food: { hunger: 2 } },
  { key: 'fried_egg', name: 'Fried Egg', desc: 'An egg fried hard in a crucible at 160 C. Hot, plain and filling.', category: 'food', age, stack: 16, food: { hunger: 5 } },
];
export default {
  items: egg,
  recipes: [
    fry('fried_egg', 'fried_egg', 'egg', 160, 6),
    bench('dough_egg', '3 dough', '2 flour, 1 egg, 1 water_pail', '1 pail'),
    forge('sugar_cake_egg', '2 sugar_cake', '2 flour, 2 sugar, 2 egg', 200),
  ],
} satisfies AreaContent;
