/**
 * The liquids of brewing as boxes (BREWING_PLAN 6, docs/api/glass.md "Liquids"): which bodies of liquid a cup, a bucket,
 * the kettle or a piece of furnace-top glass shows, from its entity. Pure: no three, no world; `brewLiquid.ts` lights the
 * colours and hands the bodies to LiquidBoxes. Positions are in the cell (0..1), `y` the bottom of the body.
 *   - a cup fills from its floor while the drink drips through the cone in a thin falling stream, clear water turning
 *     into the drink as it comes through; a finished cup holds the drink at its brim;
 *   - a bucket, beaker or vial of water stills, simmers as it heats and rolls at the boil, and sinks as it boils away;
 *   - sap in a beaker darkens to resin as it cooks, a slow thick bubbling;
 *   - the kettle's water shows through the gap its lid is pushed aside to while it boils.
 */
import { BOIL_DRY_SECONDS, BOIL_SECONDS, BREW_SECONDS } from '../core/constants';
import { BOIL_BUCKET_MACHINE, BREW_CUP_MACHINE, KETTLE_MACHINE } from '../core/brewing';
import type { BlockEntity } from '../core/types';
import { CUP_FLOOR_Y, CUP_INNER_MAX, CUP_INNER_MIN, CUP_RIM_Y, CUP_SPOUT_Y, KETTLE_HOLE_MAX, KETTLE_HOLE_MIN, KETTLE_SHOULDER_TOP } from '../world/meshCup';

export interface Body {
  /** Centre of the body in the cell, x and z; `y` is its bottom. */
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Unlit colour 0xRRGGBB. */
  colour: number;
  flowY: number;
  speed: number;
  boil: number;
  surface: boolean;
}

/** What the cone drips at first: plain hot water. */
export const BREW_WATER = 0x9eb2bc;
/** Water in a bucket or kettle (deep, so darker) and in clear glass. */
export const POT_WATER = 0x4f86a6;
export const GLASS_WATER = 0x5f9fc6;
export const SAP = 0xd8962a;
export const RESIN = 0x7a3a0e;
/** A drink whose item has no colour. */
export const DEFAULT_DRINK = 0x6b4423;
/** A boiling body's boil, and the most a heating one simmers at before it boils. */
export const BOIL = 0.8;
export const SIMMER = 0.4;
/** Liquid stands this far off the glass so its faces never fight the glass's own. */
const GAP = 0.6 / 256;

const s16 = (v: number): number => v / 16;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Mixes two 0xRRGGBB colours, `k` 0 all `a`, 1 all `b`. */
export function mixHex(a: number, b: number, k: number): number {
  const t = clamp01(k);
  const ch = (s: number): number => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** What the renderer needs to know about one brewing entity beyond the entity itself. */
export interface BrewLook {
  /** Colour of the drink item the cup names (null when it has none). */
  drinkColour: number | null;
  /** The container's `boilScale` (1 when none). */
  boilScale: number;
  /** The container's contents ('water' or 'sap'). */
  holds: 'water' | 'sap';
  /** The voxel's active bit (the kettle boils). */
  active: boolean;
}

/** The vessel a boil_bucket entity stands in, by its container's item key. */
export type Vessel = 'bucket' | 'beaker' | 'vial';
export const vesselOf = (container: string): Vessel => (container === 'water_vial' ? 'vial' : container === 'water_beaker' || container === 'pine_sap' ? 'beaker' : 'bucket');

/** Interior of each vessel in 16ths: x/z min and max, floor, the level when full. */
const VESSEL: Readonly<Record<Vessel, { lo: number; hi: number; floor: number; full: number }>> = {
  // The bucket's water fills the opening inside its rim (meshCup.ts); its body below has no top, so the water box is its lid.
  bucket: { lo: 4, hi: 12, floor: 6, full: 7.5 },
  // glassModels.ts: beaker walls 3..13 (interior 4..12) from a 1/16 base to 10/16; vial interior 7..9 up to 14/16.
  beaker: { lo: 4, hi: 12, floor: 1, full: 6.5 },
  vial: { lo: 7, hi: 9, floor: 1, full: 10 },
};

function set(out: Body, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, colour: number, boil: number, surface: boolean, speed = 0): Body {
  out.x = (x0 + x1) / 2;
  out.z = (z0 + z1) / 2;
  out.sx = x1 - x0;
  out.sz = z1 - z0;
  out.y = y0;
  out.sy = y1 - y0;
  out.colour = colour;
  out.boil = boil;
  out.surface = surface;
  out.speed = speed;
  out.flowY = speed > 0 ? -1 : 0;
  return out;
}

/**
 * Calls `emit` with each body of liquid `e` shows (the same `out` object refilled, so nothing is allocated); returns how
 * many. Entities that are not brewing ones show none.
 */
export function brewBodies(e: BlockEntity, look: BrewLook, out: Body, emit: (b: Body) => void): number {
  if (e.kind === BREW_CUP_MACHINE) return cupBodies(e, look, out, emit);
  if (e.kind === BOIL_BUCKET_MACHINE) return vesselBodies(e, look, out, emit);
  if (e.kind === KETTLE_MACHINE) {
    if (!look.active || num(e.waterL) <= 0) return 0;
    const lo = KETTLE_HOLE_MIN + GAP;
    const hi = KETTLE_HOLE_MAX - GAP;
    emit(set(out, lo, lo, hi, hi, s16(5), KETTLE_SHOULDER_TOP - s16(0.5), POT_WATER, BOIL, true));
    return 1;
  }
  return 0;
}

function cupBodies(e: BlockEntity, look: BrewLook, out: Body, emit: (b: Body) => void): number {
  const brewing = e.stage === 'brewing';
  if (!brewing && e.stage !== 'done') return 0;
  const drink = look.drinkColour ?? DEFAULT_DRINK;
  const k = brewing ? clamp01(num(e.brewS) / BREW_SECONDS) : 1;
  // The cup fills from a film on its floor to a hair under the rim.
  const floor = CUP_FLOOR_Y;
  const top = floor + (CUP_RIM_Y - s16(0.25) - floor) * (brewing ? 0.12 + 0.88 * k : 1);
  const colour = mixHex(BREW_WATER, drink, brewing ? 0.25 + 0.75 * k : 1);
  const lo = CUP_INNER_MIN + GAP;
  const hi = CUP_INNER_MAX - GAP;
  emit(set(out, lo, lo, hi, hi, floor, top, colour, 0, true));
  if (!brewing) return 1;
  // The stream from the spout to the surface, the colour of what is coming through (the drink, a little stronger).
  const w = s16(0.7);
  emit(set(out, 0.5 - w / 2, 0.5 - w / 2, 0.5 + w / 2, 0.5 + w / 2, top, CUP_SPOUT_Y + s16(0.5), mixHex(BREW_WATER, drink, 0.55 + 0.45 * k), 0, false, 1.6));
  return 2;
}

function vesselBodies(e: BlockEntity, look: BrewLook, out: Body, emit: (b: Body) => void): number {
  const v = VESSEL[vesselOf(typeof e.container === 'string' ? e.container : '')];
  const boiling = e.boiling === true;
  const heat = boiling ? 1 : clamp01(num(e.heatS) / (BOIL_SECONDS * look.boilScale));
  let colour: number;
  let boil: number;
  let full = v.full;
  if (look.holds === 'sap') {
    // Sap cooks down: it darkens and sinks as it heats, and resin bubbles slow and thick.
    colour = mixHex(SAP, RESIN, boiling ? 1 : heat * 0.6);
    boil = boiling ? 0.35 : heat * 0.25;
    full -= (boiling ? 1 : heat * 0.5) * 1.5;
  } else {
    colour = v === VESSEL.bucket ? POT_WATER : GLASS_WATER;
    // Small bubbles from about a third of the way to the boil, a simmer, then the rolling boil.
    boil = boiling ? BOIL : clamp01((heat - 0.3) / 0.7) * SIMMER;
    // Boiling water goes down as it boils away (half-way at the end), the open bucket's lid of water excepted.
    if (boiling && v !== VESSEL.bucket) full -= (full - v.floor) * 0.5 * clamp01(num(e.dryS) / BOIL_DRY_SECONDS);
  }
  const lo = s16(v.lo) + GAP;
  const hi = s16(v.hi) - GAP;
  emit(set(out, lo, lo, hi, hi, s16(v.floor), s16(full), colour, boil, true));
  return 1;
}
