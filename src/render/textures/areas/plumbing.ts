/**
 * Textures of Bronze Age plumbing (src/content/areas/plumbing.ts): the copper water pipe, the sprinkler rose (both drawn
 * by the pipe mesher), the hand pump's casing and the cistern's hooped staves.
 */
import type { Canvas, PainterSet } from '../canvas';
import { bevel, rivet, tone } from '../brush';
import * as P from '../palette';
import { mix, type RGB } from '../palette';
import { pipe, tube, type PipeLook } from '../transport';

const K = P.COPPER;
const B = P.BRONZE;
const W = P.WATER;

/** Copper tube: warm copper with a soldered band every 5 pixels and a streak of verdigris along the dark side. */
const COPPER_PIPE: PipeLook = {
  band: tube(K, (k, t) => (t % 5 === 2 ? B[k < 4 ? 3 : 1] : k === 5 && t % 7 === 3 ? P.VERDIGRIS : k <= 3 ? K[3 - Math.floor(k / 2)] : K[2 - Math.floor((k - 4) / 2)])),
  collar: [K[4], K[2], K[0]],
  hub: (c) => {
    c.disc(7.5, 7.5, 1.9, K[1]);
    c.disc(7.5, 7.5, 1.1, W[2]);
    c.set(7, 7, W[4]);
  },
};

/** The sprinkler: a copper tube with a brass rose in the middle, its spray holes dark (or wet and glinting). */
function sprinkler(wet: boolean): PipeLook {
  return {
    band: COPPER_PIPE.band,
    collar: [B[4], B[3], B[1]],
    hub: (c) => {
      c.disc(7.5, 7.5, 3.4, B[2]);
      c.ring(7.5, 7.5, 3.4, B[0]);
      c.disc(7.5, 7.5, 2.2, B[3]);
      for (const [x, y] of [[7, 5], [5, 7], [10, 8], [8, 10], [6, 9], [9, 6], [7, 7], [8, 8]] as const) c.set(x, y, wet ? W[3] : P.SOOT);
      if (wet) for (const [x, y] of [[6, 5], [10, 7], [5, 10], [9, 10]] as const) c.set(x, y, W[4]);
    },
  };
}

/** Hand pump: an iron barrel on an oak stand with a long handle on the side and a spout. */
function pumpSide(c: Canvas): void {
  const n = c.noise(3, 6, 21);
  // Oak backboard behind the barrel, the stand below it.
  c.each((x, y) => (y >= 12 ? tone(P.WOOD, 0.25 + n(x, y) * 0.5) : tone(P.OAK_BARK, 0.35 + n(x, y) * 0.4 + (x % 5 === 0 ? -0.2 : 0))));
  c.rect(0, 12, 16, 1, P.WOOD[0]);
  // Barrel.
  for (let y = 1; y < 12; y++) for (let x = 4; x <= 11; x++) c.set(x, y, x < 6 ? P.IRON_METAL[3] : x > 9 ? P.IRON_METAL[0] : P.IRON_METAL[1 + ((x + y) % 2)]);
  for (const y of [2, 10]) c.rect(4, y, 8, 1, K[2]);
  rivet(c, 5, 6, K[4], K[0]);
  rivet(c, 10, 6, K[4], K[0]);
  // Spout to the right, dripping.
  c.rect(11, 4, 4, 2, P.IRON_METAL[2]);
  c.rect(14, 6, 1, 1, P.IRON_METAL[0]);
  c.set(14, 8, W[3]);
  // Handle up and to the left.
  c.line(4, 1, 0, 5, P.WOOD[1]);
  c.line(4, 0, 0, 4, P.WOOD[3]);
  c.set(4, 1, B[4]);
  c.frame(0, 0, 16, 16, P.WOOD[0]);
}

function pumpTop(c: Canvas): void {
  c.fill(P.WOOD[1]);
  for (let x = 0; x < 16; x += 4) c.rect(x, 0, 1, 16, P.WOOD[0]);
  c.disc(7.5, 7.5, 4.6, P.IRON_METAL[1]);
  c.ring(7.5, 7.5, 4.6, P.IRON_METAL[0]);
  c.disc(7.5, 7.5, 2, P.IRON_METAL[3]);
  c.rect(7, 2, 2, 12, P.WOOD[3]);
  c.frame(0, 0, 16, 16, P.WOOD[0]);
}

function pumpBottom(c: Canvas): void {
  const n = c.noise(2, 5, 23);
  c.each((x, y) => tone(P.WOOD, 0.15 + n(x, y) * 0.6 + (y % 4 === 0 ? -0.15 : 0)));
  c.disc(7.5, 7.5, 2.4, P.IRON_METAL[0]);
  c.disc(7.5, 7.5, 1.2, W[1]);
  c.frame(0, 0, 16, 16, P.WOOD[0]);
}

const staveTone = (x: number, n: number): RGB => tone(P.WOOD, 0.2 + n * 0.55 + (x % 4 === 0 ? -0.25 : x % 4 === 3 ? 0.12 : 0));

/** Cistern: oak staves bound with two copper hoops. */
function cisternSide(c: Canvas): void {
  const n = c.noise(1, 5, 33);
  c.each((x, y) => staveTone(x, n(x, y)));
  for (const y of [2, 12]) {
    c.rect(0, y, 16, 2, K[1]);
    c.rect(0, y, 16, 1, K[3]);
    for (let x = 2; x < 16; x += 5) rivet(c, x, y, K[4], K[0]);
  }
  c.rect(0, 0, 16, 1, P.WOOD[4]);
  c.rect(0, 15, 16, 1, P.WOOD[0]);
}

/** The open top: a rim of staves around dark rainwater with a glint. */
function cisternTop(c: Canvas): void {
  const n = c.noise(4, 4, 34);
  c.each((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6) return staveTone(x + y, n(x, y));
    if (d > 5.5) return P.WOOD[0];
    return mix(W[1], W[2], n(x, y));
  });
  for (const [x, y] of [[5, 5], [6, 5], [9, 9]] as const) c.set(x, y, W[4]);
  c.frame(0, 0, 16, 16, K[1]);
}

function cisternBottom(c: Canvas): void {
  const n = c.noise(1, 4, 35);
  c.each((x, y) => staveTone(y, n(y, x)));
  bevel(c, 0, 0, 16, 16, P.WOOD[3], P.WOOD[0]);
}

export default {
  pipe_water: (c) => pipe(c, COPPER_PIPE),
  sprinkler: (c) => pipe(c, sprinkler(false)),
  sprinkler_on: (c) => pipe(c, sprinkler(true)),
  hand_pump_side: pumpSide,
  hand_pump_top: pumpTop,
  hand_pump_bottom: pumpBottom,
  cistern_side: cisternSide,
  cistern_top: cisternTop,
  cistern_bottom: cisternBottom,
} satisfies PainterSet;
