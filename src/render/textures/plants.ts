/** Wood and plants: bark, end grain, foliage, the cutout plants, planks and the torch. */
import type { Canvas, PainterSet } from './canvas';
import { tone } from './brush';
import * as P from './palette';
import { type RGB, type Ramp, mix, shade } from './palette';

/** Oak bark: vertical furrows that wander a little, seamless top to bottom. */
function oakBark(c: Canvas): void {
  const b = P.OAK_BARK;
  const wob = c.noise(4, 8, 1);
  const f = c.noise(4, 4, 2);
  c.each((x, y) => {
    const u = (x + (wob(x, y) - 0.5) * 3 + 16) % 4;
    const ridge = u < 1 ? 0 : u < 2 ? 0.75 : u < 3 ? 0.55 : 0.4;
    return tone([b[0], b[1], b[2], b[3]], ridge + (f(x, y) - 0.5) * 0.35);
  });
  // A knot and a few lit ridge tops.
  const [kx, ky] = [c.int(16), c.int(16)];
  c.wset(kx, ky, b[0]);
  c.wset(kx + 1, ky, b[0]);
  c.wset(kx, ky - 1, b[3]);
  c.wset(kx + 1, ky + 1, b[1]);
  for (const [x, y] of c.scatter(5, 4)) c.wset(x, y, b[4]);
}

/** Pine bark: tall reddish plates split by dark fissures, each column of plates offset from the next. */
function pineBark(c: Canvas): void {
  const b = P.PINE_BARK;
  const f = c.noise(4, 4, 3);
  const cols = [0, 4, 7, 11, 14];
  for (let k = 0; k < cols.length; k++) {
    const x0 = cols[k];
    const x1 = k + 1 < cols.length ? cols[k + 1] : 16;
    const plate = 6 + (k % 2) * 2;
    const off = c.int(plate);
    for (let x = x0; x < x1; x++) {
      for (let y = 0; y < 16; y++) {
        const v = (y + off) % plate;
        let col: RGB = tone([b[1], b[2], b[3]], 0.35 + f(x, y) * 0.65);
        if (x === x0) col = b[0];
        else if (v === 0) col = b[0];
        else if (v === 1) col = shade(col, 0.18);
        else if (x === x1 - 1) col = shade(col, -0.18);
        c.set(x, y, col);
      }
    }
  }
  for (const [x, y] of c.scatter(3, 6)) if (!cols.includes(x)) c.set(x, y, b[4]);
}

function logTop(c: Canvas): void {
  const w = P.WOOD;
  const bark = mix(P.OAK_BARK[1], P.PINE_BARK[1], 0.5);
  const wob = c.noise(4, 4, 1);
  c.each((x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const r = Math.hypot(dx, dy) + (wob(x, y) - 0.5) * 1.2;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 6.6) return bark;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 5.6) return shade(bark, 0.15);
    const ring = Math.floor(r / 1.6) % 2 === 0;
    return r < 1.2 ? w[1] : ring ? w[3] : w[2];
  });
  c.set(7, 7, w[0]);
  c.line(8, 8, 12, 11, shade(P.WOOD[1], -0.1));
}

function leaves(c: Canvas, ramp: Ramp, needles: boolean): void {
  const f = c.noise(4, 4, 1);
  const gaps = c.noise(2, 2, 2);
  c.each((x, y) => {
    if (gaps(x, y) < 0.22) return ramp[0];
    return tone([ramp[1], ramp[2], ramp[3]], f(x, y) * 1.15 - 0.05);
  });
  if (needles) {
    // Short paired needles slanting down-left and down-right.
    for (const [x, y] of c.scatter(12, 3)) {
      c.wset(x, y, ramp[4]);
      c.wset(x + 1, y + 1, ramp[3]);
      c.wset(x - 1, y + 1, ramp[3]);
      c.wset(x, y + 2, ramp[0]);
    }
  } else {
    // Broad leaves: 2x2 lit tops with a shadow below.
    for (const [x, y] of c.scatter(9, 4)) {
      c.wset(x, y, ramp[4]);
      c.wset(x + 1, y, ramp[3]);
      c.wset(x, y + 1, ramp[3]);
      c.wset(x + 1, y + 2, ramp[0]);
      c.wset(x + 2, y + 1, ramp[0]);
    }
  }
}

/** Tall grass: a tuft of blades rising from the bottom edge, holes fully transparent. */
function tallGrass(c: Canvas): void {
  const g = P.GRASS;
  const blades: [number, number, number][] = [[2, 9, 1], [4, 13, -1], [6, 7, 0], [7, 14, 1], [9, 11, -1], [11, 15, 1], [13, 8, -1], [14, 11, 0]];
  for (const [x0, h, lean] of blades) {
    for (let i = 0; i < h; i++) {
      const y = 15 - i;
      const x = x0 + Math.round(lean * (i / h) * (i / h) * 3);
      const col = i > h - 3 ? g[4] : i > h / 2 ? g[3] : i > 2 ? g[2] : g[1];
      c.set(x, y, col);
      if (i < h / 3) c.set(x + 1, y, g[1]);
    }
  }
  c.set(7, 1, P.STRAW[3]);
  c.set(11, 0, P.STRAW[3]);
}

/** Dry shrub: a brittle fan of grey-brown twigs from one root. */
function dryShrub(c: Canvas): void {
  const s = P.STRAW;
  const twig = shade(P.OAK_BARK[3], 0.05);
  const branches: [number, number, number, number][] = [
    [7, 15, 2, 4], [8, 15, 13, 3], [7, 14, 4, 8], [8, 13, 11, 6], [7, 12, 7, 2], [8, 11, 14, 9], [7, 11, 1, 10],
  ];
  for (const [x0, y0, x1, y1] of branches) c.line(x0, y0, x1, y1, twig);
  for (const [, , x1, y1] of branches) {
    c.set(x1, y1, s[4]);
    c.set(x1 + (x1 < 8 ? -1 : 1), y1 - 1, s[3]);
  }
  c.rect(7, 13, 2, 3, P.OAK_BARK[1]);
  c.set(5, 6, s[2]);
  c.set(11, 5, s[2]);
  c.set(3, 9, s[2]);
}

/** Planks: four boards with dark seams, grain streaks and staggered butt joints. */
function plank(c: Canvas): void {
  const w = P.WOOD;
  const grain = c.noise(8, 1, 1);
  for (let board = 0; board < 4; board++) {
    const joint = (board * 7 + 3) % 16;
    const lift = board % 2 === 0 ? 0.08 : -0.06;
    for (let y = board * 4; y < board * 4 + 4; y++) {
      for (let x = 0; x < 16; x++) {
        const v = y - board * 4;
        let col = tone([w[1], w[2], w[3]], 0.45 + lift + (grain(x, y) - 0.5) * 1.1);
        if (v === 3) col = w[0];
        else if (v === 0) col = shade(col, 0.12);
        if (x === joint && v < 3) col = w[0];
        c.set(x, y, col);
      }
    }
    c.set((joint + 2) % 16, board * 4 + 1, shade(w[0], -0.2));
  }
}

/**
 * Torch: the mesher samples only columns 7-8 for the 2px post (rows 6..15) and the centre for its top, so
 * the flame sits exactly there; the wider flame around it is what the flat item icon shows.
 */
function torch(c: Canvas): void {
  const wood = P.WOOD;
  for (let y = 8; y < 16; y++) {
    c.set(7, y, wood[3]);
    c.set(8, y, wood[1]);
  }
  c.rect(7, 8, 2, 1, P.COAL[2]);
  c.sprite(
    ['..ab..', '.abba.', 'abccba', 'abcdba', '.bddb.', '..dd..'],
    { a: P.EMBER[1], b: P.EMBER[3], c: P.EMBER[4], d: shade(P.EMBER[4], 0.5) },
    5,
    2,
  );
  c.rect(7, 6, 2, 2, shade(P.EMBER[4], 0.45));
  c.outline(0.6);
}

export const PLANTS: PainterSet = {
  oak_log_side: oakBark,
  pine_log_side: pineBark,
  log_top: logTop,
  oak_leaves: (c) => leaves(c, P.OAK_LEAF, false),
  pine_leaves: (c) => leaves(c, P.PINE_LEAF, true),
  tall_grass: tallGrass,
  dry_shrub: dryShrub,
  plank,
  torch,
};
