/**
 * Food and farm-goods icons. Raw meat is pink-red with cream fat, everything that went through the furnace is
 * browned and glossy, so raw and cooked tell apart at a glance; each dish keeps its own silhouette.
 */
import type { Canvas, PainterSet } from './canvas';
import { CARROT, TUBER } from './farm';
import * as P from './palette';
import { type RGB, type Ramp, rgb, shade } from './palette';
import { icon } from './shapes';

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

const RAW_MEAT = ramp(0x6e1c22, 0x9a2c32, 0xc24648, 0xdc6e6a, 0xf2a49c);
const ROAST = ramp(0x45220f, 0x693516, 0x8f501e, 0xb4712c, 0xd8994a);
const FAT = ramp(0xb39a86, 0xcdb6a0, 0xe2d0bc, 0xf0e4d4, 0xfcf6ec);
const ROAST_FAT = ramp(0x7a4a22, 0x9c652e, 0xbe843e, 0xd8a352, 0xefc576);
const BONE: RGB = rgb(0xece3cf);
const BONE_SHADE: RGB = rgb(0xbfb196);
const RAW_SKIN = ramp(0x9a6a5e, 0xbf8a7c, 0xdcaa98, 0xefc6b2, 0xfbe0d0);
const GOLDEN = ramp(0x5a2c0e, 0x8a4816, 0xb46a22, 0xd88e36, 0xf2bc5e);
const CRUST = ramp(0x5a3213, 0x80481b, 0xa86627, 0xc98839, 0xe6ad5e);
const CRUMB = rgb(0xf0dcae);
const DOUGH = ramp(0xa89272, 0xc7b290, 0xddcbaa, 0xede0c4, 0xfcf5e2);
const LINEN = ramp(0x7c6e54, 0x9e9072, 0xbdb092, 0xd8ceb2, 0xf0e9d6);
const STEW = ramp(0x40200f, 0x5e3015, 0x7e441d, 0x9e5c28, 0xbf7a3a);
const PELT = ramp(0x4e3220, 0x6e4a30, 0x8e6542, 0xad8258, 0xcaa276);
const GRAIN = ramp(0x7a5618, 0xa57b26, 0xcca13a, 0xe6c158, 0xf8e08e);

/** Smoothly shaded ellipse lit from the top left; returns whether a pixel was painted. */
function blob(c: Canvas, cx: number, cy: number, rx: number, ry: number, r: Ramp, flatBottom = false): void {
  c.each((x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy > 1) return null;
    if (flatBottom && y + 0.5 > cy + ry * 0.75) return null;
    const light = -dx * 0.55 - dy * 0.8;
    const edge = dx * dx + dy * dy > 0.72;
    if (edge && light < 0) return r[0];
    return light > 0.55 ? r[4] : light > 0.1 ? r[3] : light > -0.35 ? r[2] : r[1];
  });
}

/** A bone end: shaft along x from x0 to x1 at row y, with a two-lobed knob at x1. */
function bone(c: Canvas, x0: number, x1: number, y: number): void {
  c.rect(x0, y, x1 - x0, 2, BONE);
  c.rect(x0, y + 1, x1 - x0, 1, BONE_SHADE);
  c.rect(x1, y - 1, 2, 4, BONE);
  c.set(x1 + 1, y + 2, BONE_SHADE);
  c.set(x1 + 1, y - 1, BONE_SHADE);
}

// ---- meat ----------------------------------------------------------------------------------------

/** A plucked bird: round body, a folded wing, two drumsticks with bony knuckles. */
function fowl(c: Canvas, skin: Ramp, cooked: boolean): void {
  blob(c, 6.5, 9, 5.6, 4.6, skin);
  // Drumsticks pointing up and to the right, ending in bone.
  for (const [x, y] of [[10, 5], [12, 7]] as const) {
    c.rect(x, y, 2, 2, skin[2]);
    c.set(x, y, skin[3]);
    c.set(x + 2, y - 1, BONE);
    c.set(x + 3, y - 2, BONE);
    c.set(x + 3, y - 1, BONE_SHADE);
  }
  // The wing fold and a sheen.
  c.line(4, 9, 8, 11, skin[1]);
  c.line(5, 8, 8, 10, skin[3]);
  c.set(4, 6, shade(skin[4], cooked ? 0.45 : 0.25));
  c.set(5, 5, shade(skin[4], cooked ? 0.3 : 0.15));
  if (!cooked) for (const [x, y] of [[3, 10], [9, 12], [6, 12]] as const) c.set(x, y, skin[1]);
  else for (const [x, y] of [[3, 11], [8, 12], [10, 10]] as const) c.set(x, y, skin[0]);
}

/** A leg of mutton: a teardrop of meat narrowing to the shank, the bone sticking out at the top right. */
function mutton(c: Canvas, meat: Ramp, fat: Ramp, cooked: boolean): void {
  c.each((x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    // Distance to the segment from the round end (5.5, 10) to the shank (11, 5); radius tapers 4.6 -> 1.8.
    const ax = 5.5;
    const ay = 10;
    const bx = 11;
    const by = 5;
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const d = Math.hypot(px - (ax + (bx - ax) * t), py - (ay + (by - ay) * t));
    const r = 4.6 - 2.8 * t;
    if (d > r) return null;
    const rim = d > r - 1.1 && py < ay + (by - ay) * t + 0.5;
    if (rim) return fat[t > 0.6 ? 2 : 3];
    const light = (ax + (bx - ax) * t - px) * 0.3 + (ay + (by - ay) * t - py) * 0.4;
    return light > 0.8 ? meat[4] : light > 0 ? meat[3] : light > -0.9 ? meat[2] : meat[1];
  });
  c.set(12, 4, BONE);
  c.set(13, 3, BONE);
  c.set(13, 2, BONE);
  c.set(14, 2, BONE_SHADE);
  c.set(14, 3, BONE_SHADE);
  if (!cooked) {
    c.line(4, 11, 7, 9, meat[1]);
    c.set(6, 12, fat[3]);
  } else {
    // Grill marks.
    c.line(3, 10, 6, 7, meat[0]);
    c.line(5, 12, 8, 9, meat[0]);
  }
}

/** A chop: a rounded slab with a fat rim along the top and a short rib bone. */
function chop(c: Canvas, meat: Ramp, fat: Ramp, cooked: boolean): void {
  c.each((x, y) => {
    const dx = (x + 0.5 - 7) / 5.8;
    const dy = (y + 0.5 - 9) / 4.6;
    const d = dx * dx + dy * dy;
    if (d > 1) return null;
    if (d > 0.62 && dy < 0.35) return dy < -0.3 && dx < 0 ? fat[4] : fat[2];
    if (d > 0.8) return meat[0];
    const light = -dx * 0.5 - dy * 0.7;
    return light > 0.4 ? meat[4] : light > 0 ? meat[3] : light > -0.4 ? meat[2] : meat[1];
  });
  bone(c, 11, 13, 8);
  if (!cooked) {
    // Marbling.
    c.line(4, 9, 7, 10, fat[3]);
    c.set(8, 8, fat[3]);
    c.set(5, 11, meat[1]);
  } else {
    c.line(3, 8, 6, 11, meat[0]);
    c.line(6, 7, 9, 10, meat[0]);
    c.set(4, 7, shade(meat[4], 0.35));
  }
}

// ---- vegetables and grain --------------------------------------------------------------------------

function potato(c: Canvas): void {
  blob(c, 8, 8.5, 6, 4.6, TUBER);
  for (const [x, y] of [[5, 7], [9, 6], [11, 10], [7, 11]] as const) c.set(x, y, TUBER[0]);
  c.set(5, 6, TUBER[4]);
}

function bakedPotato(c: Canvas): void {
  // Roasted dark and crisp, split open along the top on a fluffy yellow inside with a pat of melting butter.
  blob(c, 8, 9.5, 6.6, 4.4, ramp(0x34200d, 0x523214, 0x744a20, 0x94642e, 0xb48246));
  c.each((x, y) => {
    const dx = (x + 0.5 - 8) / 4.6;
    const dy = (y + 0.5 - 8) / 2.4;
    if (dx * dx + dy * dy > 1) return null;
    return dy < -0.3 ? rgb(0xfdf0c0) : dy < 0.4 ? rgb(0xf0d88c) : rgb(0xd6b468);
  });
  c.rect(7, 6, 3, 2, rgb(0xfff6a8));
  c.set(9, 7, rgb(0xf2cc3e));
  c.set(10, 8, rgb(0xf2cc3e));
  // Steam.
  const steam = rgb(0xdcd8d0);
  for (const [x, y] of [[6, 3], [7, 2], [6, 1], [10, 4], [11, 3], [10, 2]] as const) c.set(x, y, steam);
}

function carrot(c: Canvas): void {
  // An orange root from the tip at the lower left to wide shoulders at the upper right, then green tops.
  for (let t = 0; t <= 9; t++) {
    const x = 3 + t;
    const y = 13 - t;
    const w = Math.floor(t / 3);
    for (let k = -w; k <= w; k++) {
      const col = k < 0 ? CARROT[4] : k === 0 ? CARROT[3] : k === w ? CARROT[1] : CARROT[2];
      c.set(x + k, y + k, col);
      c.set(x + k + 1, y + k, col);
    }
    if (t % 3 === 1 && t > 2) c.set(x + w, y + w, CARROT[0]);
  }
  const g = P.OAK_LEAF;
  c.line(13, 3, 14, 1, g[3]);
  c.line(13, 3, 11, 1, g[4]);
  c.line(13, 3, 15, 3, g[2]);
  c.set(12, 2, g[3]);
}

function wheatSeeds(c: Canvas): void {
  for (const [x, y] of [[3, 5], [8, 3], [11, 7], [5, 10], [9, 11], [2, 12], [12, 12]] as const) {
    // A plump grain with a dark crease down one side.
    c.set(x, y, GRAIN[4]);
    c.set(x + 1, y, GRAIN[3]);
    c.set(x, y + 1, GRAIN[3]);
    c.set(x + 1, y + 1, GRAIN[1]);
    c.set(x, y + 2, GRAIN[2]);
    c.set(x + 1, y + 2, GRAIN[2]);
  }
}

function wheat(c: Canvas): void {
  // A sheaf: plump ears fanned out at the top, stalks gathered by a cord tie, the cut ends splayed below.
  const stalk = ramp(0x6a5524, 0x8c7232, 0xab8f44, 0xc7ab5c, 0xdcc47c);
  const ears: [number, number][] = [[2, 3], [5, 1], [8, 1], [11, 2], [13, 5]];
  for (const [x, y] of ears) {
    c.line(x + 1, y + 4, 8, 10, stalk[2]);
    c.line(x, y + 4, 7, 10, stalk[3]);
  }
  for (const [x, y] of ears) {
    for (let i = 0; i < 4; i++) {
      c.set(x, y + i, i % 2 === 0 ? GRAIN[4] : GRAIN[3]);
      c.set(x + 1, y + i, i % 2 === 0 ? GRAIN[2] : GRAIN[1]);
    }
    c.set(x, y - 1, GRAIN[3]);
  }
  for (const [x, w] of [[4, 0], [6, 1], [8, 1], [10, 0], [12, 0]] as const) {
    c.line(7 + w, 12, x, 14, stalk[2]);
    c.set(x, 14, stalk[0]);
  }
  c.rect(6, 10, 4, 2, P.CLOTH[2]);
  c.rect(6, 10, 4, 1, P.CLOTH[4]);
}

function flour(c: Canvas): void {
  // A linen sack tied at the neck, a wheat ear stamped on its front, a little flour spilled at its foot.
  c.each((x, y) => {
    if (y < 5 || y > 14) return null;
    const half = y < 7 ? 3 + (y - 5) : y > 12 ? 5 - (y - 12) : 5;
    const dx = x + 0.5 - 7.5;
    if (Math.abs(dx) > half) return null;
    return dx < -half + 1.5 ? LINEN[4] : dx > half - 1.5 ? LINEN[1] : y > 12 ? LINEN[2] : LINEN[3];
  });
  c.rect(6, 3, 4, 2, LINEN[3]);
  c.rect(5, 1, 6, 2, LINEN[2]);
  c.set(5, 1, LINEN[4]);
  c.rect(6, 4, 4, 1, P.CLOTH[1]);
  c.line(7, 12, 8, 8, GRAIN[1]);
  c.set(7, 9, GRAIN[2]);
  c.set(9, 10, GRAIN[2]);
  c.set(7, 11, GRAIN[2]);
  c.rect(11, 13, 3, 1, rgb(0xfbf8f0));
  c.set(13, 12, rgb(0xfbf8f0));
}

function dough(c: Canvas): void {
  blob(c, 8, 9.5, 6.2, 4.4, DOUGH, true);
  c.each((x, y) => (y === 12 && x >= 3 && x <= 12 ? DOUGH[1] : null));
  c.line(6, 8, 9, 9, DOUGH[1]);
  c.set(5, 7, rgb(0xffffff));
  c.set(6, 6, DOUGH[4]);
}

function bread(c: Canvas): void {
  // A crusty loaf on a flat bottom, three slashes opening onto pale crumb.
  blob(c, 8, 9.5, 7, 4.8, CRUST, true);
  c.each((x, y) => (y === 13 && x >= 2 && x <= 13 ? CRUST[0] : null));
  for (const x of [4, 7, 10]) {
    c.set(x, 8, CRUMB);
    c.set(x + 1, 7, CRUMB);
    c.set(x + 1, 8, CRUST[1]);
  }
  c.set(4, 6, CRUST[4]);
}

function hearthStew(c: Canvas): void {
  // An earthenware bowl, brimming: stew with carrot and potato, curls of steam above.
  const bowl = P.FIRED_CLAY;
  c.each((x, y) => {
    const dx = (x + 0.5 - 8) / 6.6;
    const dy = (y + 0.5 - 8) / 6;
    if (y < 8 || dx * dx + dy * dy > 1) return null;
    return dx < -0.45 ? bowl[4] : dx < 0.1 ? bowl[3] : dx < 0.55 ? bowl[2] : bowl[1];
  });
  c.rect(5, 14, 6, 1, bowl[0]);
  c.each((x, y) => {
    const dx = (x + 0.5 - 8) / 6.2;
    const dy = (y + 0.5 - 8) / 1.7;
    if (dx * dx + dy * dy > 1) return null;
    return dy < 0 ? STEW[3] : STEW[2];
  });
  c.rect(2, 9, 12, 1, bowl[4]);
  for (const [x, y, col] of [[4, 7, CARROT[3]], [9, 8, CARROT[2]], [7, 7, rgb(0xe8d08a)], [11, 7, rgb(0xe8d08a)], [6, 8, P.OAK_LEAF[3]]] as const) {
    c.set(x, y, col);
  }
  const steam = rgb(0xdcd8d0);
  for (const [x, y] of [[5, 4], [6, 3], [5, 2], [10, 5], [11, 4], [10, 3]] as const) c.set(x, y, steam);
}

function hide(c: Canvas): void {
  // A stretched pelt: a rounded body, four leg flaps and a darker stripe down the spine.
  const inside = (x: number, y: number): boolean => {
    const dx = (x - 7.5) / 4.8;
    const dy = (y - 7.5) / 5.8;
    if (dx * dx + dy * dy <= 1) return true;
    return [[2.5, 3], [12.5, 3], [2.5, 12], [12.5, 12]].some(([fx, fy]) => Math.hypot(x - fx, y - fy) < 1.7);
  };
  c.each((x, y) => {
    if (!inside(x + 0.5, y + 0.5)) return null;
    const d = Math.hypot((x + 0.5 - 7.5) / 5, (y + 0.5 - 7.5) / 6);
    if (Math.abs(x + 0.5 - 7.5) < 0.9 && y > 2 && y < 13) return PELT[1];
    return d > 0.95 ? PELT[0] : x + y < 12 ? PELT[4] : d < 0.55 ? PELT[3] : PELT[2];
  });
}

export const FOOD_ICONS: PainterSet = {
  item_raw_fowl: icon((c) => fowl(c, RAW_SKIN, false)),
  item_cooked_fowl: icon((c) => fowl(c, GOLDEN, true)),
  item_raw_mutton: icon((c) => mutton(c, RAW_MEAT, FAT, false)),
  item_cooked_mutton: icon((c) => mutton(c, ROAST, ROAST_FAT, true)),
  item_raw_chop: icon((c) => chop(c, RAW_MEAT, FAT, false)),
  item_cooked_chop: icon((c) => chop(c, ROAST, ROAST_FAT, true)),
  item_potato: icon(potato),
  item_baked_potato: icon(bakedPotato),
  item_carrot: icon(carrot),
  item_wheat_seeds: icon(wheatSeeds),
  item_wheat: icon(wheat),
  item_flour: icon(flour),
  item_dough: icon(dough),
  item_bread: icon(bread),
  item_hearth_stew: icon(hearthStew),
  item_hide: icon(hide),
};
