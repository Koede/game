/** Icon of berry ice (src/content/areas/farm_ice.ts): a bowl of crushed ice with berries. */
import type { Canvas, PainterSet } from '../canvas';
import { rgb } from '../palette';
import { icon } from '../shapes';

const ICE = [rgb(0x7fa4b8), rgb(0xa8cfe0), rgb(0xcfe9f4), rgb(0xe8f6fb), rgb(0xffffff)];
const BERRY = [rgb(0x2a1840), rgb(0x44286a), rgb(0x6a3f98)];
const BOWL = [rgb(0x5a4030), rgb(0x84603f), rgb(0xa8845a)];

function berryIce(c: Canvas): void {
  c.rect(3, 9, 10, 4, BOWL[1]);
  c.rect(4, 13, 8, 1, BOWL[0]);
  c.rect(3, 9, 10, 1, BOWL[2]);
  for (const [x, y, r] of [[5, 7, 2.6], [8, 6, 3], [11, 7.5, 2.4]] as const) c.disc(x, y, r, ICE[2]);
  c.disc(7, 5.5, 1.5, ICE[3]);
  c.set(6, 6, ICE[4]);
  for (const [x, y] of [[5, 8], [9, 7], [11, 8]] as const) {
    c.disc(x, y, 1, BERRY[1]);
    c.set(x, y - 1, BERRY[2]);
  }
}

export default { item_berry_ice: icon(berryIce) } satisfies PainterSet;
