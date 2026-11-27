/**
 * The Bronze Age air blocks (BRONZE_PLAN 4.4): the tank drum and the compressor casing. The tube is drawn with the other
 * pipes (transport.ts) and the nozzle with the hearth parts (hearthShell.ts).
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, rivet, tone } from './brush';
import * as P from './palette';
import { mix } from './palette';

const B = P.BRONZE;

/** Bronze drum wall: vertical staves with two riveted hoops. */
function tankSide(c: Canvas): void {
  const n = c.noise(4, 4, 5);
  c.each((x, y) => tone([B[0], B[1], B[2], B[2], B[3]], 0.3 + n(x, y) * 0.5 + (x % 4 === 0 ? -0.2 : 0)));
  for (const y of [3, 11]) {
    c.rect(0, y, 16, 2, B[0]);
    c.rect(0, y, 16, 1, B[4]);
    for (let x = 1; x < 16; x += 4) rivet(c, x, y, B[4], B[0]);
  }
  for (let x = 2; x < 16; x += 4) for (let y = 6; y < 10; y++) c.set(x, y, B[3]);
  c.frame(0, 0, 16, 16, B[0]);
}

/** The drum's lid: a round plate with a valve wheel and a pressure port. */
function tankTop(c: Canvas): void {
  c.fill(B[1]);
  c.frame(0, 0, 16, 16, B[0]);
  c.disc(7.5, 7.5, 6.4, B[2]);
  c.ring(7.5, 7.5, 6.2, B[4]);
  c.ring(7.5, 7.5, 3.4, B[0]);
  c.disc(7.5, 7.5, 1.6, P.GLASS[2]);
  c.set(7, 7, P.GLASS[4]);
  for (const [x, y] of [[7, 3], [7, 12], [3, 7], [12, 7]] as const) c.set(x, y, B[4]);
}

/** Compressor casing: riveted bronze with a piston cylinder and a flywheel arc. */
function compressorSide(c: Canvas): void {
  const n = c.noise(4, 4, 9);
  c.each((x, y) => tone([B[0], B[1], B[1], B[2]], 0.2 + n(x, y) * 0.6));
  c.frame(0, 0, 16, 16, B[0]);
  bevel(c, 1, 1, 14, 14, B[3], B[0]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rivet(c, x, y, B[4], B[0]);
  c.rect(3, 6, 10, 4, P.SOOT);
  c.rect(4, 7, 8, 2, mix(P.STEEL[1], P.SOOT, 0.3));
  c.rect(4, 7, 8, 1, P.STEEL[3]);
  c.rect(9, 6, 2, 4, B[3]);
}

function compressorTop(c: Canvas): void {
  c.fill(B[1]);
  c.frame(0, 0, 16, 16, B[0]);
  bevel(c, 1, 1, 14, 14, B[3], B[0]);
  c.disc(7.5, 7.5, 4.4, P.IRON_METAL[1]);
  c.ring(7.5, 7.5, 4.4, P.IRON_METAL[4]);
  c.disc(7.5, 7.5, 1.4, P.IRON_METAL[4]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rivet(c, x, y, B[4], B[0]);
}

export const AIR_TEXTURES: PainterSet = {
  air_tank_side: tankSide,
  air_tank_top: tankTop,
  air_compressor_side: compressorSide,
  air_compressor_top: compressorTop,
};
