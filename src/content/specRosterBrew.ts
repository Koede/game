/**
 * Test fixture: the roster of brewing (BREWING_PLAN 3, 11), typed in a second time from the plan. specRoster.ts merges
 * its blocks, items, machines, block properties and recipes into the roster; brewing.test.ts checks the rest.
 * Nothing but the tests imports this file.
 */
import type { BlockDef, MachineRole } from '../core/types';

type Numbers = Record<string, number>;
const cross = (props: Partial<BlockDef> = {}): Partial<BlockDef> => ({ shape: 'cross', solid: false, opaque: false, ...props });
const small = (shape: 'cup' | 'bucket', props: Partial<BlockDef> = {}): Partial<BlockDef> => ({ shape, solid: false, opaque: false, ...props });
const TOPS = ['furnace_clay', 'furnace_bronze', 'furnace_blast', 'furnace_arc', 'furnace_plasma', 'furnace_star', 'brick', 'refractory_brick', 'plasma_casing', 'star_casing'];

export const BREW_SPEC = {
  blocks: [
    'tea_bush', 'tea_bush_bare', 'coffee_shrub', 'coffee_shrub_bare', 'clay_cup', 'cup_cone', 'cup_cone_loaded', 'cup_brewing', 'cup_full',
    'furnace_bucket', 'furnace_bucket_boiling', 'kettle_pot',
  ],

  items: [
    'drip_cone', 'tea_cutting', 'coffee_cutting', 'tea_leaves', 'dried_tea', 'black_tea', 'berry_tea_blend', 'coffee_cherries', 'roasted_beans',
    'dark_beans', 'ground_coffee', 'ground_dark_coffee', 'trail_blend', 'boiling_pail',
    'green_tea', 'black_tea_cup', 'berry_tea', 'light_roast', 'dark_roast', 'trail_blend_cup',
  ],

  /** ingredient -> [drink item, buff, family]. */
  brews: {
    dried_tea: ['green_tea', 'spring', 'tea'], black_tea: ['black_tea_cup', 'hearthkept', 'tea'], berry_tea_blend: ['berry_tea', 'mending', 'tea'],
    ground_coffee: ['light_roast', 'swift', 'coffee'], ground_dark_coffee: ['dark_roast', 'vigor', 'coffee'], trail_blend: ['trail_blend_cup', 'lasting', 'coffee'],
  } as Record<string, string[]>,

  blockProps: {
    tea_bush: cross({ itemKey: null, machine: 'tea_bush', harvestLeaves: 'tea_bush_bare', drops: [{ item: 'tea_leaves', count: [2, 3] }, { item: 'tea_cutting', count: 1, chance: 0.25 }] }),
    tea_bush_bare: cross({ itemKey: null, machine: 'tea_bush', harvestLeaves: null, drops: [{ item: 'tea_cutting', count: 1 }] }),
    coffee_shrub: cross({ itemKey: null, machine: 'coffee_shrub', harvestLeaves: 'coffee_shrub_bare', drops: [{ item: 'coffee_cherries', count: [2, 3] }, { item: 'coffee_cutting', count: 1, chance: 0.25 }] }),
    coffee_shrub_bare: cross({ itemKey: null, machine: 'coffee_shrub', harvestLeaves: null, drops: [{ item: 'coffee_cutting', count: 1 }] }),
    clay_cup: small('cup', { itemKey: 'clay_cup', machine: 'brew_cup', placeOn: null }),
    cup_cone: small('cup', { itemKey: null, machine: 'brew_cup', drops: [{ item: 'clay_cup', count: 1 }, { item: 'drip_cone', count: 1 }] }),
    cup_cone_loaded: small('cup', { itemKey: null, machine: 'brew_cup' }),
    cup_brewing: small('cup', { itemKey: null, machine: 'brew_cup' }),
    cup_full: small('cup', { itemKey: null, machine: 'brew_cup' }),
    furnace_bucket: small('bucket', { itemKey: null, machine: 'boil_bucket', placeOn: TOPS, drops: [{ item: 'water_pail', count: 1 }] }),
    furnace_bucket_boiling: small('bucket', { itemKey: null, machine: 'boil_bucket', placeOn: TOPS, drops: [{ item: 'boiling_pail', count: 1 }] }),
    kettle_pot: small('bucket', { itemKey: 'kettle_pot', machine: 'kettle', placeOn: TOPS, tool: 'pickaxe', minTier: 0 }),
  } as Record<string, Partial<BlockDef>>,

  machines: {
    tea_bush: ['bush', { regrowS: 360 }],
    coffee_shrub: ['bush', { regrowS: 360 }],
    brew_cup: ['brew', { brewS: 4, steamS: 20, dripEveryS: 0.5 }],
    boil_bucket: ['brew', { boilC: 100, boilS: 12, dryS: 180, heatDrawW: 600, boilingDrawW: 300 }],
    kettle: ['brew', { boilC: 120, capacityL: 4000, fillL: 1000, drainL: 1000, heatDrawW: 600 }],
  } as Record<string, [MachineRole, Numbers]>,

  /** Appended to the end of each station's list, in this order. */
  recipes: {
    workbench: [
      'ground_coffee: 1 ground_coffee <- 2 roasted_beans',
      'ground_dark_coffee: 1 ground_dark_coffee <- 2 dark_beans',
      'berry_tea_blend: 1 berry_tea_blend <- 1 dried_tea, 2 wildberries',
      'trail_blend: 2 trail_blend <- 1 ground_coffee, 1 ground_dark_coffee',
    ],
    furnace: [
      'kettle_pot: 1 kettle_pot <- 3 copper_ingot @600 T1',
      'dried_tea: 1 dried_tea <- 1 tea_leaves @150 5s T1',
      'black_tea: 1 black_tea <- 1 dried_tea @250 6s T1',
      'roasted_beans: 1 roasted_beans <- 1 coffee_cherries @220 8s T1',
      'dark_beans: 1 dark_beans <- 1 roasted_beans @400 8s T1',
    ],
  } as Record<string, string[]>,

  /** Signatures (in the notation of content.test.ts) of the goals placed after `make bread 1`. */
  objectives: ['flag boiled_water', 'flag brewed', 'flag six_cups'],

  /** Drinks: item -> [buff, buffS, warmth]. */
  drinks: {
    green_tea: ['spring', 300, 0], black_tea_cup: ['hearthkept', 300, 10], berry_tea: ['mending', 300, 0],
    light_roast: ['swift', 300, 0], dark_roast: ['vigor', 300, 0], trail_blend_cup: ['lasting', 300, 0],
  } as Record<string, [string, number, number]>,
};
