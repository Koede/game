/**
 * Test fixture: the roster of the Ember handwork (docs/api/handwork-content.md), typed in a second time from the contract.
 * specRoster.ts merges its blocks, items, machines, block properties and recipes into the roster; handwork.test.ts checks
 * the rest. Nothing but the tests imports this file. Recipes appended to older stations come last, in this order.
 */
import type { BlockDef, MachineRole } from '../core/types';

type Numbers = Record<string, number>;

export const HAND_SPEC = {
  blocks: [
    'chopping_block', 'hand_quern', 'stone_anvil', 'mortar', 'clay_table', 'loom', 'drying_rack', 'tanning_trough', 'casting_bench', 'alloy_pot',
  ],

  items: [
    'flint_hammer', 'bronze_hammer', 'bronze_pickaxe_head', 'bronze_axe_head', 'bronze_shovel_head', 'bronze_hoe_head', 'bronze_maul_head',
    'copper_bloom', 'tin_bloom', 'bronze_bloom', 'copper_plate', 'bronze_plate', 'soaked_hide', 'leather', 'cloth',
    'unfired_cup', 'unfired_cone', 'unfired_alloy_pot', 'unfired_ingot_mould', 'unfired_pickaxe_mould', 'unfired_axe_mould',
    'unfired_shovel_mould', 'unfired_hoe_mould', 'unfired_maul_mould',
    'ingot_mould', 'pickaxe_mould', 'axe_mould', 'shovel_mould', 'hoe_mould', 'maul_mould',
  ],

  blockProps: {
    chopping_block: { machine: 'hand', tool: 'axe', minTier: 0, power: null, shape: 'cube' },
    hand_quern: { machine: 'hand', tool: 'pickaxe', minTier: 0, power: null, shape: 'slab' },
    stone_anvil: { machine: 'hand', tool: 'pickaxe', minTier: 0, power: null, shape: 'cube' },
    mortar: { machine: 'hand', tool: 'pickaxe', minTier: 0, power: null, shape: 'slab' },
    clay_table: { machine: 'hand', tool: 'axe', minTier: 0, power: null, shape: 'cube' },
    loom: { machine: 'hand', tool: 'axe', minTier: 0, power: null, oriented: true },
    drying_rack: { machine: 'hand', tool: 'axe', minTier: 0, power: null },
    tanning_trough: { machine: 'hand', tool: 'axe', minTier: 0, power: null, shape: 'slab' },
    casting_bench: { machine: 'casting_bench', tool: 'pickaxe', minTier: 0, power: null },
    alloy_pot: { machine: 'alloy_pot', tool: 'pickaxe', minTier: 0, power: null, shape: 'slab' },
  } as Record<string, Partial<BlockDef>>,

  machines: {
    hand: ['hand', {}],
    casting_bench: ['hand', { moulds: 4, range: 4 }],
    alloy_pot: ['hand', { moltenS: 20 }],
  } as Record<string, [MachineRole, Numbers]>,

  /** Appended to the end of each older station's list, and the whole list of each new station. */
  recipes: {
    hand: [
      'chopping_block: 1 chopping_block <- 1 oak_log',
      'chopping_block_pine: 1 chopping_block <- 1 pine_log',
      'drying_rack: 1 drying_rack <- 3 stick, 1 cord',
      'flint_hammer: 1 flint_hammer <- 2 flint, 2 stick, 1 cord',
    ],
    workbench: [
      'hand_quern: 1 hand_quern <- 2 stone_brick, 1 stick',
      'stone_anvil: 1 stone_anvil <- 3 stone_brick',
      'clay_table: 1 clay_table <- 2 plank, 1 clay',
      'loom: 1 loom <- 4 plank, 2 stick, 2 cord',
      'tanning_trough: 1 tanning_trough <- 4 plank, 1 water_pail',
      'bronze_hammer: 1 bronze_hammer <- 2 bronze_ingot, 2 stick, 1 cord',
      'bronze_pickaxe: 1 bronze_pickaxe <- 1 bronze_pickaxe_head, 2 stick, 1 cord',
      'bronze_axe: 1 bronze_axe <- 1 bronze_axe_head, 2 stick, 1 cord',
      'bronze_shovel: 1 bronze_shovel <- 1 bronze_shovel_head, 2 stick, 1 cord',
      'bronze_hoe: 1 bronze_hoe <- 1 bronze_hoe_head, 2 stick, 1 cord',
      'bronze_maul: 1 bronze_maul <- 1 bronze_maul_head, 2 stick, 1 cord',
    ],
    furnace: [
      'mortar: 1 mortar <- 1 clay @400 T1',
      'casting_bench: 1 casting_bench <- 2 stone_brick, 1 clay @400 T1',
      'clay_cup_fired: 1 clay_cup <- 1 unfired_cup @500 8s T1',
      'drip_cone_fired: 1 drip_cone <- 1 unfired_cone @500 8s T1',
      'alloy_pot: 1 alloy_pot <- 1 unfired_alloy_pot @500 8s T1',
      'ingot_mould: 1 ingot_mould <- 1 unfired_ingot_mould @500 8s T1',
      'pickaxe_mould: 1 pickaxe_mould <- 1 unfired_pickaxe_mould @500 8s T1',
      'axe_mould: 1 axe_mould <- 1 unfired_axe_mould @500 8s T1',
      'shovel_mould: 1 shovel_mould <- 1 unfired_shovel_mould @500 8s T1',
      'hoe_mould: 1 hoe_mould <- 1 unfired_hoe_mould @500 8s T1',
      'maul_mould: 1 maul_mould <- 1 unfired_maul_mould @500 8s T1',
      'copper_ingot_bloom: 1 copper_ingot <- 1 copper_bloom @700 6s T1',
      'tin_ingot_bloom: 1 tin_ingot <- 1 tin_bloom @250 5s T1',
      'bronze_ingot_bloom: 1 bronze_ingot <- 1 bronze_bloom @800 6s T1',
    ],
    chopping_block: [
      'plank: 4 plank <- 1 oak_log',
      'plank_pine: 4 plank <- 1 pine_log',
      'stick: 4 stick <- 1 plank',
    ],
    hand_quern: [
      'flour: 1 flour <- 1 wheat',
    ],
    stone_anvil: [
      'copper_plate: 1 copper_plate <- 2 copper_ingot',
      'bronze_plate: 1 bronze_plate <- 2 bronze_ingot',
      'copper_wire: 3 copper_wire <- 1 copper_ingot',
    ],
    mortar: [
      'crushed_copper_mortar: 1 crushed_copper <- 1 copper_ore',
      'crushed_tin_mortar: 1 crushed_tin <- 1 tin_ore',
    ],
    clay_table: [
      'unfired_maul_mould: 1 unfired_maul_mould <- 9 clay',
      'unfired_pickaxe_mould: 1 unfired_pickaxe_mould <- 8 clay',
      'unfired_axe_mould: 1 unfired_axe_mould <- 7 clay',
      'unfired_hoe_mould: 1 unfired_hoe_mould <- 6 clay',
      'unfired_shovel_mould: 1 unfired_shovel_mould <- 5 clay',
      'unfired_alloy_pot: 1 unfired_alloy_pot <- 4 clay',
      'unfired_ingot_mould: 1 unfired_ingot_mould <- 3 clay',
      'unfired_cone: 1 unfired_cone <- 2 clay',
      'unfired_cup: 1 unfired_cup <- 1 clay',
    ],
    loom: [
      'cloth: 1 cloth <- 4 fiber',
    ],
    tanning_trough: [
      'soaked_hide: 2 soaked_hide <- 2 hide',
    ],
    drying_rack: [
      'leather: 2 leather <- 2 soaked_hide',
    ],
    alloy_pot: ['bronze_ingot_alloy: 4 bronze_ingot <- 3 copper_ingot, 1 tin_ingot'],
  } as Record<string, string[]>,
};
