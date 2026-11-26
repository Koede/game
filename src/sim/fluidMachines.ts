/**
 * Machines that exist for fluids (spec 16.1, 16.5): the pump, the boiler and the steam turbine, plus the still's
 * crude-oil runs. The fluid ports of the older machines (piped water, fuel, lava) are in machines.ts and fission.ts
 * through src/sim/fluidUse.ts.
 *
 * - Pump: a 50 W consumer touching a liquid SOURCE (flowing water is not drawn, spec 18.3). It fills its buffer at
 *   litresPerS x satisfaction; pulling pipes empty it. A water source with two sources beside it (the rule that fills
 *   a hole in a lake again, `refillsAsSource`) never runs dry; any other body (lava, oil, a lone water source or a
 *   thin line of them) loses a source for every litresPerBlock drawn - the farthest one a breadth-first search of at
 *   most searchLimit sources finds, so the pool shrinks towards the pump and is never cut off from it. Water around
 *   it then reacts by the flow rules (src/world/flow.ts).
 * - Boiler: on top of a furnace (or any block of a formed hearth's shell), above minTempC it boils water into
 *   steamPerWater times as much steam, steamLPerC litres a second per degree over minTempC up to capLPerS, as far as
 *   its water and its steam room allow, and takes heatPerSteamL joules of heat from the furnace per litre - so a
 *   boiler whose steam nobody uses stops boiling and stops cooling the fire.
 * - Steam turbine: outputW x min(1, steam / steamLPerS), load-following; it uses steam for the power actually drawn.
 * - Still: between item jobs, oilPerRunL of crude oil becomes fuelPerRunL of refined fuel every oilRunS.
 */
import { BROWNOUT_STALL, DT } from '../core/constants';
import { MachineStatus } from '../core/machineStatus';
import { fluid as fluidSpec, fluidOfLiquid, machine } from '../core/registry';
import { AIR, FACE_DIRS, type FluidKey, type IWorld, type LiquidKind } from '../core/types';
import { isLiquidSource, refillsAsSource } from '../world/water';
import type { FurnaceEntity, MachineEntity, SimContext, SimNode } from './entities';
import { heldL, useFluid } from './fluidUse';
import { behaviourOf, type Behaviour } from './machines';
import { powered } from './power';
import type { FluidLinks } from './transportViews';

const PUMP = machine('pump');
const PP = PUMP.params ?? {};
const BOILER = machine('boiler');
const BP = BOILER.params ?? {};
const TURBINE = machine('steam_turbine');
const STILL = machine('still');
const SP = STILL.params ?? {};

/** `MachineEntity.recipe` of a still refining crude oil (not a recipe of the registry). */
export const OIL_RUN = 'still:crude_oil';

/** Adds litres of a fluid to a machine's output buffer (the caller checked the room). */
function addOut(e: MachineEntity, fluid: FluidKey, litres: number): void {
  if (litres <= 0) return;
  if (e.fluidOut && e.fluidOut.litres > 0) e.fluidOut.litres += litres;
  else e.fluidOut = { fluid, litres };
}

/** Room in the output buffer for `fluid` (none while it holds another fluid). */
function outRoom(e: MachineEntity, fluid: FluidKey, cap: number): number {
  const b = e.fluidOut;
  if (!b || b.litres <= 0) return cap;
  return b.fluid === fluid ? Math.max(0, cap - b.litres) : 0;
}

// ---- pump ---------------------------------------------------------------------------------------------------------

/** The liquid source a pump draws from: the touching block, and whether it refills (never runs dry). */
export interface PumpSource {
  liquid: LiquidKind;
  fluid: FluidKey;
  x: number;
  y: number;
  z: number;
  endless: boolean;
}

/** Connected source blocks of one liquid from (x, y, z), breadth first, at most `limit` of them. */
function liquidBody(world: IWorld, liquid: LiquidKind, x: number, y: number, z: number, limit: number): Array<[number, number, number]> {
  const seen = new Set<string>([`${x},${y},${z}`]);
  const out: Array<[number, number, number]> = [[x, y, z]];
  for (let i = 0; i < out.length && out.length < limit; i++) {
    const [cx, cy, cz] = out[i];
    for (const [dx, dy, dz] of FACE_DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nz = cz + dz;
      const k = `${nx},${ny},${nz}`;
      if (seen.has(k) || world.getBlock(nx, ny, nz).liquid !== liquid || !isLiquidSource(world.getVoxel(nx, ny, nz))) continue;
      seen.add(k);
      out.push([nx, ny, nz]);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** What a pump at e draws from now: a touching liquid (the one its buffer holds first), or null. */
export function pumpSource(world: IWorld, e: MachineEntity): PumpSource | null {
  let found: PumpSource | null = null;
  const holding = e.fluidOut && e.fluidOut.litres > 0 ? e.fluidOut.fluid : null;
  for (const [dx, dy, dz] of FACE_DIRS) {
    const x = e.x + dx;
    const y = e.y + dy;
    const z = e.z + dz;
    const liquid = world.getBlock(x, y, z).liquid;
    const fluid = liquid ? fluidOfLiquid(liquid) : null;
    if (!liquid || !fluid || !isLiquidSource(world.getVoxel(x, y, z))) continue;
    const src: PumpSource = { liquid, fluid: fluid.key, x, y, z, endless: false };
    if (!found || (holding === fluid.key && found.fluid !== holding)) found = src;
  }
  if (found && found.liquid === 'water') found.endless = refillsAsSource(world, found.x, found.y, found.z);
  return found;
}

/** Takes one block out of a finite body: the farthest of the first searchLimit blocks found from the source. */
function drainBlock(world: IWorld, src: PumpSource): void {
  const body = liquidBody(world, src.liquid, src.x, src.y, src.z, PP.searchLimit);
  const [x, y, z] = body[body.length - 1];
  world.setVoxel(x, y, z, AIR, 'sim');
}

const sources = new WeakMap<SimNode, PumpSource | null>();

const pump: Behaviour = {
  prepare(node, ctx) {
    const e = node.e as MachineEntity;
    // The liquid around it changes only with blocks; looked at again once a second (and right after it drained one).
    if (!sources.has(node) || ctx.everySecond) sources.set(node, pumpSource(ctx.world, e));
    const src = sources.get(node) ?? null;
    const ok = e.on && src !== null && outRoom(e, src.fluid, PUMP.fluids?.capacityL ?? 0) > 0;
    e.demandW = ok ? PUMP.drawW ?? 0 : 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    e.f = node.net ? node.net.f : 0;
    const src = sources.get(node) ?? null;
    const running = e.demandW > 0 && src !== null && e.f >= BROWNOUT_STALL && powered(node.net);
    // Nothing to pump (no liquid in reach, or the power is out) is starved; a tank with no room left is full.
    const status = !e.on ? MachineStatus.None : src === null || e.demandW > 0 ? MachineStatus.Starved : MachineStatus.Full;
    ctx.setActive(node, running, status);
    e.rateL = 0;
    if (!running || !src) return;
    const litres = Math.min(PP.litresPerS * e.f * dt, outRoom(e, src.fluid, PUMP.fluids?.capacityL ?? 0));
    addOut(e, src.fluid, litres);
    e.rateL = litres / dt;
    if (src.endless) return;
    let drawn = (e.drawnL ?? 0) + litres;
    if (drawn >= PP.litresPerBlock) {
      drawn -= PP.litresPerBlock;
      drainBlock(ctx.world, src);
      sources.delete(node);
    }
    e.drawnL = drawn;
  },
};

// ---- boiler -------------------------------------------------------------------------------------------------------

function hottest(node: SimNode): FurnaceEntity | null {
  let best: FurnaceEntity | null = null;
  for (const f of node.furnaces) if (!best || f.tempC > best.tempC) best = f;
  return best;
}

const boiler: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    e.availW = 0;
    e.demandW = 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    const furnace = hottest(node);
    e.rateL = 0;
    let steam = 0;
    if (e.on && furnace) {
      const rate = Math.min(BP.capLPerS, Math.max(0, BP.steamLPerC * (furnace.tempC - BP.minTempC)));
      steam = Math.min(rate * dt, heldL(e, 'water') * BP.steamPerWater, outRoom(e, 'steam', BOILER.fluids?.capacityL ?? 0));
    }
    if (steam > 0 && furnace) {
      useFluid(e, 'water', steam / BP.steamPerWater);
      addOut(e, 'steam', steam);
      e.rateL = steam / dt;
      furnace.extractW += e.rateL * BP.heatPerSteamL;
    }
    ctx.setActive(node, steam > 0, e.on && furnace && heldL(e, 'water') <= 0 ? MachineStatus.Starved : MachineStatus.None);
  },
};

// ---- steam turbine ------------------------------------------------------------------------------------------------

const turbine: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    const perS = TURBINE.params?.steamLPerS ?? 1;
    e.availW = e.on ? (TURBINE.outputW ?? 0) * Math.min(1, heldL(e, 'steam') / (perS * DT)) : 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    e.outW = e.availW * (node.net ? node.net.load : 0);
    ctx.setActive(node, e.availW > 0, e.on && e.availW <= 0 ? MachineStatus.Starved : MachineStatus.None);
    const out = TURBINE.outputW ?? 1;
    const used = useFluid(e, 'steam', (TURBINE.params?.steamLPerS ?? 0) * dt * (e.outW / out));
    e.rateL = used / dt;
  },
};

// ---- still: crude oil runs -----------------------------------------------------------------------------------------

/** A still can start (or go on with) a crude-oil run: oil for one run in, room for its fuel out. */
const oilReady = (e: MachineEntity): boolean =>
  heldL(e, 'crude_oil') >= SP.oilPerRunL && outRoom(e, 'fuel', STILL.fluids?.capacityL ?? 0) >= SP.fuelPerRunL;

const still: Behaviour = {
  prepare(node, ctx) {
    const e = node.e as MachineEntity;
    if (e.recipe === OIL_RUN) {
      if (e.on && oilReady(e)) {
        node.job = null;
        e.demandW = STILL.drawW ?? 0;
        return;
      }
      e.recipe = null;
      e.progress = 0;
    }
    behaviourOf('still').prepare(node, ctx);
    // Item jobs come first; crude oil runs while the slot has nothing to do.
    if (node.job === null && e.on && oilReady(e) && (e.slots[0] === null || e.recipe === null)) {
      e.recipe = OIL_RUN;
      e.progress = 0;
      e.demandW = STILL.drawW ?? 0;
    }
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    if (e.recipe !== OIL_RUN) {
      behaviourOf('still').apply(node, ctx, dt);
      return;
    }
    e.f = node.net ? node.net.f : 0;
    const running = e.demandW > 0 && e.f >= BROWNOUT_STALL;
    ctx.setActive(node, running, e.demandW > 0 ? MachineStatus.Starved : MachineStatus.None);
    if (!running) return;
    e.progress += dt * e.f;
    if (e.progress < SP.oilRunS) return;
    e.progress = 0;
    e.recipe = null;
    useFluid(e, 'crude_oil', SP.oilPerRunL);
    addOut(e, 'fuel', SP.fuelPerRunL);
    ctx.bus.emit('machine:job', { kind: e.kind, x: e.x, y: e.y, z: e.z, item: 'fuel' });
    ctx.bus.emit('sfx', { name: 'machine_done', x: e.x, y: e.y, z: e.z });
    ctx.flagOnce('machine_job');
  },
};

/** The behaviour of the fluid machines (and the still's oil-aware one), or null for every other kind. */
export function fluidBehaviour(kind: string): Behaviour | null {
  switch (kind) {
    case 'pump':
      return pump;
    case 'boiler':
      return boiler;
    case 'steam_turbine':
      return turbine;
    case 'still':
      return still;
    default:
      return null;
  }
}

const fmtL = (litres: number): string => `${Math.round(litres).toLocaleString('en-US')} L`;
const fluidName = (key: FluidKey): string => fluidSpec(key).name.toLowerCase();

/**
 * Why a full pump stops, from the pipe ends touching it (any fluid pipe, `fluidLinksAt(..., false)`): none at all, ends
 * that only push (nothing pulls from it), or an end that pulls but the line behind it has no room. Without `links` (a
 * caller that does not know the pipes) it gives the advice for the unpiped case.
 */
export function pumpFullStatus(links: FluidLinks | null): string {
  if (links?.pullsHere) return 'Full - the line has nowhere to put it';
  if (links?.piped) return 'Full - nothing pulls from it';
  return 'Full - connect a pipe that pulls';
}

/**
 * Status words of the fluid machines (null: the generic status applies). `world` lets a pump never ticked look around;
 * `links` (the fluid pipe ends touching it) lets the pump, the boiler and the turbine say why fluid does not move.
 */
export function fluidStatus(node: SimNode, world: IWorld | null, links: FluidLinks | null = null): string | null {
  const e = node.e as MachineEntity;
  if (!e.on) return null;
  switch (e.kind) {
    case 'pump': {
      const src = sources.has(node) ? sources.get(node) ?? null : world ? pumpSource(world, e) : null;
      if (!src) return 'Must touch still water, lava or oil';
      if (outRoom(e, src.fluid, PUMP.fluids?.capacityL ?? 0) <= 0) {
        if (e.fluidOut && e.fluidOut.fluid !== src.fluid) return `Still holds ${fluidName(e.fluidOut.fluid)}`;
        return pumpFullStatus(links);
      }
      if ((e.rateL ?? 0) > 0) return `Pumping ${fluidName(src.fluid)} - ${fmtL(e.rateL ?? 0)}/s${src.endless ? '' : ' (the pool shrinks)'}`;
      return null;
    }
    case 'boiler': {
      const furnace = hottest(node);
      if (!furnace) return 'Must sit on top of a furnace';
      if (furnace.tempC < BP.minTempC) return 'The furnace is too cold';
      if (heldL(e, 'water') <= 0) return 'Needs water - pipe it in';
      if (outRoom(e, 'steam', BOILER.fluids?.capacityL ?? 0) <= 0) {
        if (links?.piped && !links.pullsHere) return 'Holds steam - wrench the pipe end at the boiler to Pull';
        return links?.piped ? 'Steam is not being used' : 'Steam is not being used - pipe it to a turbine';
      }
      return (e.rateL ?? 0) > 0 ? `Boiling ${fmtL(e.rateL ?? 0)} of steam a second` : null;
    }
    case 'steam_turbine':
      if (heldL(e, 'steam') > 0) return null;
      if (links?.piped && !links.netPulls) return 'Steam line has no end pulling from a boiler - wrench the boiler end to Pull';
      return links?.piped ? 'No steam coming in' : 'No steam - pipe it in through a hot pipe';
    case 'still':
      if (e.recipe === OIL_RUN) return `Refining crude oil - ${Math.round((100 * e.progress) / SP.oilRunS)}%`;
      if (!e.slots[0] && heldL(e, 'crude_oil') > 0 && !oilReady(e)) {
        return heldL(e, 'crude_oil') < SP.oilPerRunL ? `Needs ${SP.oilPerRunL} L of crude oil` : 'Fuel is full - pipe it out';
      }
      return null;
    default:
      return null;
  }
}

/** Progress 0..1 of a still's oil run, or null when it is not refining. */
export const oilProgress = (e: MachineEntity): number | null => (e.recipe === OIL_RUN ? Math.min(1, e.progress / SP.oilRunS) : null);

