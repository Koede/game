/** Item icons of the richer world (spec 13-14): the bronze bucket, a bucket of lava, and wildberries. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { type Ramp, rgb, shade } from './palette';
import { icon } from './shapes';

const BERRY: Ramp = [rgb(0x2a0c24), rgb(0x4e1238), rgb(0x7a1a4c), rgb(0xa8306a), rgb(0xe07aa4)];

/** A seamless bronze bucket: a tapered body lit on its left, a rolled rim, two riveted lugs and a bail. */
function bronzeBucket(c: Canvas, fill: 'empty' | 'lava'): void {
  const b = P.BRONZE;
  for (let y = 6; y <= 14; y++) {
    const inset = Math.floor((y - 6) / 4);
    for (let x = 2 + inset; x <= 13 - inset; x++) {
      const u = (x - 2 - inset) / (11 - 2 * inset);
      c.set(x, y, u < 0.18 ? b[4] : u < 0.4 ? b[3] : u < 0.75 ? b[2] : b[1]);
    }
  }
  // A darker band near the foot and a rolled lip at the top.
  c.rect(4, 13, 8, 1, b[1]);
  c.rect(2, 5, 12, 1, b[4]);
  c.set(13, 5, b[2]);
  if (fill === 'lava') {
    // Molten lava domed just over the rim, glowing on the bronze below it, with a drip down the side.
    c.rect(3, 6, 10, 1, P.LAVA[2]);
    c.rect(3, 5, 10, 1, P.LAVA[3]);
    c.rect(5, 4, 6, 1, P.LAVA[4]);
    c.set(6, 5, P.LAVA[4]);
    c.set(10, 5, P.LAVA[1]);
    for (let x = 3; x <= 12; x++) c.set(x, 7, shade(b[3], 0.25));
    c.set(11, 7, P.LAVA[2]);
    c.set(11, 8, P.LAVA[3]);
    c.set(11, 9, P.LAVA[1]);
  } else {
    c.rect(3, 6, 10, 1, shade(b[0], -0.35));
  }
  // Lugs and bail.
  c.set(2, 7, b[0]);
  c.set(13, 7, b[0]);
  c.line(2, 5, 4, 1, P.IRON_METAL[3]);
  c.line(4, 1, 11, 1, P.IRON_METAL[3]);
  c.line(11, 1, 13, 5, P.IRON_METAL[1]);
  if (fill === 'lava') {
    // Heat shimmering off the surface.
    c.set(7, 3, P.LAVA[3]);
    c.set(8, 2, P.LAVA[4]);
  }
}

/** A handful of wildberries: a cluster of round berries, each with a highlight, and a leaf. */
function wildberries(c: Canvas): void {
  // Five loose round berries, each lit on its upper left, under a sprig of two leaves.
  const g = P.OAK_LEAF;
  c.line(7, 4, 12, 1, P.OAK_BARK[3]);
  c.sprite(['.ab', 'abc', 'bc.'], { a: g[4], b: g[3], c: g[1] }, 11, 0);
  c.sprite(['ab.', 'bbc', '.cc'], { a: g[4], b: g[3], c: g[1] }, 3, 2);
  for (const [x, y] of [[7, 6], [3, 9], [10, 9], [6, 12], [11, 13]] as const) {
    c.disc(x + 0.5, y + 0.5, 1.6, BERRY[2]);
    c.set(x + 1, y + 1, BERRY[1]);
    c.set(x + 1, y + 2, BERRY[0]);
    c.set(x + 2, y + 1, BERRY[0]);
    c.set(x - 1, y, BERRY[3]);
    c.set(x, y - 1, BERRY[4]);
    c.set(x, y, BERRY[3]);
  }
}

export const WORLD_ICONS: PainterSet = {
  item_bronze_bucket: icon((c) => bronzeBucket(c, 'empty')),
  item_lava_bucket: icon((c) => bronzeBucket(c, 'lava')),
  item_wildberries: icon(wildberries),
};
