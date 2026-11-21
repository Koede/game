/**
 * Higher-level strokes shared by the families: cracks, bevelled cells (pebbles, bricks, crust), strata and
 * the casing parts of machines. All of them wrap around the tile edges where that matters for tiling.
 */
import { clamp } from '../../core/math';
import type { Canvas, CellMap } from './canvas';
import { type RGB, shade } from './palette';

const N = 16;

/** Colour of a ramp at a position 0..1 (clamped). */
export const tone = (ramp: readonly RGB[], v: number): RGB => ramp[Math.floor(clamp(v, 0, 0.9999) * ramp.length)];

/**
 * A wandering hairline crack starting at (x, y) and heading roughly along (dx, dy), with a light lip on its
 * lower-right side so it reads as cut into the surface rather than drawn on it.
 */
export function crack(c: Canvas, x: number, y: number, steps: number, dx: number, dy: number, dark: RGB, lip?: RGB): void {
  let px = x;
  let py = y;
  const path: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    path.push([px, py]);
    const r = c.rand();
    if (r < 0.55) {
      px += dx;
      py += dy;
    } else if (r < 0.78) {
      px += dx !== 0 ? dx : c.rand() < 0.5 ? -1 : 1;
      py += dy !== 0 ? dy : c.rand() < 0.5 ? -1 : 1;
    } else {
      px += dy !== 0 ? (c.rand() < 0.5 ? -1 : 1) : dx;
      py += dx !== 0 ? (c.rand() < 0.5 ? -1 : 1) : dy;
    }
  }
  const on = new Set(path.map(([a, b]) => ((b + 64) % N) * N + ((a + 64) % N)));
  if (lip) {
    for (const [a, b] of path) {
      const k = ((b + 1 + 64) % N) * N + ((a + 64) % N);
      if (!on.has(k)) c.wset(a, b + 1, lip);
    }
  }
  for (const [a, b] of path) c.wset(a, b, dark);
}

/**
 * Paints Voronoi cells as rounded stones: each cell gets its own base colour, a light rim where its
 * upper-left neighbour belongs to another cell, a dark rim on the lower right, and `gap` in the seams.
 */
export function bevelCells(
  c: Canvas,
  map: CellMap,
  colour: (id: number, x: number, y: number) => RGB,
  gap: RGB | null,
  gapWidth = 0.9,
  light = 0.22,
  dark = 0.3,
): void {
  const id = (x: number, y: number): number => map.id[((y + N) % N) * N + ((x + N) % N)];
  c.each((x, y) => {
    const k = y * N + x;
    if (gap && map.edge[k] < gapWidth) return gap;
    const me = map.id[k];
    let col = colour(me, x, y);
    if (id(x - 1, y) !== me || id(x, y - 1) !== me) col = shade(col, light);
    else if (id(x + 1, y) !== me || id(x, y + 1) !== me) col = shade(col, -dark);
    return col;
  });
}

/** Horizontal bands whose height wobbles with x (seamless): returns the band index of each pixel. */
export function strata(c: Canvas, bands: number, wobble: number, salt = 0): (x: number, y: number) => number {
  const n = c.noise(8, 8, salt);
  return (x, y) => Math.floor(((y + (n(x, 0) - 0.5) * wobble * 2 + N) % N) / (N / bands)) % bands;
}

/** A 1px bevelled rectangle: light top/left edge, dark bottom/right edge. */
export function bevel(c: Canvas, x: number, y: number, w: number, h: number, light: RGB, dark: RGB): void {
  c.rect(x, y, w, 1, light);
  c.rect(x, y, 1, h, light);
  c.rect(x, y + h - 1, w, 1, dark);
  c.rect(x + w - 1, y, 1, h, dark);
}

/** A raised rivet: bright top-left pixel over a dark one. */
export function rivet(c: Canvas, x: number, y: number, hi: RGB, lo: RGB): void {
  c.set(x, y, hi);
  c.set(x + 1, y + 1, lo);
}
