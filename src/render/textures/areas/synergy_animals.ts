/** Icons and the bedding tile of the goat milk and wool pass (src/content/areas/synergy_animals.ts). */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { shade } from '../palette';
import { icon } from '../shapes';

const GLASS = [P.rgb(0x5d7c88), P.rgb(0x86a9b6), P.rgb(0xaed0db), P.rgb(0xd2eaf0), P.rgb(0xf2fbfd)];
const MILK = [P.rgb(0xb9b2a0), P.rgb(0xd7d1c0), P.rgb(0xece7d8), P.rgb(0xf8f4ea), P.rgb(0xffffff)];
const WOOL = [P.rgb(0x8f8672), P.rgb(0xb4ab95), P.rgb(0xd3cab5), P.rgb(0xe8e1cf), P.rgb(0xf7f2e4)];
const PILLOW = [P.rgb(0xb9b2a0), P.rgb(0xd7d1c0), P.rgb(0xe9e4d6), P.rgb(0xf4f0e6), P.rgb(0xfffdf6)];
const BLANKET = [P.rgb(0x5e1f1d), P.rgb(0x7d2a26), P.rgb(0x9a3b32), P.rgb(0xb4503f), P.rgb(0xcc6a55)];
const CHEESE = [P.rgb(0xa9843a), P.rgb(0xcfa84e), P.rgb(0xe9c56a), P.rgb(0xf6dc8c), P.rgb(0xfff0b0)];
const BUTTER = [P.rgb(0xc9a02a), P.rgb(0xe8bf3c), P.rgb(0xf5d864), P.rgb(0xfbe98e), P.rgb(0xfff6c0)];
const TEA = [P.rgb(0x8a7a52), P.rgb(0xb09f72), P.rgb(0xd0c096), P.rgb(0xe0d2ac), P.rgb(0xf0e6c6)];
const COFFEE = [P.rgb(0x6b4a2c), P.rgb(0x8e6a42), P.rgb(0xb08a5e), P.rgb(0xc9a678), P.rgb(0xe0c49a)];

function beakerOfMilk(c: Canvas): void {
  c.rect(4, 2, 8, 1, GLASS[3]);
  c.rect(5, 3, 6, 10, GLASS[1]);
  c.rect(5, 3, 1, 10, GLASS[4]);
  c.rect(10, 3, 1, 10, GLASS[0]);
  c.rect(5, 13, 6, 1, GLASS[0]);
  c.rect(6, 4, 4, 8, GLASS[2]);
  c.rect(6, 6, 4, 7, MILK[3]);
  c.rect(6, 6, 4, 1, MILK[4]);
  c.rect(9, 7, 1, 6, MILK[1]);
}

function pailOfMilk(c: Canvas): void {
  c.rect(3, 5, 10, 9, P.WOOD[2]);
  c.rect(3, 5, 10, 1, P.WOOD[4]);
  c.rect(3, 5, 1, 9, P.WOOD[3]);
  c.rect(12, 5, 1, 9, P.WOOD[0]);
  for (const y of [8, 12]) c.rect(3, y, 10, 1, P.BRONZE[3]);
  c.rect(4, 5, 8, 2, MILK[3]);
  c.rect(4, 5, 8, 1, MILK[4]);
  c.rect(5, 3, 1, 3, P.BRONZE[2]);
  c.rect(10, 3, 1, 3, P.BRONZE[2]);
  c.rect(5, 2, 6, 1, P.BRONZE[3]);
}

function wool(c: Canvas): void {
  for (const [x, y, r] of [[5, 6, 3], [9, 6, 3], [7, 9, 3.4], [11, 10, 2.6], [4, 10, 2.6]] as const) c.disc(x, y, r, WOOL[3]);
  for (const [x, y] of [[4, 5], [8, 5], [6, 8], [10, 9]] as const) c.disc(x, y, 1.4, WOOL[4]);
  for (const [x, y] of [[6, 12], [9, 12], [12, 11]] as const) c.set(x, y, WOOL[1]);
  c.rect(5, 13, 6, 1, WOOL[0]);
}

function shears(c: Canvas): void {
  c.line(4, 12, 11, 3, P.BRONZE[4]);
  c.line(5, 12, 12, 3, P.BRONZE[3]);
  c.line(11, 12, 4, 3, P.BRONZE[3]);
  c.line(12, 12, 5, 3, P.BRONZE[2]);
  c.disc(3, 13, 2, P.WOOD[2]);
  c.disc(12, 13, 2, P.WOOD[2]);
  c.set(7, 8, P.BRONZE[0]);
  c.set(8, 8, P.BRONZE[0]);
}

function cheese(c: Canvas): void {
  c.rect(2, 8, 12, 5, CHEESE[2]);
  c.rect(3, 6, 10, 3, CHEESE[3]);
  c.rect(4, 5, 7, 1, CHEESE[4]);
  c.rect(2, 12, 12, 1, CHEESE[0]);
  c.rect(11, 8, 3, 5, CHEESE[1]);
  for (const [x, y] of [[5, 9], [8, 11], [10, 7]] as const) c.rect(x, y, 2, 1, CHEESE[0]);
}

function butter(c: Canvas): void {
  c.rect(3, 8, 10, 5, BUTTER[2]);
  c.rect(3, 6, 8, 3, BUTTER[3]);
  c.rect(4, 5, 6, 1, BUTTER[4]);
  c.rect(11, 6, 2, 7, BUTTER[1]);
  c.rect(3, 12, 10, 1, BUTTER[0]);
  c.line(5, 8, 9, 8, BUTTER[1]);
}

function cup(c: Canvas, liquid: readonly P.RGB[]): void {
  c.rect(4, 6, 8, 7, P.FIRED_CLAY[2]);
  c.rect(4, 6, 1, 7, P.FIRED_CLAY[3]);
  c.rect(11, 6, 1, 7, P.FIRED_CLAY[0]);
  c.rect(4, 13, 8, 1, P.FIRED_CLAY[0]);
  c.rect(5, 6, 6, 2, liquid[3]);
  c.rect(5, 6, 6, 1, liquid[4]);
  c.rect(12, 8, 2, 3, P.FIRED_CLAY[1]);
  c.set(7, 4, MILK[2]);
  c.set(9, 3, MILK[2]);
}

/** The bed's inventory and break-particle tile, seen from above: a cream pillow at the top, a red blanket, a plank border. */
function beddingTile(c: Canvas): void {
  c.each((x, y) => {
    if (x < 1 || x > 14 || y > 14) return shade(P.WOOD[1], (c.hash(x, y, 4) - 0.5) * 0.14);
    if (y < 5) return shade(PILLOW[3], (c.hash(x, y, 5) - 0.5) * 0.08);
    if (y === 5) return shade(BLANKET[1], -0.2);
    return shade(BLANKET[2], (c.hash(x, y, 6) - 0.5) * 0.1 + (x % 4 === 0 ? 0.06 : 0));
  });
}

/** The bed's model materials (src/world/bedModel.ts): planks for the frame, a cream ticking mattress, a red blanket, a linen pillow. */
function bedFrame(c: Canvas): void {
  c.each((x, y) => shade(P.WOOD[2], (c.hash(x, 0, 41) - 0.5) * 0.3 + (c.hash(x, y, 42) - 0.5) * 0.08 + (y % 8 === 3 ? -0.08 : 0)));
}
function bedMattress(c: Canvas): void {
  c.each((x, y) => {
    const base = x % 4 < 2 ? P.rgb(0xc4bca4) : P.rgb(0xe8e2cf);
    return shade(base, (c.hash(x, y, 51) - 0.5) * 0.07 + (y === 0 ? -0.1 : 0));
  });
}
function bedBlanket(c: Canvas): void {
  c.each((x, y) => {
    const base = x % 4 === 0 ? P.rgb(0xb4503f) : P.rgb(0x9a3b32);
    const edge = y < 1 || y > 14 ? -0.14 : 0;
    return shade(base, edge + (c.hash(x, y, 61) - 0.5) * 0.08);
  });
}
function bedPillow(c: Canvas): void {
  c.each((x, y) => {
    const d = Math.hypot((x - 7.5) / 7, (y - 7.5) / 6);
    return shade(d < 0.7 ? PILLOW[3] : PILLOW[2], -0.22 * Math.max(0, d - 0.7) + (c.hash(x, y, 71) - 0.5) * 0.05 - (y === 15 ? 0.14 : 0));
  });
}

export default {
  bed_frame: bedFrame,
  bed_mattress: bedMattress,
  bed_blanket: bedBlanket,
  bed_pillow: bedPillow,
  item_milk_pail: icon(pailOfMilk),
  item_milk_beaker: icon(beakerOfMilk),
  item_wool: icon(wool),
  item_shears: icon(shears),
  item_cheese: icon(cheese),
  item_butter: icon(butter),
  item_milk_tea: icon((c) => cup(c, TEA)),
  item_milk_coffee: icon((c) => cup(c, COFFEE)),
  wool_bedding: beddingTile,
} satisfies PainterSet;
