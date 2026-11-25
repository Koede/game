/**
 * Liquid that follows a glass model's profile (docs/api/glass.md "Liquids"): the bodies of liquid in a vessel are cut from the
 * model's own interior, one sixteenth slice at a time, so a flask's belly, a funnel's bulb and a jar's shoulder read as
 * round glass with liquid in them instead of a block. Pure data: no three.js, so the bodies can be checked against the
 * model in a test (liquidProfile.test.ts).
 *
 * The interior of a slice is the envelope of the model's body boxes that cross it, inset by one wall (one sixteenth), which
 * is how every vessel in glassModels.ts is built (walls are one sixteenth thick). Layers of a settled charge are cut
 * bottom-up through those slices; a slice where the interior changes starts a new step, and runs of equal footprint merge.
 */
import { GLASS_MODELS, type Box } from '../../world/glassModels';

/** One sixteenth of a block: the glass models are drawn in these. */
const P = 1 / 16;
/** Thinnest sliver of liquid worth a body (block units). */
const MIN_H = 0.002;

/** A body of liquid in block units, relative to the cell's corner. `top` marks the one whose top is the open surface. */
export interface LiquidBody { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; layer: number; top: boolean }

/** The sixteenth slices a vessel holds liquid in: from `from` up to, not including, `to`. */
export const LIQUID_RANGE: Readonly<Record<string, { from: number; to: number }>> = {
  boiling_flask: { from: 1, to: 11 },
  reaction_vessel: { from: 1, to: 11 },
  receiver: { from: 1, to: 7 },
  filter_bed: { from: 10, to: 14 },
  separatory_funnel: { from: 5, to: 13 },
};

/** Interior footprint of one slice, in sixteenths: [x0, x1, z0, z1]; null when the slice has no room for liquid. */
type Footprint = readonly [number, number, number, number];

export function sliceInterior(body: readonly Box[], k: number): Footprint | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const b of body) {
    if (b[1] >= k + 1 || b[4] <= k) continue;
    x0 = Math.min(x0, b[0]);
    x1 = Math.max(x1, b[3]);
    z0 = Math.min(z0, b[2]);
    z1 = Math.max(z1, b[5]);
  }
  if (x0 === Infinity) return null;
  const fp: Footprint = [x0 + 1, x1 - 1, z0 + 1, z1 - 1];
  return fp[1] > fp[0] && fp[3] > fp[2] ? fp : null;
}

/**
 * The liquid bodies of a vessel holding `layers` (bottom first, with their litres) at `fill` (0..1) of its range. Empty when
 * the model has no range or nothing is in it.
 */
export function profiledBodies(model: string, litres: readonly number[], fill: number): LiquidBody[] {
  const range = LIQUID_RANGE[model];
  const glass = GLASS_MODELS[model];
  if (!range || !glass || !(fill > 0)) return [];
  const all = litres.reduce((t, l) => t + l, 0);
  if (all <= 0) return [];
  const height = (range.to - range.from) * P * Math.min(1, fill);
  const out: LiquidBody[] = [];
  let y = range.from * P;
  litres.forEach((l, layer) => {
    const ya = y;
    const yb = y + height * (l / all);
    y = yb;
    if (yb - ya < MIN_H) return;
    // Runs of slices with the same footprint become one body each.
    const runs: Array<{ fp: Footprint; y0: number; y1: number }> = [];
    for (let k = range.from; k < range.to; k++) {
      const s0 = Math.max(ya, k * P);
      const s1 = Math.min(yb, (k + 1) * P);
      if (s1 - s0 < 1e-6) continue;
      const fp = sliceInterior(glass.body, k);
      if (!fp) continue;
      const last = runs[runs.length - 1];
      if (last && last.y1 >= s0 - 1e-6 && last.fp.every((v, i) => v === fp[i])) last.y1 = s1;
      else runs.push({ fp, y0: s0, y1: s1 });
    }
    for (const r of runs) {
      const [x0, x1, z0, z1] = r.fp;
      out.push({ x0: x0 * P, y0: r.y0, z0: z0 * P, x1: x1 * P, y1: r.y1, z1: z1 * P, layer, top: false });
    }
  });
  // The open surface is the top of the topmost body of the top layer.
  const topLayer = out.reduce((t, b) => Math.max(t, b.layer), -1);
  let best: LiquidBody | null = null;
  for (const b of out) if (b.layer === topLayer && (!best || b.y1 > best.y1)) best = b;
  if (best) best.top = true;
  return out;
}

/** The height the liquid reaches (block units from the cell's floor), for the bubbles that rise to it. */
export function profiledTop(model: string, fill: number): number {
  const range = LIQUID_RANGE[model];
  if (!range || !(fill > 0)) return 0;
  return range.from * P + (range.to - range.from) * P * Math.min(1, fill);
}

/**
 * A jacket's water: the annulus between its clear shell and the clear tube in its middle (the model's 2..14 interior less the
 * 6..10 tube), up to `fill` of its 13/16 height. Four boxes, in the same block units as profiledBodies.
 */
export function jacketBodies(fill: number): Array<Omit<LiquidBody, 'layer' | 'top'>> {
  if (!(fill > 0)) return [];
  const h = 13 * P * Math.min(1, fill);
  const o = 2 * P;
  const i = 14 * P;
  const t0 = 6 * P;
  const t1 = 10 * P;
  return [
    { x0: o, y0: 0, z0: o, x1: t0, y1: h, z1: i },
    { x0: t1, y0: 0, z0: o, x1: i, y1: h, z1: i },
    { x0: t0, y0: 0, z0: o, x1: t1, y1: h, z1: t0 },
    { x0: t0, y0: 0, z0: t1, x1: t1, y1: h, z1: i },
  ];
}

/** A colour moved `t` (0..1) of the way to white: the level line on the jacket's water. */
export function lighten(hex: number, t: number): number {
  const ch = (shift: number): number => {
    const c = (hex >> shift) & 255;
    return Math.round(c + (255 - c) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
