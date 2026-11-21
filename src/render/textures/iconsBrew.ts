/**
 * Item icons of brewing (BREWING_PLAN 3, 11.1): the drip cone, cuttings, leaves and cherries and each stage they are
 * processed to, boiling water, and the six drinks. Each stage reads differently at a glance: fresh leaves are bright
 * green, dried tea olive, black tea near black; cherries red, roasted beans brown, dark beans almost black.
 */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { type RGB, type Ramp, rgb } from './palette';
import { icon, mound } from './shapes';

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

const FRESH = ramp(0x2e5a1e, 0x437a28, 0x5e9a34, 0x82bc48, 0xb4e070);
const DRIED = ramp(0x3e3a1a, 0x5a5426, 0x7a7234, 0x9c9448, 0xbeb468);
const BLACK_TEA = ramp(0x0e0b0a, 0x1c1512, 0x2c211b, 0x40322a, 0x5c493c);
const DEEP_GREEN = ramp(0x143020, 0x1e4a2e, 0x2c6a3a, 0x3e8a48, 0x62b064);
const CHERRY = ramp(0x4a0a10, 0x7c1216, 0xb21f1e, 0xdc3b2a, 0xff8a6a);
const BEAN = ramp(0x2a160c, 0x4a2814, 0x6a3e1e, 0x8c5a2c, 0xb07a40);
const DARK_BEAN = ramp(0x0c0605, 0x1a0e0a, 0x2c1a12, 0x42281a, 0x5e3c28);
const GROUNDS = ramp(0x241309, 0x3e2412, 0x5a3820, 0x765030, 0x946c42);
const DARK_GROUNDS = ramp(0x0e0806, 0x1c1210, 0x2c1e18, 0x40302a, 0x58463c);
const SOIL = ramp(0x2c1e16, 0x42301f, 0x5a4229, 0x765836, 0x8f7048);
const BERRY = ramp(0x2a0c24, 0x4e1238, 0x7a1a4c, 0xa8306a, 0xe07aa4);
const CUP = ramp(0x6a3a2a, 0x8a4f36, 0xa8643f, 0xc27d52, 0xdc9a70);
const STEAM: RGB = rgb(0xe4eaec);
const STEAM_FAINT: RGB = rgb(0xb4c0c6);

/** A leaf pointing up and out from (x, y) in direction `dir`: lit on top, `len` long. */
function leaf(c: Canvas, x: number, y: number, dir: 1 | -1, len: number, r: Ramp): void {
  for (let i = 0; i < len; i++) {
    const yy = y - Math.floor(i / 2);
    c.set(x + dir * i, yy, i < 2 ? r[2] : r[3]);
    c.set(x + dir * i, yy + 1, r[1]);
    if (i === len - 1) c.set(x + dir * i, yy, r[4]);
  }
}

/** A coffee bean: an oval with a centre crease, lit from the upper left. */
function bean(c: Canvas, x: number, y: number, r: Ramp): void {
  c.sprite(['.bcc.', 'bcddb', 'bcdcb', 'bcbbb', '.bbb.'], { b: r[2], c: r[3], d: r[4] }, x, y);
  c.set(x + 2, y + 1, r[0]);
  c.set(x + 2, y + 2, r[0]);
  c.set(x + 2, y + 3, r[0]);
}

function dripCone(c: Canvas): void {
  c.rect(2, 3, 12, 2, P.CERAMIC[3]);
  c.rect(2, 3, 12, 1, P.CERAMIC[4]);
  c.rect(11, 3, 3, 2, P.CERAMIC[1]);
  const rows = [[3, 12], [4, 11], [5, 10], [6, 9], [7, 8], [7, 8]];
  rows.forEach(([a, b], i) => {
    for (let x = a; x <= b; x++) c.set(x, 5 + i, x < 6 ? CUP[3] : x > 9 ? CUP[1] : CUP[2]);
  });
  c.rect(7, 11, 2, 2, CUP[0]);
}

function cutting(c: Canvas, leafRamp: Ramp, fruit: boolean): void {
  // A stem with three leaves rising from a ball of soil and roots.
  c.line(8, 11, 8, 4, FRESH[1]);
  c.line(9, 11, 9, 5, FRESH[2]);
  leaf(c, 8, 8, -1, 5, leafRamp);
  leaf(c, 9, 6, 1, 5, leafRamp);
  leaf(c, 8, 10, 1, 4, leafRamp);
  c.set(8, 3, leafRamp[4]);
  c.set(9, 3, leafRamp[3]);
  if (fruit) {
    c.set(5, 9, CHERRY[3]);
    c.set(5, 10, CHERRY[2]);
  }
  // The soil ball with a few root threads.
  c.sprite(['..bbbbbb..', '.bccdcccb.', 'bcdcccdccb', 'bbcccbccbb', '.bbbbbbbb.'], { b: SOIL[1], c: SOIL[2], d: SOIL[3] }, 3, 11);
  for (const x of [5, 8, 10]) c.set(x, 15, SOIL[3]);
}

function pileOf(c: Canvas, r: Ramp, flecks: RGB | null): void {
  mound(c, r, flecks);
}

function leaves(c: Canvas): void {
  leaf(c, 3, 10, 1, 7, FRESH);
  leaf(c, 12, 9, -1, 7, FRESH);
  leaf(c, 4, 13, 1, 8, FRESH);
  leaf(c, 11, 12, -1, 6, FRESH);
  leaf(c, 5, 7, 1, 6, FRESH);
}

function cherries(c: Canvas): void {
  c.line(2, 3, 8, 6, P.OAK_BARK[3]);
  c.line(8, 6, 13, 3, P.OAK_BARK[3]);
  leaf(c, 8, 5, 1, 5, DEEP_GREEN);
  for (const [x, y] of [[3, 7], [7, 9], [10, 6], [5, 11], [10, 11]] as const) {
    c.sprite(['.dd.', 'dede', 'ccdc', '.bb.'], { b: CHERRY[1], c: CHERRY[2], d: CHERRY[3], e: CHERRY[4] }, x, y);
  }
}

function beans(c: Canvas, r: Ramp): void {
  bean(c, 2, 8, r);
  bean(c, 7, 4, r);
  bean(c, 9, 9, r);
}

function boilingPail(c: Canvas): void {
  // A tapered stave bucket of bubbling water with steam rising.
  const w = P.WOOD;
  for (let y = 7; y <= 14; y++) {
    const inset = Math.floor((y - 7) / 4);
    for (let x = 2 + inset; x <= 13 - inset; x++) c.set(x, y, x < 5 ? w[3] : x > 10 ? w[1] : (x - inset) % 3 === 0 ? w[1] : w[2]);
  }
  for (const y of [9, 13]) c.rect(2 + Math.floor((y - 7) / 4), y, 12 - 2 * Math.floor((y - 7) / 4), 1, P.IRON_METAL[2]);
  c.rect(2, 6, 12, 1, P.WATER[4]);
  c.rect(3, 7, 10, 1, P.WATER[3]);
  for (const x of [4, 7, 10]) c.set(x, 6, STEAM);
  c.line(2, 6, 4, 3, P.IRON_METAL[3]);
  c.line(4, 3, 11, 3, P.IRON_METAL[3]);
  c.line(11, 3, 13, 6, P.IRON_METAL[1]);
  for (const [x, y, hot] of [[5, 1, true], [6, 0, false], [9, 1, true], [10, 0, false]] as const) c.set(x, y, hot ? STEAM : STEAM_FAINT);
}

/**
 * A cup of drink seen from the front and above: clay body with an ear, the liquid ellipse at the rim in the drink's
 * colours, steam above. `extra` adds the drink's own mark.
 */
function cup(c: Canvas, liquid: Ramp, extra: (c: Canvas) => void): void {
  c.sprite(
    ['.bbbbbbbbbb.', 'bddddddddddb', 'bddddddddddb', '.bdcccccccdb', '..bcccccccb.', '..bcccccccb.', '...bbbbbbb..'],
    { b: CUP[1], c: CUP[2], d: CUP[3] },
    2,
    7,
  );
  c.rect(3, 8, 10, 2, liquid[2]);
  c.rect(4, 8, 8, 1, liquid[3]);
  c.set(4, 8, liquid[4]);
  c.sprite(['bb.', '.cb', '.cb', 'bb.'], { b: CUP[1], c: CUP[2] }, 13, 9);
  extra(c);
  for (const [x, y, hot] of [[5, 5, true], [6, 3, false], [9, 5, true], [10, 3, false], [8, 1, true]] as const) c.set(x, y, hot ? STEAM : STEAM_FAINT);
}

const GREEN_TEA = ramp(0x5a6a1e, 0x748a2a, 0x9fae45, 0xc0cd6a, 0xe6f0a8);
const BLACK_CUP = ramp(0x3a1608, 0x5a2610, 0x7a3b1c, 0x9a5430, 0xc27a50);
const BERRY_CUP = ramp(0x701a2c, 0x8e2640, 0xa8324a, 0xc4506a, 0xe68aa0);
const ROAST_CUP = ramp(0x3e2412, 0x56361a, 0x6b4423, 0x8c5c30, 0xc79a62);
const DARK_CUP = ramp(0x080403, 0x140a06, 0x2c1a10, 0x44291a, 0x6a4430);
const TRAIL_CUP = ramp(0x2c1a0c, 0x3c2412, 0x4a2f1a, 0x684630, 0x8a6446);

export const BREW_ICONS: PainterSet = {
  item_drip_cone: icon(dripCone),
  item_tea_cutting: icon((c) => cutting(c, FRESH, false)),
  item_coffee_cutting: icon((c) => cutting(c, DEEP_GREEN, true)),
  item_tea_leaves: icon(leaves),
  item_dried_tea: icon((c) => pileOf(c, DRIED, P.CLOTH[4])),
  item_black_tea: icon((c) => pileOf(c, BLACK_TEA, BLACK_TEA[4])),
  item_berry_tea_blend: icon((c) => pileOf(c, DRIED, BERRY[3])),
  item_coffee_cherries: icon(cherries),
  item_roasted_beans: icon((c) => beans(c, BEAN)),
  item_dark_beans: icon((c) => beans(c, DARK_BEAN)),
  item_ground_coffee: icon((c) => pileOf(c, GROUNDS, GROUNDS[4])),
  item_ground_dark_coffee: icon((c) => pileOf(c, DARK_GROUNDS, DARK_GROUNDS[4])),
  item_trail_blend: icon((c) => pileOf(c, GROUNDS, DARK_GROUNDS[1])),
  item_boiling_pail: icon(boilingPail),
  item_green_tea: icon((c) => cup(c, GREEN_TEA, (cv) => leaf(cv, 6, 9, 1, 3, FRESH))),
  item_black_tea_cup: icon((c) => cup(c, BLACK_CUP, () => undefined)),
  item_berry_tea: icon((c) => cup(c, BERRY_CUP, (cv) => {
    cv.set(5, 8, BERRY[3]);
    cv.set(9, 9, BERRY[2]);
  })),
  item_light_roast: icon((c) => cup(c, ROAST_CUP, (cv) => cv.rect(5, 8, 6, 1, ROAST_CUP[4]))),
  item_dark_roast: icon((c) => cup(c, DARK_CUP, (cv) => cv.set(5, 8, DARK_CUP[4]))),
  item_trail_blend_cup: icon((c) => cup(c, TRAIL_CUP, (cv) => cv.line(5, 9, 10, 7, P.WOOD[3]))),
};
