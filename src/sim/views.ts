/** Read-only snapshots of a furnace for the UI. Built on demand (a few times per second at most), never per tick. */
import { AMBIENT_TEMP_C, BROWNOUT_STALL, FORGE_CHILL_C, FURNACE_HOT_C } from '../core/constants';
import { MAX_FURNACE_TIER, fuelOf, furnaceTier, recipe, recipesAt } from '../core/registry';
import type { FurnaceTierSpec, RecipeDef, Slot } from '../core/types';
import { ingredientStatus, maxCraftable, tally, type IngredientStatus, type ItemTally } from '../game/crafting';
import type { Inventory } from '../game/inventory';
import type { ActionResult, FurnaceEntity, IgnitionState, SimNode } from './entities';
import {
  IGNITION_POWER, IGNITION_TIME_S, burnSecondsLeft, crucibleBlock, fuelCount, furnaceMaxTempC, isBurning, smeltSpeed,
} from './furnace';
import { ignitionCheck, restCheck, type ActionHost } from './furnaceActions';
import { itemName } from './machines';

export type Trend = 'rising' | 'falling' | 'steady';
/** Degrees per second below which the temperature counts as steady. */
const STEADY_C_PER_S = 0.5;

const FORGE_RECIPES = recipesAt('furnace').filter((r) => r.kind === 'forge');
const SMELT_RECIPES = recipesAt('furnace').filter((r) => r.kind === 'smelt');

export interface CrucibleView {
  index: number;
  input: Slot;
  output: Slot;
  /** The smelt recipe the loaded input runs, or null (empty, or nothing this tier smelts). */
  recipe: RecipeDef | null;
  /** 0..1 through the current item. */
  progress: number;
  /** Temperature the recipe needs, or null when nothing smeltable is loaded. */
  requiredC: number | null;
  /** Seconds until the current item is done at the present temperature (Infinity while it is not advancing). */
  secondsLeft: number;
  /** True while the crucible is advancing this tick. */
  active: boolean;
  status: string;
}

export interface UpgradeView {
  next: FurnaceTierSpec;
  ingredients: IngredientStatus[];
  requiredC: number;
  tempOk: boolean;
  ok: boolean;
  /** What is missing, or null when the upgrade can be done now. */
  reason: string | null;
}

export interface ForgeRow {
  recipe: RecipeDef;
  /** The recipe belongs to a higher furnace tier (shown as part of the tech tree). */
  locked: boolean;
  /** The furnace is hot enough right now (always true once ignited). */
  tempOk: boolean;
  canMake: boolean;
  /** Why not, or null. Order: tier, temperature, ingredients, room in the pack. */
  reason: string | null;
  ingredients: IngredientStatus[];
  /** How many could be forged from the ingredients at hand (ignoring temperature and room). */
  max: number;
  /** How many forges in a row the heat allows before the chill drops it below minTempC (Infinity once ignited). */
  heatAllows: number;
}

export interface SmeltRow {
  recipe: RecipeDef;
  locked: boolean;
  tempOk: boolean;
  /** Input items at hand (pack and nearby crates). */
  have: number;
  /** Why it would not smelt here and now, or null. */
  reason: string | null;
}

export interface FurnaceView {
  x: number;
  y: number;
  z: number;
  tier: number;
  spec: FurnaceTierSpec;
  /** This furnace is the player's home (respawn point, compass target). */
  home: boolean;
  tempC: number;
  maxTempC: number;
  trend: Trend;
  rateCPerS: number;
  lit: boolean;
  burning: boolean;
  hot: boolean;
  draft: number;
  /** Temperature of the present flame including draft, or null without a fire. */
  flameC: number | null;
  /** Temperature the furnace is heading for with the present fire, draft and electric heat (an estimate). */
  targetC: number;
  burnItem: string | null;
  /** Seconds left of the item burning now, and of the whole firebox, at the present draft. */
  burnItemLeftS: number;
  burnTimeLeftS: number;
  fuelItems: number;
  crucibles: CrucibleView[];
  electric: {
    /** This tier has electric heating at all. */
    available: boolean;
    on: boolean;
    /** The furnace shares a network with at least one other power device. */
    networked: boolean;
    demandW: number;
    deliveredW: number;
    maxW: number;
    /** Network satisfaction 0..1 (0 without a network). */
    satisfaction: number;
  };
  /** Heat taken out by thermopiles and steam engines, in watts. */
  extractW: number;
  ignited: boolean;
  ignition: { state: IgnitionState; progress: number; powerW: number; seconds: number; canStart: ActionResult };
  /** The next tier, or null at the last one. */
  upgrade: UpgradeView | null;
  canRest: ActionResult;
  forge: ForgeRow[];
  smelt: SmeltRow[];
  /** The one most useful line to show under the thermometer. */
  status: string;
}

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const missingText = (ingredients: readonly IngredientStatus[]): string =>
  `Missing ${ingredients.filter((s) => !s.ok).map((s) => `${s.need - s.have} ${itemName(s.item)}`).join(', ')}`;

function crucibleView(e: FurnaceEntity, i: number, tierSpeed: number): CrucibleView {
  const id = e.crucibleRecipe[i];
  const r = id ? recipe(id) : null;
  const view: CrucibleView = {
    index: i, input: e.crucibleIn[i], output: e.crucibleOut[i], recipe: r, progress: 0, requiredC: r ? r.minTempC : null,
    secondsLeft: Infinity, active: false, status: 'Empty',
  };
  if (!r) {
    if (e.crucibleIn[i]) view.status = 'Cannot be smelted here';
    else if (e.crucibleOut[i]) view.status = 'Done - take it out';
    return view;
  }
  view.progress = Math.min(1, e.crucibleProgress[i] / r.timeS);
  const block = crucibleBlock(e, i, r);
  if (block === 'input') view.status = `Needs ${r.inputs[0].count} ${itemName(r.inputs[0].item)}`;
  else if (block === 'output') view.status = 'Output is full - take it out';
  else if (block === 'cold') view.status = `Needs ${r.minTempC} C - now ${Math.floor(e.tempC)} C`;
  else {
    view.active = true;
    view.secondsLeft = (r.timeS - e.crucibleProgress[i]) / smeltSpeed(e, r, tierSpeed);
    view.status = `Smelting ${itemName(r.output.item)}`;
  }
  return view;
}

function upgradeView(e: FurnaceEntity, sources: readonly Inventory[]): UpgradeView | null {
  if (e.tier >= MAX_FURNACE_TIER) return null;
  const next = furnaceTier(e.tier + 1);
  const status = ingredientStatus(next.upgradeCost, sources);
  const tempOk = e.tempC >= next.upgradeTempC;
  const reason = !status.ok ? missingText(status.ingredients) : tempOk ? null : `Needs ${next.upgradeTempC} C - now ${Math.floor(e.tempC)} C`;
  return { next, ingredients: status.ingredients, requiredC: next.upgradeTempC, tempOk, ok: status.ok && tempOk, reason };
}

/** Where the temperature settles with the present heat sources: fire (capped at its flame) and electric heat. */
function targetTemp(e: FurnaceEntity, tier: FurnaceTierSpec, flame: number | null, satisfaction: number): number {
  let target = AMBIENT_TEMP_C;
  const fuel = e.burnItem ? fuelOf(e.burnItem) : null;
  if (flame !== null && fuel) {
    const q = (fuel.energyJ / fuel.burnS) * (1 + e.draft);
    target = Math.min(flame, AMBIENT_TEMP_C + (q - e.extractW) / tier.lossWPerC);
  }
  if (e.heatDemandW > 0) target = Math.max(target, AMBIENT_TEMP_C + (tier.electricHeatW * satisfaction - e.extractW) / tier.lossWPerC);
  return Math.min(Math.max(target, AMBIENT_TEMP_C), tier.maxTempC);
}

function furnaceStatus(e: FurnaceEntity, v: FurnaceView): string {
  if (e.ignited) return 'A star burns here. It needs nothing more.';
  if (e.ignition === 'running') return `Igniting - ${Math.round(v.ignition.progress * 100)}%`;
  const cold = v.crucibles.find((c) => c.recipe !== null && crucibleBlock(e, c.index, c.recipe) === 'cold');
  const heated = v.electric.deliveredW > 0;
  if (!e.lit && !heated) {
    if (v.electric.available && v.electric.on && v.electric.demandW > 0) {
      return v.electric.networked ? 'No power for electric heating' : 'Connect it to a power network to heat it electrically';
    }
    if (v.fuelItems === 0) return e.tempC >= FURNACE_HOT_C ? 'The fire is out - add fuel' : 'No fuel';
    return e.tempC >= FURNACE_HOT_C ? 'Cooling - light it again' : 'Ready to light';
  }
  if (cold && cold.recipe) return `${itemName(cold.recipe.output.item)} needs ${cold.requiredC} C - now ${Math.floor(e.tempC)} C`;
  if (v.electric.on && v.electric.demandW > 0 && v.electric.satisfaction < BROWNOUT_STALL) return 'Electric heating is starved of power';
  if (e.lit && !heated) return `Burns out in ${clock(v.burnTimeLeftS)}`;
  return v.trend === 'steady' ? `Holding ${Math.floor(e.tempC)} C` : `Heading for ${Math.floor(v.targetC)} C`;
}

export function furnaceView(host: ActionHost, node: SimNode): FurnaceView {
  const e = node.e as FurnaceEntity;
  const tier = furnaceTier(e.tier);
  const burning = isBurning(e);
  const flame = e.ignited ? e.tempC : burning ? e.flameC : null;
  const rate = 1 + e.draft;
  const net = node.net;
  const satisfaction = net ? net.f : 0;
  const sources = host.stationSources(e.x, e.y, e.z);
  const counts = tally(sources);
  const home = host.player.home;
  const view: FurnaceView = {
    x: e.x, y: e.y, z: e.z, tier: e.tier, spec: tier, home: home !== null && home.x === e.x && home.y === e.y && home.z === e.z,
    tempC: e.tempC, maxTempC: furnaceMaxTempC(e),
    trend: e.rateCPerS > STEADY_C_PER_S ? 'rising' : e.rateCPerS < -STEADY_C_PER_S ? 'falling' : 'steady',
    rateCPerS: e.rateCPerS, lit: e.lit, burning, hot: e.tempC >= FURNACE_HOT_C, draft: e.draft, flameC: flame,
    targetC: e.ignited ? e.tempC : targetTemp(e, tier, flame, satisfaction), burnItem: e.burnItem,
    burnItemLeftS: e.burnItem ? Math.max(0, e.burnLeftS) / rate : 0, burnTimeLeftS: burnSecondsLeft(e) / rate, fuelItems: fuelCount(e),
    crucibles: e.crucibleIn.map((_s, i) => crucibleView(e, i, tier.speed)),
    electric: {
      available: tier.electricHeatW > 0, on: e.electric, networked: net !== null && net.nodes.length > 1, demandW: e.heatDemandW,
      deliveredW: e.heatDemandW * satisfaction, maxW: tier.electricHeatW, satisfaction,
    },
    extractW: e.extractW, ignited: e.ignited,
    ignition: {
      state: e.ignition, progress: Math.min(1, e.ignitionProgressS / IGNITION_TIME_S), powerW: IGNITION_POWER,
      seconds: IGNITION_TIME_S, canStart: ignitionCheck(e, node),
    },
    upgrade: upgradeView(e, sources), canRest: restCheck(host, e),
    forge: forgeRowsFrom(host, e, sources, counts), smelt: smeltRows(e, counts), status: '',
  };
  view.status = furnaceStatus(e, view);
  return view;
}

/** Every forge recipe of the game in tech-tree order, judged against this furnace and the ingredients at hand. */
export function forgeRows(host: ActionHost, e: FurnaceEntity): ForgeRow[] {
  const sources = host.stationSources(e.x, e.y, e.z);
  return forgeRowsFrom(host, e, sources, tally(sources));
}

function forgeRowsFrom(host: ActionHost, e: FurnaceEntity, sources: readonly Inventory[], counts: ItemTally): ForgeRow[] {
  const rows: ForgeRow[] = [];
  for (const r of FORGE_RECIPES) {
    const have = ingredientStatus(r.inputs, counts);
    const locked = r.minTier > e.tier;
    const tempOk = e.ignited || e.tempC >= r.minTempC;
    const heatAllows = e.ignited ? Infinity : tempOk ? Math.floor((e.tempC - r.minTempC) / FORGE_CHILL_C) + 1 : 0;
    let reason: string | null = null;
    if (locked) reason = `Needs the ${furnaceTier(r.minTier).name}`;
    else if (!tempOk) reason = `Needs ${r.minTempC} C`;
    else if (!have.ok) reason = missingText(have.ingredients);
    else if (!host.player.inventory.canFit(r.output)) reason = 'No room in your pack';
    rows.push({
      recipe: r, locked, tempOk, canMake: reason === null, reason, ingredients: have.ingredients,
      max: maxCraftable(r, sources, undefined, Infinity, counts), heatAllows,
    });
  }
  return rows;
}

/** Every smelt recipe (what the crucibles can take), judged against this furnace. */
function smeltRows(e: FurnaceEntity, counts: ItemTally): SmeltRow[] {
  return SMELT_RECIPES.map((r) => {
    const locked = r.minTier > e.tier;
    const tempOk = e.ignited || e.tempC >= r.minTempC;
    const reason = locked ? `Needs the ${furnaceTier(r.minTier).name}` : tempOk ? null : `Needs ${r.minTempC} C`;
    return { recipe: r, locked, tempOk, have: counts.get(r.inputs[0].item) ?? 0, reason };
  });
}
