/** DOM-free helpers of the fluid tanks on machine screens (spec 16.2): which buffers to show and how to word them. */
import { fluidOrNull, machine } from '../../../core/registry';
import type { FluidKey } from '../../../core/types';
import type { MachineFluidView, MachineView } from '../../../sim';

export interface TankRow {
  /** Stable id of the row: 'in', 'out' or 'stack'. */
  id: 'in' | 'out' | 'stack';
  /** "In: Water", "Out: empty - gives Steam", "Water" (a tank stack). */
  label: string;
  fluid: FluidKey | null;
  /** CSS colour of the fluid, or null when empty. */
  colour: string | null;
  glow: boolean;
  litres: number;
  capacityL: number;
  /** "350 / 1,000 L" */
  text: string;
}

const litres = (l: number): string => Math.round(l).toLocaleString('en-US');
/** Non-breaking spaces keep a figure and its unit on one line when a label wraps. */
const NB = '\u00a0';
export const fluidColour = (key: FluidKey): string => `#${(fluidOrNull(key)?.colour ?? 0x808080).toString(16).padStart(6, '0')}`;
const nameOf = (key: string): string => fluidOrNull(key)?.name ?? key;

/** "Water", "Water or Lava", "Water, Lava or Crude Oil" */
export function fluidList(keys: readonly string[]): string {
  const names = keys.map(nameOf);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function row(id: TankRow['id'], label: string, fluid: FluidKey | null, amount: number, capacityL: number): TankRow {
  const spec = fluid ? fluidOrNull(fluid) : null;
  return {
    id, label, fluid, colour: spec && amount > 0 ? fluidColour(spec.key) : null, glow: spec?.glow ?? false, litres: amount, capacityL,
    text: `${litres(amount)}${NB}/${NB}${litres(capacityL)}${NB}L`,
  };
}

/**
 * The buffers a machine screen shows: a tank stack as one row, else what goes in and what comes out. `waterBeside`:
 * the machine runs on water blocks next to it (its water rule is met with nothing piped in), so its empty input is
 * not a fault - the row says where the water comes from instead.
 */
export function tankRows(kind: string, f: MachineFluidView, waterBeside = false): TankRow[] {
  if (f.stack) {
    const s = f.stack;
    const label = s.fluid && s.litres > 0 ? nameOf(s.fluid) : 'Empty - holds any one fluid';
    return [row('stack', label, s.fluid, s.litres, s.capacityL)];
  }
  const spec = machine(kind).fluids;
  const accepts = spec?.accepts ?? [];
  const gives = (spec?.gives ?? []).filter((g) => !accepts.includes(g));
  const out: TankRow[] = [];
  if (accepts.length > 0) {
    const held = f.input && f.input.litres > 0 ? f.input : null;
    if (!held && waterBeside && accepts.includes('water')) {
      out.push({ ...row('in', 'In: the water beside it', 'water', f.capacityL, f.capacityL), text: '' });
    } else {
      out.push(row('in', held ? `In: ${nameOf(held.fluid)}` : `In: empty - takes ${fluidList(accepts)}`, held?.fluid ?? null, held?.litres ?? 0, f.capacityL));
    }
  }
  if (gives.length > 0) {
    const held = f.output && f.output.litres > 0 ? f.output : null;
    out.push(row('out', held ? `Out: ${nameOf(held.fluid)}` : `Out: empty - gives ${fluidList(gives)}`, held?.fluid ?? null, held?.litres ?? 0, f.capacityL));
  }
  return out;
}

/**
 * The machine runs on water blocks beside it: its kind has a water-nearby rule (params.minWater), the rule is met
 * (no placement problem) and nothing is piped in.
 */
export function usesWaterBeside(view: Pick<MachineView, 'kind' | 'problem' | 'fluids'>): boolean {
  const minWater = machine(view.kind).params?.minWater ?? 0;
  return minWater > 0 && view.problem === null && !(view.fluids?.input && view.fluids.input.litres > 0);
}

/** The flow line under the tanks: "Pumping 200 L/s", "Boiling 400 L of steam a second", "Using 800 L/s"; '' when idle. */
export function flowText(kind: string, f: MachineFluidView): string {
  if (f.rateL <= 0) return '';
  const rate = `${litres(f.rateL)} L/s`;
  if (kind === 'pump') return `Pumping ${rate}`;
  if (kind === 'boiler') return `Boiling ${litres(f.rateL)} L of steam a second`;
  return `Using ${rate}`;
}
