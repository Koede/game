/**
 * Test fixture for content.test.ts: the roster of spec section 12 (food, farming and animals), typed in a second
 * time from the design document. specRoster.ts merges its blocks, items and block properties into the section 2
 * roster; the rest is checked by the food tests. Nothing but the tests imports this file.
 */
import type { BiomeKey, BlockDef, Drop } from '../core/types';

const crop = (key: string, ripe: Drop[], seed: string): Record<string, Partial<BlockDef>> => {
  const props: Record<string, Partial<BlockDef>> = {};
  for (let stage = 0; stage < 4; stage++) {
    props[`${key}_${stage}`] = {
      shape: 'cross', hardness: 0, itemKey: null, placeOn: ['farmland'], machine: 'crop',
      drops: stage === 3 ? ripe : [{ item: seed, count: 1 }],
    };
  }
  return props;
};

export const FOOD_SPEC = {
  blocks: [
    'farmland',
    'wheat_0', 'wheat_1', 'wheat_2', 'wheat_3',
    'potato_0', 'potato_1', 'potato_2', 'potato_3',
    'carrot_0', 'carrot_1', 'carrot_2', 'carrot_3',
    'wild_wheat', 'wild_potato', 'wild_carrot',
  ],

  items: [
    'raw_fowl', 'raw_mutton', 'raw_chop', 'cooked_fowl', 'cooked_mutton', 'cooked_chop', 'potato', 'baked_potato', 'carrot',
    'bread', 'hearth_stew', 'wheat_seeds', 'wheat', 'flour', 'dough', 'hide', 'flint_hoe', 'bronze_hoe', 'iron_hoe',
  ],

  /** Table 12.2: item -> food points. */
  hunger: {
    raw_fowl: 2, raw_mutton: 3, raw_chop: 3, cooked_fowl: 6, cooked_mutton: 7, cooked_chop: 8,
    potato: 1, baked_potato: 5, carrot: 3, bread: 6, hearth_stew: 12,
    // Resin sugar and what is baked with it (itemsSugar.ts).
    sugar: 1, sugar_cookie: 2, sweet_bun: 6, sugar_cake: 9,
    // Spec 14: picked from berry bushes.
    wildberries: 2,
  } as Record<string, number>,
  /** Foods that grant a buff: item -> [buff, seconds]. */
  buffs: { hearth_stew: ['well_fed', 360], sugar: ['sugar_rush', 45], sugar_cookie: ['sugar_rush', 90], sweet_bun: ['sugar_rush', 150], sugar_cake: ['sugar_rush', 240] } as Record<string, [string, number]>,

  /** Hoes: item -> [tier, durability]. */
  hoes: { flint_hoe: [1, 64], bronze_hoe: [2, 192], iron_hoe: [3, 384] } as Record<string, [number, number]>,

  /** Items that plant a crop: item -> first stage block. */
  plants: { wheat_seeds: 'wheat_0', potato: 'potato_0', carrot: 'carrot_0' } as Record<string, string>,

  blockProps: {
    farmland: { shape: 'cube', tool: 'shovel', hardness: 0.8, drops: [{ item: 'dirt', count: 1 }], itemKey: null },
    ...crop('wheat', [{ item: 'wheat', count: [1, 2] }, { item: 'wheat_seeds', count: [1, 3] }], 'wheat_seeds'),
    ...crop('potato', [{ item: 'potato', count: [2, 4] }], 'potato'),
    ...crop('carrot', [{ item: 'carrot', count: [2, 4] }], 'carrot'),
    wild_wheat: { shape: 'cross', drops: [{ item: 'wheat_seeds', count: [1, 2] }, { item: 'wheat', count: 1, chance: 0.5 }] },
    wild_potato: { shape: 'cross', drops: [{ item: 'potato', count: [1, 2] }] },
    wild_carrot: { shape: 'cross', drops: [{ item: 'carrot', count: [1, 2] }] },
  } as Record<string, Partial<BlockDef>>,

  /** Table 12.5: species -> numbers. */
  creatures: {
    hen: { biomes: ['woodland', 'dunes', 'marsh'], health: 4, speed: 2.2, size: { w: 0.45, h: 0.7 }, likes: ['wheat_seeds'], drops: [{ item: 'raw_fowl', count: 1 }] },
    goat: {
      biomes: ['frostfell', 'woodland'], health: 8, speed: 2.6, size: { w: 0.8, h: 1.2 }, likes: ['wheat'],
      drops: [{ item: 'raw_mutton', count: [1, 2] }, { item: 'hide', count: 1, chance: 0.5 }],
    },
    boar: {
      biomes: ['woodland', 'scar', 'marsh'], health: 10, speed: 2.8, size: { w: 0.9, h: 0.9 }, likes: ['potato', 'carrot'],
      drops: [{ item: 'raw_chop', count: [1, 3] }, { item: 'hide', count: 1 }],
    },
  } as Record<string, { biomes: BiomeKey[]; health: number; speed: number; size: { w: number; h: number }; likes: string[]; drops: Drop[] }>,
};
