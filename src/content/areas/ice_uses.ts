/**
 * Ice was harvestable (frozen ponds, frost spires) and went nowhere. Melted at a furnace it fills a pail, so a camp in the
 * frostfell never needs open water, 
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

export default {
  recipes: [
    { id: 'melt_ice', station: 'furnace', kind: 'forge', inputs: amounts('4 ice, 1 pail'), output: amount('water_pail'), minTempC: 150, minTier: 1, age: 0 },
  ],
} satisfies AreaContent;
