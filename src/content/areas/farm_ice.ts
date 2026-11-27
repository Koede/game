/**
 * A use for ice (frost spires and frozen ponds drop it): melt it in a pail for water when every pond is frozen, or
 * freeze berries and sugar into a cold treat. Data only.
 */
import type { AreaContent } from '../area';
import type { ItemSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const age = 0;
const bench = (id: string, output: string, inputs: string, byproducts?: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age, ...(byproducts ? { byproducts: amounts(byproducts) } : {}),
});
const items: ItemSpec[] = [
  { key: 'berry_ice', name: 'Berry Ice', desc: 'Crushed ice, wildberries and a little sugar: a bright cold treat. Fills a little, and tastes best in a hot room.', category: 'food', age, stack: 16, food: { hunger: 4 } },
];
export default {
  items,
  recipes: [
    // Ice in a pail melts to water (the pail is the container): water when every pond is frozen over.
    bench('melt_ice', '1 water_pail', '2 ice, 1 pail'),
    bench('berry_ice', '2 berry_ice', '2 wildberries, 1 sugar, 1 ice'),
  ],
} satisfies AreaContent;
