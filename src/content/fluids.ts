/**
 * The five fluids of spec 16.5. Pipes, tanks and machines move them in litres; a bucket holds 1000 L
 * (LITRES_PER_BUCKET). Colours are what tank and pipe windows and the UI show.
 */
import type { FluidSpec } from '../core/types';
import { DISTILL_FLUIDS } from './fluidsDistill';

export const FLUID_SPECS: FluidSpec[] = [
  // Water: endless from a source with two sources beside it (spec 18.3), or poured from a wooden bucket.
  { key: 'water', name: 'Water', colour: 0x3a86b4, hot: false, glow: false, liquid: 'water', bucket: { full: 'water_pail', empty: 'pail' } },
  // Lava: finite - a pump removes the lava block it drains; the bronze bucket carries it.
  { key: 'lava', name: 'Lava', colour: 0xff7a1e, hot: true, glow: true, liquid: 'lava', bucket: { full: 'lava_bucket', empty: 'bronze_bucket' } },
  // Steam: made by a boiler on a hot furnace, spent by the steam turbine. Only hot pipes hold it.
  { key: 'steam', name: 'Steam', colour: 0xe6ecf0, hot: true, glow: false },
  // Crude oil: pumped from the oil pools of the dunes and the scar; a steel canister (distillery) carries 1000 L.
  { key: 'crude_oil', name: 'Crude Oil', colour: 0x1d1814, hot: false, glow: false, liquid: 'oil', bucket: { full: 'crude_canister', empty: 'empty_canister' } },
  // Refined fuel: what the still makes of crude oil; the combustion engine burns it.
  { key: 'fuel', name: 'Refined Fuel', colour: 0xe2bc3a, hot: false, glow: false },
  // The glass distillery's grades (docs/DISTILLERY_PLAN.md).
  ...DISTILL_FLUIDS,
];
