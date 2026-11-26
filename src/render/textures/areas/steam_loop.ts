/** Textures of the small steam loop (src/content/areas/steam_loop.ts): the steam kettle, boiler plate and the safety valve. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb } from '../palette';

const STEAM = rgb(0xdfe6e8);
const STEAM_FAINT = rgb(0xb4c0c6);
const GLASS = rgb(0x9fd2dc);

/** A riveted copper drum x 3..12, y 5..15 with a sight glass whose level shows the water, a spout left and a pipe on top. */
function kettle(c: Canvas, hot: boolean): void {
  const k = P.COPPER;
  for (let y = 5; y <= 15; y++) {
    const inset = y === 5 || y === 15 ? 1 : 0;
    for (let x = 3 + inset; x <= 12 - inset; x++) c.set(x, y, x < 6 ? k[3] : x > 10 ? k[1] : k[2]);
  }
  for (const y of [7, 13]) c.rect(3, y, 10, 1, k[0]);
  for (const [x, y] of [[4, 6], [7, 6], [11, 6], [4, 14], [7, 14], [11, 14]] as const) c.set(x, y, k[4]);
  c.rect(7, 8, 2, 5, P.IRON_METAL[1]);
  c.rect(8, 9, 1, 4, hot ? STEAM : GLASS);
  c.rect(7, 3, 2, 2, P.BRONZE[3]);
  c.line(3, 9, 1, 7, k[2]);
  c.set(1, 7, k[4]);
  if (!hot) return;
  for (const [x, y, bright] of [[1, 5, true], [0, 3, false], [7, 2, true], [8, 0, false], [9, 1, true]] as const) c.set(x, y, bright ? STEAM : STEAM_FAINT);
  c.rect(5, 15, 6, 1, P.EMBER[3]);
}

function boilerPlate(c: Canvas): void {
  const b = P.BRONZE;
  const n = c.noise(4, 4, 11);
  c.each((x, y) => P.shade(b[2], (n(x, y) - 0.5) * 0.12));
  c.rect(0, 0, 16, 1, b[4]);
  c.rect(0, 0, 1, 16, b[3]);
  c.rect(0, 15, 16, 1, b[0]);
  c.rect(15, 0, 1, 16, b[0]);
  c.rect(0, 7, 16, 2, b[1]);
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13], [2, 7], [13, 7]] as const) c.set(x, y, b[4]);
}

function valveSide(c: Canvas): void {
  boilerPlate(c);
  c.rect(6, 3, 4, 9, P.IRON_METAL[2]);
  c.rect(6, 3, 1, 9, P.IRON_METAL[3]);
  c.rect(5, 2, 6, 2, P.BRONZE[4]);
  c.rect(5, 11, 6, 2, P.BRONZE[4]);
  c.rect(7, 6, 2, 3, P.COPPER[3]);
}

function valveTop(c: Canvas): void {
  boilerPlate(c);
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d < 2) return P.IRON_METAL[0];
    if (d < 4.5) return P.IRON_METAL[2];
    if (d < 5.5) return P.BRONZE[4];
    return null;
  });
}

function gaugeGlass(c: Canvas): void {
  boilerPlate(c);
  c.rect(4, 3, 8, 10, P.IRON_METAL[1]);
  c.rect(5, 4, 6, 8, GLASS);
  c.rect(5, 8, 6, 4, P.WATER[3]);
  c.rect(5, 8, 6, 1, P.WATER[4]);
  c.line(8, 6, 10, 4, P.EMBER[3]);
}

function portTile(mark: (c: Canvas) => void): (c: Canvas) => void {
  return (c) => { boilerPlate(c); c.rect(4, 4, 8, 8, P.IRON_METAL[1]); c.rect(5, 5, 6, 6, P.IRON_METAL[2]); mark(c); };
}

function steamPipe(c: Canvas): void {
  const b = P.BRONZE;
  c.fill(P.IRON_METAL[0]);
  c.rect(0, 5, 16, 6, b[2]);
  c.rect(0, 5, 16, 1, b[4]);
  c.rect(0, 10, 16, 1, b[0]);
  c.rect(5, 0, 6, 16, b[2]);
  c.rect(5, 0, 1, 16, b[4]);
  c.rect(10, 0, 1, 16, b[0]);
  c.rect(5, 5, 6, 6, b[3]);
  for (const [x, y] of [[6, 6], [9, 6], [6, 9], [9, 9]] as const) c.set(x, y, b[4]);
}

function steamTank(c: Canvas): void {
  const b = P.BRONZE;
  c.fill(b[1]);
  c.rect(0, 0, 16, 2, b[3]);
  c.rect(0, 14, 16, 2, b[0]);
  for (const y of [5, 10]) { c.rect(0, y, 16, 1, b[4]); c.rect(0, y + 1, 16, 1, b[0]); }
  for (const [x, y] of [[2, 3], [13, 3], [2, 8], [13, 8], [2, 12], [13, 12]] as const) c.set(x, y, b[4]);
  c.rect(7, 4, 2, 8, P.IRON_METAL[2]);
}

export default {
  steam_tank: steamTank,
  heat_port: portTile((c) => { c.rect(7, 6, 2, 4, P.EMBER[3]); c.rect(6, 7, 4, 2, P.EMBER[2]); }),
  water_port: portTile((c) => { c.rect(6, 6, 4, 4, P.WATER[3]); c.rect(7, 7, 2, 2, P.WATER[4]); }),
  steam_port: portTile((c) => { c.rect(6, 6, 4, 4, STEAM); c.rect(7, 7, 2, 2, STEAM_FAINT); }),
  steam_pipe: steamPipe,
  boiler_gauge_glass: gaugeGlass,
  steam_kettle: (c) => kettle(c, false),
  steam_kettle_on: (c) => kettle(c, true),
  boiler_plate: boilerPlate,
  safety_valve: valveSide,
  safety_valve_top: valveTop,
} satisfies PainterSet;
