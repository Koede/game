/**
 * Icon silhouettes shared by several items. Each category has its own outline so ingots, plates, powders,
 * crushed ore, rods and sealed cells tell apart by shape before colour. Ramps run dark (0) to light (4);
 * light comes from the top left. Callers finish an icon with `c.outline()`.
 */
import type { Canvas, Painter } from './canvas';
import { type RGB, type Ramp, mix, shade } from './palette';

/** Legend for sprites shaded with one ramp: '1' darkest .. '5' lightest, '6' a glint. */
export function rampLegend(r: Ramp): Record<string, RGB> {
  return { 1: r[0], 2: r[1], 3: r[2], 4: r[3], 5: r[4], 6: shade(r[4], 0.55) };
}

/** A cast bar: trapezoid top face, straight front face. */
export function ingot(c: Canvas, r: Ramp): void {
  c.sprite(
    [
      '....55555555....',
      '...5666444444...',
      '..554444444443..',
      '.54444444444433.',
      '.33333333333332.',
      '.33333333333322.',
      '.22222222222221.',
      '..111111111111..',
    ],
    rampLegend(r),
    0,
    4,
  );
}

/** A flat square sheet seen from above at an angle, with four rivet holes and a visible thickness. */
export function plate(c: Canvas, r: Ramp): void {
  c.each((x, y) => {
    const dx = Math.abs(x - 7.5) / 7.5;
    const dy = Math.abs(y - 7) / 4;
    if (dx + dy <= 1) return y < 7 ? (x < 8 ? r[4] : r[3]) : x < 8 ? r[3] : r[2];
    const dyBelow = Math.abs(y - 1 - 7) / 4;
    if (y > 7 && dx + dyBelow <= 1) return x < 8 ? r[1] : r[0];
    return null;
  });
  for (const [x, y] of [[7, 5], [4, 7], [11, 7], [8, 9]]) {
    c.set(x, y, r[0]);
  }
  c.set(6, 4, shade(r[4], 0.5));
}

/** A soft heap of powder with a few grains catching the light. */
export function mound(c: Canvas, r: Ramp, grains: RGB | null = null): void {
  c.each((x, y) => {
    const u = (x - 7.5) / 7;
    if (Math.abs(u) > 1) return null;
    const top = 12.5 - 7 * Math.sqrt(1 - u * u) * (1 - 0.15 * u);
    if (y < Math.round(top) || y > 12) return null;
    if (y === 12) return r[0];
    const side = u + (y - top) * 0.06;
    return side < -0.35 ? r[4] : side < 0.15 ? r[3] : side < 0.6 ? r[2] : r[1];
  });
  if (grains) for (const [x, y] of [[5, 8], [9, 9], [7, 11], [11, 11], [3, 11], [8, 7]]) if (c.alpha(x, y) > 0) c.set(x, y, grains);
}

/** A pile of angular fragments: ore pieces (`r`) mixed with darker rock (`rock`). */
export function crushedPile(c: Canvas, r: Ramp, rock: Ramp): void {
  const pieces: [number, number, number, number, boolean][] = [
    [2, 10, 4, 3, false], [6, 10, 4, 3, true], [10, 10, 4, 3, false],
    [4, 7, 4, 3, true], [8, 7, 4, 3, false], [6, 4, 4, 3, true], [11, 8, 2, 2, true], [2, 8, 2, 2, false],
  ];
  for (const [x, y, w, h, ore] of pieces) {
    const k = ore ? r : rock;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1) && w > 2) continue;
        c.set(x + i, y + j, j === 0 ? k[4] : i === 0 ? k[3] : j === h - 1 ? k[1] : k[2]);
      }
    }
  }
}

/** A straight round bar from the lower left to the upper right, `width` 2 or 3, with lit end caps. */
export function rod(c: Canvas, r: Ramp, width: 2 | 3, from = 2, to = 13): void {
  for (let t = from; t <= to; t++) {
    const x = t;
    const y = 15 - t;
    c.set(x, y - 1, r[4]);
    c.set(x, y, r[2]);
    if (width === 3) c.set(x + 1, y, r[1]);
    c.set(x, y + 1, r[1]);
    if (width === 3) c.set(x + 1, y + 1, r[0]);
  }
  c.set(to + 1, 15 - to - 1, r[3]);
  c.set(from - 1, 15 - from + 1, r[1]);
}

/** An upright sealed capsule: metal cap and foot, a body drawn by `fill` (per pixel, may return null). */
export function capsule(c: Canvas, metal: Ramp, fill: (x: number, y: number) => RGB): void {
  for (let y = 3; y <= 13; y++) {
    for (let x = 4; x <= 11; x++) {
      const round = (y === 3 || y === 13) && (x === 4 || x === 11);
      if (round) continue;
      if (y <= 4 || y >= 12) c.set(x, y, x < 7 ? metal[3] : x > 9 ? metal[1] : metal[2]);
      else c.set(x, y, fill(x, y));
    }
  }
  c.rect(6, 1, 4, 2, metal[2]);
  c.rect(6, 1, 2, 1, metal[4]);
  c.rect(4, 5, 8, 1, metal[0]);
}

/** Clear glass for capsules: a pale body with a vertical highlight on its left. */
export const glassFill = (glass: Ramp) => (x: number, y: number): RGB =>
  x === 5 ? glass[4] : x === 10 ? glass[1] : mix(glass[2], glass[1], (y - 5) / 8);

/** Wraps a painter so it ends with the dark icon outline. */
export const icon = (paint: Painter): Painter => (c) => {
  paint(c);
  c.outline();
};

/** A faceted lump: an octagon lit on its upper-left facets. */
export function lump(c: Canvas, cx: number, cy: number, rx: number, ry: number, r: Ramp): void {
  c.each((x, y) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    if (Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * 0.72) > 1) return null;
    if (dy < -0.35) return dx < 0.2 ? r[4] : r[3];
    if (dx < -0.3) return r[3];
    if (dy > 0.4) return r[0];
    return dx > 0.4 ? r[1] : r[2];
  });
}
