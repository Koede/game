/**
 * Keys and numbers of the glass distillery (docs/DISTILLERY_PLAN.md) shared by content, sim, player and render.
 * Pure data: the mixture physics is src/core/chem.ts, the behaviour src/sim/distill*.ts.
 */

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
} as const;

export type ChemRole = keyof typeof CHEM;
export type ChemKind = (typeof CHEM)[ChemRole];

export const CHEM_KINDS: readonly ChemKind[] = Object.values(CHEM);
const roleByKind = new Map<string, ChemRole>(Object.entries(CHEM).map(([r, k]) => [k, r as ChemRole]));

/** The `_done` block twin of a stateful module (shows "step complete" and, with the active bit, "blocked"). */
export const DONE_SUFFIX = '_done';
/** Modules with a `_done` twin. */
export const STATEFUL: readonly ChemKind[] = [CHEM.flask, CHEM.vessel, CHEM.receiver];

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
};

/** The temperatures a still base can be set to (tap it with an empty hand to step through them). */
export const STILL_SETPOINTS: readonly number[] = [78, 92, 97, 130, 200, 260, 350, 420];
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
  fuel_ethanol_beaker: { saw: 0.25, tractor: 0.2, empty: EMPTY_BEAKER },
};
export const fuelGrade = (item: string): FuelGrade | null => FUEL_GRADES[item] ?? null;
