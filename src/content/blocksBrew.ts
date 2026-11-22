/**
 * Blocks of brewing (BREWING_PLAN 3, 11): tea bushes and coffee shrubs, the clay cup in its five states, a bucket
 * heating on a furnace top, and the kettle pot. Appended after every older block, so saved voxel ids never move.
 * All of them are small cut-out sprites (shapes 'cup' and 'bucket' stand on the cell's floor, not solid).
 */
import { CUP_BLOCK } from '../core/brewing';
import type { BlockSpec } from '../core/types';

/** Ground a wild bush grows on; cuttings also take farmland. */
const BUSH_SOIL = ['grass', 'dirt', 'peat', 'farmland'];

/** The tops a bucket or the kettle may stand on: the six furnaces and the four hearth wall blocks (a hearth's roof). */
export const FURNACE_TOPS = [
  'furnace_clay', 'furnace_bronze', 'furnace_blast', 'furnace_arc', 'furnace_plasma', 'furnace_star',
  'brick', 'refractory_brick', 'plasma_casing', 'star_casing',
];

/** A picked-again bush in two blocks: the fruiting one (`harvestLeaves` points at the bare one) and the bare one. */
function bush(key: string, name: string, fruit: string, cutting: string, fruitDesc: string, bareDesc: string): BlockSpec[] {
  return [
    {
      key, name, desc: fruitDesc, shape: 'cross', hardness: 0.4, item: false, machine: key, harvestLeaves: `${key}_bare`,
      drops: [{ item: fruit, count: [2, 3] }, { item: cutting, count: 1, chance: 0.25 }], placeOn: BUSH_SOIL, textures: { all: key },
    },
    {
      key: `${key}_bare`, name: `${name} (picked)`, desc: bareDesc, shape: 'cross', hardness: 0.4, item: false, machine: key,
      drops: [{ item: cutting, count: 1 }], placeOn: BUSH_SOIL, textures: { all: `${key}_bare` },
    },
  ];
}

/** One state of the cup setup: only the plain cup is an item; the others give back its parts (the sim adds the contents). */
function cup(stage: keyof typeof CUP_BLOCK, name: string, desc: string, own: boolean): BlockSpec {
  const key = CUP_BLOCK[stage];
  return {
    key, name, desc, shape: 'cup', solid: false, hardness: 0.3, machine: 'brew_cup', textures: { all: key },
    ...(own ? { category: 'misc' as const } : { item: false, drops: [{ item: 'clay_cup', count: 1 }, { item: 'drip_cone', count: 1 }] }),
  };
}

export const BREW_BLOCKS: BlockSpec[] = [
  ...bush('tea_bush', 'Tea Bush', 'tea_leaves', 'tea_cutting',
    'A glossy green bush of young tea leaves. Pick it for leaves and, now and then, a cutting; it leafs again in six minutes.',
    'A picked tea bush, putting out new leaves. Dig it up, or take it as a cutting, to plant by your door.'),
  ...bush('coffee_shrub', 'Coffee Shrub', 'coffee_cherries', 'coffee_cutting',
    'A shrub hung with red coffee cherries. Pick it for cherries and, now and then, a cutting; it fruits again in six minutes.',
    'A picked coffee shrub, already setting new cherries. Dig it up, or take it as a cutting, to plant by your door.'),
  cup('cup', 'Clay Cup', 'A small clay cup. Stand it on any firm surface, set a Drip Cone on it, and brew.', true),
  cup('cone', 'Cup with Drip Cone', 'A drip cone on a clay cup. Load it with tea or ground coffee.', false),
  cup('loaded', 'Loaded Cone', 'A cone holding tea or coffee, waiting for boiling water.', false),
  cup('brewing', 'Brewing', 'Boiling water dripping through the cone into the cup.', false),
  cup('done', 'Cup of Drink', 'A brewed cup, steaming. Take it, then drink.', false),
  {
    key: 'furnace_bucket', name: 'Bucket on the Furnace', desc: 'A bucket of water heating on the furnace top. Take it back, or wait for the boil.',
    shape: 'bucket', solid: false, hardness: 0.3, item: false, machine: 'boil_bucket', placeOn: FURNACE_TOPS,
    drops: [{ item: 'water_pail', count: 1 }], textures: { all: 'furnace_bucket' },
  },
  {
    key: 'furnace_bucket_boiling', name: 'Boiling Bucket', desc: 'Boiling water on the furnace top. Pick it up and pour it over a loaded cone; it cools in minutes.',
    shape: 'bucket', solid: false, hardness: 0.3, item: false, machine: 'boil_bucket', placeOn: FURNACE_TOPS,
    drops: [{ item: 'boiling_pail', count: 1 }], textures: { all: 'furnace_bucket_boiling' },
  },
  {
    key: 'kettle_pot', name: 'Kettle Pot', desc: 'A copper pot that sits on the furnace and boils water, a bucket at a time. It makes no steam power: it is for tea, coffee and stew.',
    shape: 'bucket', solid: false, hardness: 0.6, tool: 'pickaxe', machine: 'kettle', placeOn: FURNACE_TOPS, category: 'misc',
    textures: { all: 'kettle_pot', sideActive: 'kettle_pot_on', topActive: 'kettle_pot_on' },
  },
];
