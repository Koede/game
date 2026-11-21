/**
 * Item and fluid transport (spec 16): four pipes, the pump, the tank, the boiler, the steam turbine and the wrench.
 *
 * A pipe texture is a plus like a cable's, but wider: the mesher's 8/16 core (PIPE_CORE_MIN..MAX) samples the
 * centre square (rows and columns 4..11) and each arm samples one band of it. Bands carry the tube lengthwise -
 * rims, a highlight, the window or wrap - and the centre is the flanged junction. Corners stay transparent, so the
 * same tile is the pipe's flat item icon.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, rivet } from './brush';
import { CASE_IRON, front, well } from './casing';
import * as P from './palette';
import { type RGB, mix, rgb, shade } from './palette';
import { icon } from './shapes';

const I = CASE_IRON;
const M = P.IRON_METAL;
const LO = 4;
const HI = 11;
const inBand = (v: number): boolean => v >= LO && v <= HI;

interface PipeLook {
  /**
   * Colour of band row `k` (0 = the outer rim on the light side .. 7 = the rim on the dark side) at position `t`
   * along the arm (0..15, the same on every arm so the pattern lines up through the core).
   */
  band: (k: number, t: number) => RGB;
  /** The junction collar: light, mid and dark. */
  collar: readonly [RGB, RGB, RGB];
  /** The hub drawn in the middle of the collar. */
  hub: (c: Canvas) => void;
  /**
   * Opacity of band row `k` at `t` (default 255): item pipes are see-through where they are glazed (the mesher
   * draws them in the blended batch). Kept >= 128 so the held item's pixel extrusion still shows the glass.
   */
  see?: (k: number, t: number) => number;
}

function pipe(c: Canvas, look: PipeLook): void {
  c.each((x, y) => {
    const h = inBand(y);
    const v = inBand(x);
    if (!h && !v) return null;
    // Horizontal arms run along x with band rows y; vertical arms along y with band rows x (lit side first).
    return h ? look.band(y - LO, x) : look.band(x - LO, y);
  });
  const see = look.see;
  if (see) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inBand(x) && !inBand(y)) continue;
        c.set(x, y, c.get(x, y), inBand(y) ? see(y - LO, x) : see(x - LO, y));
      }
    }
  }
  const [hi, mid, lo] = look.collar;
  c.rect(LO, LO, 8, 8, mid);
  bevel(c, LO, LO, 8, 8, hi, lo);
  bevel(c, LO + 1, LO + 1, 6, 6, lo, shade(hi, -0.1));
  look.hub(c);
}

/** Rim, highlight and shadow rows shared by the metal tubes; `inner` paints rows 2..5. */
const tube = (metal: readonly RGB[], inner: (k: number, t: number) => RGB) => (k: number, t: number): RGB => {
  if (k === 0 || k === 7) return metal[0];
  if (k === 1) return t % 4 === 0 ? metal[4] : metal[3];
  if (k === 6) return metal[1];
  return inner(k, t);
};

// Bronze chute: a bronze-framed glass tube - bronze ribs every 4 pixels, pale glass between them that is really
// see-through (the far wall and, later, the items inside show through). The tile stays empty.
const BRONZE_GLASS = (k: number, t: number): RGB => {
  const b = P.BRONZE;
  if (t % 4 === 1) return k === 2 ? b[4] : b[2];
  if (k === 2) return P.GLASS[3];
  if (k === 5) return mix(P.GLASS[0], b[1], 0.5);
  return mix(P.GLASS[2], b[0], k === 3 ? 0.2 : 0.3);
};
const ITEM_PIPE: PipeLook = {
  band: tube(P.BRONZE, BRONZE_GLASS),
  collar: [P.BRONZE[4], P.BRONZE[2], P.BRONZE[0]],
  hub: (c) => {
    c.rect(6, 6, 4, 4, mix(P.GLASS[2], P.BRONZE[0], 0.3), 140);
    c.set(6, 6, P.GLASS[4], 190);
    c.set(9, 9, P.BRONZE[1]);
  },
  see: (k, t) => (k <= 1 || k >= 6 || t % 4 === 1 ? 255 : k === 2 ? 175 : k === 5 ? 155 : 132),
};

// Steel conveyor: blue-white steel with a long dark slot showing the rollers inside.
const FAST_PIPE: PipeLook = {
  band: tube(P.STEEL, (k, t) => {
    if (k === 2) return P.STEEL[2];
    if (k === 5) return P.STEEL[1];
    return t % 2 === 0 ? P.GRAPHITE[3] : P.GRAPHITE[1];
  }),
  collar: [P.STEEL[4], P.STEEL[2], P.STEEL[0]],
  hub: (c) => {
    c.rect(6, 6, 4, 4, P.GRAPHITE[1]);
    c.rect(6, 7, 4, 1, P.HAZARD);
    c.rect(6, 8, 4, 1, shade(P.HAZARD, -0.4));
  },
  // The roller slot: rollers solid, the gaps between them open onto the inside of the conveyor.
  see: (k, t) => ((k === 3 || k === 4) && t % 2 === 1 ? 140 : 255),
};

// Iron fluid pipe: dark iron with a short glass window in every other segment.
const FLUID_PIPE: PipeLook = {
  band: tube(M, (k, t) => {
    const window = t % 8 >= 1 && t % 8 <= 4;
    if (!window || k === 2 || k === 5) return k === 2 ? M[2] : M[1];
    return k === 3 ? P.GLASS[3] : P.GLASS[1];
  }),
  collar: [M[4], M[2], M[0]],
  hub: (c) => {
    // A flow-direction wheel: the valve handle of the junction.
    c.rect(6, 6, 4, 4, M[1]);
    c.rect(7, 6, 2, 4, P.RUST[2]);
    c.rect(6, 7, 4, 2, P.RUST[2]);
    c.set(7, 7, P.RUST[4]);
  },
};

// Steel hot pipe: cream ceramic insulation wrapped round steel, steel straps every 4 pixels, a small window.
const HOT_PIPE: PipeLook = {
  band: (k, t) => {
    const k2 = P.CERAMIC;
    if (k === 0 || k === 7) return P.STEEL[0];
    if (t % 4 === 0) return k === 1 ? P.STEEL[4] : k === 6 ? P.STEEL[0] : P.STEEL[2];
    if (t % 8 === 2 && (k === 3 || k === 4)) return k === 3 ? P.GLASS[3] : P.GLASS[1];
    return k === 1 ? k2[4] : k === 2 ? k2[3] : k === 6 ? k2[0] : k2[2];
  },
  collar: [P.STEEL[4], P.STEEL[2], P.STEEL[0]],
  hub: (c) => {
    c.rect(6, 6, 4, 4, P.CERAMIC[1]);
    c.rect(7, 7, 2, 2, P.EMBER[2]);
    c.set(7, 7, P.EMBER[3]);
  },
};

// ---- machines ---------------------------------------------------------------------------------------------

function pump(c: Canvas, lit: boolean): void {
  // A round volute with an impeller, an outlet flange up top and the inlet pipe down to the liquid.
  c.rect(6, 0, 4, 3, M[2]);
  c.rect(5, 2, 6, 1, M[4]);
  c.disc(7.5, 7.5, 4.8, M[1]);
  c.ring(7.5, 7.5, 4.6, M[4]);
  c.disc(7.5, 7.5, 3.4, P.SOOT);
  // Impeller vanes: crossed at rest, swept into a blur while it runs, with water in the eye.
  if (lit) {
    c.disc(7.5, 7.5, 3, mix(P.SOOT, M[3], 0.4));
    c.disc(7.5, 7.5, 1.6, P.WATER[3]);
  } else {
    c.line(5, 5, 10, 10, M[3]);
    c.line(5, 10, 10, 5, M[3]);
    c.disc(7.5, 7.5, 1.2, M[2]);
  }
  c.rect(6, 12, 4, 4, M[2]);
  c.rect(6, 12, 1, 4, M[4]);
  c.rect(3, 13, 2, 1, I[0]);
}

function tankSide(c: Canvas): void {
  // Iron corner posts and bands round a tall glass sight panel with a gauge scale.
  c.fill(I[2]);
  for (const x of [0, 1, 14, 15]) for (let y = 0; y < 16; y++) c.set(x, y, x === 1 ? I[4] : x === 14 ? I[1] : I[0]);
  for (const y of [0, 15]) c.rect(0, y, 16, 1, I[0]);
  c.rect(2, 1, 12, 1, I[3]);
  c.rect(2, 14, 12, 1, I[1]);
  well(c, 4, 2, 8, 11, mix(P.GLASS[0], P.SOOT, 0.55));
  for (let y = 3; y < 13; y++) c.set(5, y, mix(P.GLASS[2], P.SOOT, 0.35));
  for (let y = 4; y < 13; y += 2) c.rect(10, y, y % 4 === 0 ? 2 : 1, 1, P.GLASS[3]);
  for (const [x, y] of [[2, 3], [2, 11], [12, 3], [12, 11]]) rivet(c, x, y, I[4], I[0]);
}

function tankTop(c: Canvas): void {
  // A riveted lid with a round filler flange and a vent.
  c.fill(I[2]);
  c.frame(0, 0, 16, 16, I[0]);
  bevel(c, 1, 1, 14, 14, I[4], I[1]);
  c.disc(7.5, 7.5, 3.6, M[1]);
  c.ring(7.5, 7.5, 3.4, M[4]);
  c.disc(7.5, 7.5, 1.8, P.SOOT);
  for (const [x, y] of [[7, 4], [11, 7], [7, 11], [4, 7]]) c.set(x, y, M[0]);
  c.rect(11, 2, 3, 2, M[3]);
  for (const [x, y] of [[2, 2], [2, 12], [12, 12]]) rivet(c, x, y, I[4], I[0]);
}

function boiler(c: Canvas, lit: boolean): void {
  // A riveted copper drum, a pressure gauge, and the water/steam pipes; working, steam leaks at the safety valve.
  c.rect(2, 3, 12, 8, P.COPPER[2]);
  c.rect(2, 3, 12, 1, P.COPPER[4]);
  c.rect(2, 4, 12, 1, P.COPPER[3]);
  c.rect(2, 10, 12, 1, P.COPPER[0]);
  for (const x of [2, 13]) c.rect(x, 3, 1, 8, P.COPPER[1]);
  for (const x of [4, 7, 10]) for (const y of [5, 9]) c.set(x, y, P.COPPER[4]);
  c.disc(10.5, 7, 1.9, P.CERAMIC[3]);
  c.ring(10.5, 7, 1.9, I[0]);
  c.line(10, 7, lit ? 11 : 9, lit ? 6 : 8, rgb(0xb02818));
  // Water in at the bottom left (blue band), steam out at the top (white band).
  c.rect(3, 12, 3, 2, M[2]);
  c.rect(3, 12, 3, 1, P.WATER[3]);
  c.rect(5, 1, 3, 2, M[2]);
  c.rect(5, 1, 3, 1, P.SNOW[2]);
  if (lit) {
    c.set(6, 0, P.SNOW[4]);
    c.set(8, 0, P.SNOW[1]);
    c.rect(4, 6, 4, 2, shade(P.COPPER[2], 0.25));
  }
}

function steamTurbine(c: Canvas, lit: boolean): void {
  // A bladed rotor in a steel casing; steam enters at the left. Running, the blades blur and the rim warms.
  const s = P.STEEL;
  c.disc(7.5, 7, 5.6, s[1]);
  c.ring(7.5, 7, 5.4, s[4]);
  c.disc(7.5, 7, 4.5, P.SOOT);
  if (lit) {
    c.disc(7.5, 7, 4.2, mix(P.SOOT, s[3], 0.45));
    c.ring(7.5, 7, 3, s[2]);
  } else {
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5;
      c.line(7.5 + Math.cos(a) * 1.4, 7 + Math.sin(a) * 1.4, 7.5 + Math.cos(a + 0.35) * 4.2, 7 + Math.sin(a + 0.35) * 4.2, k % 2 === 0 ? s[3] : s[2]);
    }
  }
  c.disc(7.5, 7, 1.3, s[4]);
  // Steam inlet pipe with a white band.
  c.rect(0, 6, 3, 3, M[2]);
  c.rect(0, 6, 3, 1, P.SNOW[2]);
}

// ---- the wrench --------------------------------------------------------------------------------------------

function wrench(c: Canvas): void {
  // A bronze open-end wrench lying corner to corner: a round head with its jaw opening to the upper right, a flat
  // shaft, and a ring end at the lower left. Lit from the upper left.
  const b = P.BRONZE;
  for (let t = 3; t <= 10; t++) {
    c.set(t, 15 - t - 1, b[4]);
    c.set(t, 15 - t, b[2]);
    c.set(t + 1, 15 - t, b[1]);
  }
  const head = (x: number, y: number, cx: number, cy: number, r: number): RGB | null => {
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) return null;
    const along = (x - cx - (y - cy)) / Math.SQRT2;
    const across = Math.abs(x - cx + (y - cy)) / Math.SQRT2;
    if (along > -0.6 && across < 1.2) return null;
    const lit = (cx - x + cy - y) / (2 * r);
    return lit > 0.25 ? b[4] : lit > -0.1 ? b[3] : lit > -0.4 ? b[2] : b[1];
  };
  c.each((x, y) => head(x, y, 12, 3.5, 3.4));
  // The ring end: a closed ring around a hole that the outline will ring too.
  c.each((x, y) => {
    const d = Math.hypot(x - 2.6, y - 13);
    if (d > 2.5) return null;
    return x + y < 15 ? b[4] : x + y < 17 ? b[2] : b[1];
  });
  for (const [x, y] of [[2, 13], [3, 13], [2, 12]] as const) c.set(x, y, b[0], 0);
}

export const TRANSPORT: PainterSet = {
  pipe_item: (c) => pipe(c, ITEM_PIPE),
  pipe_item_fast: (c) => pipe(c, FAST_PIPE),
  pipe_fluid: (c) => pipe(c, FLUID_PIPE),
  pipe_fluid_hot: (c) => pipe(c, HOT_PIPE),
  ...front('pump', pump),
  tank_side: tankSide,
  tank_top: tankTop,
  ...front('boiler', boiler, false),
  ...front('steam_turbine', steamTurbine),
  item_wrench: icon(wrench),
};
