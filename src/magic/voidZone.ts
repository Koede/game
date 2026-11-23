/**
 * Void zones (docs/api/magic.md): rare patches of thin world far from the centre where an empty vial bottles the late aspects
 * `void` and `soul`. A zone is the 3 x 3 chunks round a hashed centre chunk in some 8 x 8 chunk cells; none within
 * MIN_CHUNKS of the origin. Optional: nothing in the tech or research spine needs it. Pure.
 */
import type { Aspect } from './aspects';

export const CELL_CHUNKS = 8;
export const MIN_CHUNKS = 6;
/** Chance a cell holds a zone. */
export const ZONE_CHANCE = 0.35;

function hash(seed: number, a: number, b: number, salt: number): number {
  let h = (seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export interface VoidZone { cx: number; cz: number; aspect: Extract<Aspect, 'void' | 'soul'> }

/** The zone whose centre chunk lies in cell gx, gz, or null. */
export function zoneOfCell(seed: number, gx: number, gz: number): VoidZone | null {
  if (hash(seed, gx, gz, 21) >= ZONE_CHANCE) return null;
  const cx = gx * CELL_CHUNKS + 1 + Math.floor(hash(seed, gx, gz, 22) * (CELL_CHUNKS - 2));
  const cz = gz * CELL_CHUNKS + 1 + Math.floor(hash(seed, gx, gz, 23) * (CELL_CHUNKS - 2));
  if (Math.max(Math.abs(cx), Math.abs(cz)) < MIN_CHUNKS) return null;
  return { cx, cz, aspect: hash(seed, gx, gz, 24) < 0.5 ? 'void' : 'soul' };
}

/** The zone covering chunk cx, cz (Chebyshev radius 1 of its centre), or null. */
export function zoneAt(seed: number, cx: number, cz: number): VoidZone | null {
  const gx = Math.floor(cx / CELL_CHUNKS);
  const gz = Math.floor(cz / CELL_CHUNKS);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const z = zoneOfCell(seed, gx + dx, gz + dz);
      if (z && Math.max(Math.abs(z.cx - cx), Math.abs(z.cz - cz)) <= 1) return z;
    }
  return null;
}

/** The nearest zone centre within `radius` chunks of chunk cx, cz, with its distance in chunks. */
export function nearestZone(seed: number, cx: number, cz: number, radius: number): { zone: VoidZone; chunks: number } | null {
  const gx = Math.floor(cx / CELL_CHUNKS);
  const gz = Math.floor(cz / CELL_CHUNKS);
  const reach = Math.ceil(radius / CELL_CHUNKS) + 1;
  let best: { zone: VoidZone; chunks: number } | null = null;
  for (let dz = -reach; dz <= reach; dz++)
    for (let dx = -reach; dx <= reach; dx++) {
      const z = zoneOfCell(seed, gx + dx, gz + dz);
      if (!z) continue;
      const d = Math.hypot(z.cx - cx, z.cz - cz);
      if (d <= radius && (!best || d < best.chunks)) best = { zone: z, chunks: d };
    }
  return best;
}
