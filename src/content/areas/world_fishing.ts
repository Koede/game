/**
 * Fishing (docs/api/fishing.md): a rod, nine fish and the furnace dishes. The catch rules are src/sim/fishing.ts and the
 * tables src/content/fishing.ts; the progression solver counts the fish as obtainable once a rod is (progression.ts).
 */
import type { AreaContent } from '../area';
import type { ItemSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';
import { FISHING_ROD, FISHING_ROD_WEAR, FISH_CHOWDER_BUFF_S, WINTER_BROTH_BUFF_S } from '../fishing';

const raw = (key: string, name: string, desc: string): ItemSpec => ({ key, name, desc, category: 'food', age: 0, food: { hunger: 2 } });
const cooked = (key: string, name: string, desc: string, hunger: number): ItemSpec => ({ key, name, desc, category: 'food', age: 0, food: { hunger } });
const cook = (fish: string, out: string, tempC: number, timeS: number, id = out): RecipeSpec => ({
  id, station: 'furnace', kind: 'smelt', inputs: [amount(fish)], output: amount(out), minTempC: tempC, timeS, minTier: 1, age: 0,
});

/** A pot dish at the Clay Furnace (like the hearth stew): cooked fish, a root and a pail of water; the pail comes back. */
const pot = (id: string, out: string, inputs: string, timeS: number): RecipeSpec => ({
  id, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(out), minTempC: 280, timeS, minTier: 1, age: 0, byproducts: amounts('1 pail'),
});
/** Cooked fish that go into the chowder (potato) and the winter broth (carrot). */
const CHOWDER_FISH = ['perch', 'trout', 'salmon', 'pike', 'carp'] as const;
const BROTH_FISH = ['whitefish', 'trout', 'pike'] as const;

export default {
  items: [
    { key: FISHING_ROD, name: 'Fishing Rod', desc: 'A long stick, cord and a flint hook. Hold it and Use on water to cast, Use again when the line twitches.', category: 'tool', age: 0, stack: 1, wear: FISHING_ROD_WEAR },
    raw('raw_perch', 'Raw Perch', 'A striped little fish from still water. Barely a bite raw; the furnace makes a meal of it.'),
    raw('raw_trout', 'Raw Trout', 'A speckled river fish, quick in rain and in the frostfell pools.'),
    raw('raw_eel', 'Raw Eel', 'A slick marsh eel that bites after dark.'),
    raw('raw_glowfin', 'Raw Glowfin', 'A pale fish that glows faintly, caught in cave lakes.'),
    raw('raw_salmon', 'Raw Salmon', 'A fat river fish that runs upstream in autumn, and is gone from the water by winter.'),
    raw('raw_pike', 'Raw Pike', 'A long toothy lake fish. It bites hardest in the cold months.'),
    raw('raw_carp', 'Raw Carp', 'A broad, slow fish of warm shallows. Plentiful in summer, sulky in winter.'),
    raw('raw_whitefish', 'Raw Whitefish', 'A pale fish of the cold deep, pulled up through the ice. The best catch of midwinter.'),
    raw('raw_crayfish', 'Raw Crayfish', 'A little armoured crawler of marsh and stream, out mostly at night in the warm months.'),
    cooked('cooked_perch', 'Fried Perch', 'Perch fried crisp in the furnace.', 5),
    cooked('cooked_trout', 'Baked Trout', 'Trout baked until it flakes.', 6),
    cooked('cooked_eel', 'Smoked Eel', 'Eel smoked dark and rich; a hearty meal.', 7),
    cooked('cooked_glowfin', 'Roast Glowfin', 'Glowfin roasted over the coals. It still glimmers a little.', 6),
    cooked('cooked_salmon', 'Baked Salmon', 'Salmon baked rosy and rich: the finest fish dish there is.', 8),
    cooked('cooked_pike', 'Roast Pike', 'Pike roasted whole over the coals.', 6),
    cooked('cooked_carp', 'Fried Carp', 'Carp fried golden, a little muddy and very filling.', 5),
    cooked('cooked_whitefish', 'Smoked Whitefish', 'Whitefish smoked pale gold, a winter larder staple.', 6),
    cooked('cooked_crayfish', 'Boiled Crayfish', 'A handful of crayfish boiled bright red. Fiddly and sweet.', 4),
    { key: 'fish_chowder', name: 'Fish Chowder', desc: 'Cooked fish, potato and water simmered thick at the furnace. Filling, and it leaves you Well-Fed.', category: 'food', age: 0, stack: 16, food: { hunger: 10, buff: 'well_fed', buffS: FISH_CHOWDER_BUFF_S } },
    { key: 'winter_broth', name: 'Winter Broth', desc: 'A scalding fish broth with carrot. It leaves you Well-Warmed, so the frost bites half as hard.', category: 'food', age: 0, stack: 16, food: { hunger: 6, buff: 'well_warmed', buffS: WINTER_BROTH_BUFF_S } },
  ],
  recipes: [
    { id: FISHING_ROD, station: 'hand', inputs: amounts('2 stick, 1 cord, 1 flint'), output: amount(FISHING_ROD), age: 0 },
    cook('raw_perch', 'cooked_perch', 180, 6),
    cook('raw_trout', 'cooked_trout', 190, 7),
    cook('raw_eel', 'cooked_eel', 200, 9),
    cook('raw_glowfin', 'cooked_glowfin', 190, 7),
    cook('raw_salmon', 'cooked_salmon', 200, 9),
    cook('raw_pike', 'cooked_pike', 190, 8),
    cook('raw_carp', 'cooked_carp', 180, 7),
    cook('raw_whitefish', 'cooked_whitefish', 190, 8),
    cook('raw_crayfish', 'cooked_crayfish', 170, 5),
    ...CHOWDER_FISH.map((f) => pot(f === 'perch' ? 'fish_chowder' : `fish_chowder_${f}`, 'fish_chowder', `1 cooked_${f}, 1 potato, 1 water_pail`, 240)),
    ...BROTH_FISH.map((f) => pot(f === 'whitefish' ? 'winter_broth' : `winter_broth_${f}`, 'winter_broth', `1 cooked_${f}, 1 carrot, 1 water_pail`, 200)),
  ],
} satisfies AreaContent;
