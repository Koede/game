/**
 * Fishing (docs/api/fishing.md): a rod, four fish and the furnace dishes. The catch rules are src/sim/fishing.ts and the
 * tables src/content/fishing.ts; the progression solver counts the fish as obtainable once a rod is (progression.ts).
 */
import type { AreaContent } from '../area';
import type { ItemSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';
import { FISHING_ROD, FISHING_ROD_WEAR } from '../fishing';

const raw = (key: string, name: string, desc: string): ItemSpec => ({ key, name, desc, category: 'food', age: 0, food: { hunger: 2 } });
const cooked = (key: string, name: string, desc: string, hunger: number): ItemSpec => ({ key, name, desc, category: 'food', age: 0, food: { hunger } });
const cook = (fish: string, out: string, tempC: number, timeS: number): RecipeSpec => ({
  id: out, station: 'furnace', kind: 'smelt', inputs: [amount(fish)], output: amount(out), minTempC: tempC, timeS, minTier: 1, age: 0,
});

export default {
  items: [
    { key: FISHING_ROD, name: 'Fishing Rod', desc: 'A long stick, cord and a flint hook. Hold it and Use on water to cast, Use again when the line twitches.', category: 'tool', age: 0, stack: 1, wear: FISHING_ROD_WEAR },
    raw('raw_perch', 'Raw Perch', 'A striped little fish from still water. Barely a bite raw; the furnace makes a meal of it.'),
    raw('raw_trout', 'Raw Trout', 'A speckled river fish, quick in rain and in the frostfell pools.'),
    raw('raw_eel', 'Raw Eel', 'A slick marsh eel that bites after dark.'),
    raw('raw_glowfin', 'Raw Glowfin', 'A pale fish that glows faintly, caught in cave lakes.'),
    cooked('cooked_perch', 'Fried Perch', 'Perch fried crisp in the furnace.', 5),
    cooked('cooked_trout', 'Baked Trout', 'Trout baked until it flakes.', 6),
    cooked('cooked_eel', 'Smoked Eel', 'Eel smoked dark and rich; a hearty meal.', 7),
    cooked('cooked_glowfin', 'Roast Glowfin', 'Glowfin roasted over the coals. It still glimmers a little.', 6),
  ],
  recipes: [
    { id: FISHING_ROD, station: 'hand', inputs: amounts('2 stick, 1 cord, 1 flint'), output: amount(FISHING_ROD), age: 0 },
    cook('raw_perch', 'cooked_perch', 180, 6),
    cook('raw_trout', 'cooked_trout', 190, 7),
    cook('raw_eel', 'cooked_eel', 200, 9),
    cook('raw_glowfin', 'cooked_glowfin', 190, 7),
  ],
} satisfies AreaContent;
