/** Tiles and icons of bees and pollination (src/content/areas/bees.ts): the beehive, the beeswax candle, comb, honey, wax and the smoker. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { shade } from '../palette';
import { icon } from '../shapes';

const HONEY = [P.rgb(0x7a4a0c), P.rgb(0xb06d12), P.rgb(0xd9951e), P.rgb(0xf0b93a), P.rgb(0xffdf7a)];
const WAX = [P.rgb(0x9c7a2c), P.rgb(0xc59f42), P.rgb(0xe2c060), P.rgb(0xf1d888), P.rgb(0xfbeeb8)];
const GLASS = [P.rgb(0x5d7c88), P.rgb(0x86a9b6), P.rgb(0xaed0db), P.rgb(0xd2eaf0), P.rgb(0xf2fbfd)];
const BEE_DARK = P.rgb(0x1e1810);

/** Side of the hive: three stacked boxes of pale boards with a dark entrance slot at the bottom and a bee or two. */
function hiveSide(c: Canvas): void {
  const w = P.WOOD;
  c.fill(w[3]);
  c.each((x, y) => (c.hash(x, y) < 0.18 ? w[2] : c.hash(x, y, 1) > 0.9 ? w[4] : null));
  // Box seams and their shadowed lips.
  for (const y of [4, 9]) {
    c.rect(0, y, 16, 1, w[0]);
    c.rect(0, y + 1, 16, 1, w[4]);
  }
  c.rect(0, 15, 16, 1, w[0]);
  // Vertical grain hints.
  for (const x of [3, 8, 12]) for (let y = 0; y < 15; y++) if (c.hash(x, y, 2) < 0.4 && y !== 4 && y !== 9) c.set(x, y, w[2]);
  // The entrance: a dark slot with a landing board under it.
  c.rect(5, 12, 6, 2, P.SOOT);
  c.rect(4, 14, 8, 1, w[1]);
  // A honey stain under the slot and two bees.
  c.set(7, 14, HONEY[3]);
  c.set(8, 14, HONEY[2]);
  for (const [x, y] of [[12, 11], [2, 6]] as const) {
    c.set(x, y, HONEY[4]);
    c.set(x + 1, y, BEE_DARK);
    c.set(x, y - 1, GLASS[4]);
  }
}

/** Top of the hive: a pitched-looking lid of boards with a darker rim. */
function hiveTop(c: Canvas): void {
  const w = P.WOOD;
  c.fill(w[2]);
  c.each((x, y) => (c.hash(x, y) < 0.2 ? w[1] : c.hash(x, y, 3) > 0.88 ? w[3] : null));
  for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) c.set(x, y, w[1]);
  c.frame(0, 0, 16, 16, w[0]);
  c.rect(6, 7, 4, 2, w[0]);
  // A brick to keep the lid down, and a honey stain.
  c.rect(10, 10, 3, 2, P.STONE[3]);
  c.set(10, 10, P.STONE[4]);
  c.set(3, 4, P.rgb(0xd9951e));
}

/** Beeswax candle, drawn for the torch mesher (2px post in columns 7-8, rows 6..15; the wider icon around it). */
function candle(c: Canvas): void {
  for (let y = 8; y < 16; y++) {
    c.set(7, y, WAX[3]);
    c.set(8, y, WAX[1]);
  }
  c.set(7, 8, WAX[4]);
  c.set(8, 8, WAX[2]);
  c.set(6, 10, WAX[2]);
  c.set(9, 12, WAX[1]);
  c.sprite(['.ab.', 'abba', 'bccb', '.cc.'], { a: P.EMBER[3], b: P.EMBER[4], c: shade(P.EMBER[4], 0.4) }, 6, 3);
  c.rect(7, 6, 2, 2, shade(P.EMBER[4], 0.45));
  c.outline(0.6);
}

/** A slab of hexagon cells, a few capped, honey glinting in the open ones. */
function honeycomb(c: Canvas): void {
  c.rect(2, 3, 12, 10, WAX[2]);
  c.rect(3, 2, 10, 1, WAX[3]);
  c.rect(3, 13, 10, 1, WAX[1]);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 3 + col * 4 + (row % 2 === 1 ? 2 : 0);
      const y = 4 + row * 3;
      if (x > 12) continue;
      const capped = (row + col) % 3 === 0;
      c.rect(x, y, 2, 2, capped ? WAX[4] : HONEY[2]);
      if (!capped) c.set(x, y, HONEY[4]);
      c.set(x + 2, y + 1, WAX[0]);
    }
  }
}

/** A glass beaker of golden honey. */
function honeyBeaker(c: Canvas): void {
  c.rect(4, 2, 8, 1, GLASS[3]);
  c.rect(5, 3, 6, 10, GLASS[1]);
  c.rect(5, 3, 1, 10, GLASS[4]);
  c.rect(10, 3, 1, 10, GLASS[0]);
  c.rect(5, 13, 6, 1, GLASS[0]);
  c.rect(6, 4, 4, 8, GLASS[2]);
  c.rect(6, 6, 4, 7, HONEY[2]);
  c.rect(6, 6, 4, 1, HONEY[4]);
  c.rect(9, 7, 1, 6, HONEY[0]);
  c.rect(7, 8, 1, 3, HONEY[3]);
  // A drip running over the lip.
  c.set(11, 3, HONEY[3]);
  c.set(11, 4, HONEY[2]);
}

/** A rounded cake of yellow wax. */
function beeswax(c: Canvas): void {
  c.rect(3, 6, 10, 6, WAX[2]);
  c.rect(4, 5, 8, 1, WAX[3]);
  c.rect(4, 12, 8, 1, WAX[0]);
  c.rect(4, 6, 8, 2, WAX[4]);
  c.rect(11, 7, 1, 5, WAX[1]);
  c.set(6, 9, WAX[3]);
  c.set(9, 10, WAX[1]);
}

/** A little bellows with a tin can and a wisp of smoke. */
function smoker(c: Canvas): void {
  c.rect(2, 8, 6, 5, P.WOOD[2]);
  c.rect(2, 8, 6, 1, P.WOOD[4]);
  c.rect(3, 10, 4, 1, P.WOOD[0]);
  c.rect(8, 6, 4, 8, P.TIN[2]);
  c.rect(8, 6, 1, 8, P.TIN[4]);
  c.rect(11, 6, 1, 8, P.TIN[0]);
  c.rect(9, 4, 2, 2, P.TIN[3]);
  for (const [x, y] of [[10, 3], [11, 2], [12, 1], [13, 1]] as const) c.set(x, y, P.CONCRETE[3]);
}

/** A brown cake with a honey glaze dripping down its side. */
function honeyCake(c: Canvas): void {
  const crumb = [P.rgb(0x5a3518), P.rgb(0x7a4a22), P.rgb(0x9a6330), P.rgb(0xb57d44)];
  c.rect(2, 7, 12, 6, crumb[2]);
  c.rect(2, 12, 12, 1, crumb[0]);
  c.rect(13, 7, 1, 6, crumb[1]);
  c.rect(2, 5, 12, 2, HONEY[3]);
  c.rect(3, 4, 10, 1, HONEY[4]);
  for (const [x, h] of [[3, 2], [6, 3], [10, 2], [12, 1]] as const) c.rect(x, 7, 1, h, HONEY[2]);
  c.set(7, 9, crumb[3]);
}

export default {
  beehive_side: hiveSide,
  beehive_top: hiveTop,
  beeswax_candle: candle,
  item_honeycomb: icon(honeycomb),
  item_honey: icon(honeyBeaker),
  item_beeswax: icon(beeswax),
  item_bee_smoker: icon(smoker),
  item_honey_cake: icon(honeyCake),
} satisfies PainterSet;
