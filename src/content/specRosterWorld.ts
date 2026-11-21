/**
 * Test fixture: the roster of spec sections 13-14 (buckets, a richer world), typed in a second time from the design
 * document and docs/api/world-content.md. specRoster.ts merges its blocks, items, fuels and block properties into the
 * section 2 roster; worldContent.test.ts checks the rest. Nothing but the tests imports this file.
 */
import type { BlockDef, LootTier } from '../core/types';

const pick = (minTier: number): Partial<BlockDef> => ({ tool: 'pickaxe', minTier });
const cross = (props: Partial<BlockDef> = {}): Partial<BlockDef> => ({ shape: 'cross', solid: false, opaque: false, ...props });

export const WORLD_SPEC = {
  blocks: [
    'ember_poppy', 'skybell', 'frost_lily', 'fern', 'reeds', 'berry_bush', 'berry_bush_bare', 'glowcap', 'cactus',
    'packed_ice', 'ice_spike', 'basalt_column', 'steam_vent', 'peat',
    'cracked_stone_brick', 'mossy_stone_brick', 'collapsed_furnace', 'rusted_shell',
    'crystal_cluster', 'oil',
  ],

  items: ['bronze_bucket', 'lava_bucket', 'wildberries'],

  /** item -> [energyJ, burnS, flameTempC]. */
  fuels: { peat: [500_000, 50, 900], lava_bucket: [2_000_000, 100, 1300] } as Record<string, number[]>,

  /** Player-facing names of section 13 (keys unchanged). */
  names: { pail: 'Bucket', water_pail: 'Water Bucket', bronze_bucket: 'Bronze Bucket', lava_bucket: 'Lava Bucket' } as Record<string, string>,

  blockProps: {
    ember_poppy: cross({ itemKey: 'ember_poppy', placeOn: ['grass', 'dirt'] }),
    skybell: cross({ itemKey: 'skybell', placeOn: ['grass', 'dirt'] }),
    frost_lily: cross({ itemKey: 'frost_lily', placeOn: ['grass', 'dirt', 'snow'] }),
    fern: cross({ itemKey: null, replaceable: true, drops: [{ item: 'fiber', count: 1, chance: 0.6 }] }),
    reeds: cross({ itemKey: null, drops: [{ item: 'fiber', count: [1, 2] }] }),
    berry_bush: cross({ itemKey: null, machine: 'berry_bush', harvestLeaves: 'berry_bush_bare', drops: [{ item: 'wildberries', count: [1, 3] }] }),
    berry_bush_bare: cross({ itemKey: 'berry_bush_bare', machine: 'berry_bush', harvestLeaves: null, drops: [{ item: 'berry_bush_bare', count: 1 }] }),
    glowcap: cross({ itemKey: 'glowcap', light: 6 }),
    cactus: { shape: 'cube', contactDamage: 1, drops: [{ item: 'cactus', count: 1 }] },
    packed_ice: { ...pick(1), shape: 'cube' },
    ice_spike: cross({ itemKey: null, drops: [{ item: 'ice', count: 1 }] }),
    basalt_column: { ...pick(2), shape: 'cube' },
    steam_vent: { ...pick(2), warmth: 3, itemKey: null, drops: [{ item: 'basalt', count: 1 }] },
    peat: { tool: 'shovel', minTier: 0, shape: 'cube' },
    cracked_stone_brick: pick(0),
    mossy_stone_brick: pick(0),
    collapsed_furnace: { ...pick(0), oriented: true, itemKey: null, drops: [{ item: 'firebrick', count: [2, 4] }, { item: 'clay', count: 1, chance: 0.5 }] },
    rusted_shell: { ...pick(2), itemKey: null, drops: [{ item: 'iron_ore', count: 1 }, { item: 'copper_wire', count: [1, 2], chance: 0.5 }] },
    crystal_cluster: cross({ ...pick(3), light: 4, itemKey: null, drops: [{ item: 'silica', count: [1, 2] }] }),
    oil: { shape: 'liquid', liquid: 'oil', itemKey: null, drops: [], hardness: -1, replaceable: true },
  } as Record<string, Partial<BlockDef>>,

  /** World blocks of sections 13-14 the tech tree must not depend on (biome-flavoured, ruins, decoration). */
  optional: [
    'peat', 'cactus', 'packed_ice', 'ice_spike', 'basalt_column', 'steam_vent', 'crystal_cluster', 'glowcap',
    'ember_poppy', 'skybell', 'frost_lily', 'fern', 'reeds', 'berry_bush', 'cracked_stone_brick', 'mossy_stone_brick',
  ],

  /** Latest age an item in each loot tier may belong to: ruins speed the climb, they never skip it. */
  lootMaxAge: { near: 0, deep: 1 } as Record<LootTier, number>,
};
