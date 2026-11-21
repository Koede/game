/** The furnace heat model, firebox, crucibles and Starhearth ignition (spec 3.1). Pure state changes on the entity. */
import {
  AMBIENT_TEMP_C, DRAFT_DECAY_PER_S, DRAFT_FLAME_BONUS_C, FURNACE_HOT_C,
} from '../core/constants';
import { fuelOf, furnaceTier, item, machine, recipe, recipesAt } from '../core/registry';
import type { RecipeDef } from '../core/types';
import { stackMax, type FurnaceEntity, type SimContext, type SimNode } from './entities';

const FURNACE = machine('furnace');
const P = FURNACE.params ?? {};
export const IGNITION_TEMP_C = P.ignitionTempC;
export const IGNITION_POWER = P.ignitionPowerW;
export const IGNITION_TIME_S = P.ignitionSeconds;
const IGNITION_MIN_F = P.ignitionMinSatisfaction;
const IGNITION_GRACE_S = P.ignitionGraceS;
export const IGNITED_TEMP_C = P.ignitedTempC;
/** Ignition progress is announced in steps of this fraction, never every tick. */
const IGNITION_STEP = 0.1;

const smeltByInput = new Map<string, RecipeDef>();
for (const r of recipesAt('furnace')) if (r.kind === 'smelt') smeltByInput.set(r.inputs[0].item, r);

/** The smelt recipe a crucible runs for this input item (smelt inputs are unique). */
export const smeltRecipeFor = (itemKey: string): RecipeDef | null => smeltByInput.get(itemKey) ?? null;

export const furnaceMaxTempC = (e: FurnaceEntity): number => (e.ignited ? IGNITED_TEMP_C : furnaceTier(e.tier).maxTempC);

export const isBurning = (e: FurnaceEntity): boolean => e.lit && e.burnItem !== null;

/** Total fuel items in the firebox slots. */
export function fuelCount(e: FurnaceEntity): number {
  let n = 0;
  for (const s of e.fuel) if (s) n += s.count;
  return n;
}

/** Seconds of fire left across the whole firebox at no draft (the item burning plus every item waiting). */
export function burnSecondsLeft(e: FurnaceEntity): number {
  let s = e.burnItem !== null ? Math.max(0, e.burnLeftS) : 0;
  for (const slot of e.fuel) if (slot) s += (fuelOf(slot.item)?.burnS ?? 0) * slot.count;
  return s;
}

/** Moves the next fuel item from the slots into the fire. False when the firebox is empty. */
export function takeNextFuel(e: FurnaceEntity): boolean {
  for (let i = 0; i < e.fuel.length; i++) {
    const s = e.fuel[i];
    const fuel = s ? fuelOf(s.item) : null;
    if (!s || !fuel) continue;
    e.burnItem = s.item;
    e.burnLeftS += fuel.burnS;
    s.count--;
    if (s.count <= 0) e.fuel[i] = null;
    return true;
  }
  e.burnItem = null;
  e.burnLeftS = 0;
  return false;
}

/** Burns `seconds` of fire. Returns false when the fire ran out of fuel on the way (it is then out). */
export function burn(e: FurnaceEntity, seconds: number): boolean {
  e.burnLeftS -= seconds;
  while (e.burnLeftS <= 0) {
    if (!takeNextFuel(e)) {
      e.lit = false;
      return false;
    }
  }
  return true;
}

/** Before the networks are solved: draft decay and this tick's electric demand. `extractW` is already summed. */
export function prepareFurnace(node: SimNode): void {
  const e = node.e as FurnaceEntity;
  if (e.ignited) {
    e.demandW = 0;
    e.heatDemandW = 0;
    e.availW = FURNACE.outputW ?? 0;
    return;
  }
  const tier = furnaceTier(e.tier);
  let demand = 0;
  if (e.electric && tier.electricHeatW > 0) {
    const want = tier.lossWPerC * (e.tempC - AMBIENT_TEMP_C) + e.extractW + ((tier.maxTempC - e.tempC) * tier.heatCapacityJ) / 2;
    demand = want <= 0 ? 0 : want >= tier.electricHeatW ? tier.electricHeatW : want;
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
  const tier = furnaceTier(e.tier);
  if (e.ignited) {
    e.tempC = IGNITED_TEMP_C;
    e.rateCPerS = 0;
    e.flameC = IGNITED_TEMP_C;
    e.deliveredW = 0;
    runCrucibles(e, ctx, dt, tier.speed);
    ctx.setActive(node, true);
    return;
  }
  const f = node.net ? node.net.f : 0;
  e.deliveredW = f * e.demandW;

  // Adding fuel to a furnace that is still hot relights it.
  const count = fuelCount(e);
  if (!e.lit && count > e.fuelSeen && e.tempC >= FURNACE_HOT_C) lightFire(e, ctx);
  e.fuelSeen = count;

  const draft = e.draft;
  let qFuel = 0;
  let flame = AMBIENT_TEMP_C;
  if (e.lit) {
    if (burn(e, dt * (1 + draft))) {
      const fuel = fuelOf(e.burnItem ?? '');
      if (fuel) {
        flame = fuel.flameTempC + DRAFT_FLAME_BONUS_C * draft;
        if (e.tempC <= flame) qFuel = (fuel.energyJ / fuel.burnS) * (1 + draft);
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
  const loss = tier.lossWPerC * lossMult * (before - AMBIENT_TEMP_C);
  const base = before + ((f * e.heatDemandW - loss - e.extractW) * dt) / tier.heatCapacityJ;
  let t = base + (qFuel * dt) / tier.heatCapacityJ;
  // A fire never heats past its own flame: a steady fire sits exactly at its flame temperature.
  if (qFuel > 0 && t > flame) t = Math.max(flame, base);
  t = t < AMBIENT_TEMP_C ? AMBIENT_TEMP_C : t > tier.maxTempC ? tier.maxTempC : t;
  e.tempC = t;
  e.rateCPerS = (t - before) / dt;

  runCrucibles(e, ctx, dt, tier.speed);
  if (e.ignition === 'running') runIgnition(e, ctx, dt, f);
  ctx.setActive(node, t >= FURNACE_HOT_C);
}

/** Starts the fire if there is anything to burn. */
export function lightFire(e: FurnaceEntity, ctx: SimContext): boolean {
  if (e.burnItem === null && !takeNextFuel(e)) return false;
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
  const out = e.crucibleOut[i];
  if (out && (out.item !== r.output.item || out.count + r.output.count > stackMax(out.item))) return 'output';
  if (!e.ignited && e.tempC < r.minTempC) return 'cold';
  return null;
}

/** Smelting speed of a recipe at the furnace's current temperature, in recipe-seconds per second. */
export function smeltSpeed(e: FurnaceEntity, r: RecipeDef, tierSpeed: number): number {
  return tierSpeed * (1 + Math.min(1, Math.max(0, (e.tempC - r.minTempC) / 300)));
}

function runCrucibles(e: FurnaceEntity, ctx: SimContext, dt: number, tierSpeed: number): void {
  for (let i = 0; i < e.crucibleIn.length; i++) {
    const inp = e.crucibleIn[i];
    if (!inp) {
      if (e.crucibleRecipe[i] !== null) {
        e.crucibleRecipe[i] = null;
        e.crucibleProgress[i] = 0;
      }
      continue;
    }
    const current = e.crucibleRecipe[i];
    let r = current === null ? null : recipe(current);
    if (!r || r.inputs[0].item !== inp.item) {
      r = smeltRecipeFor(inp.item);
      if (r && r.minTier > e.tier) r = null;
      e.crucibleRecipe[i] = r ? r.id : null;
      e.crucibleProgress[i] = 0;
    }
    if (!r || crucibleBlock(e, i, r) !== null) continue;
    e.crucibleProgress[i] += dt * smeltSpeed(e, r, tierSpeed);
    if (e.crucibleProgress[i] < r.timeS) continue;
    e.crucibleProgress[i] = 0;
    inp.count -= r.inputs[0].count;
    if (inp.count <= 0) e.crucibleIn[i] = null;
    const out = e.crucibleOut[i];
    if (out) out.count += r.output.count;
    else e.crucibleOut[i] = { item: r.output.item, count: r.output.count };
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
