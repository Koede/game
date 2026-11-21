/** Icons and jar faces of Essentia & Research (src/content/itemsMagic.ts), 16x16, light from the top left. */
import { ASPECTS } from '../../magic/aspects';
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const GLASS = [P.rgb(0x5d7c88), P.rgb(0x86a9b6), P.rgb(0xaed0db), P.rgb(0xd2eaf0), P.rgb(0xf2fbfd)];
const CORK = [P.rgb(0x6b4a25), P.rgb(0x9a7040), P.rgb(0xc49a62)];
const LEATHER = [P.rgb(0x4a2a14), P.rgb(0x6b3d1d), P.rgb(0x8c5528), P.rgb(0xa86a36)];
const PAGE = [P.rgb(0xcfc3a0), P.rgb(0xe8dfc2), P.rgb(0xfaf4e2)];
const WOOD = [P.rgb(0x4e3418), P.rgb(0x74502a), P.rgb(0x9a7040)];
const COPPER = [P.rgb(0x8a4a24), P.rgb(0xc0703a), P.rgb(0xe8a070)];

const hex = (s: string): P.RGB => P.rgb(parseInt(s.slice(1), 16));
const shade = (c: P.RGB, f: number): P.RGB => [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f))];

/** A round-bellied vial with a cork; `fill` colours the liquid. */
function vial(c: Canvas, fill: P.RGB | null): void {
  c.rect(7, 1, 3, 2, CORK[1]);
  c.set(7, 1, CORK[2]);
  c.rect(7, 3, 3, 3, GLASS[2]);
  c.rect(5, 6, 7, 8, GLASS[1]);
  c.rect(4, 7, 9, 6, GLASS[1]);
  c.rect(5, 6, 1, 7, GLASS[4]);
  c.rect(11, 7, 1, 6, GLASS[0]);
  if (fill) {
    c.rect(5, 9, 7, 4, fill);
    c.rect(4, 9, 9, 3, fill);
    c.rect(5, 9, 6, 1, shade(fill, 1.35));
    c.rect(9, 11, 3, 2, shade(fill, 0.7));
    c.set(6, 10, shade(fill, 1.6));
  }
  c.set(6, 7, GLASS[4]);
}

function notebook(c: Canvas): void {
  c.rect(3, 2, 10, 12, LEATHER[2]);
  c.rect(3, 2, 10, 1, LEATHER[3]);
  c.rect(3, 13, 10, 1, LEATHER[0]);
  c.rect(12, 3, 1, 10, PAGE[0]);
  c.rect(4, 3, 1, 10, LEATHER[1]);
  // A strap and a little aspect glyph on the cover.
  c.rect(10, 2, 1, 12, LEATHER[0]);
  c.rect(6, 6, 3, 3, PAGE[1]);
  c.set(7, 7, P.rgb(0xa77fe0));
  c.set(6, 6, PAGE[2]);
}

function rod(c: Canvas): void {
  for (let i = 0; i < 9; i++) {
    c.set(3 + i, 13 - i, WOOD[1]);
    c.set(4 + i, 13 - i, WOOD[2]);
  }
  c.set(3, 13, WOOD[0]);
  // Copper collar and a glass bulb at the tip.
  c.rect(10, 5, 2, 2, COPPER[1]);
  c.set(10, 5, COPPER[2]);
  c.rect(11, 1, 4, 4, GLASS[2]);
  c.rect(12, 2, 2, 2, P.rgb(0xb8c4ff));
  c.set(12, 2, GLASS[4]);
}

function jarSide(c: Canvas): void {
  c.rect(0, 0, 16, 16, GLASS[2], 110);
  c.rect(0, 0, 16, 2, WOOD[1]);
  c.rect(0, 0, 16, 1, WOOD[2]);
  c.rect(1, 2, 1, 13, GLASS[4], 200);
  c.rect(14, 2, 1, 13, GLASS[0], 200);
  c.rect(0, 15, 16, 1, GLASS[0], 220);
  c.rect(3, 4, 1, 8, GLASS[4], 150);
}

function jarTop(c: Canvas): void {
  c.rect(0, 0, 16, 16, WOOD[1]);
  c.rect(1, 1, 14, 14, WOOD[0]);
  c.rect(2, 2, 12, 12, WOOD[2]);
  for (let i = 3; i < 13; i += 3) c.rect(2, i, 12, 1, WOOD[1]);
  c.rect(6, 6, 4, 4, CORK[1]);
  c.rect(6, 6, 4, 1, CORK[2]);
  c.rect(6, 9, 4, 1, CORK[0]);
  c.set(7, 7, GLASS[3]);
}

const vials: PainterSet = Object.fromEntries(ASPECTS.map((a) => [`item_vial_${a.key}`, icon((c) => vial(c, hex(a.color)))]));

export const MAGIC_TEXTURES: PainterSet = {
  item_field_notebook: icon(notebook),
  item_glass_vial: icon((c) => vial(c, null)),
  item_vis_rod: icon(rod),
  ...vials,
  magic_jar_side: jarSide,
  magic_jar_top: jarTop,
};
