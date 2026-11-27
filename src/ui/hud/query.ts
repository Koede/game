/**
 * What the HUD and the basic screens need from the simulation, as a small structural interface so the UI never
 * imports src/sim. `Simulation` satisfies it as is (main.ts passes the simulation straight in).
 */
import type { Inventory } from '../../game/inventory';

/** The furnace block entity fields fixed by spec section 5 (the simulation's FurnaceEntity has them). */
export interface UIFurnaceState {
  tier: number;
  tempC: number;
  lit: boolean;
  ignited: boolean;
}

/** Per-network figures (a subset of the simulation's NetworkStats). */
export interface UINetworkStats {
  /** Potential generation, demand and what is actually delivered, in watts. */
  generationW: number;
  demandW: number;
  deliveredW: number;
  storedJ: number;
  capacityJ: number;
  /** Share of demand being met, 0..1. */
  satisfaction: number;
  /** More is flowing than the weakest cable carries. */
  overloaded: boolean;
}

/** A crop's growth (a subset of the simulation's CropView). */
export interface UICropView {
  /** Block name, e.g. "Wheat (sprouting)". */
  name: string;
  ripe: boolean;
  /** On farmland, lit (sun or lamp), with water near. */
  soil: boolean;
  lit: boolean;
  hydrated: boolean;
  /** Bees from a hive in reach are pollinating it (it grows half again as fast). */
  pollinated?: boolean;
  /** Seconds to ripe at the current rate (Infinity while not growing). */
  ripeInS: number;
}

/** A cup setup or a bucket on a furnace in words (a subset of the simulation's BrewView). */
export interface UIBrewView {
  /** The target name: "Cup with drip cone - add tea or ground coffee", "Brewing 3 s", "Coffee - take it". */
  text: string;
}

/** A hand station in words (a subset of the simulation's HandView): the aiming line and how far the work is. */
export interface UIHandView {
  /** The target name: "Hand Quern - wheat 3/6 strokes", "Drying Rack - waiting for sun", "Hand Quern - flour ready". */
  label: string;
  /** 0..1 through the job (the crosshair ring fills with it). */
  fraction: number;
}

export interface UISimQuery {
  /** The furnace entity at a block position, or null (home compass: temperature, tier, hot). */
  furnaceAt(x: number, y: number, z: number): UIFurnaceState | null;
  /** Every power network (power strip). */
  allNetworks(): readonly UINetworkStats[];
  /** Ingredient sources of a station, player inventory first, then the crates near it (workbench have/need). */
  stationSources(x: number, y: number, z: number): Inventory[];
  /** The crop at a block position, or null (crosshair: why it is or is not growing). */
  cropView(x: number, y: number, z: number): UICropView | null;
  /** The brewing entity at a block position, or null (crosshair: the step the cup or bucket is at). */
  brewView(x: number, y: number, z: number): UIBrewView | null;
  /** The hand station at a block position, or null (crosshair: what it holds and how far the work is). */
  handView(x: number, y: number, z: number): UIHandView | null;
}

/** Before the simulation exists: no furnaces, no networks, no station sources (screens fall back to the player). */
export const NO_UI_SIM: UISimQuery = {
  furnaceAt: () => null,
  allNetworks: () => [],
  stationSources: () => [],
  cropView: () => null,
  brewView: () => null,
  handView: () => null,
};
