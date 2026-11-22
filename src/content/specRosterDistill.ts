/**
 * Test fixture: the roster of the glass distillery (docs/DISTILLERY_PLAN.md), typed in a second time from the plan.
 * specRoster.ts merges its blocks, items, machines, block properties and recipes into the roster (all of them come
 * last: the distillery's content files are appended after everything else); specRosterTech.ts lists its fluids and the
 * chemistry port. Nothing but the tests imports this file.
 */
import type { BlockDef, MachineRole } from '../core/types';

type Numbers = Record<string, number>;
const glassCase = (machine: string, props: Partial<BlockDef> = {}): Partial<BlockDef> => ({
  machine, shape: 'cube', solid: true, opaque: false, translucent: true, tool: 'pickaxe', minTier: 0, power: null, ...props,
});

export const DISTILL_SPEC = {
  // New faces this module adds on top of the distillery textures already inside the base budget:
  // reflux / vacuum (idle+lit), filter (idle+lit+done+blocked), asphalt, 5 containers, 12 potion vials.
  textures: 25,
  blocks: [
    'still_base', 'boiling_flask', 'boiling_flask_done', 'reaction_vessel', 'reaction_vessel_done', 'column_segment', 'condenser_coil',
    'cooling_jacket', 'receiver', 'receiver_done', 'glass_tube', 'airlock_cap', 'chem_port',
    'reflux_head', 'filter_bed', 'filter_bed_done', 'vacuum_cap', 'asphalt',
  ],

  items: [
    'syrup_beaker', 'wash_beaker', 'low_wines_beaker', 'spirit_beaker', 'fuel_ethanol_beaker',
    'empty_canister', 'crude_canister', 'gasoline_canister', 'kerosene_canister', 'diesel_canister', 'residue_canister', 'slop_canister',
    'lube_base_canister', 'bitumen_canister', 'lubricant_canister', 'tincture_beaker', 'clear_tincture_beaker',
    'essence_spring', 'elixir_spring', 'essence_hearthkept', 'elixir_hearthkept', 'essence_mending', 'elixir_mending',
    'essence_swift', 'elixir_swift', 'essence_vigor', 'elixir_vigor', 'essence_lasting', 'elixir_lasting',
  ],

  blockProps: {
    still_base: glassCase('still_base', { itemKey: 'still_base', lightActive: 6 }),
    boiling_flask: glassCase('boiling_flask', { itemKey: 'boiling_flask', lightActive: 3 }),
    boiling_flask_done: glassCase('boiling_flask', { itemKey: null, drops: [{ item: 'boiling_flask', count: 1 }], lightActive: 0 }),
    reaction_vessel: glassCase('reaction_vessel', { itemKey: 'reaction_vessel' }),
    reaction_vessel_done: glassCase('reaction_vessel', { itemKey: null, drops: [{ item: 'reaction_vessel', count: 1 }] }),
    receiver: glassCase('receiver', { itemKey: 'receiver' }),
    receiver_done: glassCase('receiver', { itemKey: null, drops: [{ item: 'receiver', count: 1 }] }),
    column_segment: glassCase('column_segment'),
    condenser_coil: glassCase('condenser_coil'),
    cooling_jacket: glassCase('cooling_jacket'),
    glass_tube: glassCase('glass_tube'),
    airlock_cap: glassCase('airlock_cap', { shape: 'slab' }),
    chem_port: glassCase('chem_port'),
    reflux_head: glassCase('reflux_head'),
    filter_bed: glassCase('filter_bed', { itemKey: 'filter_bed', lightActive: 2 }),
    filter_bed_done: glassCase('filter_bed', { itemKey: null, drops: [{ item: 'filter_bed', count: 1 }], lightActive: 0 }),
    vacuum_cap: glassCase('vacuum_cap', { shape: 'slab' }),
  } as Record<string, Partial<BlockDef>>,

  machines: {
    still_base: ['chem', {}],
    boiling_flask: ['chem', { capacityL: 4000 }],
    reaction_vessel: ['chem', { capacityL: 4000 }],
    column_segment: ['chem', {}],
    condenser_coil: ['chem', { capacityL: 100 }],
    cooling_jacket: ['chem', { capacityL: 1000 }],
    receiver: ['chem', { capacityL: 2000 }],
    glass_tube: ['chem', { capacityL: 50 }],
    airlock_cap: ['chem', {}],
    chem_port: ['chem', {}],
    reflux_head: ['chem', {}],
    filter_bed: ['chem', { capacityL: 500 }],
    vacuum_cap: ['chem', {}],
  } as Record<string, [MachineRole, Numbers]>,

  /** Appended to the end of each station's list, in this order. */
  recipes: {
    furnace: [
      'still_base: 1 still_base <- 2 copper_ingot, 2 firebrick @700 T1',
      'boiling_flask: 1 boiling_flask <- 3 glass @700 T1',
      'condenser_coil: 1 condenser_coil <- 2 glass, 1 copper_ingot @700 T1',
      'receiver: 1 receiver <- 2 glass @700 T1',
      'glass_tube: 4 glass_tube <- 1 glass @700 T1',
      'reaction_vessel: 1 reaction_vessel <- 4 glass, 1 copper_ingot @700 T1',
      'airlock_cap: 1 airlock_cap <- 1 glass, 1 tin_ingot @650 T1',
      'column_segment: 1 column_segment <- 2 glass, 1 iron_plate @1000 T2',
      'cooling_jacket: 1 cooling_jacket <- 2 iron_plate, 2 glass @1000 T2',
      'chem_port: 1 chem_port <- 2 iron_plate, 1 glass @1000 T2',
      'empty_canister: 2 empty_canister <- 2 iron_plate @1000 T2',
      'filter_bed: 1 filter_bed <- 2 glass @700 T1',
      'reflux_head: 1 reflux_head <- 2 glass, 1 iron_plate @1000 T2',
      'vacuum_cap: 1 vacuum_cap <- 1 glass, 1 steel_plate @1300 T3',
    ],
    boiling_flask: [
      'distil_syrup: 1 syrup_beaker <- 4 pine_sap 120s 0J',
      'distil_low_wines: 1 low_wines_beaker <- 16 wash_beaker 70s 0J',
      'distil_spirit: 1 spirit_beaker <- 8 low_wines_beaker 60s 0J',
    ],
    reaction_vessel: [
      'ferment_wash: 5 wash_beaker <- 1 syrup_beaker, 1 water_pail, 4 glass_beaker 110s 0J',
      'macerate_tincture: 1 tincture_beaker <- 1 spirit_beaker, 1 tea_leaves 60s 0J',
      'mix_asphalt: 8 asphalt <- 1 bitumen_canister, 1 gravel, 1 sand 60s 0J',
    ],
    filter_bed: [
      'filter_lubricant: 1 lubricant_canister <- 1 lube_base_canister, 1 clay 60s 0J',
      'filter_tincture: 1 clear_tincture_beaker <- 1 tincture_beaker, 1 charcoal 60s 0J',
    ],
    vacuum_cap: [
      'vacuum_residue: 1 lube_base_canister <- 4 residue_canister 260s 0J',
    ],
    column_segment: [
      'refine_crude: 2 diesel_canister <- 8 crude_canister 260s 0J',
      'rectify_spirit: 1 fuel_ethanol_beaker <- 4 spirit_beaker 60s 0J',
      'refine_crude_short: 1 diesel_canister <- 4 crude_canister 130s 0J',
    ],
  } as Record<string, string[]>,
};

/** Recipes the distillery adds (the count content.test.ts adds to its total). */
export const DISTILL_RECIPE_COUNT = Object.values(DISTILL_SPEC.recipes).reduce((n, l) => n + l.length, 0);
