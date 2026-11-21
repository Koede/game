/**
 * How existing machines use what pipes bring them (spec 16.2): piped water standing in for water blocks (steam engine,
 * electrolyzer, fission pile coolant), piped refined fuel (combustion engine), piped lava (geothermal tap). Pure
 * helpers over the entity's fluid buffer; the machine behaviours call them.
 */
import { DT } from '../core/constants';
import type { FluidKey } from '../core/types';
import type { MachineEntity } from './entities';

/** Litres of `fluid` in the machine's input buffer. */
export const heldL = (e: MachineEntity, fluid: FluidKey): number => (e.fluidIn && e.fluidIn.fluid === fluid ? e.fluidIn.litres : 0);

/**
 * Piped water counts as water blocks while the buffer can supply `ratePerS` litres a second (one tick's worth is
 * enough: pipes top it up every tick). False when the machine takes no piped water.
 */
export const pipedWater = (e: MachineEntity, ratePerS: number | undefined): boolean =>
  ratePerS !== undefined && ratePerS > 0 && heldL(e, 'water') >= ratePerS * DT - 1e-9;

/** Takes up to `litres` of `fluid` out of the input buffer; returns how much it took. */
export function useFluid(e: MachineEntity, fluid: FluidKey, litres: number): number {
  const b = e.fluidIn;
  if (!b || b.fluid !== fluid || litres <= 0) return 0;
  const n = Math.min(litres, b.litres);
  b.litres -= n;
  if (b.litres <= 1e-9) e.fluidIn = null;
  return n;
}
