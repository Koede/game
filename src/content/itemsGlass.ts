/**
 * Glassware shared by chemistry, brewing and essentia (docs/api/magic.md "Glassware"): the Glass Vial works wherever an
 * empty Glass Beaker is taken (the sap tap and the distillery hand back beakers of what they fill; sugar has a vial row). Either one filled with water sets down on its own on a hot furnace top and boils - small glass boils
 * faster than a bucket - and boiling water in glass brews tea like a boiling bucket. A beaker of pine sap set on the
 * furnace top cooks down to resin and hands the beaker back.
 */
import { BOILING_KEEPS_S } from '../core/constants';
import type { BlockSpec, ItemSpec, RecipeSpec } from '../core/types';
import { amount, amounts } from './amounts';
import { FURNACE_TOPS } from './blocksBrew';

/** How long glass takes to boil, as a share of a bucket's BOIL_SECONDS. */
export const BEAKER_BOIL_SCALE = 0.5;
export const VIAL_BOIL_SCALE = 0.3;
/** Resin from sap takes longer than water to come to the boil. */
export const SAP_BOIL_SCALE = 1.5;

/** Empty glassware the chemistry accepts in place of an empty beaker. */
export const EMPTY_GLASSWARE: readonly string[] = ['glass_beaker', 'glass_vial'];

export const GLASS_ITEMS: ItemSpec[] = [
  {
    key: 'water_beaker', name: 'Beaker of Water', category: 'misc', age: 0, stack: 16,
    container: { holds: 'water', boilsTo: 'boiling_beaker', emptyTo: 'glass_beaker', boilScale: BEAKER_BOIL_SCALE },
    desc: 'A little water in glass. Set it on a hot furnace top on its own: it boils twice as fast as a bucket.',
  },
  {
    key: 'boiling_beaker', name: 'Beaker of Boiling Water', category: 'misc', age: 0, stack: 1, cools: { to: 'water_beaker', afterS: BOILING_KEEPS_S },
    desc: 'Boiling water in a beaker; it cools in a minute and a half. Pour it over a loaded cone to brew a cup.',
  },
  {
    key: 'water_vial', name: 'Vial of Water', category: 'misc', age: 0, stack: 16,
    container: { holds: 'water', boilsTo: 'boiling_vial', emptyTo: 'glass_vial', boilScale: VIAL_BOIL_SCALE },
    desc: 'A few sips of water in a vial. Set it on a hot furnace top on its own: it boils in a few seconds.',
  },
  {
    key: 'boiling_vial', name: 'Vial of Boiling Water', category: 'misc', age: 0, stack: 1, cools: { to: 'water_vial', afterS: BOILING_KEEPS_S },
    desc: 'Boiling water in a vial; it cools in a minute and a half. Enough to brew one cup over a loaded cone.',
  },
];

/** Glass on a furnace top: [container item, cold block, boiling (done) block, name, done name]. */
const ON_TOP: Array<[string, string, string, string, string]> = [
  ['water_beaker', 'furnace_beaker', 'furnace_beaker_boiling', 'Beaker on the Furnace', 'Boiling Beaker'],
  ['water_vial', 'furnace_vial', 'furnace_vial_boiling', 'Vial on the Furnace', 'Boiling Vial'],
  ['pine_sap', 'furnace_sap', 'furnace_sap_resin', 'Sap on the Furnace', 'Resin in the Beaker'],
];

/** For src/core/brewing.ts CONTAINER_BLOCKS: container item -> its cold and boiling furnace-top blocks. */
export const GLASS_CONTAINER_BLOCKS: Record<string, { cold: string; boiling: string }> =
  Object.fromEntries(ON_TOP.map(([item, cold, boiling]) => [item, { cold, boiling }]));

export const GLASS_TOP_BLOCK_KEYS: readonly string[] = ON_TOP.flatMap(([, cold, boiling]) => [cold, boiling]);

export const GLASS_BLOCKS: BlockSpec[] = ON_TOP.flatMap(([item, cold, boiling, name, doneName]): BlockSpec[] => [
  {
    key: cold, name, desc: `${name}: it heats while the furnace under it is hot. Take it back with Use, or wait.`,
    shape: 'bucket', solid: false, opaque: false, translucent: true, hardness: 0.2, item: false, machine: 'boil_bucket', placeOn: FURNACE_TOPS,
    drops: [{ item, count: 1 }], textures: { all: cold },
  },
  {
    key: boiling, name: doneName, desc: item === 'pine_sap' ? 'The sap has cooked down to resin. Take it: you get the resin and the beaker.' : 'Boiling water in glass. Take it and pour it over a loaded cone.',
    shape: 'bucket', solid: false, opaque: false, translucent: true, hardness: 0.2, item: false, machine: 'boil_bucket', placeOn: FURNACE_TOPS,
    drops: [{ item, count: 1 }], textures: { all: boiling },
  },
]);

const bench = (id: string, output: string, inputs: string, byproducts: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), byproducts: amounts(byproducts), age: 0,
});

export const GLASS_RECIPES: RecipeSpec[] = [
  // Sugar boiled down in a vial instead of a beaker (the vial comes back).
  {
    id: 'sugar_vial', station: 'furnace', kind: 'forge', inputs: amounts('2 pine_resin, 1 water_pail, 1 glass_vial'), output: amount('3 sugar'),
    byproducts: amounts('1 pail, 1 glass_vial'), minTempC: 260, minTier: 1, age: 0,
  },
  bench('water_beaker', '4 water_beaker', '1 water_pail, 4 glass_beaker', '1 pail'),
  bench('water_vial', '4 water_vial', '1 water_pail, 4 glass_vial', '1 pail'),
];
