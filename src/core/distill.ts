/**
 * Keys and numbers of the glass distillery (docs/DISTILLERY_PLAN.md) shared by content, sim, player and render.
 * Pure data: the mixture physics is src/core/chem.ts, the behaviour src/sim/distill*.ts.
 */
import type { DrinkBuff, DrinkFamily } from './types';

/** Every chemistry module kind. The kind is also the key of its block and of its MachineSpec. */
export const CHEM = {
  base: 'still_base',
  flask: 'boiling_flask',
  vessel: 'reaction_vessel',
  segment: 'column_segment',
  condenser: 'condenser_coil',
  jacket: 'cooling_jacket',
  receiver: 'receiver',
  tube: 'glass_tube',
  airlock: 'airlock_cap',
  port: 'chem_port',
  reflux: 'reflux_head',
  filter: 'filter_bed',
  vacuum: 'vacuum_cap',
  funnel: 'separatory_funnel',
} as const;

export type ChemRole = keyof typeof CHEM;
export type ChemKind = (typeof CHEM)[ChemRole];

export const CHEM_KINDS: readonly ChemKind[] = Object.values(CHEM);
const roleByKind = new Map<string, ChemRole>(Object.entries(CHEM).map(([r, k]) => [k, r as ChemRole]));

/** The `_done` block twin of a stateful module (shows "step complete" and, with the active bit, "blocked"). */
export const DONE_SUFFIX = '_done';
/** Modules with a `_done` twin. */
export const STATEFUL: readonly ChemKind[] = [CHEM.flask, CHEM.vessel, CHEM.receiver, CHEM.filter, CHEM.funnel];

/** The module kind of a block key (`boiling_flask_done` -> `boiling_flask`), or null. */
export function chemKindOf(blockKey: string): ChemKind | null {
  const k = blockKey.endsWith(DONE_SUFFIX) ? blockKey.slice(0, -DONE_SUFFIX.length) : blockKey;
  return roleByKind.has(k) ? (k as ChemKind) : null;
}
export const chemRoleOf = (blockKey: string): ChemRole | null => {
  const k = chemKindOf(blockKey);
  return k ? roleByKind.get(k)! : null;
};

/**
 * The four states a module shows on its block (plan 2.1): two block variants x the voxel's active bit.
 *   idle     plain block, bit off   (dark lamp)
 *   working  plain block, bit on    (amber lamp)
 *   done     _done block,  bit off  (green lamp: the step is complete)
 *   blocked  _done block,  bit on   (red lamp: it cannot go on)
 */
export type ChemState = 'idle' | 'working' | 'done' | 'blocked';
export const stateLook = (state: ChemState): { done: boolean; active: boolean } => ({
  done: state === 'done' || state === 'blocked',
  active: state === 'working' || state === 'blocked',
});

/** Litres each module holds (0: none). */
export const CHEM_CAPACITY_L: Readonly<Record<ChemKind, number>> = {
  still_base: 0, boiling_flask: 4000, reaction_vessel: 4000, column_segment: 0, condenser_coil: 100,
  cooling_jacket: 1000, receiver: 2000, glass_tube: 50, airlock_cap: 0, chem_port: 0,
  reflux_head: 0, filter_bed: 500, vacuum_cap: 0, separatory_funnel: 1000,
};

/** Seconds a separatory funnel's layers take to settle before it lets the bottom one out. */
export const SETTLE_S = 3;

/** The temperatures a still base can be set to (tap it with an empty hand to step through them). */
/** Includes the potion still (60), the asphalt vessel (150) and the vacuum residue run (330). */
export const STILL_SETPOINTS: readonly number[] = [60, 78, 92, 97, 130, 150, 200, 260, 330, 350, 420];
export const STILL_DEFAULT_C = 97;
/** Glassware cracks past this; a hotter furnace is fine, the base only lets this much through. */
export const GLASS_MAX_C = 450;

/** The simulation steps chemistry at this rate (Hz). */
export const CHEM_STEP_HZ = 4;
/** Litres per second a still boils at full heat (it slows within 2 C of its bubble point). */
export const BOIL_LPS = 20;
/** Joules of furnace heat per litre boiled (20 L/s -> 8 kW drawn from the furnace below). */
export const BOIL_J_PER_L = 400;
/** Litres per second one condenser coil condenses; a watered cooling jacket touching it triples that. */
export const CONDENSE_LPS = 10;
export const JACKET_MULT = 3;
/** Head of a column (C): air-cooled, or with a watered jacket on the head condenser. */
export const HEAD_C = 60;
export const HEAD_JACKET_C = 30;
/** Litres per second along one liquid edge, divided by the square root of the liquid's viscosity. */
export const FLOW_LPS = 40;
/** Most column segments in one stack. */
export const MAX_SEGMENTS = 8;
/** Most modules in one rig. */
export const MAX_MODULES = 64;
/** Fermenting: litres of sugars turned per second; stops when ethanol reaches this share (the yeast gives up). */
export const FERMENT_LPS = 1.5;
export const FERMENT_MAX_ETHANOL = 0.14;
/** Too sweet to ferment above this share of sugars ("add water"). */
export const FERMENT_MAX_SUGARS = 0.3;
export const FERMENT_MIN_C = 10;
export const FERMENT_MAX_C = 40;
/** Seconds a receiver counts as "working" after liquid last arrived. */
export const RECEIVE_HOLD_S = 2;

/** A container item that carries a fluid into or out of a rig. */
export interface ChemContainer {
  fluid: string;
  litres: number;
  /** The empty container handed back when it is poured. */
  empty: string;
}

export const EMPTY_BEAKER = 'glass_beaker';
export const EMPTY_CANISTER = 'empty_canister';
export const BEAKER_L = 250;
export const CANISTER_L = 1000;

const beaker = (fluid: string): ChemContainer => ({ fluid, litres: BEAKER_L, empty: EMPTY_BEAKER });
const canister = (fluid: string): ChemContainer => ({ fluid, litres: CANISTER_L, empty: EMPTY_CANISTER });

/** Every full container, by item key. The first entry for an (empty, fluid) pair is what that empty fills to. */
export const CHEM_CONTAINERS: Readonly<Record<string, ChemContainer>> = {
  water_pail: { fluid: 'water', litres: 1000, empty: 'pail' },
  pine_sap: beaker('sap'),
  syrup_beaker: beaker('syrup'),
  wash_beaker: beaker('sugar_wash'),
  low_wines_beaker: beaker('low_wines'),
  spirit_beaker: beaker('spirit'),
  fuel_ethanol_beaker: beaker('fuel_ethanol'),
  crude_canister: canister('crude_oil'),
  gasoline_canister: canister('gasoline'),
  kerosene_canister: canister('kerosene'),
  diesel_canister: canister('diesel'),
  residue_canister: canister('residue'),
  slop_canister: canister('slop'),
  lube_base_canister: canister('lube_base'),
  bitumen_canister: canister('bitumen'),
  lubricant_canister: canister('lubricant'),
  tincture_beaker: beaker('tincture'),
  clear_tincture_beaker: beaker('clear_tincture'),
};

/** The full container an empty one becomes when it takes `fluid`, or null when it cannot hold it. */
export function filledWith(emptyKey: string, fluid: string): string | null {
  for (const k in CHEM_CONTAINERS) {
    const c = CHEM_CONTAINERS[k];
    if (c.empty === emptyKey && c.fluid === fluid) return k;
  }
  return null;
}
export const isEmptyChemContainer = (key: string): boolean => Object.values(CHEM_CONTAINERS).some((c) => c.empty === key);

/**
 * Engine fuels (plan 8.1): what one container is worth to each consumer, as a multiple of the old Fuel Canister.
 * 0 = that engine refuses it. `empty` is handed back after refuelling (the old Fuel Canister is used up whole).
 */
export interface FuelGrade {
  saw: number;
  tractor: number;
  empty: string | null;
}
export const FUEL_GRADES: Readonly<Record<string, FuelGrade>> = {
  fuel_canister: { saw: 1, tractor: 1, empty: null },
  gasoline_canister: { saw: 1.3, tractor: 1.2, empty: EMPTY_CANISTER },
  diesel_canister: { saw: 0, tractor: 1.5, empty: EMPTY_CANISTER },
  // Kerosene: a tractor burns it, one canister per canister; a two-stroke saw would choke on it.
  kerosene_canister: { saw: 0, tractor: 1, empty: EMPTY_CANISTER },
  fuel_ethanol_beaker: { saw: 0.25, tractor: 0.2, empty: EMPTY_BEAKER },
};
export const fuelGrade = (item: string): FuelGrade | null => FUEL_GRADES[item] ?? null;

// ---- modules added after the first slice (docs/DISTILLERY_PLAN.md 2, 8, 15) --------------------------------

/** Ground burner, used only when no hot furnace sits under the still base. */
export const BURNER_C = { charcoal: 250, fuel_ethanol_beaker: 300 } as const;
export const burnerTemp = (item: string): number | null =>
  item === 'charcoal' ? BURNER_C.charcoal : item === 'fuel_ethanol_beaker' ? BURNER_C.fuel_ethanol_beaker : null;

/** Wrench cycles a reflux head through these returns. Plates are multiplied by (1 + 2 r). */
export const REFLUX_RATIOS = [0, 0.5, 0.75] as const;
export type RefluxRatio = (typeof REFLUX_RATIOS)[number];
export const nextReflux = (current: number): RefluxRatio => {
  const i = (REFLUX_RATIOS as readonly number[]).indexOf(current);
  return REFLUX_RATIOS[(i < 0 ? 0 : i + 1) % REFLUX_RATIOS.length];
};
export const isRefluxRatio = (n: number): n is RefluxRatio => (REFLUX_RATIOS as readonly number[]).includes(n);

/** A vacuum cap on the stack multiplies every boiling point by this. No shaft power (that hook is skipped). */
export const VACUUM_BP = 0.7;

/** Filter bed: one of these in the slot, and it is used up. Clay on lube base becomes lubricant. */
export const FILTER_MEDIA = ['charcoal', 'sand', 'clay'] as const;
export const isFilterMedium = (item: string): boolean => (FILTER_MEDIA as readonly string[]).includes(item);

/** Herb in the plan is the tea the game already grows. Glowcap and berries are the other two it names. */
export const TINCTURE_BOTANICALS = ['tea_leaves', 'dried_tea', 'black_tea', 'glowcap', 'wildberries'] as const;
export const isBotanical = (item: string): boolean => (TINCTURE_BOTANICALS as readonly string[]).includes(item);

export const TINCTURE_C = 50;
export const ESSENCE_COUNT = 4;
export const ESSENCE_SET_C = 60;
export const ESSENCE_RUIN_C = 80;
export const ASPHALT_C = 150;
export const ASPHALT_COUNT = 8;
export const ELIXIR_VIALS = 4;
export const ELIXIR_BATCH_L = 1000;
export const ELIXIR_TIME_MULT = 3;
export const ELIXIR_STRENGTH_ADD = 1;

/** Walking and tractor speed on asphalt. S10 applies these; nothing in the player or vehicle code reads them yet. */
export const ROAD_SPEED = { walk: 1.25, tractor: 1.4 } as const;
export const ASPHALT_BLOCK = 'asphalt';
export const roadSpeedOf = (blockKey: string): { walk: number; tractor: number } | null =>
  blockKey === ASPHALT_BLOCK ? ROAD_SPEED : null;

/** A lubricant canister in the pack halves chainsaw bar wear (felling.ts). */
export const LUBE_CANISTER = 'lubricant_canister';
export const BAR_OIL_WEAR = 0.5;

export interface EssenceDrink {
  item: string;
  buff: DrinkBuff;
  family: DrinkFamily;
  essence: string;
  elixir: string;
}

/** One row per brewed drink. Essence and elixir items are named from the buff, not a new effect. */
export const ESSENCE_DRINKS: readonly EssenceDrink[] = [
  { item: 'green_tea', buff: 'spring', family: 'tea', essence: 'essence_spring', elixir: 'elixir_spring' },
  { item: 'black_tea_cup', buff: 'hearthkept', family: 'tea', essence: 'essence_hearthkept', elixir: 'elixir_hearthkept' },
  { item: 'berry_tea', buff: 'mending', family: 'tea', essence: 'essence_mending', elixir: 'elixir_mending' },
  { item: 'light_roast', buff: 'swift', family: 'coffee', essence: 'essence_swift', elixir: 'elixir_swift' },
  { item: 'dark_roast', buff: 'vigor', family: 'coffee', essence: 'essence_vigor', elixir: 'elixir_vigor' },
  { item: 'trail_blend_cup', buff: 'lasting', family: 'coffee', essence: 'essence_lasting', elixir: 'elixir_lasting' },
];

export const essenceDrink = (item: string): EssenceDrink | null => ESSENCE_DRINKS.find((d) => d.item === item) ?? null;
export const drinkOfEssence = (item: string): EssenceDrink | null => ESSENCE_DRINKS.find((d) => d.essence === item) ?? null;

export interface ElixirGrant {
  item: string;
  source: string;
  buff: DrinkBuff;
  family: DrinkFamily;
  /** The source drink's buffS times {@link ELIXIR_TIME_MULT}. */
  buffS: number;
  /** Added to the drink's strength. Drinks have no strength field; this is the only bonus. */
  strengthAdd: number;
}

/** What drinking an elixir should grant. drink.ts does not read this yet: S10 wires it. */
export function elixirGrant(row: EssenceDrink, sourceBuffS: number): ElixirGrant {
  return {
    item: row.elixir,
    source: row.item,
    buff: row.buff,
    family: row.family,
    buffS: sourceBuffS * ELIXIR_TIME_MULT,
    strengthAdd: ELIXIR_STRENGTH_ADD,
  };
}
