/** Icons of fishing (src/content/areas/world_fishing.ts): the rod, four raw fish and their cooked dishes. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb, type RGB } from '../palette';
import { icon } from '../shapes';

const PERCH = [rgb(0x3d4f2a), rgb(0x5d7a3a), rgb(0x86a24c), rgb(0xb9c870), rgb(0xe3ebb0)];
const TROUT = [rgb(0x4a4a58), rgb(0x6d7384), rgb(0x95a0b0), rgb(0xc3ccd6), rgb(0xecf0f4)];
const EEL = [rgb(0x1d2a2a), rgb(0x2e4440), rgb(0x44625a), rgb(0x66857a), rgb(0x92b0a2)];
const GLOW = [rgb(0x2d5a66), rgb(0x4a8f9a), rgb(0x7fd0cf), rgb(0xb5f1e6), rgb(0xe8fff8)];
const COOKED = [rgb(0x6b3d1e), rgb(0x935a2b), rgb(0xb87a3a), rgb(0xd69c52), rgb(0xf0c27a)];

/** A side-on fish: body ellipse, forked tail, an eye; `r` is the colour ramp. */
function fish(c: Canvas, r: readonly RGB[], long = false): void {
  const w = long ? 6.5 : 5;
  const h = long ? 2 : 3.2;
  c.each((x, y) => {
    const dx = (x - 7.5) / w;
    const dy = (y - 8) / h;
    const d = dx * dx + dy * dy;
    if (d > 1) return null;
    return dy < -0.3 ? r[3] : dy > 0.4 ? r[4] : r[2];
  });
  c.line(12 + (long ? 1 : 0), 8, 14, 5, r[1]);
  c.line(12 + (long ? 1 : 0), 8, 14, 11, r[1]);
  c.set(4, 7, r[0]);
  c.line(6, 6, 6, 10, r[1]);
}

function rod(c: Canvas): void {
  c.line(3, 13, 12, 2, P.WOOD[3]);
  c.line(4, 13, 13, 2, P.WOOD[2]);
  c.line(12, 3, 13, 9, P.STRAW[4]);
  c.set(13, 10, P.IRON[4]);
  c.set(12, 10, P.IRON[3]);
  c.set(3, 13, P.WOOD[0]);
}

const cooked = (c: Canvas): void => fish(c, COOKED);

export default {
  item_fishing_rod: icon(rod),
  item_raw_perch: icon((c) => fish(c, PERCH)),
  item_raw_trout: icon((c) => fish(c, TROUT)),
  item_raw_eel: icon((c) => fish(c, EEL, true)),
  item_raw_glowfin: icon((c) => fish(c, GLOW)),
  item_cooked_perch: icon(cooked),
  item_cooked_trout: icon((c) => { fish(c, COOKED); c.set(7, 7, P.WOOD[0]); c.set(9, 9, P.WOOD[0]); }),
  item_cooked_eel: icon((c) => { fish(c, [COOKED[0], COOKED[0], COOKED[1], COOKED[2], COOKED[3]], true); }),
  item_cooked_glowfin: icon((c) => { fish(c, COOKED); c.set(8, 7, GLOW[3]); c.set(9, 8, GLOW[2]); }),
} satisfies PainterSet;
