/**
 * The town plan (docs/plans/orrin-builds-a-town.md, section 1): where the village goes and which building stands on which plot.
 * Pure: the site and layout are chosen from the seed and a generic origin (a camp or the tavern), with the ground read through a
 * surface function. Plots are slots on a lattice around the site's plaza, nearest first, so the village grows outward ring by ring.
 */
import { hash32, mulberry32 } from '../core/math';
import { blockOrNull } from '../core/registry';
import { footprintOf, townTemplate } from './townTemplates';

/** The top solid block of a column: its height and its key. */
export interface Surface {
  y: number;
  key: string;
}
/** Ground under a column: null when it is not loaded (unknown), otherwise the surface (which may be unbuildable). */
export type SurfaceFn = (x: number, z: number) => Surface | null;

/** Site search: a candidate centre this far (blocks) from the origin, and how many candidates to try. */
export const SITE_MIN = 24;
export const SITE_MAX = 64;
export const SITE_CANDIDATES = 48;
/** Plots sit on a lattice this far apart (blocks); a footprint is at most this wide. */
export const SLOT_PITCH = 12;
export const SLOT_RING = 3;
/** Largest height difference (blocks) under a footprint for the plot to count. */
export const RELIEF_MAX = 3;
/** Fewest usable plots a site needs (the plaza is one of them). */
export const MIN_PLOTS = 4;

/** The first buildings in order: the storage bay nearest the plaza, the plaza itself, then houses and lamps. */
export const TOWN_ORDER: readonly string[] = [
  'storage_bay', 'well_plaza', 'cottage', 'lamp_post', 'workshop', 'cottage', 'lamp_post', 'cottage', 'workshop', 'cottage', 'lamp_post', 'cottage',
];

export interface PlannedBuilding {
  template: string;
  /** The footprint's lowest-x, lowest-z column (world coordinates). */
  x: number;
  z: number;
  /** Quarter turns clockwise, 0..3. */
  rot: number;
}

export interface TownPlan {
  site: [number, number];
  buildings: PlannedBuilding[];
}

/** Ground that Gruk can build on: not water, lava or ice, and not a tree (leaves, logs) or ore. */
export function buildableKey(key: string): boolean {
  if (key === 'water' || key === 'lava' || key === 'ice' || key === 'air') return false;
  if (key.endsWith('_leaves') || key.endsWith('_log') || key.endsWith('_ore')) return false;
  return blockOrNull(key) !== null;
}

/**
 * The ground heights under a w x d footprint at (x0, z0), or null when any column is unknown, unbuildable or too uneven.
 * Index of a column: i * d + j, for x offset i and z offset j.
 */
export function footingHeights(surface: SurfaceFn, x0: number, z0: number, w: number, d: number): number[] | null {
  const out: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      const s = surface(x0 + i, z0 + j);
      if (!s || !buildableKey(s.key)) return null;
      out.push(s.y);
      lo = Math.min(lo, s.y);
      hi = Math.max(hi, s.y);
    }
  }
  return hi - lo <= RELIEF_MAX ? out : null;
}

/** The lattice slot centres in order of distance from the site (the plaza slot 0,0 excluded). */
function slotOrder(): [number, number][] {
  const slots: [number, number][] = [];
  for (let i = -SLOT_RING; i <= SLOT_RING; i++) for (let j = -SLOT_RING; j <= SLOT_RING; j++) if (i || j) slots.push([i, j]);
  return slots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[0] - b[0] || a[1] - b[1]);
}

/** The footprint corner that centres a w x d footprint on (cx, cz). */
const corner = (cx: number, cz: number, w: number, d: number): [number, number] => [cx - Math.floor(w / 2), cz - Math.floor(d / 2)];

/**
 * Plans the town around a site chosen from `seed` at a distance of SITE_MIN..SITE_MAX from `origin`. Returns null when no site
 * suits (the caller tries again later). Deterministic for the same seed, origin and ground.
 */
export function planTown(seed: number, origin: readonly [number, number], surface: SurfaceFn, order: readonly string[] = TOWN_ORDER): TownPlan | null {
  const rnd = mulberry32(hash32(seed, origin[0], origin[1]));
  const plaza = townTemplate('well_plaza');
  if (!plaza) return null;
  for (let c = 0; c < SITE_CANDIDATES; c++) {
    const angle = rnd() * Math.PI * 2;
    const dist = SITE_MIN + rnd() * (SITE_MAX - SITE_MIN);
    const sx = Math.round(origin[0] + Math.cos(angle) * dist);
    const sz = Math.round(origin[1] + Math.sin(angle) * dist);
    const pb = corner(sx, sz, plaza.w, plaza.d);
    if (!footingHeights(surface, pb[0], pb[1], plaza.w, plaza.d)) continue;
    const plots: [number, number][] = [];
    for (const [i, j] of slotOrder()) {
      const cx = sx + i * SLOT_PITCH;
      const cz = sz + j * SLOT_PITCH;
      // A plot is usable when the ground under a 9 x 9 square (the largest footprint in the library) is buildable and even enough.
      const [x0, z0] = corner(cx, cz, 9, 9);
      if (footingHeights(surface, x0, z0, 9, 9)) plots.push([cx, cz]);
    }
    if (plots.length + 1 < MIN_PLOTS) continue;
    const buildings: PlannedBuilding[] = [];
    let next = 0;
    for (const key of order) {
      const t = townTemplate(key);
      if (!t) continue;
      if (key === 'well_plaza') {
        const [x, z] = corner(sx, sz, t.w, t.d);
        buildings.push({ template: key, x, z, rot: 0 });
        continue;
      }
      if (next >= plots.length) break;
      const [cx, cz] = plots[next++];
      const rot = hash32(seed, cx, cz) & 3;
      const f = footprintOf(t, rot);
      const [x, z] = corner(cx, cz, f.w, f.d);
      buildings.push({ template: key, x, z, rot });
    }
    return { site: [sx, sz], buildings };
  }
  return null;
}
