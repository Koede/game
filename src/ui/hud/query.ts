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
  /** Seconds to ripe at the current rate (Infinity while not growing). */
  ripeInS: number;
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
}

/** Before the simulation exists: no furnaces, no networks, no station sources (screens fall back to the player). */
export const NO_UI_SIM: UISimQuery = {
  furnaceAt: () => null,
  allNetworks: () => [],
  stationSources: () => [],
  cropView: () => null,
};
