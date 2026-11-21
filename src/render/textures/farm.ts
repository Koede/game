/**
 * Farming: ploughed farmland, the four stages of wheat, potatoes and carrots, and the wild plants they come from.
 * Plants are cutout tiles (alpha 0 or 255) that grow up from the bottom edge, where the cross mesh meets the soil.
 */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { type RGB, type Ramp, rgb, shade } from './palette';

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

/** Tilled soil: darker and moister than dirt. */
const SOIL = ramp(0x24170f, 0x352218, 0x48301f, 0x5c3f28, 0x775636);
/** Young shoots: a fresher green than the mossy grass. */
const SHOOT = ramp(0x34501d, 0x4a6e24, 0x62902e, 0x80ad3c, 0xa8cc62);
const POTATO_LEAF = ramp(0x243c1b, 0x335223, 0x45692b, 0x5a8335, 0x7fa64f);
const FROND = ramp(0x2b4a1b, 0x3c6322, 0x51802a, 0x6a9e34, 0x92c255);
const GRAIN = ramp(0x7a5618, 0xa57b26, 0xcca13a, 0xe6c158, 0xf8e08e);
const STALK = ramp(0x6a5524, 0x8c7232, 0xab8f44, 0xc7ab5c, 0xdcc47c);
export const CARROT = ramp(0x84360e, 0xb35018, 0xd96f22, 0xf09036, 0xffbd6a);
export const TUBER = ramp(0x553a20, 0x77532e, 0x977040, 0xb68c56, 0xd2ab78);
const PETAL = rgb(0xf3efe2);
const PETAL_SHADE = rgb(0xc9c0d8);
const POLLEN = rgb(0xe9c443);

/** Ploughed furrows across the top face: lit ridge, slope, trench, with a few clods. Seamless on all edges. */
function farmlandTop(c: Canvas): void {
  const wob = c.noise(8, 16, 1);
  const grain = c.noise(2, 2, 2);
  const row = (x: number, y: number): number => (y + Math.round((wob(x, 0) - 0.5) * 2.4) + 16) % 4;
  c.each((x, y) => {
    const v = row(x, y);
    const base = [SOIL[3], SOIL[2], SOIL[1], SOIL[0]][v];
    const n = grain(x, y) - 0.5 + (c.hash(x, y, 3) - 0.5) * 0.5;
    return n > 0.2 && v < 3 ? shade(base, 0.09) : n < -0.22 && v > 0 ? shade(base, -0.14) : base;
  });
  // Clods on the ridges, crumbs on the slopes, the odd bit of old straw in the trench.
  for (const [x, y] of c.scatter(9, 3)) {
    const v = row(x, y);
    if (v === 0) {
      c.wset(x, y, SOIL[4]);
      c.wset(x + 1, y, SOIL[3]);
      c.wset(x, y + 1, SOIL[1]);
    } else if (v === 1) c.wset(x, y, shade(SOIL[3], 0.12));
  }
  for (const [x, y] of c.scatter(3, 6)) if (row(x, y) === 3) c.wset(x, y, P.STRAW[1]);
}

/** One blade or stalk rising from the bottom row: `h` tall, curving by `lean` pixels at the tip. */
function stalk(c: Canvas, x0: number, h: number, lean: number, r: Ramp, thick = false): [number, number] {
  let tip: [number, number] = [x0, 15];
  for (let i = 0; i < h; i++) {
    const y = 15 - i;
    const x = x0 + Math.round(lean * (i / h) * (i / h));
    // The foot sits in shadow where it meets the soil.
    const col = i > h - 3 ? r[4] : i > h * 0.55 ? r[3] : i > 1 ? r[2] : i === 0 ? r[0] : r[1];
    c.set(x, y, col);
    if (thick && i < h * 0.4) c.set(x + 1, y, r[1]);
    tip = [x, y];
  }
  return tip;
}

/** An ear of grain hanging off a stalk tip: kernels in two columns, awns above. */
function ear(c: Canvas, x: number, y: number, len: number, r: Ramp, awns: boolean): void {
  for (let i = 0; i < len; i++) {
    c.set(x, y + i, i % 2 === 0 ? r[4] : r[3]);
    c.set(x + 1, y + i, i % 2 === 0 ? r[2] : r[1]);
  }
  if (awns) {
    c.set(x - 1, y - 1, r[3]);
    c.set(x + 2, y - 1, r[3]);
  }
}

/** A small leaf: a lit upper half and a shaded lower half, pointing left or right of its stem. */
function leaf(c: Canvas, x: number, y: number, dir: 1 | -1, r: Ramp, big = false): void {
  c.set(x, y, r[3]);
  c.set(x + dir, y, r[4]);
  c.set(x + dir, y + 1, r[2]);
  c.set(x + 2 * dir, y, r[3]);
  if (big) {
    c.set(x + 2 * dir, y + 1, r[1]);
    c.set(x + dir, y - 1, r[3]);
    c.set(x + 3 * dir, y, r[2]);
  }
}

/** A carrot frond: a thin stem with leaflets alternating to both sides. */
function frond(c: Canvas, x0: number, y0: number, h: number, lean: number, r: Ramp): void {
  for (let i = 0; i < h; i++) {
    const y = y0 - i;
    const x = x0 + Math.round(lean * (i / h));
    c.set(x, y, i > h - 2 ? r[4] : i === 0 ? r[0] : r[2]);
    if (i > 1 && i % 2 === 0) c.set(x - 1, y, i > h * 0.6 ? r[3] : r[1]);
    if (i > 1 && i % 2 === 1) c.set(x + 1, y, i > h * 0.6 ? r[4] : r[2]);
  }
}

/** A five-petal flower seen from the side of the plant: petals round a pollen eye. */
function flower(c: Canvas, x: number, y: number): void {
  c.set(x, y - 1, PETAL);
  c.set(x - 1, y, PETAL);
  c.set(x + 1, y, PETAL_SHADE);
  c.set(x, y + 1, PETAL_SHADE);
  c.set(x, y, POLLEN);
}

/** Shoulders of a root crop (or a tuber) showing at the soil line. */
function shoulder(c: Canvas, x: number, w: number, h: number, r: Ramp): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (j === 0 && (i === 0 || i === w - 1)) continue;
      const col: RGB = j === 0 ? r[4] : i === 0 ? r[3] : i === w - 1 ? r[1] : j % 2 === 1 ? r[2] : r[3];
      c.set(x + i, 16 - h + j, col);
    }
  }
}

// ---- wheat ---------------------------------------------------------------------------------------

function wheat0(c: Canvas): void {
  const shoots = [[1, 3, 0], [3, 4, -1], [5, 5, 1], [7, 3, 0], [9, 5, -1], [11, 4, 1], [13, 5, 0], [14, 3, -1]] as const;
  for (const [x, h, lean] of shoots) stalk(c, x, h, lean, SHOOT);
  // A first true leaf on the strongest shoots.
  leaf(c, 5, 12, -1, SHOOT);
  leaf(c, 13, 12, -1, SHOOT);
}

function wheat1(c: Canvas): void {
  const blades: [number, number, number][] = [[2, 6, -1], [4, 8, 1], [7, 9, -1], [9, 7, 2], [11, 9, 0], [13, 6, 1]];
  for (const [x, h, lean] of blades) stalk(c, x, h, lean, SHOOT);
  leaf(c, 5, 11, 1, SHOOT);
  leaf(c, 10, 12, -1, SHOOT);
}

function wheat2(c: Canvas): void {
  const green = ramp(0x40581f, 0x587826, 0x739630, 0x92ae40, 0xb6c868);
  const heads = ramp(0x55651f, 0x768a2a, 0x98a83a, 0xb8c452, 0xd6dc84);
  const stalks: [number, number, number][] = [[2, 10, 1], [5, 12, -1], [7, 11, 1], [10, 12, 0], [12, 10, -1], [14, 9, 0]];
  for (const [x, h, lean] of stalks) {
    const [tx, ty] = stalk(c, x, h, lean, green);
    ear(c, tx, ty - 3, 3, heads, false);
  }
  leaf(c, 4, 10, -1, green, true);
  leaf(c, 11, 9, 1, green, true);
}

function wheat3(c: Canvas): void {
  const stalks: [number, number, number][] = [[1, 10, 1], [3, 13, 1], [6, 14, -1], [8, 12, 1], [10, 14, 0], [12, 12, -1], [14, 10, -1]];
  for (const [x, h, lean] of stalks) {
    const [tx, ty] = stalk(c, x, h, lean, STALK);
    ear(c, tx, Math.max(1, ty - 4), 4, GRAIN, true);
  }
  leaf(c, 5, 9, -1, STALK);
  leaf(c, 11, 10, 1, STALK);
}

// ---- potatoes ------------------------------------------------------------------------------------

/** A potato plant: stems from the soil with paired leaves, `h` tall. */
function potatoBush(c: Canvas, stems: [number, number, number][], r: Ramp, big: boolean): void {
  for (const [x, h, lean] of stems) {
    for (let i = 0; i < h; i++) c.set(x + Math.round(lean * (i / h)), 15 - i, i === 0 ? r[0] : r[1]);
    for (let i = 2; i < h; i += 2) {
      const sx = x + Math.round(lean * (i / h));
      leaf(c, sx, 15 - i, i % 4 === 0 ? 1 : -1, r, big);
    }
    const tx = x + lean;
    c.set(tx, 15 - h, r[4]);
    c.set(tx - 1, 16 - h, r[3]);
    c.set(tx + 1, 16 - h, r[3]);
  }
}

function potato0(c: Canvas): void {
  potatoBush(c, [[2, 4, 0], [7, 5, 0], [12, 4, 0]], SHOOT, false);
}

function potato1(c: Canvas): void {
  potatoBush(c, [[3, 6, -1], [7, 8, 0], [11, 7, 1]], POTATO_LEAF, false);
}

function potato2(c: Canvas): void {
  potatoBush(c, [[2, 8, -1], [5, 11, 0], [9, 12, 0], [12, 9, 1]], POTATO_LEAF, true);
  for (const [x, y] of [[5, 4], [9, 3]] as const) c.set(x, y, shade(PETAL, -0.25));
}

function potato3(c: Canvas): void {
  potatoBush(c, [[1, 9, 0], [4, 12, 0], [8, 13, 0], [12, 11, 1], [14, 8, 0]], POTATO_LEAF, true);
  for (const [x, y] of [[4, 3], [8, 2], [13, 4], [2, 6]] as const) flower(c, x, y);
  shoulder(c, 5, 3, 2, TUBER);
  shoulder(c, 10, 3, 2, TUBER);
}

// ---- carrots -------------------------------------------------------------------------------------

function carrot0(c: Canvas): void {
  for (const [x, h, lean] of [[2, 4, -1], [5, 5, 0], [8, 4, 1], [11, 5, 0], [13, 4, 1]] as const) frond(c, x, 15, h, lean, SHOOT);
}

function carrot1(c: Canvas): void {
  for (const [x, h, lean] of [[3, 6, -1], [6, 8, -1], [8, 8, 1], [12, 7, 1]] as const) frond(c, x, 15, h, lean, FROND);
}

function carrot2(c: Canvas): void {
  for (const [x, h, lean] of [[2, 8, -1], [5, 10, -1], [7, 11, 0], [9, 10, 1], [12, 9, 1], [14, 7, 0]] as const) frond(c, x, 14, h, lean, FROND);
  c.set(6, 15, CARROT[2]);
  c.set(7, 15, CARROT[3]);
  c.set(11, 15, CARROT[2]);
}

function carrot3(c: Canvas): void {
  for (const [x, h, lean] of [[2, 9, -1], [4, 11, -2], [6, 12, 0], [8, 11, 1], [10, 12, 1], [12, 10, 2], [14, 8, 0]] as const) {
    frond(c, x, 12, h, lean, FROND);
  }
  shoulder(c, 2, 4, 3, CARROT);
  shoulder(c, 7, 4, 4, CARROT);
  shoulder(c, 12, 3, 3, CARROT);
}

// ---- wild plants ---------------------------------------------------------------------------------

function wildWheat(c: Canvas): void {
  const pale = ramp(0x5e5a2a, 0x7e7836, 0x9e9648, 0xbcb062, 0xd6ca86);
  for (const [x, h, lean] of [[2, 7, -1], [4, 10, 1], [8, 6, -1], [11, 9, 1], [14, 7, 0]] as const) stalk(c, x, h, lean, P.GRASS);
  for (const [x, h, lean] of [[6, 12, -2], [10, 13, 1], [13, 11, 2]] as const) {
    const [tx, ty] = stalk(c, x, h, lean, pale);
    ear(c, tx, ty, 3, pale, true);
  }
}

function wildPotato(c: Canvas): void {
  potatoBush(c, [[3, 5, -1], [7, 7, 0], [11, 6, 1]], POTATO_LEAF, true);
  flower(c, 7, 7);
  flower(c, 12, 9);
}

function wildCarrot(c: Canvas): void {
  // Lacy white umbels on tall thin stems over a low rosette of fronds.
  const stem = P.GRASS;
  for (const [x, h, lean] of [[4, 11, -1], [9, 13, 1], [12, 9, 1]] as const) {
    for (let i = 0; i < h; i++) c.set(x + Math.round(lean * (i / h)), 15 - i, i < 3 ? stem[1] : stem[2]);
    const tx = x + lean;
    const ty = 15 - h;
    for (let dx = -2; dx <= 2; dx++) c.set(tx + dx, ty, (dx + tx) % 2 === 0 ? PETAL : PETAL_SHADE);
    for (let dx = -1; dx <= 1; dx++) c.set(tx + dx, ty - 1, PETAL);
    c.set(tx, ty + 1, stem[3]);
  }
  for (const [x, h, lean] of [[2, 4, -1], [6, 5, 0], [11, 4, 1], [14, 3, 0]] as const) frond(c, x, 15, h, lean, FROND);
}

export const FARM: PainterSet = {
  farmland_top: farmlandTop,
  wheat_stage0: wheat0,
  wheat_stage1: wheat1,
  wheat_stage2: wheat2,
  wheat_stage3: wheat3,
  potato_stage0: potato0,
  potato_stage1: potato1,
  potato_stage2: potato2,
  potato_stage3: potato3,
  carrot_stage0: carrot0,
  carrot_stage1: carrot1,
  carrot_stage2: carrot2,
  carrot_stage3: carrot3,
  wild_wheat: wildWheat,
  wild_potato: wildPotato,
  wild_carrot: wildCarrot,
};
