/** Icons and furnace-top faces of the glassware (src/content/itemsGlass.ts): water and sap in beakers and vials. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const GLASS = [P.rgb(0x5d7c88), P.rgb(0x86a9b6), P.rgb(0xaed0db), P.rgb(0xd2eaf0), P.rgb(0xf2fbfd)];
const WATER = [P.rgb(0x1f4f8a), P.rgb(0x2c6cb0), P.rgb(0x3f8fd8), P.rgb(0x6fb2ee), P.rgb(0xb4dcff)];
const HOT = [P.rgb(0x2f6fa8), P.rgb(0x4a8fca), P.rgb(0x78b8e8), P.rgb(0xb8e0ff), P.rgb(0xffffff)];
const SAP = [P.rgb(0x8a6a2a), P.rgb(0xb08c3c), P.rgb(0xd4b45c), P.rgb(0xecd48a), P.rgb(0xfff2c4)];
const AMBER = [P.rgb(0x6a3a0c), P.rgb(0x95560f), P.rgb(0xc07a18), P.rgb(0xe3a02c), P.rgb(0xf6cb5c)];
const CORK = [P.rgb(0x6b4a25), P.rgb(0x9a7040), P.rgb(0xc49a62)];

function beaker(c: Canvas, fill: readonly P.RGB[], bubbles: boolean): void {
  c.rect(4, 2, 8, 1, GLASS[3]);
  c.rect(5, 3, 6, 10, GLASS[1]);
  c.rect(5, 3, 1, 10, GLASS[4]);
  c.rect(10, 3, 1, 10, GLASS[0]);
  c.rect(5, 13, 6, 1, GLASS[0]);
  c.rect(6, 6, 4, 7, fill[2]);
  c.rect(6, 6, 4, 1, fill[4]);
  c.rect(9, 7, 1, 6, fill[1]);
  if (bubbles) {
    c.set(7, 8, fill[4]);
    c.set(8, 10, fill[4]);
    c.set(7, 4, fill[3]);
    c.set(8, 3, fill[4]);
  }
}

function vial(c: Canvas, fill: readonly P.RGB[], bubbles: boolean): void {
  c.rect(7, 1, 3, 2, CORK[1]);
  c.set(7, 1, CORK[2]);
  c.rect(7, 3, 3, 3, GLASS[2]);
  c.rect(5, 6, 7, 8, GLASS[1]);
  c.rect(4, 7, 9, 6, GLASS[1]);
  c.rect(5, 6, 1, 7, GLASS[4]);
  c.rect(11, 7, 1, 6, GLASS[0]);
  c.rect(5, 9, 6, 4, fill[2]);
  c.rect(5, 9, 6, 1, fill[4]);
  c.rect(9, 10, 2, 3, fill[1]);
  if (bubbles) {
    c.set(7, 11, fill[4]);
    c.set(8, 4, fill[3]);
  }
}

/** A furnace-top face: hot iron plate below, the glass standing on it. */
function onTop(c: Canvas, draw: (c: Canvas) => void, glow: boolean): void {
  c.rect(0, 14, 16, 2, glow ? P.rgb(0x8a3a18) : P.rgb(0x3a3430));
  c.rect(0, 14, 16, 1, glow ? P.rgb(0xd86a28) : P.rgb(0x5a524a));
  draw(c);
}

export const GLASS_TEXTURES: PainterSet = {
  item_water_beaker: icon((c) => beaker(c, WATER, false)),
  item_boiling_beaker: icon((c) => beaker(c, HOT, true)),
  item_water_vial: icon((c) => vial(c, WATER, false)),
  item_boiling_vial: icon((c) => vial(c, HOT, true)),
  furnace_beaker: (c) => onTop(c, (k) => beaker(k, WATER, false), false),
  furnace_beaker_boiling: (c) => onTop(c, (k) => beaker(k, HOT, true), true),
  furnace_vial: (c) => onTop(c, (k) => vial(k, WATER, false), false),
  furnace_vial_boiling: (c) => onTop(c, (k) => vial(k, HOT, true), true),
  furnace_sap: (c) => onTop(c, (k) => beaker(k, SAP, false), false),
  furnace_sap_resin: (c) => onTop(c, (k) => beaker(k, AMBER, true), true),
};
