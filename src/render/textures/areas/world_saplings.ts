/** Tiles of the saplings (src/content/areas/world_saplings.ts): a thin stem with a small crown, on a clear tile. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';

function oakSapling(c: Canvas): void {
  for (let y = 7; y <= 15; y++) c.set(7 + (y > 12 ? 1 : 0), y, P.OAK_BARK[y > 12 ? 1 : 2]);
  c.set(6, 10, P.OAK_LEAF[2]);
  c.set(5, 9, P.OAK_LEAF[3]);
  c.set(9, 11, P.OAK_LEAF[2]);
  c.set(10, 10, P.OAK_LEAF[3]);
  for (let y = 1; y <= 7; y++) {
    const w = y < 3 ? 2 : y < 6 ? 4 : 3;
    for (let x = 8 - w; x < 8 + w; x++) c.set(x, y, c.hash(x, y) < 0.3 ? P.OAK_LEAF[1] : c.hash(x, y, 1) > 0.75 ? P.OAK_LEAF[4] : P.OAK_LEAF[3]);
  }
}

function pineSapling(c: Canvas): void {
  for (let y = 11; y <= 15; y++) c.set(7, y, P.PINE_BARK[y > 13 ? 1 : 3]);
  for (let y = 1; y <= 11; y++) {
    const w = Math.floor((y - 1) / 2.5) + 1;
    for (let x = 7 - w + 1; x < 7 + w; x++) {
      const edge = x === 7 - w + 1 || x === 7 + w - 1;
      c.set(x, y, edge ? P.PINE_LEAF[1] : c.hash(x, y) < 0.3 ? P.PINE_LEAF[2] : c.hash(x, y, 1) > 0.8 ? P.PINE_LEAF[4] : P.PINE_LEAF[3]);
    }
  }
}

export default {
  oak_sapling: oakSapling,
  pine_sapling: pineSapling,
} satisfies PainterSet;
