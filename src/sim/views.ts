/** Read-only snapshots for the UI: one per furnace, machine and power network. Built on demand, never per tick. */
import { AMBIENT_TEMP_C, BROWNOUT_STALL, FURNACE_HOT_C } from '../core/constants';
import { MAX_FURNACE_TIER, fuelOf, furnaceTier, recipe, recipesAt } from '../core/registry';
import type { FurnaceTierSpec, RecipeDef, Slot } from '../core/types';
import { ingredientStatus, maxCraftable, tally, type IngredientStatus } from '../game/crafting';
import { formatWatts } from '../game/objectives';
import type { ActionResult, FurnaceEntity, IgnitionState, MachineEntity, SimNode } from './entities';
import { pileCooled } from './fission';
import {
  IGNITION_POWER, IGNITION_TIME_S, burnSecondsLeft, crucibleBlock, fuelCount, furnaceMaxTempC, isBurning, smeltSpeed,
} from './furnace';
import { ignitionCheck, restCheck, type ActionHost } from './furnaceActions';
import { holdsFuel, isProcessor, itemName, placementProblem } from './machines';
import type { Network, NetworkState } from './power';

export type Trend = 'rising' | 'falling' | 'steady';
/** Degrees per second below which the temperature counts as steady. */
const STEADY_C_PER_S = 0.5;

export interface CrucibleView {
  index: number;
  input: Slot;
  output: Slot;
  recipe: RecipeDef | null;
  /** 0..1 through the current item. */
  progress: number;
  /** Temperature the recipe needs, or null when nothing smeltable is loaded. */
  requiredC: number | null;
  /** Seconds until the current item is done at the present temperature (Infinity while it is not advancing). */
  secondsLeft: number;
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
  canMake: boolean;
  /** Why not, or null. */
  reason: string | null;
  ingredients: IngredientStatus[];
  /** How many could be forged from the ingredients at hand (ignoring temperature). */
  max: number;
}

export interface FurnaceView {
  x: number;
  y: number;
  z: number;
  tier: number;
  spec: FurnaceTierSpec;
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
  /** Temperature the furnace is heading for with the present fire and electric heat. */
  targetC: number;
  burnItem: string | null;
  /** Seconds left of the item burning now, and of the whole firebox, at the present draft. */
  burnItemLeftS: number;
  burnTimeLeftS: number;
  fuelItems: number;
  crucibles: CrucibleView[];
  electric: { available: boolean; on: boolean; demandW: number; deliveredW: number; maxW: number };
  /** Heat taken out by thermopiles and steam engines, in watts. */
  extractW: number;
  ignited: boolean;
  ignition: { state: IgnitionState; progress: number; powerW: number; seconds: number; canStart: ActionResult };
  upgrade: UpgradeView | null;
  canRest: ActionResult;
  /** The one most useful line to show under the thermometer. */
  status: string;
}

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function crucibleView(e: FurnaceEntity, i: number, tierSpeed: number): CrucibleView {
  const id = e.crucibleRecipe[i];
  const r = id ? recipe(id) : null;
  const view: CrucibleView = {
    index: i, input: e.crucibleIn[i], output: e.crucibleOut[i], recipe: r, progress: 0, requiredC: r ? r.minTempC : null,
    secondsLeft: Infinity, status: 'Empty',
  };
  if (!r) {
    if (e.crucibleIn[i]) view.status = 'Cannot be smelted here';
    else if (e.crucibleOut[i]) view.status = 'Done';
    return view;
  }
  view.progress = Math.min(1, e.crucibleProgress[i] / r.timeS);
  const block = crucibleBlock(e, i, r);
  if (block === 'input') view.status = `Needs ${r.inputs[0].count} ${itemName(r.inputs[0].item)}`;
  else if (block === 'output') view.status = 'Output is full';
  else if (block === 'cold') view.status = `Needs ${r.minTempC} C`;
  else {
    view.secondsLeft = (r.timeS - e.crucibleProgress[i]) / smeltSpeed(e, r, tierSpeed);
    view.status = `Smelting ${itemName(r.output.item)}`;
  }
  return view;
}

function upgradeView(host: ActionHost, e: FurnaceEntity): UpgradeView | null {
  if (e.tier >= MAX_FURNACE_TIER) return null;
  const next = furnaceTier(e.tier + 1);
  const status = ingredientStatus(next.upgradeCost, host.stationSources(e.x, e.y, e.z));
  const tempOk = e.tempC >= next.upgradeTempC;
  const missing = status.ingredients.filter((s) => !s.ok).map((s) => `${s.need - s.have} ${itemName(s.item)}`);
  const reason = missing.length > 0 ? `Missing ${missing.join(', ')}` : tempOk ? null : `Needs ${next.upgradeTempC} C`;
  return { next, ingredients: status.ingredients, requiredC: next.upgradeTempC, tempOk, ok: status.ok && tempOk, reason };
}

function targetTemp(e: FurnaceEntity, tier: FurnaceTierSpec, flame: number | null): number {
  let target = AMBIENT_TEMP_C;
  const fuel = e.burnItem ? fuelOf(e.burnItem) : null;
  if (flame !== null && fuel) {
    const q = (fuel.energyJ / fuel.burnS) * (1 + e.draft);
    target = Math.min(flame, AMBIENT_TEMP_C + (q - e.extractW) / tier.lossWPerC);
  }
  if (e.heatDemandW > 0 && e.demandW > 0) {
    const heat = tier.electricHeatW * (e.deliveredW / e.demandW);
    target = Math.max(target, AMBIENT_TEMP_C + (heat - e.extractW) / tier.lossWPerC);
  }
  return Math.min(Math.max(target, AMBIENT_TEMP_C), tier.maxTempC);
}

function furnaceStatus(e: FurnaceEntity, v: FurnaceView): string {
  if (e.ignited) return 'A star burns here. It needs nothing more.';
  if (e.ignition === 'running') return `Igniting - ${Math.round(v.ignition.progress * 100)}%`;
  const cold = v.crucibles.find((c) => c.recipe !== null && c.requiredC !== null && crucibleBlock(e, c.index, c.recipe) === 'cold');
  const heated = v.electric.deliveredW > 0;
  if (!e.lit && !heated) {
    if (v.fuelItems === 0 && e.burnItem === null) return e.tempC >= FURNACE_HOT_C ? 'The fire is out - add fuel' : 'No fuel';
    return 'Ready to light';
  }
  if (cold && cold.recipe) return `${itemName(cold.recipe.output.item)} needs ${cold.requiredC} C - now ${Math.floor(e.tempC)}`;
  if (e.lit && !heated) return `Burns out in ${clock(v.burnTimeLeftS)}`;
  if (v.electric.on && v.electric.demandW > 0 && v.electric.deliveredW < v.electric.demandW * BROWNOUT_STALL) return 'Electric heating is starved of power';
  return v.trend === 'steady' ? `Holding ${Math.floor(e.tempC)} C` : `Heading for ${Math.floor(v.targetC)} C`;
}

export function furnaceView(host: ActionHost, node: SimNode): FurnaceView {
  const e = node.e as FurnaceEntity;
  const tier = furnaceTier(e.tier);
  const burning = isBurning(e);
  const flame = e.ignited ? e.tempC : burning ? e.flameC : null;
  const rate = 1 + e.draft;
  const view: FurnaceView = {
    x: e.x, y: e.y, z: e.z, tier: e.tier, spec: tier, tempC: e.tempC, maxTempC: furnaceMaxTempC(e),
    trend: e.rateCPerS > STEADY_C_PER_S ? 'rising' : e.rateCPerS < -STEADY_C_PER_S ? 'falling' : 'steady',
    rateCPerS: e.rateCPerS, lit: e.lit, burning, hot: e.tempC >= FURNACE_HOT_C, draft: e.draft, flameC: flame,
    targetC: e.ignited ? e.tempC : targetTemp(e, tier, flame), burnItem: e.burnItem,
    burnItemLeftS: e.burnItem ? Math.max(0, e.burnLeftS) / rate : 0, burnTimeLeftS: burnSecondsLeft(e) / rate, fuelItems: fuelCount(e),
    crucibles: e.crucibleIn.map((_s, i) => crucibleView(e, i, tier.speed)),
    electric: {
      available: tier.electricHeatW > 0, on: e.electric, demandW: e.heatDemandW,
      deliveredW: e.demandW > 0 ? (e.deliveredW * e.heatDemandW) / e.demandW : 0, maxW: tier.electricHeatW,
    },
    extractW: e.extractW, ignited: e.ignited,
    ignition: {
      state: e.ignition, progress: Math.min(1, e.ignitionProgressS / IGNITION_TIME_S), powerW: IGNITION_POWER,
      seconds: IGNITION_TIME_S, canStart: ignitionCheck(e, node),
    },
    upgrade: upgradeView(host, e), canRest: restCheck(host, e), status: '',
  };
  view.status = furnaceStatus(e, view);
  return view;
}

/** Every forge recipe of the game in tech-tree order, judged against this furnace and the ingredients at hand. */
export function forgeRows(host: ActionHost, e: FurnaceEntity): ForgeRow[] {
  const sources = host.stationSources(e.x, e.y, e.z);
  const counts = tally(sources);
  const rows: ForgeRow[] = [];
  for (const r of recipesAt('furnace')) {
    if (r.kind !== 'forge') continue;
    const have = ingredientStatus(r.inputs, counts);
    const locked = r.minTier > e.tier;
    let reason: string | null = null;
    if (locked) reason = `Needs the ${furnaceTier(r.minTier).name}`;
    else if (!e.ignited && e.tempC < r.minTempC) reason = `Needs ${r.minTempC} C`;
    else if (!have.ok) reason = 'Missing ingredients';
    else if (!host.player.inventory.canFit(r.output)) reason = 'No room in your pack';
    rows.push({ recipe: r, locked, canMake: reason === null, reason, ingredients: have.ingredients, max: maxCraftable(r, sources, undefined, Infinity, counts) });
  }
  return rows;
}

// ---- machines ---------------------------------------------------------------------------------------------------

export interface MachineView {
  kind: string;
  name: string;
  role: string;
  x: number;
  y: number;
  z: number;
  on: boolean;
  running: boolean;
  status: string;
  /** What is wrong with where it stands, or null. */
  problem: string | null;
  hint: string | null;
  /** Generators: watts available and watts actually delivered. Storage: discharge watts in outW. */
  availW: number;
  outW: number;
  /** Consumers: watts wanted, and the fraction of it the network delivers. */
  demandW: number;
  satisfaction: number;
  /** Processors and bore rig: 0..1 through the current job or block. */
  progress: number;
  recipe: RecipeDef | null;
  /** Storage. */
  storedJ: number;
  capacityJ: number;
  chargeW: number;
  /** Fuel generators: seconds the loaded fuel lasts at the present output (Infinity when idle). */
  fuelLeftS: number;
  /** Fission pile. */
  coreC: number;
  cooled: boolean;
  /** Bore rig: y of the last block it mined. */
  depthY: number;
  slots: Slot[];
}

function machineStatus(node: SimNode, v: MachineView): string {
  const e = node.e as MachineEntity;
  const spec = node.spec;
  if (spec.role === 'crate') return '';
  if (spec.role === 'storage') {
    const pct = Math.round((100 * e.storedJ) / (spec.capacityJ ?? 1));
    return v.chargeW > 0 ? `${pct}% - charging ${formatWatts(v.chargeW)}` : e.outW > 0 ? `${pct}% - feeding ${formatWatts(e.outW)}` : `${pct}% - idle`;
  }
  if (!e.on) return 'Switched off';
  if (e.kind === 'fission_pile') {
    if (!holdsFuel(node)) return 'No fuel rod';
    if (!v.cooled) return `No cooling - core at ${Math.floor(e.coreC)} C and rising`;
  }
  if (v.problem) return v.problem;
  if (spec.role === 'generator') {
    if (spec.fuels && spec.fuels.length > 0 && !holdsFuel(node)) return 'No fuel';
    if (e.availW <= 0) return e.kind === 'solar_panel' ? 'No sunlight' : e.kind === 'steam_engine' || e.kind === 'thermopile' ? 'The furnace is too cold' : 'Idle';
    return `${formatWatts(e.outW)} of ${formatWatts(e.availW)} in use`;
  }
  if (e.kind === 'bore_rig') {
    if (e.halted !== '') return e.halted;
    if (e.demandW <= 0) return 'Buffer full';
  } else if (isProcessor(e.kind)) {
    if (!e.slots[0]) return 'Waiting for input';
    if (v.recipe === null) return 'Cannot process this';
    if (e.demandW <= 0) return 'Output is full';
  }
  if (e.demandW > 0 && v.satisfaction < BROWNOUT_STALL) return v.satisfaction > 0 ? 'Not enough power' : 'No power';
  if (e.kind === 'bore_rig') return `Boring at depth ${e.depthY}`;
  if (v.recipe) return `Making ${itemName(v.recipe.output.item)} - ${Math.round(v.progress * 100)}%`;
  return v.satisfaction < 1 ? `Running at ${Math.round(v.satisfaction * 100)}% power` : 'Running';
}

export function machineView(node: SimNode): MachineView {
  const e = node.e as MachineEntity;
  const spec = node.spec;
  const isStorage = spec.role === 'storage';
  const r = e.recipe ? recipe(e.recipe) : null;
  const span = e.kind === 'bore_rig' ? spec.params?.secondsPerBlock ?? 1 : r ? r.timeS : 1;
  let fuelJ = e.fuelJ;
  if (spec.fuels && e.slots[0]) fuelJ += e.slots[0].count * (spec.params?.fuelEnergyJ ?? spec.params?.rodEnergyJ ?? fuelOf(e.slots[0].item)?.energyJ ?? 0) * (spec.efficiency ?? 1);
  const view: MachineView = {
    kind: e.kind, name: spec.name, role: spec.role, x: e.x, y: e.y, z: e.z, on: e.on, running: node.active, status: '',
    problem: placementProblem(node), hint: spec.placementHint ?? null, availW: e.availW, outW: e.outW, demandW: e.demandW,
    satisfaction: isStorage ? 1 : node.net ? node.net.f : 0, progress: Math.min(1, e.progress / span), recipe: r,
    storedJ: e.storedJ, capacityJ: spec.capacityJ ?? 0, chargeW: isStorage ? e.f : 0,
    fuelLeftS: e.outW > 0 ? fuelJ / e.outW : Infinity, coreC: e.coreC, cooled: e.kind === 'fission_pile' ? pileCooled(node) : true,
    depthY: e.depthY, slots: e.slots,
  };
  view.status = machineStatus(node, view);
  return view;
}

// ---- networks ---------------------------------------------------------------------------------------------------

export interface NetworkMember {
  kind: string;
  name: string;
  x: number;
  y: number;
  z: number;
  /** Positive = feeds the network, negative = draws from it. */
  watts: number;
  status: string;
}

export interface NetworkStats {
  id: number;
  /** Potential generation, demand and what is actually delivered, in watts. */
  generationW: number;
  demandW: number;
  deliveredW: number;
  storedJ: number;
  capacityJ: number;
  chargeW: number;
  dischargeW: number;
  /** Most the cables carry; Infinity without cables. */
  ratingW: number;
  cables: number;
  satisfaction: number;
  overloaded: boolean;
  state: NetworkState;
  members: NetworkMember[];
  /** One sample per second, oldest first, 60 of each. */
  historyG: number[];
  historyUsed: number[];
}

export function networkStats(net: Network): NetworkStats {
  const members: NetworkMember[] = net.nodes.map((n) => {
    const base = { kind: n.e.kind, x: n.e.x, y: n.e.y, z: n.e.z };
    if (n.e.kind === 'furnace') {
      const e = n.e as FurnaceEntity;
      const tier = furnaceTier(e.tier);
      const status = e.ignited ? `Generating ${formatWatts(e.availW)}` : e.demandW > 0 ? `Drawing ${formatWatts(e.deliveredW)} of ${formatWatts(e.demandW)}` : 'No electric load';
      return { ...base, name: tier.name, watts: e.ignited ? e.availW * net.load : -e.deliveredW, status };
    }
    const view = machineView(n);
    const watts = n.spec.role === 'storage' ? view.outW - view.chargeW : view.availW > 0 ? view.outW : -view.demandW * net.f;
    return { ...base, name: n.spec.name, watts, status: view.status };
  });
  return {
    id: net.id, generationW: net.generationW, demandW: net.demandW, deliveredW: net.deliveredW, storedJ: net.storedJ,
    capacityJ: net.capacityJ, chargeW: net.chargeW, dischargeW: net.dischargeW, ratingW: net.ratingW, cables: net.cables,
    satisfaction: net.f, overloaded: net.overloaded, state: net.state, members, historyG: [...net.historyG], historyUsed: [...net.historyUsed],
  };
}
