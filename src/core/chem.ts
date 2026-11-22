/**
 * The mixture model of the distillery (docs/DISTILLERY_PLAN.md 5). Pure and DOM-free.
 *
 * Every liquid inside a chemistry rig is a `Mix`: litres per component. Distilling anything is one piece of physics:
 * Raoult's law with a vapour pressure that doubles every 10 C (`p_i(T) = 2^((T - bp_i) / 10)`, 1 at the boiling
 * point). From it:
 *   - the bubble point of a mixture: sum x_i p_i(Tb) = 1  ->  Tb = -10 log2(sum x_i 2^(-bp_i / 10));
 *     non-volatile components (sugars, rosin) dilute it, so they raise the boiling point like real solutes;
 *   - the vapour leaving it: y_i proportional to x_i p_i(Tb)^n, where n = 1 for a pot still and grows with column
 *     plates (each plate re-distils what the one below gave it).
 * A still holds its liquid at the bubble point and boils only while its heat source is hotter than that, so a run
 * ends by itself when what is left boils above the set temperature: the "step complete" of the plan.
 *
 * At the boundary of a rig (a beaker, a canister, a pipe) a mixture is NAMED by the best grade it meets (`nameOf`)
 * and a named fluid EXPANDS to that grade's own composition (`expand`), which only just meets the grade. Volume is
 * exact everywhere; purity can only be lost at a boundary, never gained.
 */

export type Component =
  | 'methanol' | 'ethanol' | 'gasoline' | 'water' | 'fusel' | 'turpentine' | 'kerosene' | 'diesel' | 'lube_base'
  | 'bitumen' | 'sugars' | 'rosin' | 'lubricant' | 'tincture' | 'clear_tincture';

export interface ComponentSpec {
  key: Component;
  name: string;
  /** Boiling point at 1 bar, C; null for what never boils in glass (sugars, rosin). */
  bp: number | null;
  /** Colour of the pure component in glass, 0xRRGGBB. */
  colour: number;
  /** Relative to water (1): how slowly it runs through tubes and drips from coils. */
  viscosity: number;
}

const spec = (key: Component, name: string, bp: number | null, colour: number, viscosity: number): ComponentSpec => ({ key, name, bp, colour, viscosity });

export const COMPONENTS: Readonly<Record<Component, ComponentSpec>> = {
  methanol: spec('methanol', 'Heads', 65, 0xdfe8ee, 0.6),
  ethanol: spec('ethanol', 'Ethanol', 78, 0xf1efe2, 1),
  gasoline: spec('gasoline', 'Gasoline', 90, 0xf2d24a, 0.5),
  water: spec('water', 'Water', 100, 0x3a86b4, 1),
  fusel: spec('fusel', 'Tails', 130, 0xb9a36a, 2),
  turpentine: spec('turpentine', 'Turpentine', 160, 0xcfe0a6, 1.2),
  kerosene: spec('kerosene', 'Kerosene', 190, 0x9fc4e8, 1.5),
  diesel: spec('diesel', 'Diesel', 280, 0xc98f2e, 3),
  lube_base: spec('lube_base', 'Lube Base', 370, 0x7a5a1e, 12),
  bitumen: spec('bitumen', 'Bitumen', 520, 0x15120f, 200),
  sugars: spec('sugars', 'Sugars', null, 0xc07a18, 30),
  rosin: spec('rosin', 'Rosin', null, 0x95560f, 30),
  // Filtered or blended products. No boiling point is given for them, so they stay in the vessel.
  lubricant: spec('lubricant', 'Lubricant', null, 0x20ff80, 12),
  tincture: spec('tincture', 'Tincture', null, 0xc02080, 1),
  clear_tincture: spec('clear_tincture', 'Clear Tincture', null, 0x66ffcc, 1),
};

export const COMPONENT_KEYS = Object.keys(COMPONENTS) as Component[];

/** Litres per component. Only finite amounts > 0 are kept by the helpers below. */
export type Mix = Partial<Record<Component, number>>;

/** Below this many litres an amount is dust and is dropped (keeps mixes from carrying 1e-12 L of everything). */
export const DUST_L = 1e-6;

export function total(m: Mix): number {
  let t = 0;
  for (const k in m) t += m[k as Component]!;
  return t;
}

export function add(m: Mix, c: Component, litres: number): void {
  if (!(litres > 0)) return;
  m[c] = (m[c] ?? 0) + litres;
}

/** Takes up to `litres` of one component out; returns what it took. */
export function take(m: Mix, c: Component, litres: number): number {
  const have = m[c] ?? 0;
  const t = Math.min(have, Math.max(0, litres));
  const left = have - t;
  if (left > DUST_L) m[c] = left;
  else delete m[c];
  return t + (left <= DUST_L ? left : 0);
}

/** Moves up to `litres` of `src` (all components in proportion) into `dst`; returns the litres moved. */
export function pour(src: Mix, dst: Mix, litres: number): number {
  const have = total(src);
  if (have <= 0 || !(litres > 0)) return 0;
  const k = Math.min(1, litres / have);
  let moved = 0;
  for (const c of Object.keys(src) as Component[]) {
    const t = k >= 1 ? take(src, c, Infinity) : take(src, c, src[c]! * k);
    add(dst, c, t);
    moved += t;
  }
  return moved;
}

export const share = (m: Mix, c: Component, t = total(m)): number => (t > 0 ? (m[c] ?? 0) / t : 0);

/**
 * Vapour pressure (bar) of a component at T, by the doubling-every-10-C rule; 0 for non-volatiles.
 * `bpScale` is 0.7 under a vacuum cap (docs/DISTILLERY_PLAN.md 4, 5.2): every boiling point is multiplied.
 */
export const pressureAt = (c: Component, tempC: number, bpScale = 1): number => {
  const bp = COMPONENTS[c].bp;
  return bp === null ? 0 : Math.pow(2, (tempC - bp * bpScale) / 10);
};

/** The temperature a mixture boils at (C), or null when nothing in it is volatile (or it is empty). */
export function bubblePoint(m: Mix, bpScale = 1): number | null {
  const t = total(m);
  if (t <= 0) return null;
  let s = 0;
  for (const k in m) {
    const bp = COMPONENTS[k as Component].bp;
    if (bp !== null) s += (m[k as Component]! / t) * Math.pow(2, -(bp * bpScale) / 10);
  }
  return s > 0 ? -10 * Math.log2(s) : null;
}

/**
 * The share of each component in the vapour leaving a mixture at its bubble point, enriched `n` times (1: one
 * equilibrium stage, a pot still; each column plate adds stages). Written into `out` (cleared first); returns false
 * when nothing boils.
 */
export function vapourShares(m: Mix, n: number, out: Mix, bpScale = 1): boolean {
  for (const k in out) delete out[k as Component];
  const tb = bubblePoint(m, bpScale);
  if (tb === null) return false;
  let sum = 0;
  for (const k in m) {
    const p = pressureAt(k as Component, tb, bpScale);
    if (p <= 0) continue;
    const w = m[k as Component]! * Math.pow(p, n);
    if (w > 0) {
      out[k as Component] = w;
      sum += w;
    }
  }
  if (sum <= 0) return false;
  for (const k in out) out[k as Component]! /= sum;
  return true;
}

/** Volume-weighted colour of a mixture (0xRRGGBB); `empty` when there is nothing. */
export function colourOf(m: Mix, empty = 0x9fb7c0): number {
  const t = total(m);
  if (t <= 0) return empty;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const k in m) {
    const w = m[k as Component]! / t;
    const c = COMPONENTS[k as Component].colour;
    r += ((c >> 16) & 255) * w;
    g += ((c >> 8) & 255) * w;
    b += (c & 255) * w;
  }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Geometric-mean viscosity of a mixture (water 1). */
export function viscosityOf(m: Mix): number {
  const t = total(m);
  if (t <= 0) return 1;
  let l = 0;
  for (const k in m) l += (m[k as Component]! / t) * Math.log(COMPONENTS[k as Component].viscosity);
  return Math.exp(l);
}

// ---- grades: naming at the boundary -------------------------------------------------------------------------

/** One named fluid a mixture can be bottled as. */
export interface GradeSpec {
  /** Fluid key (src/content/fluidsDistill.ts). */
  fluid: string;
  /** Least share of each listed component a mixture needs to be named this. */
  need: Mix;
  /** What one litre of it is when poured into a rig (shares summing to 1; meets `need`). */
  mix: Mix;
}

/** Slop: what a mixture that meets no grade is bottled as. Pouring it back gives this mix. */
export const SLOP = 'slop';
const SLOP_MIX: Mix = { water: 0.5, fusel: 0.3, diesel: 0.2 };

/** Every grade, best first (the first one a mixture meets names it). */
export const GRADES: readonly GradeSpec[] = [
  // Lube grade is 0.70 (plan 5.4). Bitumen's share is the 0.66 of the plan's residue feed, so the atmospheric
  // residue grade (0.60 bitumen) stays residue and a vacuum residue run can be bottled as bitumen.
  { fluid: 'lubricant', need: { lubricant: 0.7 }, mix: { lubricant: 0.7, bitumen: 0.3 } },
  { fluid: 'lube_base', need: { lube_base: 0.7 }, mix: { lube_base: 0.7, bitumen: 0.3 } },
  { fluid: 'bitumen', need: { bitumen: 0.66 }, mix: { bitumen: 1 } },
  { fluid: 'clear_tincture', need: { clear_tincture: 0.7 }, mix: { clear_tincture: 0.7, water: 0.3 } },
  { fluid: 'tincture', need: { tincture: 0.7 }, mix: { tincture: 0.7, water: 0.3 } },
  { fluid: 'fuel_ethanol', need: { ethanol: 0.88 }, mix: { ethanol: 0.9, water: 0.09, methanol: 0.01 } },
  { fluid: 'spirit', need: { ethanol: 0.58 }, mix: { ethanol: 0.65, water: 0.32, fusel: 0.02, methanol: 0.01 } },
  { fluid: 'low_wines', need: { ethanol: 0.25 }, mix: { ethanol: 0.3, water: 0.66, fusel: 0.03, methanol: 0.01 } },
  { fluid: 'gasoline', need: { gasoline: 0.8 }, mix: { gasoline: 0.85, kerosene: 0.15 } },
  { fluid: 'kerosene', need: { kerosene: 0.7 }, mix: { kerosene: 0.75, diesel: 0.15, gasoline: 0.1 } },
  { fluid: 'diesel', need: { diesel: 0.8 }, mix: { diesel: 0.85, kerosene: 0.1, lube_base: 0.05 } },
  { fluid: 'syrup', need: { sugars: 0.55 }, mix: { sugars: 0.65, water: 0.2, turpentine: 0.075, rosin: 0.075 } },
  { fluid: 'residue', need: { bitumen: 0.45 }, mix: { bitumen: 0.6, lube_base: 0.3, diesel: 0.1 } },
  { fluid: 'sugar_wash', need: { ethanol: 0.05, water: 0.6 }, mix: { water: 0.87, ethanol: 0.1, fusel: 0.026, methanol: 0.004 } },
  { fluid: 'sap', need: { sugars: 0.15, water: 0.5 }, mix: { water: 0.65, sugars: 0.25, turpentine: 0.05, rosin: 0.05 } },
  { fluid: 'crude_oil', need: { gasoline: 0.15, diesel: 0.2, bitumen: 0.15 }, mix: { gasoline: 0.22, kerosene: 0.13, diesel: 0.3, lube_base: 0.12, bitumen: 0.23 } },
  { fluid: 'water', need: { water: 0.97 }, mix: { water: 1 } },
];

const gradeByFluid = new Map(GRADES.map((g) => [g.fluid, g]));

/** The grade of a fluid key, or null (slop and unknown keys have none). */
export const gradeOf = (fluid: string): GradeSpec | null => gradeByFluid.get(fluid) ?? null;

/** Whether a mixture meets a grade's needs. */
export function meets(m: Mix, g: GradeSpec, t = total(m)): boolean {
  if (t <= 0) return false;
  for (const k in g.need) if (share(m, k as Component, t) + 1e-9 < g.need[k as Component]!) return false;
  return true;
}

/** The fluid a mixture is bottled as: the first grade it meets, else 'slop'. Null when it is empty. */
export function nameOf(m: Mix): string | null {
  const t = total(m);
  if (t <= DUST_L) return null;
  for (const g of GRADES) if (meets(m, g, t)) return g.fluid;
  return SLOP;
}

/** `litres` of a named fluid as a mixture (slop and unknown fluids pour in as slop). */
export function expand(fluid: string, litres: number): Mix {
  const shares = gradeOf(fluid)?.mix ?? SLOP_MIX;
  const out: Mix = {};
  for (const k in shares) add(out, k as Component, shares[k as Component]! * litres);
  return out;
}

/** Whether a fluid key can be poured into or bottled from a rig. */
export const isChemFluid = (fluid: string): boolean => fluid === SLOP || gradeByFluid.has(fluid);

// ---- the column ---------------------------------------------------------------------------------------------

/**
 * Tray temperatures of a column: tray h (1..height) of a stack heated to `sourceC` with its head at `headC`.
 * Linear between the two; index 0 of the result is tray 1.
 */
export function trayTemps(sourceC: number, headC: number, height: number): number[] {
  const out: number[] = [];
  for (let h = 1; h <= height; h++) out.push(sourceC - ((sourceC - headC) * h) / height);
  return out;
}

/**
 * Which draw a component condenses at: the lowest draw whose tray is at or below its boiling point. `draws` are the
 * trays of the side draws, bottom to top; the head (index draws.length) takes everything lighter.
 */
export function drawIndex(bp: number, drawTrayC: readonly number[]): number {
  for (let i = 0; i < drawTrayC.length; i++) if (bp >= drawTrayC[i]) return i;
  return drawTrayC.length;
}

/** Share of a cut that leaks one draw up (the column's imperfection); smaller in taller columns. */
export const leakShare = (segments: number): number => (segments <= 0 ? 0 : 0.25 / segments);

/**
 * Enrichment stages of a stack: one for the pot, plus the plates times (1 + 2 r).
 * r is the reflux return (0, 0.5 or 0.75). With no reflux head, r is 0 and this is 1 + segments.
 */
export const stagesOf = (segments: number, reflux = 0): number => 1 + segments * (1 + 2 * reflux);
