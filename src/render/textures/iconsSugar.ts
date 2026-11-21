/** Icons of the resin, sugar and sweet-baking chain (src/content/itemsSugar.ts), 16x16, light from the top left. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const GLASS = [P.rgb(0x5d7c88), P.rgb(0x86a9b6), P.rgb(0xaed0db), P.rgb(0xd2eaf0), P.rgb(0xf2fbfd)];
const AMBER = [P.rgb(0x6a3a0c), P.rgb(0x95560f), P.rgb(0xc07a18), P.rgb(0xe3a02c), P.rgb(0xf6cb5c)];
const SUGAR_W = [P.rgb(0xaaa595), P.rgb(0xcbc6b4), P.rgb(0xe6e2d3), P.rgb(0xf6f3e8), P.rgb(0xffffff)];
const CRUST = [P.rgb(0x6b3d17), P.rgb(0x8c5522), P.rgb(0xb07230), P.rgb(0xcf9244), P.rgb(0xe6b366)];
const CHOC = P.rgb(0x4a2a14);

/** The beaker: a flared lip, a straight glass body, two graduation ticks. `fill` is the liquid colour ramp, or null for empty. */
function beaker(c: Canvas, fill: readonly P.RGB[] | null): void {
  // Lip and body.
  c.rect(4, 2, 8, 1, GLASS[3]);
  c.rect(5, 3, 6, 10, GLASS[1]);
  c.rect(5, 3, 1, 10, GLASS[4]);
  c.rect(10, 3, 1, 10, GLASS[0]);
  // Base.
  c.rect(5, 13, 6, 1, GLASS[0]);
  c.rect(6, 4, 4, 8, GLASS[2]);
  if (fill) {
    c.rect(6, 7, 4, 6, fill[3]);
    c.rect(6, 7, 4, 1, fill[4]);
    c.rect(9, 8, 1, 5, fill[1]);
  }
  // Graduations.
  c.set(6, 5, GLASS[0]);
  c.set(7, 5, GLASS[0]);
  c.set(6, 9, GLASS[0]);
  c.set(7, 9, GLASS[0]);
}

function resin(c: Canvas): void {
  // A faceted amber nugget with a bright glint.
  c.rect(5, 5, 7, 7, AMBER[2]);
  c.rect(4, 6, 9, 5, AMBER[2]);
  c.rect(5, 5, 4, 3, AMBER[3]);
  c.rect(5, 5, 2, 2, AMBER[4]);
  c.rect(9, 9, 4, 2, AMBER[1]);
  c.rect(6, 11, 5, 1, AMBER[0]);
  c.set(6, 6, P.rgb(0xfff2b0));
}

function sugar(c: Canvas): void {
  // A little pile of crystals.
  c.rect(4, 10, 8, 3, SUGAR_W[3]);
  c.rect(5, 8, 6, 3, SUGAR_W[3]);
  c.rect(6, 6, 4, 3, SUGAR_W[4]);
  c.rect(7, 5, 2, 2, SUGAR_W[4]);
  c.rect(4, 12, 8, 1, SUGAR_W[1]);
  c.rect(9, 9, 3, 3, SUGAR_W[2]);
  for (const [x, y] of [[5, 9], [8, 7], [10, 11], [6, 12]] as const) c.set(x, y, SUGAR_W[0]);
  c.set(3, 12, SUGAR_W[2]);
  c.set(12, 12, SUGAR_W[2]);
}

function cookie(c: Canvas): void {
  c.rect(4, 5, 8, 7, CRUST[3]);
  c.rect(3, 6, 10, 5, CRUST[3]);
  c.rect(4, 5, 5, 2, CRUST[4]);
  c.rect(4, 11, 8, 1, CRUST[1]);
  c.rect(11, 8, 2, 3, CRUST[2]);
  // Sugar grains on top.
  for (const [x, y] of [[5, 7], [8, 6], [10, 8], [6, 10], [9, 10]] as const) c.set(x, y, SUGAR_W[4]);
  for (const [x, y] of [[7, 8], [5, 9]] as const) c.set(x, y, CHOC);
}

function bun(c: Canvas): void {
  c.rect(3, 7, 10, 5, CRUST[3]);
  c.rect(4, 5, 8, 3, CRUST[3]);
  c.rect(5, 4, 6, 1, CRUST[3]);
  c.rect(4, 5, 4, 2, CRUST[4]);
  c.rect(3, 11, 10, 1, CRUST[1]);
  c.rect(11, 7, 2, 4, CRUST[2]);
  // A glaze stripe of sugar across the top.
  c.rect(5, 6, 6, 1, SUGAR_W[4]);
  c.set(6, 7, SUGAR_W[3]);
  c.set(9, 7, SUGAR_W[3]);
  c.rect(7, 8, 2, 1, SUGAR_W[3]);
}

function cake(c: Canvas): void {
  // A block of cake under a thick sugar crust.
  c.rect(3, 7, 10, 6, CRUST[2]);
  c.rect(3, 7, 10, 1, CRUST[4]);
  c.rect(3, 12, 10, 1, CRUST[0]);
  c.rect(11, 7, 2, 6, CRUST[1]);
  c.rect(3, 4, 10, 4, SUGAR_W[3]);
  c.rect(3, 4, 10, 1, SUGAR_W[4]);
  // Drips down the sides and a crumb line.
  c.rect(4, 8, 1, 2, SUGAR_W[3]);
  c.rect(8, 8, 2, 1, SUGAR_W[3]);
  c.rect(12, 8, 1, 2, SUGAR_W[2]);
  c.rect(7, 2, 2, 2, AMBER[3]);
  c.set(7, 2, AMBER[4]);
  c.set(5, 10, CRUST[0]);
  c.set(9, 11, CRUST[0]);
}

export const SUGAR_ICONS: PainterSet = {
  item_glass_beaker: icon((c) => beaker(c, null)),
  item_pine_sap: icon((c) => beaker(c, AMBER)),
  item_pine_resin: icon(resin),
  item_sugar: icon(sugar),
  item_sugar_cookie: icon(cookie),
  item_sweet_bun: icon(bun),
  item_sugar_cake: icon(cake),
};
