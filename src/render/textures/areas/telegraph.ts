/**
 * The telegraph and radio blocks (src/content/areas/telegraph.ts): a tarred pole with a copper ground strap, the office's desk
 * front with its sounder and key (the sounder's lamp lit while it is busy), and the radio mast's steel lattice (its spark
 * gap blue while it is on air).
 */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { shade } from '../palette';

const TAR = P.rgb(0x3b2a1e);

function pole(c: Canvas): void {
  const n = c.noise(2, 6, 3);
  c.each((x, y) => shade(TAR, -0.15 + n(x, y) * 0.3 + (x % 5 === 0 ? -0.1 : 0) + (c.hash(x, y, 4) > 0.9 ? 0.12 : 0)));
  // A thin copper ground strap down one side.
  c.rect(12, 0, 1, 16, P.COPPER[1]);
}

function officeFront(on: boolean) {
  return (c: Canvas): void => {
    // Plank backing, a desk top, a brass sounder on the left and the key on the right.
    c.rect(0, 0, 16, 16, P.WOOD[2]);
    for (let y = 3; y < 16; y += 4) c.rect(0, y, 16, 1, P.WOOD[1]);
    c.rect(0, 9, 16, 2, P.WOOD[4]);
    c.rect(0, 11, 16, 1, P.WOOD[0]);
    // The sounder: two coils on a base and the armature.
    c.rect(2, 5, 6, 4, P.BRONZE[1]);
    c.rect(3, 3, 2, 4, P.COPPER[2]);
    c.rect(6, 3, 2, 4, P.COPPER[2]);
    c.rect(2, 2, 7, 1, P.BRONZE[4]);
    // The key: a lever with a black knob.
    c.rect(10, 7, 5, 2, P.BRONZE[2]);
    c.rect(10, 7, 5, 1, P.BRONZE[4]);
    c.disc(13.5, 6, 1.4, P.SOOT);
    // The line lamp above the key.
    c.disc(12, 2.5, 1.5, on ? P.EMBER[4] : P.SOOT);
    if (on) c.set(12, 2, [255, 255, 230]);
    // A paper tape running off the desk.
    c.rect(4, 12, 9, 2, P.rgb(0xf1e6c8));
    for (let x = 5; x < 12; x += 2) c.set(x, 13, P.SOOT);
  };
}

function mast(on: boolean) {
  return (c: Canvas): void => {
    c.fill(shade(P.STEEL[0], -0.45));
    // Two uprights with diagonal lattice between them.
    c.rect(1, 0, 2, 16, P.STEEL[1]);
    c.rect(13, 0, 2, 16, P.STEEL[1]);
    c.rect(1, 0, 1, 16, P.STEEL[3]);
    for (let y = 0; y < 16; y += 8) {
      c.line(3, y, 12, y + 7, P.STEEL[2]);
      c.line(12, y, 3, y + 7, P.STEEL[2]);
      c.rect(1, y, 14, 1, P.STEEL[2]);
    }
    // The spark-gap insulator in the middle.
    c.disc(7.5, 7.5, 2.2, P.CERAMIC[2]);
    c.disc(7.5, 7.5, 1.1, on ? P.ARC_GLOW[2] : P.GRAPHITE[2]);
    if (on) c.set(7, 7, P.ARC_GLOW[4]);
  };
}

export default {
  telegraph_pole: pole,
  telegraph_office_front: officeFront(false),
  telegraph_office_front_on: officeFront(true),
  radio_mast: mast(false),
  radio_mast_on: mast(true),
} satisfies PainterSet;
