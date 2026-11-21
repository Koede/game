/** What the player can do at a furnace (spec 3.1). Every action returns ok or a short human reason. */
import {
  AMBIENT_TEMP_C, DRAFT_PER_PUMP, FORGE_CHILL_C, FURNACE_HOT_C, PLAYER_HEIGHT,
} from '../core/constants';
import { FURNACE_TIERS, MAX_FURNACE_TIER, blockId, furnaceTier, recipe } from '../core/registry';
import { withId } from '../core/types';
import type { GameClock } from '../game/clock';
import { craftByPlayer, ingredientStatus, takeIngredients } from '../game/crafting';
import type { Inventory } from '../game/inventory';
import { OK, refuse, resizeFurnace, type ActionResult, type FurnaceEntity, type SimContext, type SimNode } from './entities';
import { IGNITION_TEMP_C, burn, burnSecondsLeft, fireboxJunk, fuelCount, lightFire, statsOf } from './furnace';
import { hearthName } from './hearthScan';
import { buildHint } from './hearthStats';
import { cableRefusal, ignitionPower } from './ignitionPower';
import { itemName } from './machines';

/** Seconds of fuel a night's rest consumes, and the least fire that must be left to allow it. */
export const REST_FUEL_S = 60;

export interface ActionHost extends SimContext {
  readonly clock: GameClock;
  /** Ingredient sources of a station: the player's inventory first, then crates within reach of it. */
  stationSources(x: number, y: number, z: number): Inventory[];
}

export type ForgeResult = { ok: true; made: number } | { ok: false; reason: string };

/** Why there is nothing to light: an empty container blocking the firebox, or no fuel at all. */
export function noFuelReason(e: FurnaceEntity): string {
  const junk = fireboxJunk(e);
  return junk && fuelCount(e) === 0 ? `Take the ${itemName(junk)} out of the firebox` : 'No fuel in the firebox';
}

const tooCold = (needC: number, e: FurnaceEntity): string => `Needs ${needC} C - the furnace is at ${Math.floor(e.tempC)} C`;

export function light(host: ActionHost, e: FurnaceEntity, node: SimNode): ActionResult {
  if (e.ignited) return refuse('The Starhearth needs no fire');
  if (e.lit) return refuse('The fire is already burning');
  if (!lightFire(e, host, node.extraFuel)) return refuse(noFuelReason(e));
  e.fuelSeen = fuelCount(e);
  return OK;
}

export function douse(host: ActionHost, e: FurnaceEntity): ActionResult {
  if (e.ignited) return refuse('A star cannot be doused');
  if (!e.lit) return refuse('The fire is not lit');
  e.lit = false;
  e.fuelSeen = fuelCount(e);
  host.bus.emit('furnace:out', { x: e.x, y: e.y, z: e.z });
  host.bus.emit('sfx', { name: 'fire_out', x: e.x, y: e.y, z: e.z });
  return OK;
}

export function pump(host: ActionHost, e: FurnaceEntity): ActionResult {
  if (e.ignited) return refuse('The Starhearth needs no bellows');
  e.draft = Math.min(1, e.draft + DRAFT_PER_PUMP);
  host.bus.emit('furnace:pumped', { x: e.x, y: e.y, z: e.z, draft: e.draft });
  host.bus.emit('sfx', { name: 'bellows', x: e.x, y: e.y, z: e.z, pitch: 0.9 + 0.3 * e.draft });
  host.flagOnce('bellows_pumped');
  return OK;
}

export function setElectric(host: ActionHost, e: FurnaceEntity, on: boolean): ActionResult {
  if (furnaceTier(e.tier).electricHeatW <= 0) {
    const first = FURNACE_TIERS.find((t) => t.electricHeatW > 0);
    return refuse(first ? `Electric heating starts with the ${first.name}` : 'This furnace has no electric heating');
  }
  if (e.electric !== on) {
    e.electric = on;
    host.bus.emit('sfx', { name: on ? 'machine_on' : 'machine_off', x: e.x, y: e.y, z: e.z });
  }
  return OK;
}

/** Forges a recipe up to `times` times; stops early when the furnace gets too cold or ingredients run out. */
export function forge(host: ActionHost, e: FurnaceEntity, recipeId: string, times = 1): ForgeResult {
  const r = recipe(recipeId);
  if (!r || r.station !== 'furnace' || r.kind !== 'forge') return { ok: false, reason: 'Not a forge recipe' };
  const locked = tierLock(e, r.minTier);
  if (locked) return { ok: false, reason: locked };
  if (!(times >= 1)) return { ok: false, reason: 'Nothing to make' };
  const crates = host.stationSources(e.x, e.y, e.z).slice(1);
  let made = 0;
  let reason = '';
  const count = Math.floor(times);
  while (made < count) {
    if (!e.ignited && e.tempC < r.minTempC) {
      reason = tooCold(r.minTempC, e);
      break;
    }
    const result = craftByPlayer(host.player, r, { crates, sfx: made === 0 ? 'forge' : null });
    if (!result.ok) {
      reason = result.reason;
      break;
    }
    if (!e.ignited) e.tempC = Math.max(AMBIENT_TEMP_C, e.tempC - FORGE_CHILL_C);
    made++;
  }
  return made > 0 ? { ok: true, made } : { ok: false, reason };
}

/**
 * Why a recipe of `minTier` cannot be made here, or null: the furnace is a lower tier ("Needs the Blast Furnace"), or
 * its hearth does not let it run that high ("Needs a formed Blast hearth").
 */
export function tierLock(e: FurnaceEntity, minTier: number): string | null {
  if (minTier > e.tier) return `Needs the ${furnaceTier(minTier).name}`;
  if (minTier > e.effTier) return `Needs a formed ${hearthName(minTier)}`;
  return null;
}

/** What keeps the next tier's hearth from counting as built, or null (spec 17.1: the upgrade needs it formed). */
export const upgradeStructure = (e: FurnaceEntity, nextTier: number): string | null =>
  (e.hearth?.tier ?? 0) >= nextTier ? null : buildHint(nextTier);

/** Rebuilds the furnace as the next tier, in place. Needs the next tier's hearth formed around it. */
export function upgrade(host: ActionHost, e: FurnaceEntity): ActionResult {
  if (e.tier >= MAX_FURNACE_TIER) return refuse('This is the last furnace there is');
  const next = furnaceTier(e.tier + 1);
  const structure = upgradeStructure(e, next.tier);
  if (structure) return refuse(structure);
  const sources = host.stationSources(e.x, e.y, e.z);
  const status = ingredientStatus(next.upgradeCost, sources);
  if (!status.ok) {
    const missing = status.ingredients.filter((i) => !i.ok).map((i) => `${i.need - i.have} ${itemName(i.item)}`);
    return refuse(`Missing ${missing.join(', ')}`);
  }
  if (e.tempC < next.upgradeTempC) return refuse(tooCold(next.upgradeTempC, e));
  takeIngredients(next.upgradeCost, sources);
  resizeFurnace(e, next.tier);
  host.world.setVoxel(e.x, e.y, e.z, withId(host.world.getVoxel(e.x, e.y, e.z), blockId(next.block)), 'sim');
  host.bus.emit('furnace:upgraded', { x: e.x, y: e.y, z: e.z, tier: next.tier });
  host.bus.emit('sfx', { name: 'upgrade', x: e.x, y: e.y, z: e.z });
  host.bus.emit('toast', { text: `Upgraded to the ${next.name}`, kind: 'good', item: next.block });
  return OK;
}

/** Whether ignition may start now. */
export function ignitionCheck(e: FurnaceEntity, node: SimNode): ActionResult {
  if (e.tier < MAX_FURNACE_TIER) return refuse(`Only the ${furnaceTier(MAX_FURNACE_TIER).name} can be ignited`);
  if (e.ignited) return refuse('Already ignited');
  if (e.effTier < MAX_FURNACE_TIER) return refuse(buildHint(MAX_FURNACE_TIER));
  if (e.ignition === 'running') return refuse('Ignition is under way');
  if (e.tempC < IGNITION_TEMP_C) return refuse(tooCold(IGNITION_TEMP_C, e));
  const net = node.net;
  if (!net || (net.generationW <= 0 && net.storedJ <= 0)) return refuse('Connect it to a power network first');
  const power = ignitionPower(e, node);
  const cable = power ? cableRefusal(power) : null;
  return cable ? refuse(cable) : OK;
}

export function startIgnition(host: ActionHost, e: FurnaceEntity, node: SimNode): ActionResult {
  const check = ignitionCheck(e, node);
  if (!check.ok) return check;
  e.ignition = 'running';
  e.ignitionProgressS = 0;
  e.ignitionLowS = 0;
  host.bus.emit('furnace:ignition', { x: e.x, y: e.y, z: e.z, state: 'started', progress: 0 });
  host.bus.emit('sfx', { name: 'ignition', x: e.x, y: e.y, z: e.z });
  return OK;
}

/** Whether the player may rest at this furnace until dawn. */
export function restCheck(host: ActionHost, e: FurnaceEntity, node: SimNode): ActionResult {
  if (!host.clock.isNight) return refuse('You can only rest at night');
  if (e.tempC < FURNACE_HOT_C) return refuse('The furnace is cold');
  const p = host.player.position;
  const d = Math.hypot(p.x - (e.x + 0.5), p.y + PLAYER_HEIGHT / 2 - (e.y + 0.5), p.z - (e.z + 0.5));
  if (d > furnaceTier(e.tier).warmth) return refuse('Come closer to the furnace');
  const heated = e.ignited || (e.electric && e.heatDemandW > 0 && e.deliveredW > 0);
  const fireLasts = e.lit && burnSecondsLeft(e, node.extraFuel) / ((1 + e.draft) * statsOf(node).fireScale) >= REST_FUEL_S;
  return heated || fireLasts ? OK : refuse('The fire would not last the night - add fuel');
}

export function rest(host: ActionHost, e: FurnaceEntity, node: SimNode): ActionResult {
  const check = restCheck(host, e, node);
  if (!check.ok) return check;
  const fire = REST_FUEL_S * statsOf(node).fireScale;
  if (e.lit && !e.ignited && burnSecondsLeft(e, node.extraFuel) >= fire) {
    burn(e, fire, node.extraFuel, host.giveBack);
    e.fuelSeen = fuelCount(e);
    host.touch(e);
  }
  host.clock.skipToDawn();
  host.bus.emit('flag', { flag: 'rested' });
  host.bus.emit('toast', { text: 'You rested by the fire until dawn', kind: 'good' });
  return OK;
}
