/**
 * Brewing blocks (BREWING_PLAN 3, 6): tea bushes and coffee shrubs, the clay cup in its five states, a bucket on a
 * furnace top and the kettle pot. Cutout sprites (alpha 0 or 255) drawn at their real size in the tile, standing on the
 * bottom row: the cup body is x 5..10, y 11..15; a cone sits at x 4..11, y 6..10; a bucket or the kettle at x 3..12,
 * y 7..15. The renderer's stand-in draws them as crossed quads, the real meshes sample these same rectangles.
 */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { type Ramp, rgb } from './palette';

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

const TEA = ramp(0x14301f, 0x1d452a, 0x2a5e35, 0x3a7a43, 0x58a058);
const TEA_TIP = ramp(0x6c8f2c, 0x8db03c, 0xa9cc52, 0xc4e070, 0xe0f4a0);
const COFFEE = ramp(0x10281a, 0x193b25, 0x24512f, 0x32683a, 0x4b8650);
const CHERRY = ramp(0x4a0a10, 0x7c1216, 0xb21f1e, 0xdc3b2a, 0xff8a6a);
const GREEN_FRUIT = ramp(0x3a5a1c, 0x56782a, 0x75983a, 0x98b852, 0xc0d980);
const CLAY_CUP = ramp(0x6a3a2a, 0x8a4f36, 0xa8643f, 0xc27d52, 0xdc9a70);
const FILTER = rgb(0xece4cc);
const FILTER_SHADE = rgb(0xb9ae92);
const LEAF_DRY = rgb(0x6a5a2c);
const LEAF_DRY_LIGHT = rgb(0x8a7838);
const STEAM = rgb(0xdfe6e8);
const STEAM_FAINT = rgb(0xb4c0c6);
const LIQUID = rgb(0x6a4222);
const LIQUID_LIGHT = rgb(0x8c5c30);
const WET_CLAY = ramp(0x4e2a1e, 0x663a29, 0x7d4a33, 0x935c40, 0xa87052);

// ---- bushes ---------------------------------------------------------------------------------------

/** The leafy mass of a bush: a rounded dome on the ground with gaps (`gap`) so the cutout breathes. */
function mass(c: Canvas, leaf: Ramp, gap: number, seed: string): void {
  c.withSeed(seed, () => {
    const edge = c.noise(4, 4, 1);
    const tex = c.noise(2, 2, 2);
    c.each((x, y) => {
      const dx = (x + 0.5 - 8) / 7;
      const dy = (y + 0.5 - 9.8) / 6;
      const d = dx * dx + dy * dy + (edge(x, y) - 0.5) * 0.5;
      if (d > 1 || y > 14) return null;
      if (c.hash(x, y, 7) < gap) return null;
      const lit = -dx * 0.5 - dy * 0.8 + (tex(x, y) - 0.5) * 0.9;
      return lit > 0.5 ? leaf[4] : lit > 0.1 ? leaf[3] : lit > -0.3 ? leaf[2] : leaf[1];
    });
    for (const x of [6, 8, 10]) {
      c.set(x, 15, P.OAK_BARK[1]);
      c.set(x + (x < 8 ? 1 : x > 8 ? -1 : 0), 14, P.OAK_BARK[2]);
    }
  });
}

/** Tea's "two leaves and a bud": pale lime tips sitting on the top of the bush. */
function teaTips(c: Canvas, spots: ReadonlyArray<readonly [number, number]>): void {
  for (const [x, y] of spots) {
    c.set(x, y, TEA_TIP[3]);
    c.set(x + 1, y, TEA_TIP[2]);
    c.set(x, y - 1, TEA_TIP[4]);
    c.set(x - 1, y + 1, TEA_TIP[1]);
  }
}

function cherry(c: Canvas, x: number, y: number, r: Ramp): void {
  c.set(x, y, r[4]);
  c.set(x + 1, y, r[3]);
  c.set(x, y + 1, r[2]);
  c.set(x + 1, y + 1, r[1]);
}

function teaBush(c: Canvas): void {
  mass(c, TEA, 0.1, 'tea_bush');
  teaTips(c, [[4, 6], [7, 4], [10, 5], [12, 8], [6, 8], [9, 8], [3, 10], [11, 11]]);
}

function teaBushBare(c: Canvas): void {
  mass(c, TEA, 0.3, 'tea_bush');
  // New buds only: small, tight, pale green.
  for (const [x, y] of [[5, 7], [9, 5], [11, 9]] as const) c.set(x, y, TEA_TIP[1]);
  c.set(7, 9, TEA_TIP[0]);
}

function coffeeShrub(c: Canvas): void {
  mass(c, COFFEE, 0.1, 'coffee_shrub');
  for (const [x, y] of [[3, 8], [6, 6], [10, 6], [12, 9], [8, 10], [5, 11], [11, 12], [8, 7]] as const) cherry(c, x, y, CHERRY);
}

function coffeeShrubBare(c: Canvas): void {
  mass(c, COFFEE, 0.3, 'coffee_shrub');
  for (const [x, y] of [[5, 8], [10, 7], [8, 11]] as const) {
    c.set(x, y, GREEN_FRUIT[2]);
    c.set(x + 1, y, GREEN_FRUIT[1]);
  }
}

// ---- the cup setup ----------------------------------------------------------------------------------

const CUP_LEGEND = { a: CLAY_CUP[0], b: CLAY_CUP[1], c: CLAY_CUP[2], d: CLAY_CUP[3], e: CLAY_CUP[4] } as const;

/** The clay cup: body x 5..10, y 11..15, a small ear on its right. `rim` paints the top row: the empty mouth or the drink. */
function cupBody(c: Canvas, rim: 'empty' | 'full' | 'wet'): void {
  c.sprite(['eddddc', 'edddcc', 'dccccb', 'dcccbb', 'bbbbbb'], CUP_LEGEND, 5, 11);
  c.set(11, 12, CLAY_CUP[2]);
  c.set(11, 13, CLAY_CUP[1]);
  c.set(10, 14, CLAY_CUP[0]);
  if (rim === 'empty') {
    c.rect(6, 11, 4, 1, CLAY_CUP[0]);
  } else if (rim === 'full') {
    c.rect(6, 11, 4, 1, LIQUID);
    c.set(6, 11, LIQUID_LIGHT);
  } else {
    c.rect(6, 11, 4, 1, WET_CLAY[0]);
    c.set(7, 11, LIQUID_LIGHT);
  }
}

/** The drip cone: a filter lip at y 6 and a clay funnel down to the cup's mouth. */
function cone(c: Canvas, wet: boolean): void {
  const body = wet ? WET_CLAY : CLAY_CUP;
  c.rect(4, 6, 8, 1, FILTER);
  c.set(11, 6, FILTER_SHADE);
  c.set(4, 6, P.CERAMIC[3]);
  c.sprite(['.cddddb.', '..cddb..', '..cddb..', '...cb...'], { b: body[1], c: body[2], d: body[3] }, 4, 7);
  c.set(4, 7, body[2]);
  c.set(11, 7, body[1]);
}

function clayCup(c: Canvas): void {
  cupBody(c, 'empty');
}

function cupCone(c: Canvas): void {
  cone(c, false);
  cupBody(c, 'empty');
}

function cupConeLoaded(c: Canvas): void {
  cone(c, false);
  cupBody(c, 'empty');
  // A heap of dry leaves or grounds above the filter lip.
  c.sprite(['..bbbb..', '.bcbcbb.', 'bbcbbcbb'], { b: LEAF_DRY, c: LEAF_DRY_LIGHT }, 4, 3);
  c.set(7, 2, LEAF_DRY);
  c.set(8, 2, LEAF_DRY_LIGHT);
}

function cupBrewing(c: Canvas): void {
  cone(c, true);
  cupBody(c, 'wet');
  // Hot water soaking the grounds, a drop in the air below the spout, and steam off the cone.
  c.rect(5, 5, 6, 1, LIQUID);
  c.set(6, 5, LIQUID_LIGHT);
  c.set(8, 10, LIQUID_LIGHT);
  for (const [x, y, hot] of [[6, 3, true], [7, 2, false], [9, 3, true], [10, 1, false]] as const) c.set(x, y, hot ? STEAM : STEAM_FAINT);
}

function cupFull(c: Canvas): void {
  cone(c, false);
  cupBody(c, 'full');
  for (const [x, y, hot] of [[6, 4, true], [7, 3, false], [8, 1, true], [9, 4, true], [10, 2, false]] as const) c.set(x, y, hot ? STEAM : STEAM_FAINT);
}

// ---- a bucket and the kettle --------------------------------------------------------------------------

const WOOD = P.WOOD;
const WATER = P.WATER;

/** A stave bucket at x 3..12, y 8..15 with its bail above. `boil` puts bubbles on the water and steam over the bail. */
function bucket(c: Canvas, boil: boolean): void {
  for (let y = 8; y <= 15; y++) {
    const inset = y >= 12 ? 1 : 0;
    for (let x = 3 + inset; x <= 12 - inset; x++) {
      const stave = (x - inset) % 3 === 0;
      c.set(x, y, x < 6 ? WOOD[3] : x > 10 ? WOOD[1] : stave ? WOOD[1] : WOOD[2]);
    }
  }
  for (const y of [10, 14]) c.rect(y === 14 ? 4 : 3, y, y === 14 ? 8 : 10, 1, P.IRON_METAL[2]);
  c.rect(3, 8, 10, 1, boil ? WATER[4] : WATER[3]);
  c.rect(4, 9, 8, 1, WATER[2]);
  c.line(3, 8, 5, 5, P.IRON_METAL[3]);
  c.line(5, 5, 10, 5, P.IRON_METAL[3]);
  c.line(10, 5, 12, 8, P.IRON_METAL[1]);
  if (!boil) return;
  for (const [x, y] of [[5, 8], [8, 8], [11, 8], [7, 9]] as const) c.set(x, y, STEAM);
  for (const [x, y, hot] of [[6, 3, true], [7, 2, false], [9, 3, true], [8, 1, false], [10, 2, true]] as const) c.set(x, y, hot ? STEAM : STEAM_FAINT);
}

/** The kettle pot: a copper belly at x 3..12, y 8..15, a lid with a knob, a spout left and a handle right. */
function kettle(c: Canvas, hot: boolean): void {
  const k = P.COPPER;
  c.sprite(
    [
      '..bbbbbbbb..',
      '.bddddccccb.',
      'bddeddcccccb',
      'bddddcccccbb',
      'bdddccccbbbb',
      '.bcccccbbbb.',
      '..bbbbbbbb..',
    ],
    { b: k[1], c: k[2], d: k[3], e: k[4] },
    2,
    9,
  );
  // Lid (lifted a pixel and steaming when boiling), knob, spout and handle.
  const lid = hot ? 6 : 7;
  c.rect(4, lid, 8, 2, k[2]);
  c.rect(4, lid, 8, 1, k[3]);
  c.rect(7, lid - 1, 2, 1, P.BRONZE[3]);
  c.line(2, 10, 0, 8, k[2]);
  c.set(0, 8, k[4]);
  c.line(13, 9, 14, 10, P.IRON[3]);
  c.line(14, 10, 14, 13, P.IRON[3]);
  c.line(14, 13, 13, 14, P.IRON[2]);
  if (!hot) return;
  for (const [x, y, bright] of [[0, 6, true], [1, 4, false], [7, 3, true], [8, 1, false], [9, 3, false]] as const) c.set(x, y, bright ? STEAM : STEAM_FAINT);
  // The pot glows warm from the fire below.
  c.rect(5, 15, 6, 1, P.EMBER[3]);
  c.rect(6, 14, 4, 1, P.EMBER[2]);
}

export const BREW: PainterSet = {
  tea_bush: teaBush,
  tea_bush_bare: teaBushBare,
  coffee_shrub: coffeeShrub,
  coffee_shrub_bare: coffeeShrubBare,
  clay_cup: clayCup,
  cup_cone: cupCone,
  cup_cone_loaded: cupConeLoaded,
  cup_brewing: cupBrewing,
  cup_full: cupFull,
  furnace_bucket: (c) => bucket(c, false),
  furnace_bucket_boiling: (c) => bucket(c, true),
  kettle_pot: (c) => kettle(c, false),
  kettle_pot_on: (c) => kettle(c, true),
};
