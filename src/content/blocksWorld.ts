/**
 * Blocks of the richer world (spec 13-14): surface life, the marsh, the Old Works ruins and the underground. They
 * are appended to BLOCK_SPECS after every older block, so saved voxel ids never move.
 */
import type { BlockSpec } from '../core/types';

/** A wild flower: pure decoration, picked as itself and planted again wherever the player likes. */
function flower(key: string, name: string, desc: string, alsoOn: string[] = []): BlockSpec {
  return { key, name, desc, shape: 'cross', hardness: 0, placeOn: ['grass', 'dirt', ...alsoOn], textures: { all: key } };
}

/** Ground a berry bush grows on. */
const BUSH_SOIL = ['grass', 'dirt', 'peat'];

export const WORLD_BLOCKS: BlockSpec[] = [
  // Surface life
  flower('ember_poppy', 'Ember Poppy', 'A red poppy that likes warm ground: woodland meadows and the edges of the scar. Pick it and plant it by your door.'),
  flower('skybell', 'Skybell', 'Nodding blue bells on a thin stem, common in woodland and around marsh pools.'),
  flower('frost_lily', 'Frost Lily', 'A white lily that opens in the snow. It is the only flower of the frostfell.', ['snow']),
  {
    key: 'fern', name: 'Fern', desc: 'Curling green fronds that grow in the shade of the woods. Pull them up for fiber.',
    shape: 'cross', hardness: 0.1, replaceable: true, item: false, drops: [{ item: 'fiber', count: 1, chance: 0.6 }],
    placeOn: ['grass', 'dirt'], textures: { all: 'fern' },
  },
  {
    key: 'reeds', name: 'Reeds', desc: 'Tall stiff reeds at the water line. Their stems are full of fiber.',
    shape: 'cross', hardness: 0.2, item: false, drops: [{ item: 'fiber', count: [1, 2] }],
    placeOn: ['sand', 'dirt', 'clay', 'grass', 'peat'], textures: { all: 'reeds' },
  },
  {
    // Harvesting leaves the bare bush (and its entity) in place; src/sim turns it back into this after regrowS.
    key: 'berry_bush', name: 'Berry Bush', desc: 'A low bush heavy with wildberries. Pick it and it grows a new crop in five minutes.',
    shape: 'cross', hardness: 0.4, item: false, machine: 'berry_bush', harvestLeaves: 'berry_bush_bare',
    drops: [{ item: 'wildberries', count: [1, 3] }], placeOn: BUSH_SOIL, textures: { all: 'berry_bush' },
  },
  {
    key: 'berry_bush_bare', name: 'Berry Bush (picked)', desc: 'A picked berry bush, already setting fruit again. Dig it up to replant it nearer home.',
    shape: 'cross', hardness: 0.4, machine: 'berry_bush', category: 'block', placeOn: BUSH_SOIL, textures: { all: 'berry_bush_bare' },
  },
  {
    key: 'glowcap', name: 'Glowcap', desc: 'A mushroom with a soft cyan glow, found on dark forest floors and in caves. Plant it to light a path.',
    shape: 'cross', hardness: 0, light: 6, placeOn: ['grass', 'dirt', 'stone', 'rubble', 'gravel', 'clay', 'basalt', 'peat'], textures: { all: 'glowcap' },
  },
  {
    key: 'cactus', name: 'Cactus', desc: 'A ribbed desert cactus. Its spines hurt to touch, which makes it a fine hedge.',
    hardness: 0.8, contactDamage: 1, placeOn: ['sand', 'cactus'], textures: { side: 'cactus_side', top: 'cactus_top' },
  },
  {
    key: 'packed_ice', name: 'Packed Ice', desc: 'Ice pressed hard and blue by its own weight. The frost spires are built of it.',
    hardness: 3, tool: 'pickaxe', minTier: 1, textures: { all: 'packed_ice' },
  },
  {
    key: 'ice_spike', name: 'Ice Spike', desc: 'The glassy point of a frost spire. It snaps off as plain ice.',
    shape: 'cross', hardness: 0.5, tool: 'pickaxe', item: false, drops: [{ item: 'ice', count: 1 }], textures: { all: 'ice_spike' },
  },
  {
    key: 'basalt_column', name: 'Basalt Column', desc: 'Basalt cooled into tall six-sided pillars. Heavy, dark, and handsome in a wall.',
    hardness: 6, tool: 'pickaxe', minTier: 2, textures: { side: 'basalt_column_side', top: 'basalt_column_top' },
  },
  {
    key: 'steam_vent', name: 'Steam Vent', desc: 'A crack in the basalt that breathes hot steam. Stand close on a cold night.',
    hardness: 6, tool: 'pickaxe', minTier: 2, item: false, drops: [{ item: 'basalt', count: 1 }], warmth: 3,
    textures: { top: 'steam_vent_top', side: 'basalt', bottom: 'basalt' },
  },
  {
    key: 'peat', name: 'Peat', desc: 'Dark, half-rotted moss cut from the marsh. Dried in the firebox it burns hotter than wood, at 900 C.',
    hardness: 0.9, tool: 'shovel', textures: { all: 'peat' },
  },
  // The Old Works: remnants of someone who tamed fire before you
  {
    key: 'cracked_stone_brick', name: 'Cracked Stone Brick', desc: 'Stone brick split by long winters. Someone laid these walls a very long time ago.',
    hardness: 3, tool: 'pickaxe', textures: { all: 'cracked_stone_brick' },
  },
  {
    key: 'mossy_stone_brick', name: 'Mossy Stone Brick', desc: 'Old stone brick gone green with moss. Ruins are full of it.',
    hardness: 4, tool: 'pickaxe', textures: { all: 'mossy_stone_brick' },
  },
  {
    key: 'collapsed_furnace', name: 'Collapsed Furnace', desc: 'A furnace long cold, its mouth fallen in. Break it to salvage its firebrick.',
    hardness: 3, tool: 'pickaxe', oriented: true, item: false,
    drops: [{ item: 'firebrick', count: [2, 4] }, { item: 'clay', count: 1, chance: 0.5 }],
    textures: { front: 'collapsed_furnace', side: 'furnace_clay_side', top: 'furnace_clay_top' },
  },
  {
    key: 'rusted_shell', name: 'Rusted Shell', desc: 'The rusted casing of a machine nobody remembers. A bronze pickaxe pries out iron and wire.',
    hardness: 5, tool: 'pickaxe', minTier: 2, item: false,
    drops: [{ item: 'iron_ore', count: 1 }, { item: 'copper_wire', count: [1, 2], chance: 0.5 }], textures: { all: 'rusted_shell' },
  },
  // Underground
  {
    key: 'crystal_cluster', name: 'Crystal Cluster', desc: 'Pale crystals glowing softly inside a geode. Pure quartz: an iron pickaxe breaks them straight into silica.',
    shape: 'cross', hardness: 1.5, tool: 'pickaxe', minTier: 3, item: false, age: 1, light: 4,
    drops: [{ item: 'silica', count: [1, 2] }], textures: { all: 'crystal_cluster' },
  },
  {
    key: 'oil', name: 'Crude Oil', desc: 'Thick black oil seeping up in the dunes and the scar. A pump draws it off; a bucket cannot hold it.',
    shape: 'liquid', liquid: 'oil', replaceable: true, hardness: -1, drops: 'none', item: false, textures: { all: 'oil' },
  },
];
