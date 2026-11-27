/** Icons of hen eggs (src/content/areas/farm_eggs.ts): a brown egg and a fried egg. */
import type { Canvas, PainterSet } from '../canvas';
import { rgb } from '../palette';
import { icon } from '../shapes';

const SHELL = [rgb(0x7a5230), rgb(0xa8743f), rgb(0xcf9a5c), rgb(0xe8bd84), rgb(0xf8dcb0)];
const WHITE = [rgb(0xb8b2a2), rgb(0xd9d4c6), rgb(0xf0ecdf), rgb(0xfbf8ee), rgb(0xffffff)];
const YOLK = [rgb(0xb8741a), rgb(0xe09a22), rgb(0xf5b73a), rgb(0xffd25e), rgb(0xfff0a0)];
const PAN = [rgb(0x2a2a30), rgb(0x44444c), rgb(0x666670), rgb(0x8a8a94), rgb(0xb4b4bc)];

function egg(c: Canvas): void {
  c.each((x, y) => {
    const dx = (x - 7.5) / (y < 8 ? 3.2 : 3.8);
    const dy = (y - 8.5) / 5;
    if (dx * dx + dy * dy > 1) return null;
    return dx < -0.4 ? SHELL[3] : dx > 0.4 ? SHELL[1] : SHELL[2];
  });
  c.set(6, 5, SHELL[4]);
  c.set(6, 6, SHELL[4]);
}

function friedEgg(c: Canvas): void {
  c.disc(7.5, 9, 6.2, PAN[1]);
  c.disc(7.5, 9, 5.4, PAN[2]);
  c.line(13, 12, 15, 15, PAN[0]);
  c.disc(7.5, 8.5, 4.2, WHITE[3]);
  c.disc(10, 10, 2.2, WHITE[3]);
  c.disc(7, 8, 2, YOLK[2]);
  c.set(6, 7, YOLK[4]);
  c.set(8, 9, YOLK[0]);
}

export default {
  item_egg: icon(egg),
  item_fried_egg: icon(friedEgg),
} satisfies PainterSet;
