/**
 * Every block of the world (spec 2.1). BLOCK_SPECS[0] must be air. The order fixes the numeric ids stored in
 * voxels, so new blocks are only ever appended.
 *
 * Hardness is seconds by bare hand. `minTier` is the tool tier below which a block drops nothing:
 * hands 0, flint 1, bronze 2, iron 3, steel 4, power drill 5. `age` is the age in which the block first
 * becomes obtainable (content.test.ts proves it against the progression solver).
 */
import type { BlockSpec, Drop } from '../core/types';
import { EMBER_BLOCKS } from './emberbound';
import { TECH_BLOCKS } from './blocksTech';
import { WORLD_BLOCKS } from './blocksWorld';
import { BREW_BLOCKS } from './blocksBrew';
import { DISTILL_BLOCKS } from './blocksDistill';
import { MAGIC_BLOCKS } from './itemsMagic';
import { WORKSHOP_BLOCKS } from './itemsWorkshop';
import { GLASS_BLOCKS } from './itemsGlass';
import { HAND_BLOCKS } from './blocksHand';
import { areaBlocks } from './area';
import LOCK from './blockIds.lock.json';

const FOLIAGE_DROPS: Drop[] = [
  { item: 'fiber', count: 1, chance: 0.3 },
  { item: 'stick', count: 1, chance: 0.15 },
];
/** Leaves also drop their tree's sapling now and then (src/content/areas/world_saplings.ts, docs/api/tree-growth.md). */
export const LEAF_SAPLING_CHANCE = 0.04;
const leafDrops = (sapling: string): Drop[] => [...FOLIAGE_DROPS, { item: sapling, count: 1, chance: LEAF_SAPLING_CHANCE }];

/** An ore: one texture named after its key, pickaxe only, drops itself unless `extra.drops` says otherwise. */
function ore(key: string, name: string, desc: string, hardness: number, minTier: number, age: number, extra: Partial<BlockSpec> = {}): BlockSpec {
  return { key, name, desc, hardness, minTier, age, tool: 'pickaxe', category: 'resource', textures: { all: key }, ...extra };
}

/** One tier of the furnace. All six carry the same block entity; upgrading swaps the block id in place. */
function furnace(tier: string, name: string, desc: string, age: number, lightActive: number, warmthActive: number): BlockSpec {
  const key = `furnace_${tier}`;
  return {
    key, name, desc, age, lightActive, warmthActive,
    machine: 'furnace', power: 'device', oriented: true, hardness: 3, tool: 'pickaxe', stack: 1,
    textures: { side: `${key}_side`, top: `${key}_top`, front: `${key}_front`, frontActive: `${key}_front_on` },
  };
}

/** A powered machine: shared casing, its own front (idle and running), faces the player, always drops itself. */
function machine(key: string, name: string, desc: string, age: number, extra: Partial<BlockSpec> = {}): BlockSpec {
  return {
    key, name, desc, age,
    machine: key, power: 'device', oriented: true, hardness: 2, tool: 'pickaxe', stack: 16,
    textures: { side: 'machine_side', top: 'machine_top', front: `${key}_front`, frontActive: `${key}_front_on` },
    ...extra,
  };
}

/** The four growth stages of a crop: `<crop>_0` (just planted) .. `<crop>_3` (ripe), carried by one 'crop' entity. */
function crop(key: string, name: string, stageNames: [string, string, string, string], desc: [string, string, string, string], seed: string, ripe: Drop[]): BlockSpec[] {
  return stageNames.map((stage, i) => ({
    key: `${key}_${i}`, name: `${name} (${stage})`, desc: desc[i],
    shape: 'cross', hardness: 0, item: false, placeOn: ['farmland'], machine: 'crop',
    drops: i === 3 ? ripe : [{ item: seed, count: 1 }], textures: { all: `${key}_stage${i}` },
  }));
}

/** A wild food plant: grows on grass in small patches, drops food or seed, never placed back by the player. */
function wildPlant(key: string, name: string, desc: string, drops: Drop[]): BlockSpec {
  return { key, name, desc, shape: 'cross', hardness: 0.2, item: false, placeOn: ['grass', 'dirt'], drops, textures: { all: key } };
}

function cable(key: string, name: string, desc: string, age: number, cableRatingW: number): BlockSpec {
  return { key, name, desc, age, cableRatingW, shape: 'cable', power: 'cable', hardness: 0.4, category: 'machine', textures: { all: key } };
}

const LEGACY_BLOCKS: BlockSpec[] = [
  // ---- natural -------------------------------------------------------------------------------
  { key: 'air', name: 'Air', shape: 'none', hardness: -1, drops: 'none', replaceable: true },
  {
    key: 'corestone', name: 'Corestone', desc: 'The floor of the world. No tool you will ever make can mark it.',
    hardness: -1, drops: 'none', item: false, textures: { all: 'corestone' },
  },
  {
    key: 'stone', name: 'Stone', desc: 'Solid rock. A pickaxe breaks it down into rubble.',
    hardness: 4, tool: 'pickaxe', minTier: 1, drops: [{ item: 'rubble', count: 1 }], textures: { all: 'stone' },
  },
  {
    key: 'rubble', name: 'Rubble', desc: 'Loose broken stone. Furnace walls and stone brick both start as a heap of this.',
    hardness: 2, tool: 'pickaxe', textures: { all: 'rubble' },
  },
  { key: 'dirt', name: 'Dirt', desc: 'Plain earth. Easy to dig and easy to pile.', hardness: 0.8, tool: 'shovel', textures: { all: 'dirt' } },
  {
    key: 'grass', name: 'Grass', desc: 'Earth with a living green skin. Dug up, it is just dirt.',
    hardness: 0.9, tool: 'shovel', drops: [{ item: 'dirt', count: 1 }], textures: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' },
  },
  { key: 'sand', name: 'Sand', desc: 'Fine, dry sand. A hot furnace melts it into glass.', hardness: 0.8, tool: 'shovel', textures: { all: 'sand' } },
  {
    key: 'gravel', name: 'Gravel', desc: 'Loose pebbles. Dig through it and now and then a sharp flint turns up.',
    hardness: 1, tool: 'shovel', drops: [{ item: 'gravel', count: 1 }, { item: 'flint', count: 1, chance: 0.25 }], textures: { all: 'gravel' },
  },
  {
    key: 'clay', name: 'Clay', desc: 'Heavy, wet clay. Your first furnace is built from it, and fired it becomes firebrick.',
    hardness: 1, tool: 'shovel', category: 'resource', textures: { all: 'clay' },
  },
  { key: 'snow', name: 'Snow', desc: 'Packed snow. A quiet reminder to stay near a fire.', hardness: 0.5, tool: 'shovel', textures: { all: 'snow' } },
  { key: 'ice', name: 'Ice', desc: 'Frozen water, hard and slick underfoot.', hardness: 1.5, tool: 'pickaxe', textures: { all: 'ice' } },
  {
    key: 'basalt', name: 'Basalt', desc: 'Dark volcanic rock, dense and slow to break. Lava is often not far away.',
    hardness: 6, tool: 'pickaxe', minTier: 2, textures: { all: 'basalt' },
  },
  {
    key: 'limestone', name: 'Limestone', desc: 'Pale, chalky rock. In the forge it draws the impurities out of iron to leave steel.',
    hardness: 4, tool: 'pickaxe', minTier: 1, category: 'resource', textures: { all: 'limestone' },
  },
  {
    key: 'water', name: 'Water', desc: 'Fresh water. Still water is made of source blocks; what flows from them runs downhill and spreads seven blocks. Machines that use water need it close by.',
    shape: 'liquid', liquid: 'water', translucent: true, replaceable: true, hardness: -1, drops: 'none', item: false, textures: { all: 'water' },
  },
  {
    key: 'lava', name: 'Lava', desc: 'Molten rock. It burns on contact, and a geothermal tap can draw on its heat forever.',
    shape: 'liquid', liquid: 'lava', replaceable: true, hardness: -1, drops: 'none', item: false,
    light: 15, warmth: 4, contactDamage: 4, textures: { all: 'lava' },
  },
  {
    key: 'oak_log', name: 'Oak Log', desc: 'A sturdy oak trunk. Split it into planks, burn it, or bake it into charcoal.',
    hardness: 2, tool: 'axe', textures: { side: 'oak_log_side', top: 'log_top' },
  },
  {
    key: 'oak_stump', name: 'Oak Stump', desc: 'What is left of a felled oak: a ring of old wood. Chop it for a stick or two.',
    hardness: 2.5, tool: 'axe', drops: [{ item: 'stick', count: [1, 2] }], textures: { side: 'oak_log_side', top: 'log_top' },
  },
  {
    key: 'pine_stump', name: 'Pine Stump', desc: 'A resinous stump of a felled pine. Chop it for a stick or two.',
    hardness: 2.5, tool: 'axe', drops: [{ item: 'stick', count: [1, 2] }], textures: { side: 'pine_log_side', top: 'log_top' },
  },
  {
    key: 'oak_leaves', name: 'Oak Leaves', desc: 'Broad green leaves. Stripping them yields fiber and the odd stick.',
    hardness: 0.3, drops: leafDrops('oak_sapling'), textures: { all: 'oak_leaves' },
  },
  {
    key: 'pine_log', name: 'Pine Log', desc: 'A resinous pine trunk. It splits, burns and chars exactly like oak.',
    hardness: 2, tool: 'axe', textures: { side: 'pine_log_side', top: 'log_top' },
  },
  {
    key: 'pine_leaves', name: 'Pine Boughs', desc: 'Dense needled boughs. They give fiber and sticks just as oak leaves do.',
    hardness: 0.3, drops: leafDrops('pine_sapling'), textures: { all: 'pine_leaves' },
  },
  {
    key: 'tall_grass', name: 'Tall Grass', desc: 'Long grass. Pull it up for fiber, and now and then a few wheat seeds.',
    shape: 'cross', hardness: 0.1, replaceable: true,
    drops: [{ item: 'fiber', count: 1, chance: 0.5 }, { item: 'wheat_seeds', count: 1, chance: 0.15 }],
    placeOn: ['grass', 'dirt'], textures: { all: 'tall_grass' },
  },
  {
    key: 'dry_shrub', name: 'Dry Shrub', desc: 'A brittle, sun-dried bush that snaps into sticks.',
    shape: 'cross', hardness: 0.2, replaceable: true, drops: [{ item: 'stick', count: [1, 2] }],
    placeOn: ['sand', 'dirt', 'grass', 'gravel', 'snow', 'stone', 'basalt'], textures: { all: 'dry_shrub' },
  },

  // ---- ores ----------------------------------------------------------------------------------
  ore('coal_ore', 'Coal Seam', 'Black coal bedded in stone. It burns far hotter than wood.', 5, 1, 0, { drops: [{ item: 'coal', count: [1, 2] }] }),
  ore('copper_ore', 'Copper Ore', 'Green-stained rock heavy with copper. A clay furnace wins the metal from it at 700 C.', 5.5, 1, 0),
  ore('tin_ore', 'Tin Ore', 'Dull grey ore that melts at a low heat. With copper it makes bronze.', 5.5, 1, 0),
  ore('iron_ore', 'Iron Ore', 'Rust-red ore. It gives up its iron only to a blast furnace.', 7, 2, 0),
  ore('sulfur_ore', 'Sulfur Ore', 'Yellow crystals with a sharp smell. The acid in a battery starts here.', 6, 2, 0, { drops: [{ item: 'sulfur', count: [1, 2] }] }),
  ore('quartz_ore', 'Quartz Ore', 'Milky crystal locked in the rock. Crushed to silica, it becomes wafers and furnace glass.', 8, 3, 2),
  ore('bauxite', 'Bauxite', 'Crumbly red-brown ore. Crushed and smelted very hot, it yields light aluminum.', 8, 3, 2),
  ore('wolframite', 'Wolframite', 'A dark, very heavy ore from the deep. Its tungsten shrugs off heat that melts steel.', 12, 4, 2),
  ore('spodumene', 'Spodumene', 'Pale, glassy crystals from the deep, rich in lithium.', 11, 4, 2),
  ore('pitchblende', 'Pitchblende', 'Black, heavy and faintly glowing. It is radioactive: do not linger beside it unprotected.', 14, 5, 4, { radiation: 2, light: 4 }),
  ore('oil_shale', 'Oil Shale', 'Dark, greasy rock. A still cooks fuel out of it.', 7, 2, 0),

  // ---- built ---------------------------------------------------------------------------------
  { key: 'plank', name: 'Planks', desc: 'Sawn boards. Good for building, for the workbench, and for a quick fire.', hardness: 1.5, tool: 'axe', textures: { all: 'plank' } },
  { key: 'stone_brick', name: 'Stone Brick', desc: 'Rubble squared and stacked into a tidy, lasting wall.', hardness: 4, tool: 'pickaxe', textures: { all: 'stone_brick' } },
  {
    // The wall of a Blast hearth (spec 17): its seams glow while the hearth is formed.
    key: 'brick', name: 'Brick', desc: 'Fired clay bricks, warm in colour and tough as stone. Walls of brick around a furnace make a Blast hearth.',
    hardness: 3.5, tool: 'pickaxe', textures: { all: 'brick', sideActive: 'brick_on', topActive: 'brick_on', bottomActive: 'brick_on' },
  },
  {
    key: 'glass', name: 'Glass', desc: 'Clear glass. It lets the daylight in and keeps the weather out.',
    hardness: 0.5, opaque: false, translucent: true, textures: { all: 'glass' },
  },
  { key: 'concrete', name: 'Concrete', desc: 'Poured stone, smooth and very hard to break. Made for walls that must hold.', hardness: 6, tool: 'pickaxe', age: 2, textures: { all: 'concrete' } },
  {
    key: 'torch', name: 'Torch', desc: 'A small, steady flame. It lights the dark and takes the edge off the cold.',
    shape: 'torch', hardness: 0.1, light: 13, warmth: 2, textures: { all: 'torch' },
  },
  {
    key: 'workbench', name: 'Workbench', desc: 'A plain bench for cold work: your first furnace and a few wooden things. Everything else is made at the furnace.',
    station: 'workbench', hardness: 2, tool: 'axe', stack: 16, category: 'machine', textures: { top: 'workbench_top', side: 'workbench_side', bottom: 'plank' },
  },
  {
    key: 'crate', name: 'Crate', desc: 'Twenty-seven slots of storage. A furnace draws ingredients from crates nearby, and machines push their output into one that touches them.',
    machine: 'crate', hardness: 2, tool: 'axe', stack: 16, textures: { all: 'crate' },
  },
  {
    key: 'lamp', name: 'Lamp', desc: 'An electric lamp. It shines for as long as its network has power.',
    machine: 'lamp', power: 'device', hardness: 1, tool: 'pickaxe', stack: 64, lightActive: 15,
    textures: { side: 'lamp', sideActive: 'lamp_on', top: 'machine_top' },
  },

  // ---- furnaces ------------------------------------------------------------------------------
  furnace('clay', 'Clay Furnace', 'The heart of your base. Feed it fuel, keep it hot, and smelt and forge at its mouth.', 0, 11, 6),
  furnace('blast', 'Blast Furnace', 'Firebrick walls and a forced draft. Hot enough for iron and steel.', 2, 12, 8),
  furnace('arc', 'Arc Furnace', 'Graphite electrodes turn electricity into a heat no fuel can match.', 3, 13, 10),
  furnace('plasma', 'Plasma Furnace', 'A magnetic bottle of plasma. It melts tungsten and quartz, and it is always hungry for power.', 4, 14, 12),
  furnace('star', 'Starhearth', 'A furnace built to hold a star. Bring it to 3000 C, feed it power, and ignite it.', 5, 15, 24),

  // ---- generators ----------------------------------------------------------------------------
  machine('thermopile', 'Thermopile', "Turns a furnace's heat straight into a trickle of current. Set it against a furnace.", 0),
  machine('steam_engine', 'Steam Engine', 'Boils water over the fire and spins a dynamo. It sits on top of a furnace with water at its side.', 2),
  machine('burner_generator', 'Burner Generator', 'Burns any furnace fuel for electricity, and only as fast as the network asks.', 2, { lightActive: 7 }),
  machine('water_wheel', 'Water Wheel', 'Slow, steady power from water on at least two sides. Wheels crowded together share the flow.', 2),
  machine('wind_turbine', 'Wind Turbine', 'Catches the wind under an open sky. The higher it stands, the more it makes.', 3),
  machine('solar_panel', 'Solar Panel', 'Silent power from daylight under an open sky. It sleeps at night.', 3, {
    shape: 'slab', oriented: false, textures: { top: 'solar_panel_top', side: 'machine_side', bottom: 'machine_top' },
  }),
  machine('combustion_engine', 'Combustion Engine', 'A heavy engine that drinks fuel canisters and answers with real power.', 3),
  machine('geothermal_tap', 'Geothermal Tap', 'Draws on the heat of lava beside it and never runs dry.', 3, { lightActive: 5 }),
  machine('fission_pile', 'Fission Pile', 'Splits the atoms of a fuel rod for enormous power. Keep water on two sides of it, always.', 4, { lightActive: 5 }),

  // ---- grid ----------------------------------------------------------------------------------
  cable('copper_cable', 'Copper Cable', 'Carries power between machines. A network of copper cable can move 10 kW.', 0, 10_000),
  cable('heavy_cable', 'Heavy Cable', 'Thick aluminum conductors that move 120 kW. A network is only as strong as its weakest cable.', 3, 120_000),
  cable('super_cable', 'Super Cable', 'A superconducting line that moves 2 MW, enough to light a star.', 4, 2_000_000),
  machine('battery', 'Acid Battery', 'Stores 2 MJ and gives it back whenever generation falls short.', 2, {
    textures: { side: 'machine_side', top: 'machine_top', front: 'battery_front' },
  }),
  machine('lithium_bank', 'Lithium Bank', 'A wall of lithium cells: 40 MJ, released as fast as 150 kW.', 4, {
    textures: { side: 'machine_side', top: 'machine_top', front: 'lithium_bank_front' },
  }),

  // ---- consumers -----------------------------------------------------------------------------
  machine('blower', 'Blower', 'An electric fan for the firebox. It keeps the draft of any furnace beside it high, so you can put the bellows down.', 2),
  machine('space_heater', 'Space Heater', 'A glowing coil that keeps a room warm for as long as it has power.', 2, { warmthActive: 6, lightActive: 6 }),
  machine('crusher', 'Crusher', 'Grinds ore to powder: two portions from every block, and the only way to work quartz, bauxite and the deep ores.', 2),
  machine('still', 'Still', 'Cooks oil shale down into canisters of fuel.', 3),
  machine('bore_rig', 'Bore Rig', 'Drills straight down, block after block, and keeps whatever it finds.', 3),
  machine('centrifuge', 'Centrifuge', 'Spins yellowcake until only the potent fraction is left.', 4),
  machine('electrolyzer', 'Electrolyzer', 'Splits water with a great deal of power and bottles the heavy hydrogen. It must touch water.', 4),

  // ---- hazard --------------------------------------------------------------------------------
  {
    // Hardness -1 would make it permanent (spec 3.6), so "tier 5 only" is expressed as a block that takes a
    // power drill 12 s and anything lesser many minutes for nothing.
    key: 'corium', name: 'Corium', desc: 'The slag of a melted reactor. Fiercely radioactive, and only a power drill clears it away.',
    hardness: 120, tool: 'pickaxe', minTier: 5, drops: 'none', item: false, light: 9, radiation: 8, age: 4, textures: { all: 'corium' },
  },

  // ---- food and farming (spec 12) - appended, so every older block keeps its id ---------------
  {
    key: 'farmland', name: 'Farmland', desc: 'Soil turned with a hoe into dark furrows. Seeds, potatoes and carrots grow on it.',
    hardness: 0.8, tool: 'shovel', item: false, drops: [{ item: 'dirt', count: 1 }], textures: { top: 'farmland_top', side: 'dirt', bottom: 'dirt' },
  },
  ...crop('wheat', 'Wheat', ['sprouting', 'growing', 'heading', 'ripe'], [
    'Wheat, just sown. It needs daylight or a lamp, and grows twice as fast with water close by.',
    'Young wheat, green and growing.',
    'Wheat in ear, not yet golden.',
    'Ripe golden wheat. Harvest it for grain and more seed.',
  ], 'wheat_seeds', [{ item: 'wheat', count: [1, 2] }, { item: 'wheat_seeds', count: [1, 3] }]),
  ...crop('potato', 'Potatoes', ['sprouting', 'growing', 'budding', 'ripe'], [
    'A seed potato in the furrow. It needs daylight or a lamp, and grows twice as fast with water close by.',
    'Potato leaves pushing up out of the soil.',
    'A leafy potato plant in bud, its tubers still swelling underground.',
    'In full flower, tubers showing at the soil: the potatoes are ready to dig.',
  ], 'potato', [{ item: 'potato', count: [2, 4] }]),
  ...crop('carrot', 'Carrots', ['sprouting', 'growing', 'thickening', 'ripe'], [
    'A carrot just planted. It needs daylight or a lamp, and grows twice as fast with water close by.',
    'Feathery carrot tops, still thin.',
    'Carrots thickening below the leaves.',
    'Orange shoulders show at the soil: the carrots are ready to pull.',
  ], 'carrot', [{ item: 'carrot', count: [2, 4] }]),
  wildPlant('wild_wheat', 'Wild Wheat', 'A tuft of wild grain. It gives wheat seeds, and sometimes a little wheat.',
    [{ item: 'wheat_seeds', count: [1, 2] }, { item: 'wheat', count: 1, chance: 0.5 }]),
  wildPlant('wild_potato', 'Wild Potato', 'Low leaves with small white flowers. Pull it up for a potato or two.', [{ item: 'potato', count: [1, 2] }]),
  wildPlant('wild_carrot', 'Wild Carrot', 'Lacy white flowers over a thin orange root. Pull it up for a carrot or two.', [{ item: 'carrot', count: [1, 2] }]),

  ...WORLD_BLOCKS,
  ...TECH_BLOCKS,
  ...EMBER_BLOCKS,
  ...BREW_BLOCKS,
  ...HAND_BLOCKS,
  ...DISTILL_BLOCKS,
  ...MAGIC_BLOCKS,
  ...WORKSHOP_BLOCKS,
  ...GLASS_BLOCKS,
  // Appended last so no saved voxel id moves (BRONZE_PLAN W0): the Bronze Furnace is tier 2 of six.
  furnace('bronze', 'Bronze Furnace', 'Bronze plates round the firebox: 1100 C, two crucibles, and heat enough to carry to machines. It stands alone, no hearth needed.', 1, 11, 7),
];

/**
 * Orders `specs` by the id lock (blockIds.lock.json): a locked key sits at its id, keys the lock does not know yet are
 * appended after the highest id in registry order (run `npm run ids:sync` to lock them). A locked key that is missing is
 * an error: block ids are permanent, a block is never deleted (retire it by hiding it, not by removing it).
 */
export function orderByLock(specs: readonly BlockSpec[], lock: Readonly<Record<string, number>>): BlockSpec[] {
  const byKey = new Map(specs.map((b) => [b.key, b]));
  const out: BlockSpec[] = [];
  const claimed = new Set<number>();
  for (const [key, id] of Object.entries(lock)) {
    if (claimed.has(id)) continue; // a duplicated id: the first key keeps it, ids:sync moves the others
    const b = byKey.get(key);
    if (!b) throw new Error(`block "${key}" (id ${id}) is in blockIds.lock.json but no longer defined: block ids are permanent`);
    out[id] = b;
    claimed.add(id);
  }
  for (let i = 0; i < out.length; i++) if (out[i] === undefined) throw new Error(`blockIds.lock.json has a gap at id ${i}`);
  for (const b of specs) if (!out.includes(b)) out.push(b);
  return out;
}

export const BLOCK_SPECS: BlockSpec[] = orderByLock([...LEGACY_BLOCKS, ...areaBlocks()], LOCK);
/** Every block key in id order (for scripts/ids-sync.mjs). */
export const BLOCK_KEYS_IN_ORDER: string[] = BLOCK_SPECS.map((b) => b.key);
