/**
 * Goat milk and wool (docs/SYNERGY_TOOLS.md): items, the bedding block and every recipe that ties them into brewing,
 * baking, stews, the sugar chain, the loom, coats, bellows and the hand stations. The milking and shearing Uses are in
 * src/player/animals.ts and src/mobs/manager.ts (harvest). Data only.
 */
import type { AreaContent } from '../area';
import type { ItemSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const age = 0;
const bench = (id: string, output: string, inputs: string, byproducts?: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age, ...(byproducts ? { byproducts: amounts(byproducts) } : {}),
});
const forge = (id: string, output: string, inputs: string, minTempC: number, byproducts?: string): RecipeSpec => ({
  id, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier: 1, age,
  ...(byproducts ? { byproducts: amounts(byproducts) } : {}),
});
const strokes = (id: string, station: string, output: string, inputs: string, n: number): RecipeSpec => ({
  id, station, inputs: amounts(inputs), output: amount(output), strokes: n, age,
});
const timed = (id: string, station: string, output: string, inputs: string, timeS: number): RecipeSpec => ({
  id, station, inputs: amounts(inputs), output: amount(output), timeS, age,
});
/** A mug of milky tea or coffee: eaten like food (it is not one of the six brewed drinks, whose buffs and six_cups are fixed). */
const milky = (key: string, name: string, desc: string): ItemSpec => ({
  key, name, desc, category: 'food', age, stack: 8, food: { hunger: 5, buff: 'well_fed', buffS: 120 },
});
export default {
  items: [
    { key: 'milk_pail', name: 'Bucket of Goat Milk', desc: 'A bucket of warm goat milk. Use an empty bucket on a goat to fill it. Bakes into stews and cakes; the bucket comes back.', category: 'misc', age, stack: 8 },
    { key: 'milk_beaker', name: 'Beaker of Goat Milk', desc: 'A glass beaker of goat milk. Use an empty beaker on a goat. Stirs into tea and coffee, makes dough, and sets as cheese or butter.', category: 'misc', age, stack: 16 },
    { key: 'wool', name: 'Wool', desc: 'A greasy fleece, sheared from a goat with shears or a blade. Weave it at the loom, quilt it into a coat, pad a bellows with it.', category: 'material', age },
    { key: 'shears', name: 'Shears', desc: 'Two bronze blades on a spring. Use on a goat to take its wool; a goat grows it back in ten minutes.', category: 'tool', age, stack: 1, wear: 48 },
    { key: 'cheese', name: 'Goat Cheese', desc: 'A hard white wheel, cured on the drying rack. Filling, and keeps its goodness.', category: 'food', age, stack: 16, food: { hunger: 8, buff: 'well_fed', buffS: 60 } },
    { key: 'butter', name: 'Butter', desc: 'Milk churned in the mortar. Folded into dough it bakes two loaves of bread from one.', category: 'material', age },
    milky('milk_tea', 'Milk Tea', 'Dried tea steeped with goat milk in a cup, eaten warm: fills you up and keeps you well fed for two minutes.'),
    milky('milk_coffee', 'Milk Coffee', 'Ground coffee stirred with goat milk in a cup: fills you up and keeps you well fed for two minutes.'),
  ],
  blocks: [
    // Drawn as a single-cell bed by the miniblock model in src/world/bedModel.ts; its materials are listed here for the atlas.
    { key: 'wool_bedding', name: 'Wool Bedding', desc: 'A low bed of boards and wool: a plank frame, a cream mattress, a red blanket folded at the foot and a pillow. Warm to lie beside, soft to look at.', shape: 'slab', hardness: 0.8, tool: 'axe', warmth: 1, category: 'block', oriented: true, textures: { all: 'wool_bedding', models:['bed_frame', 'bed_mattress', 'bed_blanket', 'bed_pillow'] } },
  ],
  recipes: [
    bench('shears', '1 shears', '2 bronze_plate, 1 stick, 1 cord'),
    bench('milk_tea', '1 milk_tea', '1 dried_tea, 1 milk_beaker, 1 clay_cup', '1 glass_beaker'),
    bench('milk_coffee', '1 milk_coffee', '1 ground_coffee, 1 milk_beaker, 1 clay_cup', '1 glass_beaker'),
    bench('dough_milk', '2 dough', '1 flour, 1 milk_beaker', '1 glass_beaker'),
    bench('padded_coat_wool', '1 padded_coat', '6 wool, 2 cord'),
    bench('bellows_wool', '1 bellows', '4 plank, 3 wool'),
    bench('wool_bedding', '2 wool_bedding', '3 wool, 2 plank'),
    forge('hearth_stew_milk', '2 hearth_stew', '1 cooked_mutton, 1 potato, 1 carrot, 1 milk_pail', 300, '1 pail'),
    forge('sugar_cake_milk', '2 sugar_cake', '2 flour, 2 sugar, 1 milk_pail', 200, '1 pail'),
    forge('bread_butter', '2 bread', '1 dough, 1 butter', 220),
    strokes('cloth_wool', 'loom', '2 cloth', '2 wool', 8),
    strokes('butter', 'mortar', 'butter', '2 milk_beaker', 8),
    timed('cheese', 'drying_rack', 'cheese', '2 milk_beaker', 180),
  ],
} satisfies AreaContent;
