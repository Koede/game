/**
 * Icons of the legendary weapons (src/content/legendary.ts): each reads at a glance by its colour and one extra mark - Emberfang's
 * glowing edge, Gale Reed's feathered shaft, Lanternblade's lit core. One 16x16 icon each; the held item uses the same texture.
 */
import type { Canvas, Painter, PainterSet } from './canvas';
import * as P from './palette';
import type { Ramp } from './palette';
import { icon } from './shapes';

/** A blade along the main diagonal from the guard (gx, gy) up to the tip (tx, ty), two pixels wide, lit on its upper left. */
function blade(c: Canvas, gx: number, gy: number, tx: number, ty: number, metal: Ramp, edge: Ramp): void {
  const steps = Math.max(Math.abs(tx - gx), Math.abs(ty - gy));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(gx + ((tx - gx) * i) / steps);
    const y = Math.round(gy + ((ty - gy) * i) / steps);
    c.set(x, y, metal[3]);
    c.set(x + 1, y, metal[1]);
    c.set(x, y + 1, edge[2]);
    if (i === steps) c.set(x, y, edge[4]);
  }
}

/** Crossguard at (gx, gy) and a wood grip with a pommel running down to (hx, hy). */
function hilt(c: Canvas, gx: number, gy: number, hx: number, hy: number, guard: Ramp): void {
  c.line(gx - 2, gy - 2, gx + 2, gy + 2, guard[3]);
  c.line(gx - 2, gy - 1, gx + 1, gy + 2, guard[1]);
  c.line(gx - 1, gy + 1, hx, hy, P.WOOD[2]);
  c.line(gx, gy + 1, hx + 1, hy, P.WOOD[1]);
  c.set(hx, hy, guard[4]);
}

function emberfang(c: Canvas): void {
  blade(c, 5, 10, 13, 2, P.STEEL, P.EMBER);
  for (const [x, y] of [[8, 7], [10, 5], [12, 3]] as const) c.set(x, y, P.EMBER[4]);
  hilt(c, 5, 10, 2, 13, P.BRONZE);
  c.set(14, 1, P.EMBER[3]);
  c.set(11, 2, P.EMBER[2]);
}

function lanternblade(c: Canvas): void {
  blade(c, 5, 10, 11, 4, P.STEEL, P.GOLD);
  c.set(8, 7, P.STARFIRE[4]);
  c.set(9, 6, P.STARFIRE[3]);
  c.set(9, 7, P.STARFIRE[2]);
  hilt(c, 5, 10, 2, 13, P.BRONZE);
  // A little lantern as the pommel: a lit pane in a bronze cage.
  c.rect(1, 12, 3, 3, P.BRONZE[1]);
  c.set(2, 13, P.STARFIRE[4]);
}

function galeReed(c: Canvas): void {
  // A long, pale reed shaft with a narrow leaf head and a wisp of feather below the head.
  c.line(2, 14, 11, 5, P.WOOD[3]);
  c.line(3, 14, 12, 5, P.WOOD[1]);
  c.line(10, 6, 14, 2, P.ALUMINUM[3]);
  c.line(11, 6, 14, 3, P.ALUMINUM[1]);
  c.set(14, 1, P.ALUMINUM[4]);
  c.set(12, 3, P.ALUMINUM[4]);
  c.line(8, 8, 6, 6, P.ICE[3]);
  c.line(9, 9, 7, 11, P.ICE[2]);
  c.set(5, 5, P.ICE[4]);
}

const paint = (fn: Painter): Painter => icon(fn);

export const LEGENDARY_ICONS: PainterSet = {
  item_emberfang: paint(emberfang),
  item_lanternblade: paint(lanternblade),
  item_gale_reed: paint(galeReed),
};
