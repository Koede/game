/**
 * The shells of multiblock hearths (spec 17): the wall blocks of each tier, the electrode and the hatches and port
 * set into a wall. Every one has an `_on` twin for the formed hearth, whose seams glow with the fire inside: ember
 * for brick, white-hot for refractory brick, violet for plasma casing, gold for star casing. The tiles of whole walls
 * tile seamlessly; the seams that glow are the ones that run off the tile edges, so a formed wall reads as one
 * glowing grid rather than a pattern of separate blocks.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, rivet, tone } from './brush';
import { brick, masonry } from './building';
import * as P from './palette';
import { type RGB, type Ramp, mix, rgb, shade } from './palette';

/** Dense pale firebrick fired with coke: buff with dark grog speckles. */
const REFRACTORY: Ramp = [rgb(0x7a7060), rgb(0x978c76), rgb(0xb0a48a), rgb(0xc6ba9e), rgb(0xdcd1b5)];
const REFRACTORY_MORTAR = rgb(0x4a4440);
/** Seam glow of a formed Arc hearth, dim to bright: hotter than brick's ember, short of white. */
const WHITE_HOT: Ramp = [rgb(0x8a3a14), rgb(0xd86a1e), rgb(0xf8922a), rgb(0xffbe4a), rgb(0xffe48c)];

/** Lights every seam pixel (picked by `isSeam`) in a ramp that wanders along the seam, and warms the edge it touches. */
function glowSeams(c: Canvas, isSeam: (x: number, y: number) => boolean, glow: Ramp, warmth = 0.22): void {
  const seam = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) seam[y * 16 + x] = isSeam(x, y) ? 1 : 0;
  const at = (x: number, y: number): boolean => seam[(((y % 16) + 16) % 16) * 16 + (((x % 16) + 16) % 16)] === 1;
  const n = c.noise(4, 4, 7);
  c.each((x, y) => {
    if (at(x, y)) return tone([glow[2], glow[3], glow[3], glow[4]], 0.2 + n(x, y) * 0.8);
    const near = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
    return near ? mix(c.get(x, y), glow[2], warmth) : null;
  });
}

// ---- walls ---------------------------------------------------------------------------------------------

function brickWall(c: Canvas, lit: boolean): void {
  c.withSeed('brick', () => brick(c));
  if (!lit) return;
  const m = P.MORTAR;
  const isMortar = (x: number, y: number): boolean => {
    const [r, g, b] = c.get(x, y);
    return r === m[0] && g === m[1] && b === m[2];
  };
  const mortar = new Set<number>();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (isMortar(x, y)) mortar.add(y * 16 + x);
  glowSeams(c, (x, y) => mortar.has(y * 16 + x), P.EMBER, 0.1);
}

function refractory(c: Canvas, lit: boolean): void {
  const r = REFRACTORY;
  const f = c.noise(4, 4, 1);
  masonry(c, 4, 8, (id, x, y) => tone([r[1], r[2], r[3]], 0.2 + c.hash(id, 0, 1) * 0.45 + f(x, y) * 0.35), REFRACTORY_MORTAR, r[0]);
  // Grog: dark specks of coke burnt into the clay.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (y % 4 === 3 || c.hash(x, y, 5) > 0.04) continue;
    const [cr] = c.get(x, y);
    if (cr !== REFRACTORY_MORTAR[0]) c.set(x, y, shade(r[0], -0.2));
  }
  if (lit) glowSeams(c, (x, y) => y % 4 === 3 || (x + (Math.floor(y / 4) % 2 === 0 ? 0 : 4)) % 8 === 7, WHITE_HOT, 0.28);
}

/** Four bolted 8x8 plates; the seams between them run along x = 7 and y = 7 and off every tile edge. */
function plates(c: Canvas, ramp: Ramp, seam: RGB, detail: (c: Canvas, px: number, py: number) => void): void {
  const f = c.noise(4, 4, 1);
  c.each((x, y) => {
    if (x % 8 === 7 || y % 8 === 7) return seam;
    const u = x % 8;
    const v = y % 8;
    const base = tone([ramp[1], ramp[2], ramp[2], ramp[3]], 0.15 + f(x, y) * 0.6 + c.hash(x >> 3, y >> 3, 2) * 0.2);
    if (u === 0 || v === 0) return shade(base, 0.18);
    if (u === 6 || v === 6) return shade(base, -0.2);
    return base;
  });
  for (const py of [0, 8]) for (const px of [0, 8]) detail(c, px, py);
}

function plasmaCasing(c: Canvas, lit: boolean): void {
  const t = P.TUNGSTEN;
  const s = P.STEEL;
  plates(c, t, P.SOOT, (cc, px, py) => {
    // Four corner bolts on every plate, each lit on its upper left.
    for (const [dx, dy] of [[1, 1], [5, 1], [1, 5], [5, 5]]) rivet(cc, px + dx, py + dy, s[3], t[0]);
  });
  if (lit) glowSeams(c, (x, y) => x % 8 === 7 || y % 8 === 7, P.PLASMA, 0.25);
}

function starCasing(c: Canvas, lit: boolean): void {
  const a = P.STAR_ALLOY;
  plates(c, a, shade(a[0], -0.4), (cc, px, py) => {
    // A fused-quartz lens in a gold ring at the heart of each plate.
    cc.disc(px + 3, py + 3, 2.1, P.GOLD[1]);
    cc.disc(px + 3, py + 3, 1.3, P.GLASS[2]);
    cc.set(px + 2, py + 2, P.GLASS[4]);
    cc.set(px + 4, py + 4, P.GOLD[3]);
  });
  // Gold trim along the top and left of every plate.
  for (let i = 0; i < 16; i++) for (const k of [0, 8]) {
    if (i % 8 === 7) continue;
    c.set(i, k, P.GOLD[2]);
    c.set(k, i, P.GOLD[2]);
  }
  if (lit) glowSeams(c, (x, y) => x % 8 === 7 || y % 8 === 7, P.STARFIRE, 0.3);
}

// ---- parts set into a wall ------------------------------------------------------------------------------

/** The riveted iron frame every hatch and port shares; formed, the gap around it glows. */
function partFrame(c: Canvas, lit: boolean): void {
  const m = P.IRON_METAL;
  c.fill(m[1]);
  c.frame(0, 0, 16, 16, lit ? P.EMBER[3] : P.SOOT);
  bevel(c, 1, 1, 14, 14, m[3], m[0]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rivet(c, x, y, m[4], m[0]);
  if (lit) {
    for (let i = 1; i < 15; i++) {
      c.blend(i, 1, P.EMBER[2], 0.35);
      c.blend(1, i, P.EMBER[2], 0.35);
      c.blend(i, 14, P.EMBER[2], 0.35);
      c.blend(14, i, P.EMBER[2], 0.35);
    }
  }
}

function itemHatch(c: Canvas, lit: boolean): void {
  partFrame(c, lit);
  // A bronze chute mouth: a square funnel stepping in to a dark (or fire-lit) throat, with a down arrow.
  const b = P.BRONZE;
  c.rect(4, 4, 8, 8, b[1]);
  bevel(c, 4, 4, 8, 8, b[4], b[0]);
  c.rect(5, 5, 6, 6, b[2]);
  bevel(c, 5, 5, 6, 6, b[0], b[3]);
  c.rect(6, 6, 4, 4, lit ? P.EMBER[2] : P.SOOT);
  if (lit) {
    c.rect(7, 7, 2, 2, P.EMBER[4]);
    c.set(6, 9, P.EMBER[1]);
  } else c.rect(6, 6, 4, 1, shade(P.SOOT, 0.12));
  // Arrow marks above and below: items go in and come out.
  c.set(7, 2, b[4]);
  c.set(8, 2, b[4]);
  c.set(7, 13, b[3]);
  c.set(8, 13, b[3]);
}

function fluidHatch(c: Canvas, lit: boolean): void {
  partFrame(c, lit);
  // A round flanged pipe port with a sight glass, and a valve handle on the frame.
  const m = P.IRON_METAL;
  c.disc(7.5, 7.5, 4.6, m[2]);
  c.ring(7.5, 7.5, 4.3, m[4]);
  for (const [x, y] of [[7, 3], [12, 7], [7, 12], [3, 7]] as const) c.set(x, y, m[0]);
  c.disc(7.5, 7.5, 2.6, P.SOOT);
  if (lit) {
    c.disc(7.5, 7.5, 2.2, P.LAVA[2]);
    c.disc(7, 7, 1.2, P.LAVA[4]);
  } else {
    c.disc(7.5, 7.5, 2.2, mix(P.GLASS[0], P.SOOT, 0.6));
    c.set(6, 6, P.GLASS[3]);
  }
  c.rect(11, 1, 4, 1, P.RUST[2]);
  c.rect(12, 0, 2, 3, P.RUST[3]);
}

function powerPort(c: Canvas, lit: boolean): void {
  partFrame(c, lit);
  // Two ceramic bushings carry a copper bus through the wall; the cyan pip shows it is joined to a formed hearth.
  const k = P.CERAMIC;
  for (const x of [3, 9]) {
    c.rect(x, 3, 4, 9, k[2]);
    bevel(c, x, 3, 4, 9, k[4], k[0]);
    for (const y of [5, 7, 9]) c.rect(x, y, 4, 1, k[1]);
    c.rect(x + 1, 2, 2, 1, P.COPPER[3]);
    c.rect(x + 1, 12, 2, 1, P.COPPER[1]);
  }
  c.rect(5, 6, 6, 2, P.COPPER[2]);
  c.rect(5, 6, 6, 1, P.COPPER[4]);
  c.rect(7, 13, 2, 1, lit ? P.CYAN : P.CYAN_OFF);
  if (lit) c.rect(7, 14, 2, 1, P.CYAN_GLOW);
}

function electrode(c: Canvas, lit: boolean): void {
  // A graphite rod's end in a thick ceramic collar, seated in a dark iron ring; formed, its tip burns blue-white.
  const k = P.CERAMIC;
  const g = P.GRAPHITE;
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7.2) return P.IRON_METAL[0];
    if (d > 6.2) return y + x < 15 ? P.IRON_METAL[3] : P.IRON_METAL[1];
    if (d > 3.4) return tone([k[1], k[2], k[3]], 0.5 + (7.5 - y) * 0.06 + c.hash(x, y, 1) * 0.15);
    if (d > 2.6) return k[0];
    return lit ? tone([P.ARC_GLOW[2], P.ARC_GLOW[3], P.ARC_GLOW[4]], 1 - d / 2.6) : tone([g[1], g[2], g[3]], 0.4 + (7.5 - y) * 0.1);
  });
  // Copper clamp bolts on the collar.
  for (const [x, y] of [[7, 1], [13, 7], [7, 13], [1, 7]] as const) c.rect(x, y, 2, 2, P.COPPER[2]);
  if (lit) {
    c.ring(7.5, 7.5, 3, P.ARC_GLOW[1]);
    c.set(7, 7, rgb(0xffffff));
  }
}

/** The cold tile and its formed twin, painted from the same random stream so only the seams change. */
const both = (name: string, paint: (c: Canvas, lit: boolean) => void): PainterSet => ({
  [name]: (c) => paint(c, false),
  [`${name}_on`]: (c) => c.withSeed(name, () => paint(c, true)),
});

export const HEARTH_SHELL: PainterSet = {
  brick_on: (c) => brickWall(c, true),
  ...both('refractory_brick', refractory),
  ...both('plasma_casing', plasmaCasing),
  ...both('star_casing', starCasing),
  ...both('electrode', electrode),
  ...both('hatch_item', itemHatch),
  ...both('hatch_fluid', fluidHatch),
  ...both('power_port', powerPort),
};
