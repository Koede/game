/** Read-only snapshots of a furnace for the UI. Built on demand (a few times per second at most), never per tick. */
import { AMBIENT_TEMP_C, BROWNOUT_STALL, FORGE_CHILL_C, FURNACE_HOT_C } from '../core/constants';
import { MAX_FURNACE_TIER, fuelOf, furnaceTier, recipe, recipesAt } from '../core/registry';
import type { FurnaceTierSpec, RecipeDef, Slot } from '../core/types';
import { ingredientStatus, maxCraftable, tally, type IngredientStatus, type ItemTally } from '../game/crafting';
import type { Inventory } from '../game/inventory';
import type { ActionResult, FurnaceEntity, IgnitionState, SimNode } from './entities';
import {
  IGNITION_POWER, IGNITION_TIME_S, burnSecondsLeft, crucibleBlock, fireboxJunk, fuelCount, furnaceMaxTempC, isBurning, smeltSpeed, statsOf,
} from './furnace';
import { ALLOY_POT, alloyMinC, alloyTimeS, moltenLeft, potBlock } from './casting';
import { ignitionCheck, restCheck, tierLock, upgradeStructure, type ActionHost } from './furnaceActions';
import type { Hearth } from './hearth';
import { hearthName } from './hearthScan';
import { ignitionPower, type IgnitionPower } from './ignitionPower';
import type { FurnaceStats } from './hearthStats';
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
  /** Beyond what the hearth holds (spec 17.3): it holds still and only gives its contents back. */
  locked: boolean;
  /** Metal poured out of a smelt and still molten (item = its ingot, count = units), the seconds left to pour it, and the alloy pot's copper and tin. */
  melt: Slot;
  moltenS: number;
  mix: readonly [number, number] | null;
  status: string;
}

/** The hearth around a furnace, in brief (the STRUCTURE tab has the details: Simulation.structureView). */
export interface HearthBrief {
  formed: boolean;
  /** Structural tier 2..5, 0 when not formed. */
  tier: number;
  /** "Blast hearth" ... "Starhearth", or null when not formed. */
  name: string | null;
  /** [across, deep, high] of the inside when formed. */
  inner: [number, number, number] | null;
  closed: boolean;
  windows: number;
  /** Blowers in its faces, and how many of them run (each running one is a tuyere: +25% smelting). */
  blowers: number;
  tuyeres: number;
  /** "Formed - Blast hearth 3x3x2" or "Not formed". */
  text: string;
  /** The first thing wrong with it (for the tier the furnace wants), or null. */
  problem: string | null;
}

export interface UpgradeView {
  next: FurnaceTierSpec;
  ingredients: IngredientStatus[];
  requiredC: number;
  tempOk: boolean;
  /**
   * The next tier's hearth is formed around the furnace (spec 17.1), and what to build for it otherwise ("Build a
   * Blast hearth: brick walls around the furnace"). Always set by the simulation; optional only so views built by
   * hand (UI tests) still type-check.
   */
  structureOk?: boolean;
  structure?: string | null;
  ok: boolean;
  /** What is missing, or null when the upgrade can be done now. Order: the hearth, ingredients, temperature. */
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
  /** The furnace block's (upgraded) tier, and its spec: name, age, blurb. */
  tier: number;
  spec: FurnaceTierSpec;
  /** The tier it runs at: min(tier, the formed hearth's tier), 1 standing alone (spec 17.1). */
  effectiveTier: number;
  hearth: HearthBrief;
  /** Crucibles that work now (the rest are locked). */
  cruciblesActive: number;
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
  /** Rain or snow falls on it from open sky: it loses heat FURNACE_WET_LOSS_MULT times faster (spec 15). */
  rainChilled: boolean;
  ignited: boolean;
  ignition: {
    state: IgnitionState; progress: number; powerW: number; seconds: number; canStart: ActionResult;
    /**
     * Tier 5 on a network: what ignition needs of it and whether cables, supply and storage hold (null otherwise).
     * Always set by the simulation; optional only so views built by hand (UI tests) still type-check.
     */
    power?: IgnitionPower | null;
  };
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

function crucibleView(e: FurnaceEntity, i: number, fs: FurnaceStats): CrucibleView {
  const view = crucibleBase(e, i, fs);
  // Molten metal waiting to be poured is what matters most; the smelt itself shows in the progress meter.
  if (view.moltenS > 0 && view.melt) view.status = `Molten ${itemName(view.melt.item)} - pour it in ${Math.ceil(view.moltenS)} s`;
  return view;
}

/** The alloy pot's status: what it holds and what it waits for. */
function potView(view: CrucibleView, e: FurnaceEntity, i: number): void {
  const [cu, sn] = e.crucibleMix[i];
  const block = potBlock(e, i);
  view.requiredC = alloyMinC();
  if (cu === 0 && sn === 0) view.status = 'Alloy pot - pour 3 copper and 1 tin ingots in';
  else if (cu < 3 || sn < 1) view.status = `Alloy pot: ${cu} copper, ${sn} tin - needs 3 copper and 1 tin`;
  else if (block) view.status = block;
  else if (!e.ignited && e.tempC < alloyMinC()) view.status = `Needs ${alloyMinC()} C - now ${Math.floor(e.tempC)} C`;
  else {
    view.active = true;
    view.progress = Math.min(1, e.crucibleProgress[i] / alloyTimeS());
    view.secondsLeft = alloyTimeS() - e.crucibleProgress[i];
    view.status = `Alloying bronze (${cu} copper, ${sn} tin)`;
  }
}

function crucibleBase(e: FurnaceEntity, i: number, fs: FurnaceStats): CrucibleView {
  const id = e.crucibleRecipe[i];
  const locked = i >= fs.crucibles;
  const r = id && !locked ? recipe(id) : null;
  const view: CrucibleView = {
    index: i, input: e.crucibleIn[i], output: e.crucibleOut[i], recipe: r, progress: 0, requiredC: r ? r.minTempC : null,
    secondsLeft: Infinity, active: false, locked, status: 'Empty',
    melt: e.crucibleMelt[i], moltenS: moltenLeft(e, i), mix: e.crucibleIn[i]?.item === ALLOY_POT ? e.crucibleMix[i] : null,
  };
  if (locked) {
    view.status = e.crucibleIn[i] || e.crucibleOut[i] ? 'Locked - take it out'
      : fs.tier < 2 ? 'Locked - build a hearth to use it' : 'Locked - a bigger hearth opens it';
    return view;
  }
  if (!r) {
    if (e.crucibleIn[i]?.item === ALLOY_POT) potView(view, e, i);
    else if (e.crucibleIn[i]) view.status = 'Cannot be smelted here';
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
    view.secondsLeft = (r.timeS - e.crucibleProgress[i]) / smeltSpeed(e, r, fs.speed);
    view.status = `Smelting ${itemName(r.output.item)}`;
  }
  return view;
}

function upgradeView(e: FurnaceEntity, sources: readonly Inventory[]): UpgradeView | null {
  if (e.tier >= MAX_FURNACE_TIER) return null;
  const next = furnaceTier(e.tier + 1);
  const status = ingredientStatus(next.upgradeCost, sources);
  const tempOk = e.tempC >= next.upgradeTempC;
  const structure = upgradeStructure(e, next.tier);
  const reason = structure ?? (!status.ok ? missingText(status.ingredients) : tempOk ? null : `Needs ${next.upgradeTempC} C - now ${Math.floor(e.tempC)} C`);
  return {
    next, ingredients: status.ingredients, requiredC: next.upgradeTempC, tempOk, structureOk: structure === null, structure,
    ok: structure === null && status.ok && tempOk, reason,
  };
}

/**
 * Where the temperature settles with the present heat sources, mirroring applyFurnace: fire, electric heat and the
 * heat engines' draw add up; the fire stops adding heat above its own flame.
 */
export function targetTemp(e: FurnaceEntity, fs: FurnaceStats, flame: number | null, satisfaction: number, lossMult: number): number {
  const lossWPerC = fs.lossWPerC * lossMult;
  const fuel = e.burnItem ? fuelOf(e.burnItem) : null;
  const qFire = flame !== null && fuel ? (fuel.energyJ / fuel.burnS) * (1 + e.draft) * fs.fireScale : 0;
  const elec = e.heatDemandW > 0 ? fs.electricHeatW * satisfaction : 0;
  let target = AMBIENT_TEMP_C + (qFire + elec - e.extractW) / lossWPerC;
  if (qFire > 0 && flame !== null && target > flame) target = Math.max(flame, AMBIENT_TEMP_C + (elec - e.extractW) / lossWPerC);
  return Math.min(Math.max(target, AMBIENT_TEMP_C), fs.maxTempC);
}

/** The hearth in brief, for the furnace screen's header and status line. */
function hearthBrief(e: FurnaceEntity, fs: FurnaceStats, hearth: Hearth | null): HearthBrief {
  const h = e.hearth;
  const scan = hearth?.scan ?? null;
  const want = Math.max(2, e.tier);
  let problem: string | null = null;
  if (scan && (!h || h.tier < want)) problem = scan.problems[0]?.text ?? null;
  const blowers = hearth?.blowers.length ?? 0;
  if (!h) {
    return { formed: false, tier: 0, name: null, inner: null, closed: false, windows: 0, blowers, tuyeres: 0, text: 'Not formed', problem };
  }
  const name = hearthName(h.tier);
  return {
    formed: true, tier: h.tier, name, inner: [...h.inner], closed: h.closed, windows: h.windows, blowers, tuyeres: fs.tuyeres,
    text: `Formed - ${name} ${h.inner[0]}x${h.inner[1]}x${h.inner[2]}`, problem,
  };
}

function furnaceStatus(e: FurnaceEntity, v: FurnaceView): string {
  if (e.ignited) return 'A star burns here. It needs nothing more.';
  if (e.ignition === 'running') return `Igniting - ${Math.round(v.ignition.progress * 100)}%`;
  if (v.effectiveTier < e.tier) {
    const runs = `it runs like a ${furnaceTier(v.effectiveTier).name}`;
    return v.hearth.formed ? `The ${v.hearth.name} holds it back - ${runs}` : `No ${hearthName(e.tier)} formed - ${runs}`;
  }
  const cold = v.crucibles.find((c) => c.recipe !== null && crucibleBlock(e, c.index, c.recipe) === 'cold');
  const heated = v.electric.deliveredW > 0;
  if (!e.lit && !heated) {
    if (v.electric.available && v.electric.on && v.electric.demandW > 0) {
      return v.electric.networked ? 'No power for electric heating' : 'Connect it to a power network to heat it electrically';
    }
    const junk = fireboxJunk(e);
    // An empty container filling the whole firebox keeps any fuel out.
    if (junk && e.fuel.every((s) => s !== null && !fuelOf(s.item))) return `Take the ${itemName(junk)} out of the firebox`;
    if (v.fuelItems === 0) return e.tempC >= FURNACE_HOT_C ? 'The fire is out - add fuel' : 'No fuel';
    return e.tempC >= FURNACE_HOT_C ? 'Cooling - light it again' : 'Ready to light';
  }
  if (cold && cold.recipe) return `${itemName(cold.recipe.output.item)} needs ${cold.requiredC} C - now ${Math.floor(e.tempC)} C`;
  if (v.electric.on && v.electric.demandW > 0 && v.electric.satisfaction < BROWNOUT_STALL) return 'Electric heating is starved of power';
  const rain = v.rainChilled ? ' - rain chills it, build a roof' : '';
  if (e.lit && !heated) return `Burns out in ${clock(v.burnTimeLeftS)}${rain}`;
  return (v.trend === 'steady' ? `Holding ${Math.floor(e.tempC)} C` : `Heading for ${Math.floor(v.targetC)} C`) + rain;
}

/**
 * `lossMult`: this tick's heat-loss multiplier from the weather (1 when dry or roofed). `hearth`: the runtime of the
 * hearth around it (the last scan's problems).
 */
export function furnaceView(host: ActionHost, node: SimNode, lossMult = 1, hearth: Hearth | null = null): FurnaceView {
  const e = node.e as FurnaceEntity;
  const tier = furnaceTier(e.tier);
  const fs = statsOf(node);
  const burning = isBurning(e);
  const flame = e.ignited ? e.tempC : burning ? e.flameC : null;
  const rate = (1 + e.draft) * fs.fireScale;
  const net = node.net;
  const satisfaction = net ? net.f : 0;
  const sources = host.stationSources(e.x, e.y, e.z);
  const counts = tally(sources);
  const home = host.player.home;
  const view: FurnaceView = {
    x: e.x, y: e.y, z: e.z, tier: e.tier, spec: tier, effectiveTier: fs.tier, hearth: hearthBrief(e, fs, hearth),
    cruciblesActive: Math.min(fs.crucibles, e.crucibleIn.length),
    home: home !== null && home.x === e.x && home.y === e.y && home.z === e.z, tempC: e.tempC, maxTempC: furnaceMaxTempC(e, fs),
    trend: e.rateCPerS > STEADY_C_PER_S ? 'rising' : e.rateCPerS < -STEADY_C_PER_S ? 'falling' : 'steady',
    rateCPerS: e.rateCPerS, lit: e.lit, burning, hot: e.tempC >= FURNACE_HOT_C, draft: e.draft, flameC: flame,
    targetC: e.ignited ? e.tempC : targetTemp(e, fs, flame, satisfaction, lossMult), burnItem: e.burnItem,
    burnItemLeftS: e.burnItem ? Math.max(0, e.burnLeftS) / rate : 0, burnTimeLeftS: burnSecondsLeft(e, node.extraFuel) / rate,
    fuelItems: fuelCount(e),
    crucibles: e.crucibleIn.map((_s, i) => crucibleView(e, i, fs)),
    electric: {
      available: fs.electricHeatW > 0, on: e.electric, networked: net !== null && net.nodes.length > 1, demandW: e.heatDemandW,
      deliveredW: e.heatDemandW * satisfaction, maxW: fs.electricHeatW, satisfaction,
    },
    extractW: e.extractW, rainChilled: !e.ignited && lossMult > 1, ignited: e.ignited,
    ignition: {
      state: e.ignition, progress: Math.min(1, e.ignitionProgressS / IGNITION_TIME_S), powerW: IGNITION_POWER,
      seconds: IGNITION_TIME_S, canStart: ignitionCheck(e, node), power: e.tier >= MAX_FURNACE_TIER ? ignitionPower(e, node) : null,
    },
    upgrade: upgradeView(e, sources), canRest: restCheck(host, e, node),
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
    const lock = tierLock(e, r.minTier);
    const locked = lock !== null;
    const tempOk = e.ignited || e.tempC >= r.minTempC;
    const heatAllows = e.ignited ? Infinity : tempOk ? Math.floor((e.tempC - r.minTempC) / FORGE_CHILL_C) + 1 : 0;
    let reason: string | null = null;
    if (lock) reason = lock;
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
    const lock = tierLock(e, r.minTier);
    const locked = lock !== null;
    const tempOk = e.ignited || e.tempC >= r.minTempC;
    const reason = lock ?? (tempOk ? null : `Needs ${r.minTempC} C`);
    return { recipe: r, locked, tempOk, have: counts.get(r.inputs[0].item) ?? 0, reason };
  });
}
