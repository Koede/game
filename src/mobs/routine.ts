/**
 * The daily routine of the animals (docs/plans/animals-with-routines.md): a home point they keep to, a day of grazing
 * near it, the herd drifting together, shelter from storms and the winter night, and sleep at night. Pure rules plus the
 * one world search (the nearest roofed cell); the brain (brain.ts) decides when to ask.
 */
import { SUNSET_AT, TWILIGHT } from '../core/constants';
import type { CreatureSpec, IWorld } from '../core/types';
import { solidHeight, walkable } from './terrain';
import type { Mob } from './types';

export type RoutinePhase = 'dawn' | 'day' | 'dusk' | 'night';

/** What the sky is doing, as far as animals care (storm now, winter season). */
export interface MobSky {
  storm: boolean;
  winter: boolean;
}

/** Day phase of a clock reading; the same cut-offs as the game clock (src/game/clock.ts). */
export function routinePhase(timeOfDay: number): RoutinePhase {
  if (timeOfDay < TWILIGHT) return 'dawn';
  if (timeOfDay < SUNSET_AT - TWILIGHT) return 'day';
  if (timeOfDay < SUNSET_AT) return 'dusk';
  return 'night';
}

/** An animal keeps within this many blocks of home by day (wild herds roam wider than the player's own). */
export const HOME_RANGE_WILD = 16;
export const HOME_RANGE_TAME = 9;
/** At night it settles within this distance of home. */
export const HOME_SETTLE = 3;
/** A grown animal farther than this from the nearest herd mate trots back to it. */
export const HERD_LEASH = 8;
/** Mates farther than this are another herd. */
export const HERD_RANGE = 24;
/** A sleeper wakes when the player comes this close. */
export const WAKE_DISTANCE = 3;
/** How far it looks for a roof in a storm. */
export const SHELTER_RADIUS = 12;
/** Blocks above the feet that count as a roof. */
const ROOF_HEIGHT = 6;

export const homeRange = (m: Mob): number => (m.tame ? HOME_RANGE_TAME : HOME_RANGE_WILD);

/** Does the species keep a routine? Companions follow the player; the rest live a day. */
export const hasRoutine = (spec: CreatureSpec): boolean => !spec.pet && !spec.hostile;

/** What it wants to be doing now: shelter from weather, sleep, gather towards home at dusk, or live the day. */
export type Want = 'shelter' | 'sleep' | 'gather' | 'free';

export function wantNow(phase: RoutinePhase, sky: MobSky): Want {
  if (sky.storm) return 'shelter';
  if (phase === 'night') return sky.winter ? 'shelter' : 'sleep';
  if (phase === 'dusk') return sky.winter ? 'shelter' : 'gather';
  return 'free';
}

/** A solid block within ROOF_HEIGHT above the feet cell. */
export function roofedAt(world: IWorld, x: number, y: number, z: number, clearance: number): boolean {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const by = Math.floor(y + 0.01);
  for (let c = by + clearance; c <= by + ROOF_HEIGHT; c++) if (solidHeight(world, bx, c, bz) > 0) return true;
  return false;
}

/**
 * Nearest roofed cell the animal can walk to within SHELTER_RADIUS of (cx, cz), searched in growing rings. Writes the
 * cell centre to out[0], out[1]; false when there is none. Run rarely (once per decision), never every tick.
 */
export function findShelter(world: IWorld, m: Mob, cx: number, cz: number, clearance: number, out: number[]): boolean {
  const fy = Math.floor(m.y + 0.01);
  const bx = Math.floor(cx);
  const bz = Math.floor(cz);
  for (let r = 1; r <= SHELTER_RADIUS; r++) {
    let best = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = bx + dx;
        const z = bz + dz;
        if (!world.isLoaded(x, z)) continue;
        const d = (x + 0.5 - m.x) ** 2 + (z + 0.5 - m.z) ** 2;
        if (d >= best) continue;
        // The roof test is the cheap one, so it goes first; the walk is checked only for cells that have one.
        if (!roofedAt(world, x, fy, z, clearance)) continue;
        const y = walkable(world, m.x, m.z, fy, x + 0.5, z + 0.5, clearance);
        if (Number.isNaN(y) || !roofedAt(world, x, y, z, clearance)) continue;
        best = d;
        out[0] = x + 0.5;
        out[1] = z + 0.5;
      }
    }
    if (best < Infinity) return true;
  }
  return false;
}

/** Handled by a hand: a sleeping animal rouses and stays restless a few seconds (feeding, milking, shearing). */
export function wakeUp(m: Mob): void {
  if (m.state !== 'sleep') return;
  m.state = 'idle';
  m.stateS = 6;
  m.hasTarget = false;
}
