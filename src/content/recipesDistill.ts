/**
 * Recipes of the glass distillery (docs/DISTILLERY_PLAN.md 7, 8).
 *
 * Forge rows make the glassware. The PROCESS rows are the process cards: a typical run of a rig written as a recipe
 * at the station of the module that defines it, so the Codex lists it and the progression solver knows what a rig
 * can make. The rig itself works on litres, not on these rows (src/sim/distill.ts); src/sim/distillProcess.test.ts
 * builds every card's rig from its `rig` string and checks it makes at least the card's outputs from its inputs.
 * `minTempC` is the still base setting the card is run at.
 */
import { ESSENCE_DRINKS } from '../core/distill';
import type { ItemAmount, RecipeSpec } from '../core/types';

function amounts(s: string): ItemAmount[] {
  return s.split(',').map((p) => {
    const [n, item] = p.trim().split(/\s+/);
    return item === undefined ? { item: n, count: 1 } : { item, count: Number(n) };
  });
}

function forge(minTier: number, output: string, inputs: string, minTempC: number, byproducts?: string, id?: string): RecipeSpec {
  const out = amounts(output)[0];
  const spec: RecipeSpec = { id: id ?? out.item, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: out, minTempC, minTier, age: minTier - 1 };
  return byproducts ? { ...spec, byproducts: amounts(byproducts) } : spec;
}

/** A process card: inputs -> output (+ byproducts) at the station of its defining module, `minTempC` on the base. */
export interface ProcessCard extends RecipeSpec {
  /**
   * How the rig stands, one layer per '/'-separated row, TOP layer first; each layer is a row of cells along +x.
   * Legend: B still base, F flask, V reaction vessel, | column segment, C condenser, R receiver, T tube,
   * J cooling jacket, A airlock cap, . air. The furnace goes under every B.
   */
  rig: string;
}

function card(id: string, station: string, inputs: string, output: string, byproducts: string, setC: number, timeS: number, age: number, rig: string): ProcessCard {
  return { id, station, inputs: amounts(inputs), output: amounts(output)[0], byproducts: byproducts ? amounts(byproducts) : [], minTempC: setC, timeS, age, rig };
}

export const DISTILL_FORGE: RecipeSpec[] = [
  forge(1, 'still_base', '2 copper_ingot, 2 firebrick', 700),
  forge(1, 'boiling_flask', '3 glass', 700),
  forge(1, 'condenser_coil', '2 glass, 1 copper_ingot', 700),
  forge(1, 'receiver', '2 glass', 700),
  forge(1, '4 glass_tube', '1 glass', 700),
  forge(1, 'reaction_vessel', '4 glass, 1 copper_ingot', 700),
  forge(1, 'airlock_cap', '1 glass, 1 tin_ingot', 650),
  forge(3, 'column_segment', '2 glass, 1 iron_plate', 1000),
  forge(3, 'cooling_jacket', '2 iron_plate, 2 glass', 1000),
  forge(3, 'chem_port', '2 iron_plate, 1 glass', 1000),
  forge(3, '2 empty_canister', '2 iron_plate', 1000),
  // Same glass costs as the module they sit beside. Vacuum is Current Age (tier 4 after the six-age renumbering), like the plan's age table.
  forge(1, 'filter_bed', '2 glass', 700),
  forge(3, 'reflux_head', '2 glass, 1 iron_plate', 1000),
  forge(4, 'vacuum_cap', '1 glass, 1 steel_plate', 1300),
];

const ESSENCE_CARDS: ProcessCard[] = [
  ...ESSENCE_DRINKS.map((row) => card(`essence_${row.buff}`, 'vacuum_cap', `4 ${row.item}`, `1 ${row.essence}`, '', 60, 60, 3, 'U/CR/F./B.')),
  ...ESSENCE_DRINKS.map((row) => card(`elixir_${row.buff}`, 'reaction_vessel', `1 ${row.essence}, 2 clear_tincture_beaker, 2 syrup_beaker`, `4 ${row.elixir}`, '', 20, 60, 3, 'V')),
];

export const PROCESS_CARDS: ProcessCard[] = [
  card('distil_syrup', 'boiling_flask', '4 pine_sap', '1 syrup_beaker', '3 glass_beaker', 130, 120, 0, 'CR/F./B.'),
  card('ferment_wash', 'reaction_vessel', '1 syrup_beaker, 1 water_pail, 4 glass_beaker', '5 wash_beaker', '1 pail', 20, 110, 0, 'A/V'),
  card('distil_low_wines', 'boiling_flask', '16 wash_beaker', '1 low_wines_beaker', '15 glass_beaker', 97, 70, 0, 'CR/F./B.'),
  card('distil_spirit', 'boiling_flask', '8 low_wines_beaker', '1 spirit_beaker', '7 glass_beaker', 92, 60, 0, 'CR/F./B.'),
  card('refine_crude', 'column_segment', '8 crude_canister', '2 diesel_canister', '1 gasoline_canister, 1 kerosene_canister, 2 residue_canister, 2 empty_canister', 350, 260, 2,
    '..CR/..|./RC|./..|CR/..F/..B'),
  card('rectify_spirit', 'column_segment', '4 spirit_beaker', '1 fuel_ethanol_beaker', '3 glass_beaker', 92, 60, 2, 'CR/|./|./F./B.'),
  // Too short a column: gasoline and kerosene come over together as slop (stack height is the number of cuts).
  card('refine_crude_short', 'column_segment', '4 crude_canister', '1 diesel_canister', '1 slop_canister, 1 residue_canister, 1 empty_canister', 350, 130, 2,
    '.CR/.|./.|CR/.F/.B'),
  // Vacuum residue run (330 C): lube base overhead, bitumen left in the flask.
  card('vacuum_residue', 'vacuum_cap', '4 residue_canister', '1 lube_base_canister', '1 bitumen_canister', 330, 260, 3, 'U/CR/F./B.'),
  card('filter_lubricant', 'filter_bed', '1 lube_base_canister, 1 clay', '1 lubricant_canister', '', 20, 60, 3, 'X'),
  card('macerate_tincture', 'reaction_vessel', '1 spirit_beaker, 1 tea_leaves', '1 tincture_beaker', '', 60, 60, 0, 'V/B'),
  card('filter_tincture', 'filter_bed', '1 tincture_beaker, 1 charcoal', '1 clear_tincture_beaker', '', 20, 60, 0, 'X'),
  card('mix_asphalt', 'reaction_vessel', '1 bitumen_canister, 1 gravel, 1 sand', '8 asphalt', '', 150, 60, 3, 'V/B'),
  ...ESSENCE_CARDS,
];

/** Block key of each rig legend letter. */
export const RIG_LEGEND: Readonly<Record<string, string>> = {
  B: 'still_base', F: 'boiling_flask', V: 'reaction_vessel', '|': 'column_segment', C: 'condenser_coil', R: 'receiver', T: 'glass_tube',
  J: 'cooling_jacket', A: 'airlock_cap', P: 'chem_port', H: 'reflux_head', X: 'filter_bed', U: 'vacuum_cap',
};

/** Every distinct block a rig string needs. */
export function rigBlocks(rig: string): string[] {
  return [...new Set([...rig].map((ch) => RIG_LEGEND[ch]).filter((k): k is string => k !== undefined))];
}

export const PROCESS_BY_ID: ReadonlyMap<string, ProcessCard> = new Map(PROCESS_CARDS.map((c) => [c.id, c]));

/**
 * Essence and elixir cards stay in PROCESS_CARDS (the still really does run them) but not in the recipe book:
 * brewing.test forbids a drink item as any recipe input, and an elixir row would be unreachable without that.
 * S10 can register them once that rule has an exception. The items are listed as world-only until then.
 */
const BOOK_CARDS = PROCESS_CARDS.filter((c) => !c.id.startsWith('essence_') && !c.id.startsWith('elixir_'));

export const DISTILL_RECIPES: RecipeSpec[] = [...DISTILL_FORGE, ...BOOK_CARDS.map(({ rig: _rig, ...r }) => r)];
