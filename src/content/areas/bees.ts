/**
 * Bees and pollination: the beehive (a block you work by Use, like the boiler's gauge glass), what it gives (honeycomb,
 * honey, beeswax) and what those make. The hive's behaviour (a swarm moving in, flying by day, filling combs, the
 * pollination boost on nearby crops) lives in src/sim/apiary.ts and src/sim/crops.ts. Data only.
 */
import type { AreaContent } from '../area';
import type { RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const age = 0;
const bench = (id: string, output: string, inputs: string, byproducts?: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age, ...(byproducts ? { byproducts: amounts(byproducts) } : {}),
});
const forge = (id: string, output: string, inputs: string, minTempC: number, byproducts?: string): RecipeSpec => ({
  id, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier: 1, age,
  ...(byproducts ? { byproducts: amounts(byproducts) } : {}),
});

export default {
  blocks: [
    {
      key: 'beehive', name: 'Beehive', category: 'machine', age, hardness: 1.2, tool: 'axe', machine: 'beehive',
      desc: 'Wooden boxes for bees. Set it near flowers or crops and wild bees move in, fill honeycomb and make crops within 5 blocks grow faster. Hold a Bee Smoker to take comb.',
      textures: { top: 'beehive_top', bottom: 'beehive_top', side: 'beehive_side' },
    },
    {
      key: 'beeswax_candle', name: 'Beeswax Candle', category: 'block', age, shape: 'torch', hardness: 0.1, light: 12, warmth: 1,
      desc: 'A fat honey-coloured candle. It burns clean and bright, and the room smells of summer.',
      textures: { all: 'beeswax_candle' },
    },
  ],
  items: [
    { key: 'honeycomb', name: 'Honeycomb', desc: 'A slab of wax cells heavy with honey, lifted from a beehive. Press it at the workbench into a glass beaker: honey and beeswax.', category: 'material', age, stack: 32 },
    { key: 'honey', name: 'Beaker of Honey', desc: 'Golden honey in a glass beaker. Eat it for a short Sugar Rush, bake it into a honey cake, or boil it down to sugar at the furnace.', category: 'food', age, stack: 16, food: { hunger: 2, buff: 'sugar_rush', buffS: 60 } },
    { key: 'beeswax', name: 'Beeswax', desc: 'A soft yellow cake of wax, left over when honeycomb is pressed. Wrap it round a cord for candles.', category: 'material', age, stack: 32 },
    { key: 'bee_smoker', name: 'Bee Smoker', desc: 'A little wooden bellows with a smouldering fiber can. Hold it while you take honeycomb and the bees stay calm instead of stinging.', category: 'tool', age, stack: 1 },
    { key: 'honey_cake', name: 'Honey Cake', desc: 'A soft brown cake baked with honey. A big meal and a long Sugar Rush.', category: 'food', age, stack: 8, food: { hunger: 9, buff: 'sugar_rush', buffS: 240 } },
  ],
  machines: [
    // beehive - one entity per hive (never a machine node; role 'brew' routes Use and the crosshair line through the
    // simulation like the boiler's glass). params:
    //   reach      flowers, crops and bushes within this many blocks (horizontally, 2 up or down) are forage; crops
    //              in reach of a settled hive are pollinated
    //   boost      growth multiplier of a pollinated crop while the bees are out (by day, dry, not winter)
    //   settleS    seconds of flying weather beside forage before a swarm moves into an empty hive
    //   combS      seconds of full foraging per honeycomb (fullForage forage blocks or more; fewer is slower)
    //   fullForage forage blocks that keep the bees at full pace
    //   maxCombs   honeycomb a hive holds before it stops filling
    {
      kind: 'beehive', name: 'Beehive', role: 'brew', blocks: ['beehive'],
      params: { reach: 5, boost: 1.5, settleS: 20, combS: 180, fullForage: 8, maxCombs: 3 },
      desc: 'Bees forage the flowers and crops round it by day, filling honeycomb and pollinating the crops so they grow half again as fast.',
      placementHint: 'Set it among flowers or beside a field.',
    },
  ],
  recipes: [
    bench('beehive', '1 beehive', '5 plank, 3 fiber'),
    bench('bee_smoker', '1 bee_smoker', '2 plank, 1 cord, 2 fiber'),
    bench('honey', '1 honey', '1 honeycomb, 1 glass_beaker', '1 beeswax'),
    bench('beeswax_candle', '2 beeswax_candle', '1 beeswax, 1 cord'),
    forge('honey_cake', '2 honey_cake', '2 flour, 2 honey', 200, '2 glass_beaker'),
    forge('sugar_honey', '2 sugar', '1 honey', 160, '1 glass_beaker'),
  ],
} satisfies AreaContent;
