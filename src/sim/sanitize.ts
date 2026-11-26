/**
 * Repairs block entities a save brings in before the simulation adopts them: a save from an older build, or one edited
 * by hand, can hold a field of the wrong type (a firebox that is not a list), an item that no longer exists or a kind
 * the game does not know - and one bad field must not stop the simulation for good. Every field the simulation uses is
 * coerced to its type (slot lists to valid stacks, numbers to finite numbers, the tier into range), in place; what
 * cannot be repaired is reported so the caller drops it.
 */
import { sanitizeEnchants } from '../core/enchant';
import { MACHINES, MAX_FURNACE_TIER, canonicalItemKey, fluidOrNull, fuelOf, itemOrNull, recipe } from '../core/registry';
import { PIPE_FILTER_SLOTS, PIPE_PRIORITY_MAX, PIPE_PRIORITY_MIN } from '../core/constants';
import type { BlockEntity, Slot } from '../core/types';
import { createFurnace, createMachine } from './entities';
import type { PipeEntity, PortConfig, SavedPacket } from './pipeState';

export type Repair = 'ok' | 'repaired' | 'dropped';

type Fields = Record<string, unknown>;

const isObject = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A valid stack, or null (unknown items, counts that are not whole positive numbers). */
function cleanSlot(v: unknown): Slot {
  if (!isObject(v) || typeof v.item !== 'string' || !finite(v.count) || v.count < 1) return null;
  const key = canonicalItemKey(v.item);
  if (key === null) return null;
  const s: Exclude<Slot, null> = { item: key, count: Math.floor(v.count) };
  if (finite(v.durability)) s.durability = v.durability;
  if (v.quality === 1 || v.quality === 2) s.quality = v.quality;
  const enchants = sanitizeEnchants(v.enchants);
  if (enchants) s.enchants = enchants;
  return s;
}

/** Whether a slot array already holds only valid stacks (null or clean ones). */
const slotsClean = (list: unknown[]): boolean => list.every((s) => s === null || JSON.stringify(cleanSlot(s)) === JSON.stringify(s));

function cleanFluid(v: unknown): { fluid: string; litres: number } | null {
  if (!isObject(v) || typeof v.fluid !== 'string' || !fluidOrNull(v.fluid) || !finite(v.litres) || v.litres < 0) return null;
  return v as { fluid: string; litres: number };
}

const IGNITION = new Set(['idle', 'running', 'failed', 'done']);

/**
 * Repairs a furnace or machine entity in place. 'dropped': its kind is unknown (or it is not a machine at all) and the
 * caller should remove it; 'repaired': something was reset. `blockTier`: the tier of the furnace block standing there,
 * for a furnace whose own tier is unusable.
 */
export function sanitizeEntity(e: BlockEntity, blockTier: number | null = null): Repair {
  const f = e as unknown as Fields;
  if (typeof e.kind !== 'string' || !MACHINES.has(e.kind)) return 'dropped';
  let fixed = false;
  const set = (key: string, value: unknown): void => {
    f[key] = value;
    fixed = true;
  };
  const furnace = e.kind === 'furnace';
  if (furnace) {
    const valid = finite(f.tier) && Number.isInteger(f.tier) && f.tier >= 1 && f.tier <= MAX_FURNACE_TIER;
    const tier = valid ? (f.tier as number) : blockTier ?? 1;
    if (tier !== f.tier) set('tier', tier);
  }
  const template = (furnace ? createFurnace(e.x, e.y, e.z, f.tier as number) : createMachine(e.kind, e.x, e.y, e.z)) as unknown as Fields;
  for (const [key, want] of Object.entries(template)) {
    if (key === 'kind' || key === 'x' || key === 'y' || key === 'z' || key === 'tier') continue;
    const has = f[key];
    // A field an older build did not have yet is filled in quietly: that is no damage.
    if (has === undefined) {
      f[key] = want;
      continue;
    }
    if (Array.isArray(want)) {
      if (!Array.isArray(has)) set(key, want);
      continue;
    }
    if (typeof want === 'number' && !finite(has)) set(key, want);
    else if (typeof want === 'boolean' && typeof has !== 'boolean') set(key, want);
    else if (typeof want === 'string' && typeof has !== 'string') set(key, want);
  }
  // Slot lists: every stack valid, at least as long as the spec asks (machine slots exactly as long).
  const slotLists = furnace ? ['fuel', 'crucibleIn', 'crucibleOut'] : ['slots'];
  for (const key of slotLists) {
    const list = f[key] as unknown[];
    const size = (template[key] as unknown[]).length;
    if (!slotsClean(list)) set(key, list.map(cleanSlot));
    const cur = f[key] as Slot[];
    while (cur.length < size) {
      cur.push(null);
      fixed = true;
    }
    if (!furnace && cur.length > size) {
      cur.length = size;
      fixed = true;
    }
  }
  if (furnace) {
    // Crucible progress and recipes: numbers and known recipes (the arrays keep their lengths; they grow on use).
    const progress = (f.crucibleProgress as unknown[]).map((p) => (finite(p) && p >= 0 ? p : 0));
    const recipes = (f.crucibleRecipe as unknown[]).map((r) => (typeof r === 'string' && recipe(r) ? r : null));
    if (JSON.stringify(progress) !== JSON.stringify(f.crucibleProgress)) set('crucibleProgress', progress);
    if (JSON.stringify(recipes) !== JSON.stringify(f.crucibleRecipe)) set('crucibleRecipe', recipes);
    repairCasting(f, set);
    if (f.burnItem !== null && !(typeof f.burnItem === 'string' && fuelOf(f.burnItem))) set('burnItem', null);
    if (!IGNITION.has(f.ignition as string)) set('ignition', 'idle');
    const effTier = f.effTier as number;
    if (effTier < 1 || effTier > (f.tier as number) || !Number.isInteger(effTier)) set('effTier', 1);
    if (f.hearth !== null && !validSummary(f.hearth)) set('hearth', null);
  } else {
    if (f.recipe !== null && !(typeof f.recipe === 'string' && recipe(f.recipe))) set('recipe', null);
    for (const key of ['fluidIn', 'fluidOut']) if (f[key] !== null && !cleanFluid(f[key])) set(key, null);
    for (const key of ['drawnL', 'rateL']) if (key in f && !finite(f[key])) set(key, 0);
  }
  return fixed ? 'repaired' : 'ok';
}

/** Casting state (molten metal, its countdown, an alloy pot's mix) as long as the crucibles, every value valid. */
function repairCasting(f: Fields, set: (key: string, value: unknown) => void): void {
  // As many as the crucibles (the arrays grow together; crucibleOut is the one nothing but the hearth ever extends).
  const n = (f.crucibleOut as unknown[]).length;
  const melt = (f.crucibleMelt as unknown[]).slice(0, n).map(cleanSlot);
  const moltenS = (f.crucibleMoltenS as unknown[]).slice(0, n).map((v) => (finite(v) && v > 0 ? v : 0));
  const mix = (f.crucibleMix as unknown[]).slice(0, n).map((v): [number, number] =>
    Array.isArray(v) && finite(v[0]) && finite(v[1]) && v[0] >= 0 && v[1] >= 0 ? [Math.floor(v[0]), Math.floor(v[1])] : [0, 0]);
  while (melt.length < n) melt.push(null);
  while (moltenS.length < n) moltenS.push(0);
  while (mix.length < n) mix.push([0, 0]);
  for (let i = 0; i < n; i++) if (!melt[i]) moltenS[i] = 0;
  if (JSON.stringify(melt) !== JSON.stringify(f.crucibleMelt)) set('crucibleMelt', melt);
  if (JSON.stringify(moltenS) !== JSON.stringify(f.crucibleMoltenS)) set('crucibleMoltenS', moltenS);
  if (JSON.stringify(mix) !== JSON.stringify(f.crucibleMix)) set('crucibleMix', mix);
}

const triple = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(finite);

function validSummary(h: unknown): boolean {
  return isObject(h) && finite(h.tier) && triple(h.inner) && triple(h.min) && triple(h.max) && typeof h.closed === 'boolean' && finite(h.windows);
}

function validPort(p: unknown): p is PortConfig {
  if (!isObject(p)) return false;
  const { mode, distribution, filterMode, priority, filter } = p;
  return (mode === 'push' || mode === 'pull' || mode === 'off')
    && (distribution === 'nearest' || distribution === 'round')
    && (filterMode === 'allow' || filterMode === 'deny')
    && Number.isInteger(priority) && (priority as number) >= PIPE_PRIORITY_MIN && (priority as number) <= PIPE_PRIORITY_MAX
    && Array.isArray(filter) && filter.length <= PIPE_FILTER_SLOTS
    && filter.every((k) => typeof k === 'string' && (itemOrNull(k) !== null || fluidOrNull(k) !== null));
}

const quad = (v: unknown): boolean => Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n));

function validPacket(p: unknown): p is SavedPacket {
  return isObject(p) && typeof p.item === 'string' && itemOrNull(p.item) !== null && finite(p.count) && p.count >= 1
    && quad(p.from) && quad(p.to);
}

/** Repairs a pipe entity in place: bad port settings fall back to the default, bad packets and stores are dropped. */
export function sanitizePipe(e: PipeEntity): Repair {
  const f = e as unknown as Fields;
  let fixed = false;
  if (f.ports !== undefined) {
    const ports = Array.isArray(f.ports) ? f.ports.slice(0, 6).map((p) => (validPort(p) ? p : null)) : [];
    if (JSON.stringify(ports) !== JSON.stringify(f.ports)) {
      e.ports = ports;
      fixed = true;
    }
  }
  if (f.cut !== undefined && !(Number.isInteger(f.cut) && (f.cut as number) >= 0 && (f.cut as number) < 64)) {
    delete e.cut;
    fixed = true;
  }
  if (f.store !== undefined) {
    const s = f.store;
    const ok = isObject(s) && (s.fluid === null || (typeof s.fluid === 'string' && fluidOrNull(s.fluid) !== null)) && finite(s.litres) && s.litres >= 0;
    if (!ok) {
      delete e.store;
      fixed = true;
    }
  }
  if (f.packets !== undefined) {
    const packets = Array.isArray(f.packets) ? f.packets.filter(validPacket) : [];
    if (!Array.isArray(f.packets) || packets.length !== f.packets.length) {
      e.packets = packets;
      fixed = true;
    }
  }
  return fixed ? 'repaired' : 'ok';
}

/** The toast after a load repaired or dropped entities, or null when every one was sound. */
export const repairToast = (count: number): string | null =>
  count <= 0 ? null : count === 1 ? '1 damaged machine was reset' : `${count} damaged machines were reset`;
