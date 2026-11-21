/** Icon of the Hand Vacuum Pump (16x16): a bronze cylinder with a T handle, a leather bellows band and a flared nozzle. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const LEATHER = [P.rgb(0x3a2214), P.rgb(0x58361f), P.rgb(0x7a4e2c), P.rgb(0x9a6a3e), P.rgb(0xb98c5c)];

function handVacuum(c: Canvas): void {
  const B = P.BRONZE;
  // T handle on top of the plunger rod.
  c.rect(4, 1, 8, 2, LEATHER[2]);
  c.rect(4, 1, 8, 1, LEATHER[4]);
  c.rect(7, 3, 2, 2, P.STEEL[2]);
  // Cylinder body: lit on the left, shaded on the right.
  c.rect(4, 5, 6, 7, B[3]);
  c.rect(4, 5, 2, 7, B[4]);
  c.rect(9, 5, 1, 7, B[1]);
  c.rect(4, 5, 6, 1, B[4]);
  // Leather bellows band round the middle, stitched.
  c.rect(4, 7, 6, 3, LEATHER[2]);
  c.rect(4, 7, 6, 1, LEATHER[4]);
  c.rect(4, 9, 6, 1, LEATHER[0]);
  for (const x of [5, 7, 9]) c.set(x, 8, LEATHER[0]);
  // Side nozzle flaring out to the right, with a dark mouth.
  c.rect(10, 9, 2, 2, B[2]);
  c.rect(12, 8, 2, 4, B[3]);
  c.rect(12, 8, 2, 1, B[4]);
  c.rect(14, 8, 1, 4, P.GRAPHITE[1]);
  // Foot ring.
  c.rect(3, 12, 8, 2, B[1]);
  c.rect(3, 12, 8, 1, B[3]);
  // Suction streaks.
  c.set(15, 6, P.STEEL[4]);
  c.set(15, 13, P.STEEL[4]);
}

export const GROUND_ICONS: PainterSet = {
  item_hand_vacuum: icon(handVacuum),
};
