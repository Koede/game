/** Icons of the forged swords and spears (src/content/areas/weapons.ts): a blade or point in the metal's ramp on a wooden grip. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import type { Ramp } from '../palette';
import { icon } from '../shapes';

function sword(c: Canvas, m: Ramp): void {
  // Grip and pommel at the lower left, a crossguard, then a blade running to the upper right.
  for (let i = 0; i < 3; i++) { c.set(2 + i, 13 - i, P.WOOD[3]); c.set(3 + i, 13 - i, P.WOOD[1]); }
  c.set(1, 14, m[3]);
  for (const [x, y] of [[4, 9], [5, 10], [6, 11], [5, 8], [6, 9], [7, 10], [3, 10], [4, 11], [5, 12]] as const) c.set(x, y, m[2]);
  for (let i = 0; i < 9; i++) { c.set(6 + i - 1, 9 - i, m[4]); c.set(7 + i - 1, 9 - i, m[3]); c.set(7 + i, 9 - i, m[1]); }
  c.set(14, 1, m[4]);
}

function spear(c: Canvas, m: Ramp): void {
  // A long diagonal shaft with a leaf-shaped head at the upper right.
  for (let i = 0; i < 12; i++) { c.set(1 + i, 14 - i, P.WOOD[3]); c.set(2 + i, 14 - i, P.WOOD[1]); }
  for (const [x, y] of [[11, 4], [12, 3], [13, 2], [12, 4], [11, 3], [13, 3], [12, 2], [14, 1], [10, 4], [11, 5], [12, 5], [10, 3], [13, 4]] as const) c.set(x, y, m[(x + y) % 3 + 2]);
  c.set(14, 1, m[4]);
}

const SETS: Array<[string, Ramp]> = [['bronze', P.BRONZE], ['iron', P.IRON_METAL], ['steel', P.STEEL]];

export default Object.fromEntries(SETS.flatMap(([n, r]) => [
  [`item_${n}_sword`, icon((c) => sword(c, r))],
  [`item_${n}_spear`, icon((c) => spear(c, r))],
])) as PainterSet;
