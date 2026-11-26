/** Tiles of the cave breadcrumbs (src/content/areas/cave_marks.ts): a chalk arrow-and-cross cutout, and a stone cairn with a glowcap. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb } from '../palette';

const CHALK = rgb(0xf2efe4);
const CHALK_DIM = rgb(0xc9c6b8);
const DUST = [rgb(0xa8a699), rgb(0xe4dccb), rgb(0xd8e0e6)];
const CAP = rgb(0x9cf2f0);

/** Cutout tile that sits on the bottom edge, like the other cross plants: an arrow pointing right over a small cross. */
function chalkMark(c: Canvas): void {
  for (let x = 2; x <= 12; x++) c.set(x, 11, x % 3 === 0 ? CHALK_DIM : CHALK);
  for (let i = 0; i < 4; i++) { c.set(12 - i, 8 + i, CHALK); c.set(12 - i, 14 - i, CHALK); }
  c.set(13, 11, CHALK);
  for (let i = 0; i < 3; i++) { c.set(3 + i, 3 + i, CHALK); c.set(5 - i, 3 + i, CHALK_DIM); }
  c.set(2, 14, CHALK_DIM);
  c.set(9, 5, CHALK_DIM);
  // Thick strokes, so it reads at a glance on a dark floor.
  for (let x = 2; x <= 11; x++) c.set(x, 12, CHALK_DIM);
  for (let i = 0; i < 3; i++) { c.set(6 + i, 1 + i, CHALK); c.set(8 - i, 1 + i, CHALK); }
  c.rect(3, 14, 3, 1, CHALK);
  c.rect(8, 14, 5, 1, CHALK_DIM);
  // Smudged chalk dust round the strokes.
  for (const [x, y, k] of [[1, 11, 0], [14, 11, 1], [4, 10, 2], [10, 9, 0], [13, 13, 1], [6, 13, 2]] as const) c.set(x, y, DUST[k]);
}

function cairn(c: Canvas): void {
  c.fill(P.STONE[2]);
  c.each((x, y) => (c.hash(x, y) < 0.3 ? P.STONE[1] : c.hash(x, y, 1) > 0.85 ? P.STONE[3] : null));
  // Stacked stones, mortared by dark seams.
  for (const y of [5, 10]) for (let x = 0; x < 16; x++) c.set(x, y, P.STONE[0]);
  for (const [x, y0] of [[5, 0], [11, 0], [3, 6], [9, 6], [14, 6], [6, 11], [12, 11]] as const) for (let y = y0; y < y0 + 4 + (y0 === 0 ? 1 : 0); y++) c.set(x, y, P.STONE[0]);
  // The glowcap in the top.
  c.rect(6, 1, 4, 3, CAP);
  c.set(7, 0, CAP);
  c.set(8, 0, CAP);
  c.set(6, 1, rgb(0xe8fffc));
}

export default { chalk_mark: chalkMark, cave_cairn: cairn } satisfies PainterSet;
