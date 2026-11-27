/**
 * Fishing rules (docs/api/fishing.md), pure: which kind of water a spot is, what bites there at this hour in this
 * weather, how long the wait is. Randomness is injected (`rng` returns [0,1)) so tests and replays are exact.
 * The Use handler on a water block with a rod in hand and the bobber are a thin layer over this.
 */
import { FISH, JUNK, type FishSeason, type FishSpec, type WaterKind } from '../content/fishing';

export interface WaterSpot {
  biome: 'woodland' | 'dunes' | 'frostfell' | 'scar' | 'marsh';
  /** Blocks of water below the bobber (the column's water depth). */
  depth: number;
  /** Horizontal water blocks in the connected pool within the scan limit (a 24+ count reads as a lake). */
  area: number;
  /** True when the water flows (river / stream blocks). */
  flowing: boolean;
  /** True when the sky is not visible above the water (a cave lake). */
  underground: boolean;
  /** Water surface is ice (frostfell winter pool): fish through it. */
  frozen?: boolean;
}

export interface CastContext {
  /** 0..1 fraction of the day since dawn; night when >= 0.55 (see DAY in core/constants for the real clock). */
  night: boolean;
  raining: boolean;
  /** The season of the year; absent (older callers) means no seasonal effect. */
  season?: FishSeason;
}

/** Pool size (horizontal blocks) at which still water counts as a lake. */
export const LAKE_AREA = 24;
export const MIN_DEPTH = 1;

/** The kind of water a spot is; null when it is too shallow to fish. */
export function waterKind(w: WaterSpot): WaterKind | null {
  if (w.depth < MIN_DEPTH) return null;
  if (w.underground) return 'cave';
  if (w.frozen || w.biome === 'frostfell') return 'frozen';
  if (w.flowing) return 'river';
  if (w.biome === 'marsh') return 'marsh';
  return w.area >= LAKE_AREA && w.depth >= 3 ? 'lake' : 'pond';
}

export interface Catch { kind: 'fish' | 'junk' | 'nothing'; item: string | null; spec?: FishSpec }

const weightOf = (f: FishSpec, kind: WaterKind, ctx: CastContext): number => {
  const base = f.weights[kind] ?? 0;
  if (base === 0) return 0;
  const seasonal = ctx.season ? f.seasons?.[ctx.season] ?? 1 : 1;
  return base * (ctx.night && f.night ? f.night : 1) * (ctx.raining && f.rain ? f.rain : 1) * seasonal;
};

/** Chance a cast ends in nothing at all (the fish got away). Rain and the dim hours of night bring them on. */
export function missChance(ctx: CastContext): number {
  return 0.25 - (ctx.raining ? 0.08 : 0) - (ctx.night ? 0.04 : 0);
}

/** Chance the haul is junk rather than a fish. Cave and frozen water are clean. */
export function junkChance(kind: WaterKind): number {
  return kind === 'cave' || kind === 'frozen' ? 0.05 : kind === 'marsh' ? 0.22 : 0.12;
}

/** What one successful bite brings up. */
export function rollCatch(kind: WaterKind, ctx: CastContext, rng: () => number): Catch {
  if (rng() < missChance(ctx)) return { kind: 'nothing', item: null };
  if (rng() < junkChance(kind)) {
    const total = JUNK.reduce((n, j) => n + j.weight, 0);
    let r = rng() * total;
    for (const j of JUNK) if ((r -= j.weight) < 0) return { kind: 'junk', item: j.item };
    return { kind: 'junk', item: JUNK[0].item };
  }
  const weights = FISH.map((f) => weightOf(f, kind, ctx));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return { kind: 'nothing', item: null };
  let r = rng() * total;
  for (let i = 0; i < FISH.length; i++) if ((r -= weights[i]) < 0) return { kind: 'fish', item: FISH[i].item, spec: FISH[i] };
  return { kind: 'nothing', item: null };
}

/** Seconds from casting to the bite: 4-12, shorter in rain and at night. */
export function biteDelayS(ctx: CastContext, rng: () => number): number {
  const base = 4 + rng() * 8;
  return base * (ctx.raining ? 0.75 : 1) * (ctx.night ? 0.85 : 1);
}

/** Fish that can be caught in `kind` water in `season` (every fish of that water when the season is omitted). */
export const fishInSeason = (kind: WaterKind, season?: FishSeason): string[] =>
  FISH.filter((f) => weightOf(f, kind, { night: false, raining: false, season }) > 0).map((f) => f.item);

/** Fish a water kind can hold (for the codex and tests). */
export const fishIn = (kind: WaterKind): string[] => FISH.filter((f) => (f.weights[kind] ?? 0) > 0).map((f) => f.item);
