/** Dye icons, stained plank tiles and the furniture tiles of the decorating pass (src/content/areas/decor.ts). */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { shade } from '../palette';
import { icon } from '../shapes';

const COLORS: Record<string, number> = { red: 0xb83a32, yellow: 0xd8b43a, blue: 0x3a64b8, green: 0x3f8f45, black: 0x2a2a2e, white: 0xeeeae0 };

function dyeIcon(color: number): (c: Canvas) => void {
  const base = P.rgb(color);
  return (c) => {
    c.rect(4, 8, 8, 6, base);
    c.rect(5, 6, 6, 2, shade(base, 0.15));
    c.rect(6, 4, 4, 2, shade(base, 0.3));
    c.rect(4, 8, 2, 6, shade(base, 0.2));
    c.rect(10, 8, 2, 6, shade(base, -0.25));
  };
}

function stained(color: number): (c: Canvas) => void {
  const base = shade(P.rgb(color), -0.05);
  return (c) => {
    const n = c.noise(4, 4, 7);
    c.each((x, y) => shade(base, (n(x, y) - 0.5) * 0.14 + (c.hash(x, y, 2) - 0.5) * 0.06));
    for (const y of [0, 5, 10, 15]) c.line(0, y, 15, y, shade(base, -0.28));
    for (const [x, y] of [[4, 2], [11, 7], [6, 12]]) c.rect(x, y, 1, 1, shade(base, -0.2));
  };
}

function tableTile(c: Canvas): void {
  c.each(() => P.WOOD[2]);
  c.rect(0, 0, 16, 2, P.WOOD[4]);
  c.rect(0, 14, 16, 2, P.WOOD[0]);
  for (const x of [5, 10]) c.line(x, 2, x, 13, P.WOOD[1]);
}

function benchTile(c: Canvas): void {
  c.each(() => P.WOOD[3]);
  c.rect(0, 0, 16, 3, P.WOOD[4]);
  c.rect(0, 13, 16, 3, P.WOOD[1]);
  c.rect(1, 3, 2, 10, P.WOOD[0]);
  c.rect(13, 3, 2, 10, P.WOOD[0]);
}

function bookshelfTile(c: Canvas): void {
  c.each(() => P.WOOD[2]);
  const spines = [0x8a3a32, 0x3a5c8a, 0x4a7a46, 0xb89a3a, 0x6a4a7a];
  for (const y of [1, 9]) {
    c.rect(0, y + 6, 16, 1, P.WOOD[0]);
    for (let x = 1, i = 0; x < 15; x += 2, i++) c.rect(x, y, 2, 6, P.rgb(spines[(i + y) % spines.length]));
  }
  c.rect(0, 0, 16, 1, P.WOOD[4]);
}

export default {
  ...Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [`item_${k}_dye`, icon(dyeIcon(v))])),
  ...Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [`${k}_stained_plank`, stained(v)])),
  dining_table: tableTile,
  plank_bench: benchTile,
  bookshelf: bookshelfTile,
} satisfies PainterSet;
