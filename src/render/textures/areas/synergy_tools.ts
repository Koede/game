/**
 * Tiles of the tool-and-block synergy pass (docs/SYNERGY_TOOLS.md): stripped logs, pillars, a lintel, the chimney,
 * and the two bronze plate blocks. Small and honest: a few ramps, no tricks.
 */
import type { Canvas, PainterSet } from '../canvas';
import { tone } from '../brush';
import * as P from '../palette';
import { shade, type Ramp } from '../palette';

function stripped(c: Canvas, ramp: Ramp): void {
  const grain = c.noise(1, 8, 2);
  c.each((x, y) => shade(tone(ramp, 0.35 + grain(x, y) * 0.4 + (x % 5 === 0 ? -0.12 : 0)), (c.hash(x, y, 9) - 0.5) * 0.16));
}

/** A column of stacked courses with a darker joint at each end and a lit left edge. */
function pillar(c: Canvas, ramp: Ramp): void {
  const n = c.noise(4, 4, 3);
  c.each((x, y) => tone(ramp, 0.4 + n(x, y) * 0.3));
  c.rect(0, 0, 16, 2, ramp[3]);
  c.rect(0, 2, 16, 1, ramp[0]);
  c.rect(0, 13, 16, 1, ramp[0]);
  c.rect(0, 14, 16, 2, ramp[3]);
  c.rect(0, 3, 1, 10, ramp[4]);
  c.rect(15, 3, 1, 10, ramp[1]);
  c.rect(7, 3, 2, 10, ramp[2]);
}

function lintel(c: Canvas): void {
  const r = P.BRICK;
  c.each((x, y) => shade(r[2], (c.hash(x, y, 4) - 0.5) * 0.14));
  c.rect(0, 0, 16, 1, r[4]);
  c.rect(0, 15, 16, 1, r[0]);
  for (let x = 3; x < 16; x += 4) c.rect(x, 1, 1, 14, r[1]);
  c.rect(0, 7, 16, 1, r[1]);
}

function chimneySide(c: Canvas): void {
  const r = P.BRICK;
  const n = c.noise(4, 4, 5);
  c.each((x, y) => tone(r, 0.3 + n(x, y) * 0.35));
  for (let y = 0; y < 16; y += 4) c.rect(0, y, 16, 1, r[0]);
  for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) c.rect(x, y + 1, 1, 3, r[0]);
  c.rect(0, 0, 16, 3, P.BRICK[3]); // the sooty cap band
  c.rect(0, 0, 16, 1, P.BRICK[4]);
}

function chimneyTop(c: Canvas): void {
  c.fill(P.BRICK[2]);
  c.rect(0, 0, 16, 2, P.BRICK[4]);
  c.rect(0, 14, 16, 2, P.BRICK[1]);
  c.rect(4, 4, 8, 8, P.GRAPHITE[0]);
  c.rect(5, 5, 6, 6, P.GRAPHITE[1]);
  c.rect(6, 6, 4, 4, P.GRAPHITE[2]);
}

function bronzePlate(c: Canvas): void {
  const r = P.BRONZE;
  const n = c.noise(4, 4, 7);
  c.each((x, y) => tone(r, 0.35 + n(x, y) * 0.3));
  c.rect(0, 0, 16, 1, r[4]);
  c.rect(0, 15, 16, 1, r[0]);
  c.rect(0, 0, 1, 16, r[3]);
  c.rect(15, 0, 1, 16, r[1]);
  c.rect(8, 1, 1, 14, r[1]); // the seam between two plates
}

function rivetPlate(c: Canvas): void {
  bronzePlate(c);
  const r = P.BRONZE;
  for (const [x, y] of [[2, 2], [5, 2], [11, 2], [14, 2], [2, 13], [5, 13], [11, 13], [14, 13], [2, 7], [14, 7]] as const) {
    c.set(x, y, r[4]);
    c.set(x + 1, y + 1, r[0]);
  }
}

export default {
  stripped_oak_side: (c) => stripped(c, P.WOOD),
  stripped_pine_side: (c) => stripped(c, [P.PINE_BARK[3], P.WOOD[1], P.WOOD[2], P.WOOD[3], P.WOOD[4]] as unknown as Ramp),
  pillar_stone_side: (c) => pillar(c, P.STONE),
  pillar_brick_side: (c) => pillar(c, P.BRICK),
  lintel_side: lintel,
  chimney_side: chimneySide,
  chimney_top: chimneyTop,
  bronze_plate_block: bronzePlate,
  rivet_plate_block: rivetPlate,
} satisfies PainterSet;
