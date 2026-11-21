/** DOM-free helpers of the furnace screen: thermometer notches, tones, readout texts, which slot a button loads. */
import { fuelOf, furnaceTier, itemOrNull, machine, RECIPES, recipesFor } from '../../../core/registry';
import type { RecipeDef, Slot } from '../../../core/types';
import type { FurnaceView, UpgradeView } from '../../../sim';
import type { Tone } from '../../kit/gauges';
import type { ThermoNotch } from '../../kit/thermometer';
import { nameOf } from './forgeRows';

/** The Starhearth may start its ignition from this temperature (content params). */
export const IGNITION_TEMP_C = machine('furnace').params?.ignitionTempC ?? 3000;

/** "Copper Ingot" -> "Copper": notch labels and status lines have little room. */
export const shortName = (key: string): string => nameOf(key).replace(/ Ingot$/, '');

/** 0:42, 12:05 */
export function clockText(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--';
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Marks beside the thermometer: what the loaded crucibles need, the recipe the player is looking at, the next
 * upgrade, the Starhearth's ignition point and the present flame (or electric) ceiling. Duplicates collapse.
 */
export function thermoNotches(view: FurnaceView, selected: RecipeDef | null): ThermoNotch[] {
  const out: ThermoNotch[] = [];
  const add = (tempC: number, label: string, kind: ThermoNotch['kind'] = 'threshold'): void => {
    if (!out.some((n) => n.tempC === tempC && n.label === label)) out.push({ tempC, label, kind });
  };
  for (const c of view.crucibles) if (c.recipe) add(c.recipe.minTempC, shortName(c.recipe.output.item));
  if (selected && !view.ignited) add(selected.minTempC, shortName(selected.output.item));
  if (view.upgrade) add(view.upgrade.requiredC, 'Upgrade');
  if (view.tier === 5 && !view.ignited) add(IGNITION_TEMP_C, 'Ignite');
  if (!view.ignited) {
    if (view.flameC !== null) add(Math.round(view.flameC), 'Flame', 'limit');
    else if (view.electric.deliveredW > 0) add(Math.round(view.targetC), 'Electric', 'limit');
  }
  return out;
}

/** Colour of the one-line status: what it asks of the player. */
export function statusTone(view: FurnaceView): Tone {
  if (view.ignited) return 'good';
  if (view.ignition.state === 'running') return 'power';
  const s = view.status;
  if (/starved|No power/.test(s)) return 'bad';
  if (/needs|No fuel|fire is out|Connect/.test(s)) return 'warn';
  if (view.burning) return 'heat';
  if (view.electric.deliveredW > 0) return 'power';
  return 'neutral';
}

export type FlameMode = 'none' | 'embers' | 'fire' | 'electric' | 'star';

/** What the live flame shows: mode, height 0..1 (draft), and the temperature its colours come from. */
export interface FlameLook {
  mode: FlameMode;
  height: number;
  tempC: number;
}

export function flameLook(view: FurnaceView): FlameLook {
  if (view.ignited) return { mode: 'star', height: 1, tempC: view.tempC };
  if (view.burning) return { mode: 'fire', height: 0.42 + 0.58 * view.draft, tempC: view.flameC ?? view.tempC };
  if (view.electric.deliveredW > 0) return { mode: 'electric', height: 0.3, tempC: view.tempC };
  if (view.hot) return { mode: 'embers', height: 0.12, tempC: view.tempC };
  return { mode: 'none', height: 0, tempC: view.tempC };
}

/** The burn bar's label and reading: the item burning and its time left, else what the firebox holds. */
export function burnText(view: FurnaceView): [label: string, reading: string] {
  if (view.ignited) return ['Fuel', 'Needs none'];
  if (view.burning && view.burnItem) return [nameOf(view.burnItem), clockText(view.burnItemLeftS)];
  if (view.fuelItems > 0) return [`${view.fuelItems} loaded`, clockText(view.burnTimeLeftS)];
  return ['Firebox', 'Empty'];
}

/** Fraction of the burning item that is left (the burn bar). */
export function burnFraction(view: FurnaceView): number {
  const fuel = view.burnItem ? fuelOf(view.burnItem) : null;
  if (!view.burning || !fuel) return 0;
  return Math.min(1, (view.burnItemLeftS * (1 + view.draft)) / fuel.burnS);
}

/** Ingredients of the next upgrade gathered so far, counted per item up to what is needed. */
export function upgradeProgress(up: UpgradeView): { have: number; need: number } {
  let have = 0;
  let need = 0;
  for (const s of up.ingredients) {
    have += Math.min(s.have, s.need);
    need += s.need;
  }
  return { have, need };
}

const isTool = (stack: Slot): boolean => stack !== null && stack.durability !== undefined;

/** Items a crucible bakes into something (logs into charcoal): burning them throws away the next goal's input. */
const SMELT_INPUTS: ReadonlySet<string> = new Set(
  RECIPES.filter((r) => r.kind === 'smelt').flatMap((r) => r.inputs.map((i) => i.item)),
);

/**
 * The bag slot the "Add fuel" button loads from: real fuels first (coal, charcoal, coke: the coolest one that still
 * reaches the furnace's top temperature, else the hottest - a clay furnace never eats the coke steel needs), then the
 * cheapest wood (sticks, then planks), then anything a crucible could still use (logs) last. With `spareSmeltable` (the
 * goal is baking charcoal) logs are skipped unless nothing else burns. -1 when the bag holds nothing that burns.
 */
export function bestFuelSlot(slots: readonly Slot[], opts: { spareSmeltable?: boolean; maxTempC?: number } = {}): number {
  const top = opts.maxTempC ?? Infinity;
  let best = -1;
  let bestScore = -Infinity;
  let fallback = -1;
  slots.forEach((stack, i) => {
    if (!stack || isTool(stack)) return;
    const fuel = fuelOf(stack.item);
    if (!fuel) return;
    const smeltable = SMELT_INPUTS.has(stack.item);
    if (smeltable && opts.spareSmeltable) {
      if (fallback < 0) fallback = i;
      return;
    }
    const flame = fuel.flameTempC;
    const score =
      itemOrNull(stack.item)?.category === 'fuel'
        ? (flame >= top ? 40_000 - flame : 20_000 + flame)
        : smeltable ? 5_000 - flame : 10_000 - flame;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best >= 0 ? best : fallback;
}

/** About two minutes of burn per tap of "Add fuel" (at least one item), so one tap never empties the pack. */
export const FUEL_LOAD_S = 120;
export function fuelLoadCount(item: string, have: number): number {
  const burnS = fuelOf(item)?.burnS ?? FUEL_LOAD_S;
  return Math.min(have, Math.max(1, Math.ceil(FUEL_LOAD_S / Math.max(1, burnS))));
}

/** The first bag slot holding this item, or -1. */
export const slotOf = (slots: readonly Slot[], item: string): number => slots.findIndex((s) => s !== null && s.item === item);

/** Where an item comes from, for "what is missing" hints: the station and, at the furnace, the heat it needs. */
export function sourceText(item: string): string {
  const r = recipesFor(item)[0];
  if (!r) return 'gather or mine it';
  if (r.station === 'hand') return 'craft it by hand';
  if (r.station === 'workbench') return 'make it at the workbench';
  if (r.station === 'furnace') {
    const tier = r.minTier > 1 ? ` (${furnaceTier(r.minTier).name})` : '';
    return `${r.kind === 'smelt' ? 'smelt' : 'forge'} it here at ${r.minTempC} °C${tier}`;
  }
  return `made by the ${machine(r.station).name}`;
}
