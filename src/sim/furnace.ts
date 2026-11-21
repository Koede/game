/** The furnace heat model, firebox, crucibles and Starhearth ignition (spec 3.1). Pure state changes on the entity. */
import {
  AMBIENT_TEMP_C, DRAFT_DECAY_PER_S, DRAFT_FLAME_BONUS_C, FURNACE_HOT_C,
} from '../core/constants';
import { fuelOf, item, machine, recipe, recipesAt } from '../core/registry';
import type { RecipeDef } from '../core/types';
import { addToSlots, type ExtraFuel, type FurnaceEntity, type SimContext, type SimNode } from './entities';
import { ALLOY_POT, castRoom, coolMolten, pourOutOfSmelt, runPot } from './casting';
import { furnaceStats, type FurnaceStats } from './hearthStats';

const FURNACE = machine('furnace');
const P = FURNACE.params ?? {};
export const IGNITION_TEMP_C = P.ignitionTempC;
export const IGNITION_POWER = P.ignitionPowerW;
export const IGNITION_TIME_S = P.ignitionSeconds;
export const IGNITION_MIN_F = P.ignitionMinSatisfaction;
const IGNITION_GRACE_S = P.ignitionGraceS;
export const IGNITED_TEMP_C = P.ignitedTempC;
/** Ignition progress is announced in steps of this fraction, never every tick. */
const IGNITION_STEP = 0.1;

const smeltByInput = new Map<string, RecipeDef>();
for (const r of recipesAt('furnace')) if (r.kind === 'smelt') smeltByInput.set(r.inputs[0].item, r);

/** The smelt recipe a crucible runs for this input item (smelt inputs are unique). */
export const smeltRecipeFor = (itemKey: string): RecipeDef | null => smeltByInput.get(itemKey) ?? null;

/** The numbers a furnace node runs at (kept by the hearths; a lone furnace's until they first look). */
export const statsOf = (node: SimNode): FurnaceStats => node.fs ?? (node.fs = furnaceStats((node.e as FurnaceEntity).tier, null));

export const furnaceMaxTempC = (e: FurnaceEntity, fs: FurnaceStats): number => (e.ignited ? IGNITED_TEMP_C : fs.maxTempC);

/** Hands an item back to whoever is at the furnace (a burned lava bucket's empty bucket that found no slot). */
export type GiveBack = (item: string) => void;

export const isBurning = (e: FurnaceEntity): boolean => e.lit && e.burnItem !== null;

/** Fuel items in the firebox slots (what can burn: an empty container a burned fuel left there does not count). */
export function fuelCount(e: FurnaceEntity): number {
  let n = 0;
  for (const s of e.fuel) if (s && fuelOf(s.item)) n += s.count;
  return n;
}

/** The first thing in the firebox that cannot burn (the lava bucket's empty bronze bucket), or null. */
export function fireboxJunk(e: FurnaceEntity): string | null {
  for (const s of e.fuel) if (s && !fuelOf(s.item)) return s.item;
  return null;
}

/** Fuel a formed hearth's fluid hatches hold burns like this item (with no bucket to give back). */
const LAVA_FUEL = 'lava_bucket';
const LAVA_BURN_S = fuelOf(LAVA_FUEL)?.burnS ?? 0;

/**
 * Seconds of fire left across the whole firebox at no draft and a fire scale of 1 (the item burning, every item
 * waiting, and lava waiting in the hearth's fluid hatches).
 */
export function burnSecondsLeft(e: FurnaceEntity, extra: ExtraFuel | null = null): number {
  let s = e.burnItem !== null ? Math.max(0, e.burnLeftS) : 0;
  for (const slot of e.fuel) if (slot) s += (fuelOf(slot.item)?.burnS ?? 0) * slot.count;
  if (extra) s += extra.lavaUnits() * LAVA_BURN_S;
  return s;
}

/**
 * Moves the next fuel item from the slots into the fire (then a load of the hearth's lava). A fuel that comes in a
 * container (FuelSpec.fuelReturns: the lava bucket) leaves the container in the firebox slot it emptied; if that
 * slot is still taken, in another one, else it is handed to `give`. False when there is nothing left to burn.
 */
export function takeNextFuel(e: FurnaceEntity, extra: ExtraFuel | null = null, give: GiveBack | null = null): boolean {
  for (let i = 0; i < e.fuel.length; i++) {
    const s = e.fuel[i];
    const fuel = s ? fuelOf(s.item) : null;
    if (!s || !fuel) continue;
    e.burnItem = s.item;
    e.burnLeftS += fuel.burnS;
    s.count--;
    if (s.count <= 0) e.fuel[i] = null;
    const back = fuel.fuelReturns;
    if (back) {
      if (e.fuel[i] === null) e.fuel[i] = { item: back, count: 1 };
      else if (addToSlots(e.fuel, back, 1) > 0) give?.(back);
    }
    return true;
  }
  if (extra && extra.takeLava()) {
    e.burnItem = LAVA_FUEL;
    e.burnLeftS += LAVA_BURN_S;
    return true;
  }
  e.burnItem = null;
  e.burnLeftS = 0;
  return false;
}

/** Burns `seconds` of fire. Returns false when the fire ran out of fuel on the way (it is then out). */
export function burn(e: FurnaceEntity, seconds: number, extra: ExtraFuel | null = null, give: GiveBack | null = null): boolean {
  e.burnLeftS -= seconds;
  while (e.burnLeftS <= 0) {
    if (!takeNextFuel(e, extra, give)) {
      e.lit = false;
      return false;
    }
  }
  return true;
}

/**
 * Before the networks are solved: this tick's electric demand. The thermostat counts the heat engines' draw of the
 * last tick (`extractW`), which is then cleared: they add this tick's draw after the networks are solved, in
 * proportion to the power actually used.
 */
export function prepareFurnace(node: SimNode): void {
  const e = node.e as FurnaceEntity;
  const fs = statsOf(node);
  const extract = e.extractW;
  e.extractW = 0;
  if (e.ignited) {
    e.demandW = 0;
    e.heatDemandW = 0;
    e.availW = FURNACE.outputW ?? 0;
    return;
  }
  let demand = 0;
  if (e.electric && fs.electricHeatW > 0) {
    const want = fs.lossWPerC * (e.tempC - AMBIENT_TEMP_C) + extract + ((fs.maxTempC - e.tempC) * fs.heatCapacityJ) / 2;
    demand = want <= 0 ? 0 : want >= fs.electricHeatW ? fs.electricHeatW : want;
  }
  e.heatDemandW = demand;
  e.demandW = e.ignition === 'running' ? demand + IGNITION_POWER : demand;
  e.availW = 0;
}

/**
 * After the networks are solved: fire, temperature, crucibles, ignition. `lossMult` scales the heat loss (rain or
 * snow falling on a furnace with open sky above, spec 15).
 */
export function applyFurnace(node: SimNode, ctx: SimContext, dt: number, lossMult = 1): void {
  const e = node.e as FurnaceEntity;
  const fs = statsOf(node);
  if (e.ignited) {
    e.tempC = IGNITED_TEMP_C;
    e.rateCPerS = 0;
    e.flameC = IGNITED_TEMP_C;
    e.deliveredW = 0;
    runCrucibles(e, ctx, dt, fs);
    ctx.setActive(node, true);
    return;
  }
  const f = node.net ? node.net.f : 0;
  e.deliveredW = f * e.demandW;
  const extra = node.extraFuel;
  const give = ctx.giveBack;

  // Adding fuel to a furnace that is still hot relights it.
  const count = fuelCount(e) + (extra ? extra.lavaUnits() : 0);
  if (!e.lit && count > e.fuelSeen && e.tempC >= FURNACE_HOT_C) lightFire(e, ctx, extra);
  e.fuelSeen = count;

  const draft = e.draft;
  let qFuel = 0;
  let flame = AMBIENT_TEMP_C;
  if (e.lit) {
    // A hearth's fire is sized to its shell: it burns fireScale times as much, and gives as much more heat.
    if (burn(e, dt * (1 + draft) * fs.fireScale, extra, give)) {
      const fuel = fuelOf(e.burnItem ?? '');
      if (fuel) {
        flame = fuel.flameTempC + DRAFT_FLAME_BONUS_C * draft;
        if (e.tempC <= flame) qFuel = (fuel.energyJ / fuel.burnS) * (1 + draft) * fs.fireScale;
      }
    } else {
      e.fuelSeen = 0;
      ctx.bus.emit('furnace:out', { x: e.x, y: e.y, z: e.z });
      ctx.bus.emit('sfx', { name: 'fire_out', x: e.x, y: e.y, z: e.z });
      // Not worth a warning while electricity keeps the furnace hot.
      if (e.deliveredW <= 0) ctx.bus.emit('toast', { text: 'The furnace fire burned out', kind: 'warn' });
    }
  }
  e.flameC = flame;
  e.draft = Math.max(0, draft - DRAFT_DECAY_PER_S * dt);

  const before = e.tempC;
  const loss = fs.lossWPerC * lossMult * (before - AMBIENT_TEMP_C);
  const base = before + ((f * e.heatDemandW - loss - e.extractW) * dt) / fs.heatCapacityJ;
  let t = base + (qFuel * dt) / fs.heatCapacityJ;
  // A fire never heats past its own flame: a steady fire sits exactly at its flame temperature.
  if (qFuel > 0 && t > flame) t = Math.max(flame, base);
  // Above its maximum (its hearth came apart) nothing heats it: it cools down to the maximum by itself.
  if (before > fs.maxTempC) t = Math.max(fs.maxTempC, before - ((loss + e.extractW) * dt) / fs.heatCapacityJ);
  const top = before > fs.maxTempC ? before : fs.maxTempC;
  t = t < AMBIENT_TEMP_C ? AMBIENT_TEMP_C : t > top ? top : t;
  e.tempC = t;
  e.rateCPerS = (t - before) / dt;

  runCrucibles(e, ctx, dt, fs);
  if (e.ignition === 'running') runIgnition(e, ctx, dt, f);
  ctx.setActive(node, t >= FURNACE_HOT_C);
}

/** Starts the fire if there is anything to burn. */
export function lightFire(e: FurnaceEntity, ctx: SimContext, extra: ExtraFuel | null = null): boolean {
  if (e.burnItem === null && !takeNextFuel(e, extra, ctx.giveBack)) return false;
  e.lit = true;
  ctx.bus.emit('furnace:lit', { x: e.x, y: e.y, z: e.z });
  ctx.bus.emit('sfx', { name: 'ignite', x: e.x, y: e.y, z: e.z });
  ctx.flagOnce('furnace_lit');
  return true;
}

/** Why a crucible is not advancing, or null when it is. */
export function crucibleBlock(e: FurnaceEntity, i: number, r: RecipeDef): 'input' | 'output' | 'cold' | null {
  const inp = e.crucibleIn[i];
  if (!inp || inp.count < r.inputs[0].count) return 'input';
  if (!castRoom(e, i, r)) return 'output';
  if (!e.ignited && e.tempC < r.minTempC) return 'cold';
  return null;
}

/** Smelting speed of a recipe at the furnace's current temperature, in recipe-seconds per second. */
export function smeltSpeed(e: FurnaceEntity, r: RecipeDef, tierSpeed: number): number {
  return tierSpeed * (1 + Math.min(1, Math.max(0, (e.tempC - r.minTempC) / 300)));
}

/** The smelt recipe this furnace may run on an input item at its effective tier, or null. */
export function crucibleRecipe(itemKey: string, fs: FurnaceStats): RecipeDef | null {
  const r = smeltRecipeFor(itemKey);
  return r && r.minTier <= fs.tier ? r : null;
}

/** Crucibles beyond the hearth's count are locked: they hold still, and only give their contents back. */
function runCrucibles(e: FurnaceEntity, ctx: SimContext, dt: number, fs: FurnaceStats): void {
  coolMolten(e, ctx, dt);
  const n = Math.min(fs.crucibles, e.crucibleIn.length);
  for (let i = 0; i < n; i++) {
    const inp = e.crucibleIn[i];
    if (!inp) {
      if (e.crucibleRecipe[i] !== null) {
        e.crucibleRecipe[i] = null;
        e.crucibleProgress[i] = 0;
      }
      continue;
    }
    if (inp.item === ALLOY_POT) {
      runPot(e, i, ctx, dt);
      continue;
    }
    const current = e.crucibleRecipe[i];
    let r = current === null ? null : recipe(current);
    if (!r || r.inputs[0].item !== inp.item || r.minTier > fs.tier) {
      r = crucibleRecipe(inp.item, fs);
      e.crucibleRecipe[i] = r ? r.id : null;
      e.crucibleProgress[i] = 0;
    }
    if (!r || crucibleBlock(e, i, r) !== null) continue;
    e.crucibleProgress[i] += dt * smeltSpeed(e, r, fs.speed);
    if (e.crucibleProgress[i] < r.timeS) continue;
    e.crucibleProgress[i] = 0;
    inp.count -= r.inputs[0].count;
    if (inp.count <= 0) e.crucibleIn[i] = null;
    if (!pourOutOfSmelt(e, i, r)) {
      const out = e.crucibleOut[i];
      if (out) out.count += r.output.count;
      else e.crucibleOut[i] = { item: r.output.item, count: r.output.count };
    }
    ctx.touch(e);
    ctx.bus.emit('furnace:smelted', { x: e.x, y: e.y, z: e.z, item: r.output.item, count: r.output.count });
    ctx.bus.emit('item:made', { item: r.output.item, count: r.output.count, station: 'furnace', recipeId: r.id });
    ctx.bus.emit('sfx', { name: 'smelt_done', x: e.x, y: e.y, z: e.z });
  }
}

function runIgnition(e: FurnaceEntity, ctx: SimContext, dt: number, f: number): void {
  const pos = { x: e.x, y: e.y, z: e.z };
  if (f >= IGNITION_MIN_F) {
    e.ignitionLowS = 0;
    const before = Math.floor(e.ignitionProgressS / (IGNITION_TIME_S * IGNITION_STEP));
    e.ignitionProgressS += dt;
    const progress = Math.min(1, e.ignitionProgressS / IGNITION_TIME_S);
    if (e.ignitionProgressS >= IGNITION_TIME_S - 1e-9) {
      e.ignition = 'done';
      e.ignited = true;
      e.lit = true;
      e.tempC = IGNITED_TEMP_C;
      ctx.bus.emit('furnace:ignition', { ...pos, state: 'done', progress: 1 });
      ctx.bus.emit('sfx', { name: 'win' });
      ctx.bus.emit('toast', { text: `${item('furnace_star').name} ignited - a star burns in your hearth`, kind: 'good' });
      ctx.bus.emit('flag', { flag: 'ignited' });
      ctx.bus.emit('game:won', {});
    } else if (Math.floor(e.ignitionProgressS / (IGNITION_TIME_S * IGNITION_STEP)) !== before) {
      ctx.bus.emit('furnace:ignition', { ...pos, state: 'progress', progress });
    }
    return;
  }
  e.ignitionLowS += dt;
  if (e.ignitionLowS <= IGNITION_GRACE_S) return;
  e.ignition = 'failed';
  e.ignitionProgressS = 0;
  e.ignitionLowS = 0;
  ctx.bus.emit('furnace:ignition', { ...pos, state: 'failed', progress: 0 });
  ctx.bus.emit('sfx', { name: 'machine_off', ...pos });
  ctx.bus.emit('toast', { text: 'Ignition failed - the grid could not hold the power', kind: 'bad' });
}
