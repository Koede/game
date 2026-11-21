/**
 * The Ember handwork stations (docs/api/handwork-content.md section 8): each a `_top` and a `_side` (the loom also a
 * `_front`). Wood is warm and worn, stone is grey, fired clay is terracotta; every station shows what it is for on its
 * top face (the part the player looks down at while working it).
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, tone } from './brush';
import * as P from './palette';
import { type RGB, mix, shade } from './palette';

const W = P.WOOD;

/** Vertical or horizontal plank boards with seams, shared by the wooden stations. */
function boards(c: Canvas, ramp: readonly RGB[], horizontal: boolean, boardsN = 4): void {
  const grain = c.noise(horizontal ? 8 : 1, horizontal ? 1 : 8, 2);
  const w = 16 / boardsN;
  c.each((x, y) => {
    const u = horizontal ? y : x;
    const v = horizontal ? x : y;
    const seam = u % w === 0;
    const col = tone(ramp, 0.3 + c.hash(Math.floor(u / w), 0, 3) * 0.3 + grain(x, y) * 0.35);
    return seam ? shade(ramp[0], -0.1) : v < 0 ? col : col;
  });
}

// ---- chopping block ------------------------------------------------------------------------------

function choppingTop(c: Canvas): void {
  const bark = P.OAK_BARK;
  c.fill(bark[1]);
  const rings = c.noise(4, 4, 1);
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7.6) return null;
    if (d > 6.7) return bark[2];
    const wobble = d + (rings(x, y) - 0.5) * 1.4;
    return Math.floor(wobble) % 2 === 0 ? W[3] : W[2];
  });
  c.disc(7.5, 7.5, 1.1, W[1]);
  // Axe cuts: two deep wedges and a pale chip beside each.
  for (const [x0, y0, x1, y1] of [[4, 4, 8, 6], [7, 9, 12, 10]] as const) {
    c.line(x0, y0, x1, y1, W[0]);
    c.line(x0, y0 + 1, x1, y1 + 1, shade(W[0], -0.2));
    c.set(x1 + 1, y1 - 1, W[4]);
  }
}

function choppingSide(c: Canvas): void {
  const bark = P.OAK_BARK;
  const n = c.noise(2, 8, 4);
  c.each((x, y) => tone([bark[0], bark[1], bark[2], bark[3]], 0.15 + n(x, y) * 0.6 + (x % 4 === 0 ? 0.12 : 0)));
  for (let x = 1; x < 16; x += 5) c.line(x, 0, x + 1, 15, bark[0]);
  // The face is scarred with axe marks, pale where the wood shows.
  for (const [x, y] of [[3, 3], [10, 6], [5, 10], [12, 12]] as const) {
    c.rect(x, y, 3, 1, W[3]);
    c.rect(x, y + 1, 3, 1, W[0]);
  }
  c.rect(0, 0, 16, 1, W[2]);
}

// ---- quern ---------------------------------------------------------------------------------------

function quernTop(c: Canvas): void {
  const s = P.STONE;
  c.fill(s[1]);
  const grit = c.noise(4, 4, 1);
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7.4) return null;
    const lit = (-(x - 7.5) - (y - 7.5)) / 14;
    return tone([s[1], s[2], s[3], s[4]], 0.45 + lit * 0.5 + (grit(x, y) - 0.5) * 0.35);
  });
  c.ring(7.5, 7.5, 7.4, s[0]);
  // The eye in the middle, grooves cut to carry the meal out, and the wooden peg handle near the rim.
  c.disc(7.5, 7.5, 1.6, P.DEEPSTONE[0]);
  c.disc(7.5, 7.5, 0.8, P.SOOT);
  for (const a of [0.5, 2.2, 3.9, 5.5]) c.line(7.5 + Math.cos(a) * 2.4, 7.5 + Math.sin(a) * 2.4, 7.5 + Math.cos(a) * 6.2, 7.5 + Math.sin(a) * 6.2, s[0]);
  c.rect(11, 3, 2, 3, W[2]);
  c.rect(11, 3, 1, 3, W[4]);
  c.set(12, 5, W[0]);
}

function quernSide(c: Canvas): void {
  const s = P.STONE;
  const grit = c.noise(4, 4, 3);
  c.each((x, y) => tone([s[0], s[1], s[2], s[3]], 0.25 + grit(x, y) * 0.55 + (y < 8 ? 0.12 : 0)));
  c.rect(0, 7, 16, 1, P.DEEPSTONE[0]);
  c.rect(0, 8, 16, 1, s[4]);
  c.rect(0, 0, 16, 1, s[4]);
  c.rect(0, 15, 16, 1, s[0]);
}

// ---- anvil ---------------------------------------------------------------------------------------

function anvilTop(c: Canvas): void {
  const s = P.DEEPSTONE;
  const grit = c.noise(4, 4, 2);
  c.each((x, y) => tone([s[0], s[1], s[2], s[3]], 0.3 + grit(x, y) * 0.5));
  c.rect(1, 1, 14, 14, s[2]);
  bevel(c, 1, 1, 14, 14, s[4], s[0]);
  // Hammered work face: a worn bright patch with dents, and copper flecks of work.
  c.disc(7.5, 7.5, 4.6, s[3]);
  c.disc(7, 7, 3.2, mix(s[3], s[4], 0.5));
  for (const [x, y] of [[5, 6], [8, 5], [9, 9], [6, 9], [10, 7]] as const) c.set(x, y, s[1]);
  for (const [x, y] of [[6, 7], [9, 6], [8, 8]] as const) c.set(x, y, P.COPPER[3]);
}

function anvilSide(c: Canvas): void {
  const s = P.DEEPSTONE;
  const grit = c.noise(4, 4, 5);
  c.each((x, y) => tone([s[0], s[1], s[2], s[3]], 0.25 + grit(x, y) * 0.5));
  // A tapering waist between a broad face and a broad foot.
  c.rect(0, 0, 16, 4, s[3]);
  c.rect(0, 0, 16, 1, s[4]);
  c.rect(0, 12, 16, 4, s[1]);
  c.rect(0, 15, 16, 1, s[0]);
  c.rect(0, 3, 16, 1, s[0]);
  c.rect(0, 12, 16, 1, s[3]);
  for (const x of [0, 1, 14, 15]) c.rect(x, 4, 1, 8, s[0]);
  c.rect(2, 4, 1, 8, s[3]);
}

// ---- mortar --------------------------------------------------------------------------------------

function mortarTop(c: Canvas): void {
  const f = P.FIRED_CLAY;
  c.fill(P.STONE[1]);
  c.each((x, y) => (Math.hypot(x - 7.5, y - 7.5) <= 7.4 ? tone([f[1], f[2], f[3]], 0.5 + (-(x - 7.5) - (y - 7.5)) / 22) : null));
  c.ring(7.5, 7.5, 7.4, f[0]);
  // The bowl: dark inside, a lit crescent on the lower right, crushed ore in the bottom, the pestle laid across.
  c.disc(7.5, 7.5, 5.2, f[0]);
  c.disc(7, 7, 4.5, shade(f[0], -0.35));
  for (const [x, y] of [[6, 8], [8, 9], [7, 6], [9, 7]] as const) c.set(x, y, P.COPPER[2]);
  c.set(8, 8, P.TIN[3]);
  c.line(2, 12, 11, 3, P.STONE[0]);
  c.line(2, 11, 11, 2, P.STONE[3]);
  c.line(3, 11, 10, 4, P.STONE[4]);
}

function mortarSide(c: Canvas): void {
  const f = P.FIRED_CLAY;
  const n = c.noise(4, 4, 6);
  c.each((x, y) => tone([f[0], f[1], f[2], f[3]], 0.25 + n(x, y) * 0.45 + (x < 6 ? 0.2 : x > 11 ? -0.2 : 0)));
  c.rect(0, 0, 16, 2, f[4]);
  c.rect(0, 2, 16, 1, f[0]);
  c.rect(0, 15, 16, 1, f[0]);
}

// ---- clay table ----------------------------------------------------------------------------------

function clayTableTop(c: Canvas): void {
  boards(c, [W[1], W[2], W[3]], false, 4);
  c.rect(0, 0, 16, 1, W[0]);
  c.rect(0, 15, 16, 1, W[0]);
  // A slab of wet clay worked flat, a thumb dent, a ridge where it was pressed, a shaping stick.
  const k = P.CLAY;
  c.each((x, y) => {
    if (x < 2 || x > 13 || y < 3 || y > 12) return null;
    if ((x === 2 || x === 13) && (y === 3 || y === 12)) return null;
    return tone([k[1], k[2], k[3]], 0.35 + (-(x - 7) - (y - 7)) / 20 + c.hash(x, y, 1) * 0.15);
  });
  c.disc(6, 7, 1.3, k[1]);
  c.line(8, 5, 12, 10, k[4]);
  c.rect(12, 12, 3, 1, W[0]);
  c.line(10, 14, 14, 11, W[4]);
}

function clayTableSide(c: Canvas): void {
  c.fill(shade(P.OAK_BARK[0], -0.35));
  for (let x = 0; x < 16; x++) {
    c.set(x, 0, W[4]);
    c.set(x, 1, W[3]);
    c.set(x, 2, W[2]);
    c.set(x, 3, W[0]);
  }
  for (const x0 of [1, 12]) {
    c.rect(x0, 4, 3, 12, W[2]);
    c.rect(x0, 4, 1, 12, W[3]);
    c.rect(x0 + 2, 4, 1, 12, W[1]);
  }
  c.rect(1, 11, 14, 2, W[2]);
  c.rect(1, 11, 14, 1, W[3]);
  // Moulded clay pieces drying on the shelf.
  for (const x0 of [4, 8]) {
    c.rect(x0, 8, 3, 3, P.CLAY[3]);
    c.rect(x0, 8, 3, 1, P.CLAY[4]);
  }
}

// ---- casting bench -------------------------------------------------------------------------------

function benchTop(c: Canvas): void {
  const b = P.FIREBRICK;
  const grit = c.noise(4, 4, 7);
  c.each((x, y) => tone([b[0], b[1], b[2], b[3]], 0.3 + grit(x, y) * 0.5));
  bevel(c, 0, 0, 16, 16, b[4], b[0]);
  // Four sockets for moulds, each a dark pit with a scorched rim and a trace of bronze in one.
  for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]] as const) {
    c.rect(x - 1, y - 1, 7, 6, P.SOOT);
    c.rect(x, y, 5, 4, P.IRON[1]);
    c.rect(x + 1, y + 1, 3, 2, P.IRON[0]);
  }
  c.rect(10, 3, 3, 1, P.BRONZE[3]);
  c.rect(3, 10, 3, 1, P.BRONZE[2]);
}

function benchSide(c: Canvas): void {
  const b = P.FIREBRICK;
  const f = c.noise(4, 2, 8);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4);
      const u = (x + (row % 2 === 0 ? 0 : 4)) % 8;
      if (y % 4 === 3 || u === 7) c.set(x, y, P.MORTAR);
      else c.set(x, y, tone([b[1], b[2], b[3]], 0.3 + f(x, y) * 0.6));
    }
  }
  // Soot above, where metal has been spilled.
  for (let x = 0; x < 16; x++) c.set(x, 0, shade(b[0], -0.4));
  for (const [x, y] of [[3, 1], [4, 1], [9, 1], [10, 2], [13, 1]] as const) c.set(x, y, P.SOOT);
}

// ---- alloy pot -----------------------------------------------------------------------------------

function potTop(c: Canvas): void {
  const f = P.FIRED_CLAY;
  c.fill(P.IRON[2]);
  c.each((x, y) => (Math.hypot(x - 7.5, y - 7.5) <= 7.2 ? tone([f[1], f[2], f[3]], 0.45 + (-(x - 7.5) - (y - 7.5)) / 22) : null));
  c.ring(7.5, 7.5, 7.2, f[0]);
  c.disc(7.5, 7.5, 5, f[0]);
  c.disc(7.5, 7.5, 4.1, P.SOOT);
  // A skin of molten bronze in the pot with a bright highlight, and the spout notch at the top.
  c.disc(7.5, 8, 3.6, P.BRONZE[2]);
  c.disc(7, 7.2, 2.2, P.BRONZE[3]);
  c.set(6, 6, P.BRONZE[4]);
  c.set(7, 6, P.BRONZE[4]);
  c.rect(6, 0, 4, 2, f[0]);
  c.rect(7, 0, 2, 2, P.SOOT);
}

function potSide(c: Canvas): void {
  const f = P.FIRED_CLAY;
  const n = c.noise(4, 4, 9);
  c.each((x, y) => tone([f[0], f[1], f[2], f[3]], 0.2 + n(x, y) * 0.4 + (x < 5 ? 0.25 : x > 11 ? -0.2 : 0.05)));
  c.rect(0, 0, 16, 2, f[4]);
  c.rect(0, 2, 16, 1, f[0]);
  // A band of soot and a grip of cord.
  c.rect(0, 6, 16, 2, shade(f[0], -0.3));
  for (let x = 1; x < 16; x += 2) c.set(x, 11, P.CLOTH[3]);
  for (let x = 0; x < 16; x += 2) c.set(x, 12, P.CLOTH[1]);
  c.rect(0, 15, 16, 1, f[0]);
}

// ---- drying rack ---------------------------------------------------------------------------------

function rackTop(c: Canvas): void {
  c.fill(shade(P.DIRT[0], -0.1));
  // A frame of sticks with slats across, a strip of hide hung over it.
  for (const x of [1, 13]) {
    c.rect(x, 0, 2, 16, W[2]);
    c.rect(x, 0, 1, 16, W[4]);
  }
  for (const y of [1, 5, 9, 13]) {
    c.rect(1, y, 14, 2, W[3]);
    c.rect(1, y, 14, 1, W[4]);
    c.rect(1, y + 1, 14, 1, W[1]);
  }
  c.each((x, y) => (x >= 4 && x <= 10 && y >= 2 && y <= 9 ? mix(P.STRAW[2], P.DIRT[3], 0.4 + c.hash(x, y, 2) * 0.3) : null));
  c.rect(4, 9, 7, 1, P.DIRT[1]);
}

function rackSide(c: Canvas): void {
  c.fill(shade(P.OAK_BARK[0], -0.45));
  for (const x of [0, 13]) {
    c.rect(x, 0, 3, 16, W[2]);
    c.rect(x, 0, 1, 16, W[4]);
    c.rect(x + 2, 0, 1, 16, W[0]);
  }
  for (const y of [2, 7, 12]) {
    c.rect(2, y, 12, 2, W[3]);
    c.rect(2, y, 12, 1, W[4]);
  }
  // A hide and a bunch of drying grass hanging from the bars.
  c.each((x, y) => (x >= 4 && x <= 8 && y >= 3 && y <= 10 ? mix(P.DIRT[3], P.DIRT[2], (y - 3) / 7 + c.hash(x, y, 1) * 0.2) : null));
  for (const x of [10, 11, 12]) c.rect(x, 8, 1, 4 + (x % 2), P.STRAW[3]);
}

// ---- tanning trough ------------------------------------------------------------------------------

function troughTop(c: Canvas): void {
  boards(c, [W[0], W[1], W[2]], true, 4);
  c.rect(0, 0, 16, 2, W[2]);
  c.rect(0, 14, 16, 2, W[1]);
  c.rect(0, 0, 2, 16, W[2]);
  c.rect(14, 0, 2, 16, W[1]);
  // Brown-green tanning liquor with a soaking hide floating in it.
  const w = P.WATER;
  c.each((x, y) => (x >= 2 && x <= 13 && y >= 2 && y <= 13 ? mix(tone([w[1], w[2], w[3]], 0.3 + c.hash(x, y, 3) * 0.5), P.DIRT[2], 0.45) : null));
  c.each((x, y) => (Math.hypot((x - 7.5) / 3.5, (y - 8) / 2.5) < 1 ? mix(P.DIRT[3], P.DIRT[2], c.hash(x, y, 4)) : null));
  c.set(11, 4, shade(w[4], 0.3));
  c.set(4, 11, shade(w[4], 0.3));
}

function troughSide(c: Canvas): void {
  boards(c, [W[0], W[1], W[2]], false, 5);
  c.rect(0, 0, 16, 1, W[3]);
  for (const y of [3, 12]) {
    c.rect(0, y, 16, 1, P.IRON_METAL[1]);
    c.rect(0, y + 1, 16, 1, P.IRON_METAL[0]);
  }
  c.set(3, 7, P.WATER[1]);
  c.set(3, 8, P.WATER[1]);
  c.set(10, 9, P.WATER[1]);
}

// ---- loom ----------------------------------------------------------------------------------------

function loomTop(c: Canvas): void {
  boards(c, [W[1], W[2], W[3]], true, 4);
  c.rect(0, 0, 16, 2, W[3]);
  c.rect(0, 14, 16, 2, W[1]);
  // The top beam: a roller with a few turns of thread, two pegs.
  c.rect(3, 5, 10, 6, W[0]);
  for (let x = 4; x < 13; x += 2) c.rect(x, 5, 1, 6, P.CLOTH[3]);
  c.rect(2, 7, 1, 2, W[4]);
  c.rect(13, 7, 1, 2, W[4]);
}

function loomSide(c: Canvas): void {
  c.fill(shade(P.OAK_BARK[0], -0.45));
  for (const x of [0, 13]) {
    c.rect(x, 0, 3, 16, W[2]);
    c.rect(x, 0, 1, 16, W[4]);
    c.rect(x + 2, 0, 1, 16, W[0]);
  }
  c.rect(0, 0, 16, 3, W[3]);
  c.rect(0, 0, 16, 1, W[4]);
  c.rect(0, 13, 16, 3, W[2]);
  // Warp threads between the posts.
  for (let x = 4; x < 13; x += 2) c.rect(x, 3, 1, 10, P.CLOTH[2]);
}

function loomFront(c: Canvas): void {
  c.fill(shade(P.OAK_BARK[0], -0.45));
  for (const x of [0, 13]) {
    c.rect(x, 0, 3, 16, W[2]);
    c.rect(x, 0, 1, 16, W[4]);
    c.rect(x + 2, 0, 1, 16, W[0]);
  }
  c.rect(0, 0, 16, 3, W[3]);
  c.rect(0, 0, 16, 1, W[4]);
  c.rect(0, 13, 16, 3, W[2]);
  // Taut warp threads, a woven band of cloth growing from the bottom, a shuttle on the weft.
  for (let x = 4; x < 13; x++) c.rect(x, 3, 1, 10, x % 2 === 0 ? P.CLOTH[3] : P.CLOTH[2]);
  c.each((x, y) => (x >= 3 && x <= 12 && y >= 8 && y <= 12 ? tone([P.CLOTH[1], P.CLOTH[2], P.CLOTH[3], P.CLOTH[4]], ((x + y) % 2 === 0 ? 0.62 : 0.3) + c.hash(x, y, 1) * 0.2) : null));
  c.rect(6, 6, 4, 1, W[0]);
  c.rect(6, 6, 3, 1, W[4]);
  c.set(10, 6, P.IRON_METAL[3]);
}

export const HAND_TEXTURES: PainterSet = {
  chopping_block_top: choppingTop,
  chopping_block_side: choppingSide,
  hand_quern_top: quernTop,
  hand_quern_side: quernSide,
  stone_anvil_top: anvilTop,
  stone_anvil_side: anvilSide,
  mortar_top: mortarTop,
  mortar_side: mortarSide,
  clay_table_top: clayTableTop,
  clay_table_side: clayTableSide,
  casting_bench_top: benchTop,
  casting_bench_side: benchSide,
  alloy_pot_top: potTop,
  alloy_pot_side: potSide,
  drying_rack_top: rackTop,
  drying_rack_side: rackSide,
  tanning_trough_top: troughTop,
  tanning_trough_side: troughSide,
  loom_top: loomTop,
  loom_side: loomSide,
  loom_front: loomFront,
};
