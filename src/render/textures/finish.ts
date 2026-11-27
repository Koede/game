/**
 * The house finish for area-drawn art (src/render/textures/areas/*): different threads painted these tiles with a few
 * flat colours, while the core set carries grain, softer saturation and dark-edged icons. This wraps each area painter
 * so new art lands in the same style without every author having to repeat the habits:
 *
 *  - opaque tiles (blocks): flat patches get a faint deterministic grain, and over-saturated colours are eased toward grey;
 *  - icons that have a silhouette: if the painter left the rim un-outlined, the rim is sunk into the shared violet shadow.
 *
 * Painters that already carry detail or an outline are left alone (the checks are on the painted pixels), so authors can
 * still draw whatever they like. DOM-free; every random value comes from the canvas's name-seeded hash.
 */
import type { Canvas, Painter, PainterSet } from './canvas';
import { shade, type RGB } from './palette';

const N = 16;
/** A pixel counts as flat when both neighbours along a row or a column are within this much of its luminance. */
const FLAT = 6;
/** Grain amplitude (palette `shade` units, +-). */
export const GRAIN = 0.03;
/** Saturation (max-min)/max above which a colour is eased back, and how far toward its grey. */
export const SAT_LIMIT = 0.62;
export const SAT_EASE = 0.14;
/** Icons whose rim is darker than the interior on less than this share of rim pixels get an outline. */
export const OUTLINE_BELOW = 0.5;
export const OUTLINE_SINK = -0.42;
/** Area textures that are deliberately not outlined (marks on the ground, glass). */
const NO_OUTLINE = /^(chalk_mark|glassware_)/;

const lumOf = (d: Uint8ClampedArray, i: number): number => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const hasTransparency = (d: Uint8ClampedArray): boolean => {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128 && ++n > 8) return true;
  return false;
};
const alphaAt = (d: Uint8ClampedArray, x: number, y: number): number => (x < 0 || y < 0 || x >= N || y >= N ? 0 : d[(y * N + x) * 4 + 3]);
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Share of rim pixels (opaque with a see-through neighbour) that are darker than their opaque neighbours. */
export function outlineShare(d: Uint8ClampedArray): number {
  let rim = 0;
  let dark = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (alphaAt(d, x, y) < 128 || !NEIGHBOURS.some(([dx, dy]) => alphaAt(d, x + dx, y + dy) < 128)) continue;
      rim++;
      let sum = 0;
      let n = 0;
      for (const [dx, dy] of NEIGHBOURS) if (alphaAt(d, x + dx, y + dy) >= 128) (sum += lumOf(d, ((y + dy) * N + x + dx) * 4)), n++;
      if (n > 0 && lumOf(d, (y * N + x) * 4) < sum / n - 6) dark++;
    }
  return rim ? dark / rim : 1;
}

function finishBlock(c: Canvas): void {
  const d = c.data;
  const flat: boolean[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const l = lumOf(d, (y * N + x) * 4);
      const near = (dx: number, dy: number): boolean => Math.abs(lumOf(d, (((y + dy + N) % N) * N + ((x + dx + N) % N)) * 4) - l) <= FLAT;
      // Flat in a patch, or along a smooth gradient (both sides in one direction match): either way it wants grain.
      flat.push((near(1, 0) && near(-1, 0)) || (near(0, 1) && near(0, -1)));
    }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      let col: RGB = [d[i], d[i + 1], d[i + 2]];
      const mx = Math.max(...col);
      const mn = Math.min(...col);
      if (mx > 0 && (mx - mn) / mx > SAT_LIMIT) {
        const g = lumOf(d, i);
        col = [col[0] + (g - col[0]) * SAT_EASE, col[1] + (g - col[1]) * SAT_EASE, col[2] + (g - col[2]) * SAT_EASE];
      }
      if (flat[y * N + x]) col = shade(col, (c.hash(x, y, 417) - 0.5) * 2 * GRAIN);
      c.set(x, y, col, d[i + 3]);
    }
}

function finishIcon(c: Canvas): void {
  const d = c.data;
  const rim: [number, number][] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (alphaAt(d, x, y) >= 128 && NEIGHBOURS.some(([dx, dy]) => alphaAt(d, x + dx, y + dy) < 128)) rim.push([x, y]);
  for (const [x, y] of rim) {
    const i = (y * N + x) * 4;
    c.set(x, y, shade([d[i], d[i + 1], d[i + 2]], OUTLINE_SINK), d[i + 3]);
  }
}

/** Runs the finish for one named painter. */
export function finished(name: string, paint: Painter): Painter {
  return (c) => {
    paint(c);
    if (!hasTransparency(c.data)) finishBlock(c);
    else if (!NO_OUTLINE.test(name) && outlineShare(c.data) < OUTLINE_BELOW) finishIcon(c);
  };
}

export function finishSet(set: PainterSet): PainterSet {
  return Object.fromEntries(Object.entries(set).map(([name, paint]) => [name, finished(name, paint)]));
}
