/**
 * Aura per chunk (docs/api/magic.md): the land's mood. A smooth hashed field over the chunk grid, calm near the world's
 * centre, plus a per-chunk `shift` the runtime keeps (taint pushes it down, cleansing up). Rich air makes a crucible give
 * more essentia and feeds a carried rod; tainted air gives less, and wears at the mind (warp). Pure.
 */
import { PRIMALS } from './aspects';
import type { Primal } from './vis';

export type AuraKind = 'rich' | 'plain' | 'tainted';
export const AURA_RICH = 0.4;
export const AURA_TAINTED = -0.45;
/** Chunks around the centre that are always calm. */
export const CALM_RADIUS = 3;
/** Crucible yield factors. */
export const RICH_YIELD = 1.25;
export const TAINTED_YIELD = 0.75;
/** Seconds between a rich chunk's trickle of vis, and between a tainted chunk's touch of warp. */
export const RICH_VIS_S = 12;
export const TAINT_WARP_S = 60;

function hash(seed: number, a: number, b: number, salt: number): number {
  let h = (seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);
const CELL = 4;

/** The land's own aura of chunk cx, cz: -1 (tainted) .. 1 (rich). */
export function baseAura(seed: number, cx: number, cz: number): number {
  const gx = Math.floor(cx / CELL);
  const gz = Math.floor(cz / CELL);
  const fx = smooth(cx / CELL - gx);
  const fz = smooth(cz / CELL - gz);
  const v = (a: number, b: number): number => hash(seed, a, b, 11) * 2 - 1;
  const top = v(gx, gz) * (1 - fx) + v(gx + 1, gz) * fx;
  const bottom = v(gx, gz + 1) * (1 - fx) + v(gx + 1, gz + 1) * fx;
  const field = (top * (1 - fz) + bottom * fz) * 1.5;
  const d = Math.hypot(cx, cz);
  const calm = d <= CALM_RADIUS ? 0 : smooth(Math.min(1, (d - CALM_RADIUS) / 3));
  return Math.max(-1, Math.min(1, field * calm));
}

export const auraKind = (level: number): AuraKind => (level >= AURA_RICH ? 'rich' : level <= AURA_TAINTED ? 'tainted' : 'plain');
export const auraYield = (kind: AuraKind): number => (kind === 'rich' ? RICH_YIELD : kind === 'tainted' ? TAINTED_YIELD : 1);

/** The primal a rich chunk favours (it trickles into a rod). */
export const auraPrimal = (seed: number, cx: number, cz: number): Primal => PRIMALS[Math.floor(hash(seed, cx, cz, 12) * PRIMALS.length) % PRIMALS.length] as Primal;

/** An essentia fingerprint scaled for the aura: rich rounds up, tainted rounds down but keeps at least 1 of anything it had. */
export function scaleByAura<T extends Record<string, number | undefined>>(fp: T, kind: AuraKind): T {
  if (kind === 'plain') return fp;
  const out: Record<string, number> = {};
  for (const [a, n] of Object.entries(fp)) {
    if (!n || n <= 0) continue;
    out[a] = kind === 'rich' ? Math.ceil(n * RICH_YIELD) : Math.max(1, Math.floor(n * TAINTED_YIELD));
  }
  return out as T;
}

export const auraText = (kind: AuraKind): string => (kind === 'rich' ? 'rich aura' : kind === 'tainted' ? 'tainted aura' : 'calm aura');
