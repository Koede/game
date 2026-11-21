/**
 * Pure lookups over the Emberbound data (spec 19) shared by the modules that build on it: where an automaton may
 * spawn (src/mobs), what difficulty does to the numbers (src/mobs, src/game), and what the player's worn gear is
 * worth (src/game). Nothing here keeps state.
 */
import type { Difficulty } from './context';
import { ARMOUR_CAUSES, HOSTILE_CAP, HOSTILE_DAMAGE_MULT, HOSTILE_DEEP_Y, HOSTILE_MOONLESS_MAX_ILLUMINATION, HOSTILE_PEAK_Y } from './constants';
import type { DamageCause } from './gameEvents';
import { AUTOMATONS, itemOrNull } from './registry';
import type { BiomeKey, CreatureSpec, HostileHabitat, SpawnPlace } from './types';
import { moonIllumination } from './weather';

/** What the spawner knows about a candidate spot (already solid-floored, dark and out of view). */
export interface SpotFacts {
  /** No opaque block anywhere above the spot. */
  skyOpen: boolean;
  /** Feet height. */
  y: number;
  /** Clock sunlight below HOSTILE_NIGHT_SUNLIGHT. */
  night: boolean;
  biome: BiomeKey;
}

/** Every SpawnPlace a spot matches (see SpawnPlace in types.ts for the tests). */
export function spawnPlacesAt(f: SpotFacts): SpawnPlace[] {
  const out: SpawnPlace[] = [];
  if (!f.skyOpen) out.push(f.y < HOSTILE_DEEP_Y ? 'deep' : 'cave');
  if (f.skyOpen && f.night) out.push('surface');
  if (f.biome === 'scar') {
    out.push('scar');
    if (f.night) out.push('scar_night');
  }
  if (f.skyOpen && f.night && f.y >= HOSTILE_PEAK_Y) out.push('peak');
  return out;
}

/** A type's spawn weight at a spot: the largest of its weights for the places the spot matches (0 = never there). */
export function placeWeight(spec: CreatureSpec, places: readonly SpawnPlace[]): number {
  const weights = spec.hostile?.habitat.places ?? {};
  let best = 0;
  for (const p of places) best = Math.max(best, weights[p] ?? 0);
  return best;
}

/** A night with at most HOSTILE_MOONLESS_MAX_ILLUMINATION of the moon lit (new moon and the nights either side). */
export const isMoonless = (moonPhase: number): boolean => moonIllumination(moonPhase) <= HOSTILE_MOONLESS_MAX_ILLUMINATION;

/** The sky right now, as far as a habitat's `sky` condition cares. */
export interface SkyFacts {
  storm: boolean;
  moonPhase: number;
}

/** Whether the sky lets a habitat spawn now (true for every habitat without a `sky` condition). */
export const skyAllows = (h: HostileHabitat, sky: SkyFacts): boolean =>
  h.sky === undefined || sky.storm || isMoonless(sky.moonPhase);

/**
 * Weighted pick of an automaton type for a spot, among those whose places, sky and per-type `maxLoaded` allow it.
 * `loadedOf(key)` counts that type among the loaded hostiles. `random` returns [0, 1). Null when nothing fits.
 */
export function pickAutomaton(
  places: readonly SpawnPlace[], sky: SkyFacts, loadedOf: (key: string) => number, random: () => number,
): CreatureSpec | null {
  let total = 0;
  const weights = AUTOMATONS.map((spec) => {
    const h = spec.hostile;
    const ok = h !== undefined && skyAllows(h.habitat, sky) && loadedOf(spec.key) < (h.habitat.maxLoaded ?? Infinity);
    const w = ok ? placeWeight(spec, places) : 0;
    total += w;
    return w;
  });
  if (total <= 0) return null;
  let pick = random() * total;
  let last: CreatureSpec | null = null;
  for (let i = 0; i < AUTOMATONS.length; i++) {
    if (weights[i] <= 0) continue;
    last = AUTOMATONS[i];
    pick -= weights[i];
    if (pick < 0) return last;
  }
  return last;
}

/** Hostiles allowed loaded at once on this difficulty. */
export const hostileCap = (d: Difficulty): number => HOSTILE_CAP[d];

/** Damage one landed attack of this automaton deals on this difficulty (before armour). 0 for a non-automaton. */
export const hostileDamage = (spec: CreatureSpec, d: Difficulty): number => (spec.hostile?.damage ?? 0) * HOSTILE_DAMAGE_MULT[d];

/** What the gear carried in an inventory is worth: the best of each number among its armour items. */
export interface WornArmour {
  /** Fraction taken off hits of ARMOUR_CAUSES (0 = none). */
  reduction: number;
  /** Multiplier on the cold's warmth drain (1 = no coat). */
  warmthDrainMult: number;
}

/** The best armour among the stacks of an inventory (any iterable of slots; unknown items and empty slots are skipped). */
export function bestArmour(slots: Iterable<{ item: string } | null>): WornArmour {
  const worn: WornArmour = { reduction: 0, warmthDrainMult: 1 };
  for (const s of slots) {
    const a = s ? itemOrNull(s.item)?.armour : undefined;
    if (!a) continue;
    worn.reduction = Math.max(worn.reduction, a.reduction);
    worn.warmthDrainMult = Math.min(worn.warmthDrainMult, a.warmthDrainMult ?? 1);
  }
  return worn;
}

/** Damage left after armour: reduced only for causes in ARMOUR_CAUSES. */
export const armouredDamage = (amount: number, cause: DamageCause, worn: WornArmour): number =>
  ARMOUR_CAUSES.includes(cause) ? amount * (1 - worn.reduction) : amount;
