/** Icons of fishing (src/content/areas/world_fishing.ts): the rod, nine fish, their cooked dishes, a chowder and a broth. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb, type RGB } from '../palette';
import { icon } from '../shapes';

const PERCH = [rgb(0x3d4f2a), rgb(0x5d7a3a), rgb(0x86a24c), rgb(0xb9c870), rgb(0xe3ebb0)];
const TROUT = [rgb(0x4a4a58), rgb(0x6d7384), rgb(0x95a0b0), rgb(0xc3ccd6), rgb(0xecf0f4)];
const EEL = [rgb(0x1d2a2a), rgb(0x2e4440), rgb(0x44625a), rgb(0x66857a), rgb(0x92b0a2)];
const GLOW = [rgb(0x2d5a66), rgb(0x4a8f9a), rgb(0x7fd0cf), rgb(0xb5f1e6), rgb(0xe8fff8)];
const SALMON = [rgb(0x5a3a3a), rgb(0x8a5a55), rgb(0xc77a6a), rgb(0xe8a08a), rgb(0xf6d2c0)];
const PIKE = [rgb(0x2f3d22), rgb(0x4d6130), rgb(0x728a3e), rgb(0xa3b663), rgb(0xd5dea0)];
const CARP = [rgb(0x5a4420), rgb(0x8a6a2e), rgb(0xb8903e), rgb(0xd8b866), rgb(0xf0e0a6)];
const WHITE = [rgb(0x6a7480), rgb(0x9aa5b0), rgb(0xc8d2da), rgb(0xe6edf2), rgb(0xffffff)];
const CRAY = [rgb(0x4a2a1e), rgb(0x7a3a28), rgb(0xa8503a), rgb(0xc87858), rgb(0xe8a888)];
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

/** A little crayfish: oval body, two claws, a fanned tail. */
function crayfish(c: Canvas, r: readonly RGB[]): void {
  c.each((x, y) => {
    const dx = (x - 8) / 3;
    const dy = (y - 9) / 4;
    return dx * dx + dy * dy <= 1 ? (dy < 0 ? r[3] : r[2]) : null;
  });
  c.line(5, 6, 4, 3, r[1]);
  c.line(11, 6, 12, 3, r[1]);
  c.line(7, 13, 9, 13, r[1]);
  c.set(7, 7, r[0]);
  c.set(9, 7, r[0]);
}

/** A bowl of something hot: rim, a filled top in `food`, a steam wisp. */
function bowl(c: Canvas, ramp: readonly RGB[], food: RGB): void {
  c.each((x, y) => {
    if (y < 8 || y > 12) return null;
    const half = 6 - (y - 8) * 0.7;
    if (Math.abs(x - 7.5) > half) return null;
    return y === 8 ? food : ramp[y > 10 ? 1 : 0];
  });
  c.line(5, 5, 6, 3, ramp[0]);
  c.line(9, 5, 10, 3, ramp[0]);
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
  item_raw_salmon: icon((c) => fish(c, SALMON, true)),
  item_raw_pike: icon((c) => fish(c, PIKE, true)),
  item_raw_carp: icon((c) => fish(c, CARP)),
  item_raw_whitefish: icon((c) => fish(c, WHITE)),
  item_raw_crayfish: icon((c) => { crayfish(c, CRAY); }),
  item_cooked_salmon: icon((c) => { fish(c, [SALMON[0], SALMON[1], SALMON[2], COOKED[3], COOKED[4]], true); }),
  item_cooked_pike: icon((c) => { fish(c, COOKED, true); c.set(7, 7, P.WOOD[0]); }),
  item_cooked_carp: icon((c) => { fish(c, COOKED); c.set(7, 6, P.WOOD[0]); c.set(9, 10, P.WOOD[0]); c.set(10, 7, P.WOOD[0]); }),
  item_cooked_whitefish: icon((c) => { fish(c, [COOKED[1], COOKED[2], COOKED[3], COOKED[4], WHITE[4]]); }),
  item_cooked_crayfish: icon((c) => crayfish(c, [rgb(0x7a2418), rgb(0xa8351f), rgb(0xd24a2a), rgb(0xe8704a), rgb(0xf6a080)])),
  item_fish_chowder: icon((c) => bowl(c, [rgb(0xe6d9b0), rgb(0xd3c28c)], COOKED[3])),
  item_winter_broth: icon((c) => bowl(c, [rgb(0xc8d6dc), rgb(0x9fb4be)], COOKED[2])),
} satisfies PainterSet;
