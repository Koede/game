/**
 * Block entities of the simulation. Every entity is a plain JSON object stored in the world (the world saves
 * them as they are), so ALL machine state lives in plain fields. `SimNode` is the runtime wrapper the
 * simulation keeps next to each entity: cached surroundings and network membership, never saved.
 */
import { AMBIENT_TEMP_C } from '../core/constants';
import { furnaceTier, itemOrNull, machine } from '../core/registry';
import type { GameBus } from '../core/context';
import type { BlockEntity, FluidKey, IWorld, MachineSpec, RecipeDef, Slot } from '../core/types';
import type { PlayerState } from '../game/playerState';
import type { FurnaceStats, HearthSummary } from './hearthStats';
import type { Network } from './power';

export type IgnitionState = 'idle' | 'running' | 'failed' | 'done';

/** The furnace. `tier`, `tempC`, `lit`, `draft` and `ignited` are a cross-module contract (spec section 5). */
export interface FurnaceEntity extends BlockEntity {
  kind: 'furnace';
  tier: number;
  tempC: number;
  lit: boolean;
  draft: number;
  ignited: boolean;
  /** Firebox slots (tier.fuelSlots of them). */
  fuel: Slot[];
  /** The fuel item burning right now and the seconds of it left at no draft. */
  burnItem: string | null;
  burnLeftS: number;
  /** Fuel items seen in the firebox last tick: a rise while hot relights the fire. */
  fuelSeen: number;
  /** Crucibles as parallel arrays (index = crucible). */
  crucibleIn: Slot[];
  crucibleOut: Slot[];
  crucibleProgress: number[];
  crucibleRecipe: (string | null)[];
  /** Electric heating switch (only does anything from the tier that has electricHeatW). */
  electric: boolean;
  ignition: IgnitionState;
  ignitionProgressS: number;
  ignitionLowS: number;
  /** The formed hearth it sits in (spec 17), or null; saved so a loaded game runs on until the first scan confirms it. */
  hearth: HearthSummary | null;
  /** Tier it runs at: min(tier, the hearth's structural tier), 1 when it stands alone (spec 17.1). */
  effTier: number;
  // Figures of the last tick, for the UI and the network.
  flameC: number;
  rateCPerS: number;
  extractW: number;
  heatDemandW: number;
  demandW: number;
  deliveredW: number;
  availW: number;
}

/** Every other machine shares one shape; a kind only uses the fields that concern it. */
export interface MachineEntity extends BlockEntity {
  on: boolean;
  slots: Slot[];
  /** Processors: seconds into the current job. Bore rig: seconds into the current block. */
  progress: number;
  /** Processors: id of the recipe in progress. */
  recipe: string | null;
  /** Fuel generators: electric joules left in the item being burned. */
  fuelJ: number;
  /** Storage: joules held. */
  storedJ: number;
  /** Fission pile: core temperature, seconds spent above the meltdown temperature, warning state. */
  coreC: number;
  hotS: number;
  warned: boolean;
  alarmS: number;
  /** Bore rig: y of the block it mined last, and why it stopped ('' while it can go on). */
  depthY: number;
  halted: string;
  /**
   * Fluid buffers of machines with fluid ports (spec 16.2): what pipes or buckets put in, and what it hands out. A
   * machine whose `accepts` and `gives` share a fluid (the tank) keeps both in `fluidIn`.
   */
  fluidIn: FluidStack | null;
  fluidOut: FluidStack | null;
  // Figures of the last tick.
  availW: number;
  outW: number;
  demandW: number;
  f: number;
}

export type SimEntity = FurnaceEntity | MachineEntity;

/** Some litres of one fluid. */
export interface FluidStack {
  fluid: FluidKey;
  litres: number;
}

export const isFurnace = (e: BlockEntity | undefined): e is FurnaceEntity => e !== undefined && e.kind === 'furnace';

const emptySlots = (n: number): Slot[] => new Array<Slot>(n).fill(null);
/** Crucibles of a furnace standing alone (tier 1 numbers until a hearth forms around it; the arrays grow then). */
const LONE = furnaceTier(1).crucibles;

export function createFurnace(x: number, y: number, z: number, tier: number): FurnaceEntity {
  const spec = furnaceTier(tier);
  return {
    kind: 'furnace', x, y, z, tier, tempC: AMBIENT_TEMP_C, lit: false, draft: 0, ignited: false,
    fuel: emptySlots(spec.fuelSlots), burnItem: null, burnLeftS: 0, fuelSeen: 0,
    crucibleIn: emptySlots(LONE), crucibleOut: emptySlots(LONE),
    crucibleProgress: new Array<number>(LONE).fill(0),
    crucibleRecipe: new Array<string | null>(LONE).fill(null),
    electric: true, ignition: 'idle', ignitionProgressS: 0, ignitionLowS: 0, hearth: null, effTier: 1,
    flameC: AMBIENT_TEMP_C, rateCPerS: 0, extractW: 0, heatDemandW: 0, demandW: 0, deliveredW: 0, availW: 0,
  };
}

/**
 * Grows the firebox in place when the tier changes (the arrays are wrapped by inventories, so never replaced). The
 * crucibles follow the effective stats instead (src/sim/hearth.ts grows them when a hearth grants more).
 */
export function resizeFurnace(e: FurnaceEntity, tier: number): void {
  const spec = furnaceTier(tier);
  e.tier = tier;
  while (e.fuel.length < spec.fuelSlots) e.fuel.push(null);
}

export function createMachine(kind: string, x: number, y: number, z: number): MachineEntity {
  return {
    kind, x, y, z, on: true, slots: emptySlots(machine(kind).slots ?? 0), progress: 0, recipe: null, fuelJ: 0, storedJ: 0,
    coreC: AMBIENT_TEMP_C, hotS: 0, warned: false, alarmS: 0, depthY: y, halted: '', fluidIn: null, fluidOut: null,
    availW: 0, outW: 0, demandW: 0, f: 0,
  };
}

/** Runtime companion of an entity. */
export interface SimNode {
  e: SimEntity;
  spec: MachineSpec;
  key: string;
  net: Network | null;
  /** Mirrors the voxel's active flag so the world is only written on change. */
  active: boolean;
  loaded: boolean;
  /** The surroundings below must be recomputed (a block near it changed, or its chunk was loaded). */
  dirty: boolean;
  // Surroundings, recomputed whenever a block near it changes.
  water: number;
  sideWater: number;
  lava: number;
  openSky: boolean;
  /** Water wheels within the share radius, itself included. */
  wheels: number;
  /** Furnaces this machine works with (thermopile, blower: touching; steam engine: the one underneath). */
  furnaces: FurnaceEntity[];
  /** Crates touching this machine. */
  crates: MachineEntity[];
  /** Storage: this tick's charge and discharge limits in watts. */
  maxIn: number;
  maxOut: number;
  /** Processors: the job that can run this tick. */
  job: RecipeDef | null;
  /** Furnaces: the numbers it runs at (effective tier, hearth size, tuyeres); kept by src/sim/hearth.ts. */
  fs: FurnaceStats | null;
  /** Furnaces: fuel its formed hearth adds to the firebox (lava in fluid hatches), or null. */
  extraFuel: ExtraFuel | null;
}

/** What a formed hearth adds to its controller's firebox (spec 17.1: lava through fluid hatches). */
export interface ExtraFuel {
  /** Whole loads of lava waiting (each burns like one lava bucket). */
  lavaUnits(): number;
  /** Takes one load; false when there is none. No bucket comes back from piped lava. */
  takeLava(): boolean;
}

export const posKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export function createNode(e: SimEntity): SimNode {
  return {
    e, spec: machine(e.kind), key: posKey(e.x, e.y, e.z), net: null, active: false, loaded: true, dirty: true, water: 0, sideWater: 0,
    lava: 0, openSky: false, wheels: 1, furnaces: [], crates: [], maxIn: 0, maxOut: 0, job: null, fs: null, extraFuel: null,
  };
}

/** Most of `item` one slot holds (same rule as the inventory: tools 1, unknown items 99). */
export const stackMax = (item: string): number => itemOrNull(item)?.stack ?? 99;

/**
 * Adds items straight into a plain slot array, ignoring any accept rule (the simulation fills take-only output
 * slots this way). Slots [from, to). Returns how many did NOT fit.
 */
export function addToSlots(slots: Slot[], item: string, count: number, from = 0, to = slots.length): number {
  const limit = stackMax(item);
  let left = count;
  for (let i = from; i < to && left > 0; i++) {
    const s = slots[i];
    if (!s || s.item !== item || s.durability !== undefined || s.count >= limit) continue;
    const n = Math.min(limit - s.count, left);
    s.count += n;
    left -= n;
  }
  for (let i = from; i < to && left > 0; i++) {
    if (slots[i]) continue;
    const n = Math.min(limit, left);
    slots[i] = { item, count: n };
    left -= n;
  }
  return left;
}

/** How many more of `item` fit into slots [from, to). */
export function roomInSlots(slots: readonly Slot[], item: string, from = 0, to = slots.length): number {
  const limit = stackMax(item);
  let room = 0;
  for (let i = from; i < to; i++) {
    const s = slots[i];
    if (!s) room += limit;
    else if (s.item === item && s.durability === undefined) room += Math.max(0, limit - s.count);
  }
  return room;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };
export const OK: ActionResult = { ok: true };
export const refuse = (reason: string): ActionResult => ({ ok: false, reason });

/** What behaviours need from the simulation that owns them. */
export interface SimContext {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  /** Sunlight factor 0..1 and wind factor for this tick (wind already includes the weather's). */
  sunlight: number;
  wind: number;
  /** Solar output multiplier of this tick's weather (WEATHER_SOLAR, eased; spec 15). */
  solar: number;
  /** True on one tick per second: slow housekeeping (crate push) runs then. */
  everySecond: boolean;
  /** Sets the voxel's active flag when it differs from the node's. */
  setActive(node: SimNode, active: boolean): void;
  /** Tells an open screen that the simulation wrote into this entity's slots. */
  touch(e: SimEntity): void;
  /** Emits a 'flag' event the first time only. */
  flagOnce(flag: string): void;
  /** Moves whatever fits from slots [from, to) of a machine into the crates touching it. */
  pushToCrates(node: SimNode, from: number, to: number): void;
  /** Schedules a meltdown for the end of the tick. */
  meltdown(node: SimNode): void;
  /** Deterministic random number in [0, 1). */
  random(): number;
  /** Hands one item to the player (a container a burned fuel left behind and no slot could hold). */
  readonly giveBack: (item: string) => void;
}
