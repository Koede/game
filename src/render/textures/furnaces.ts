/**
 * The five furnace tiers, each with its own walls, crown and mouth. A lit mouth (`*_front_on`) glows in the
 * tier's colour: dull red clay, orange blast, white-yellow arc with a blue rim, violet-white plasma, a golden
 * star. The whole lit face is drawn full-bright by the renderer, so the walls around the mouth stay as dark
 * as on the unlit face and only pick up a little reflected glow.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, bevelCells, rivet, tone } from './brush';
import * as P from './palette';
import { type Ramp, mix, shade } from './palette';

type Mask = (x: number, y: number) => boolean;

interface Tier {
  walls: (c: Canvas) => void;
  crown: (c: Canvas) => void;
  /** Draws the frame of the mouth over the walls; the mouth itself is filled afterwards. */
  frame: (c: Canvas) => void;
  mouth: Mask;
  glow: Ramp;
  /** Marks drawn over the mouth (grates, flames, arcs, a star) and the cyan power pip, lit or not. */
  over?: (c: Canvas, lit: boolean) => void;
}

const archMouth: Mask = (x, y) => y >= 6 && y <= 13 && (y >= 8 ? x >= 4 && x <= 11 : y === 7 ? x >= 5 && x <= 10 : x >= 6 && x <= 9);
const doorMouth: Mask = (x, y) => x >= 4 && x <= 11 && y >= 7 && y <= 12;
const slotMouth: Mask = (x, y) => x >= 3 && x <= 12 && y >= 6 && y <= 11;
const portMouth: Mask = (x, y) => Math.hypot(x - 7.5, y - 8.5) <= 3.9;
const sunMouth: Mask = (x, y) => Math.hypot(x - 7.5, y - 7.5) <= 4.4;

/** The dark inside of a cold furnace: soot with a little grey ash on the floor. */
function cold(c: Canvas, m: Mask): void {
  let bottom = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (m(x, y)) bottom = Math.max(bottom, y);
  c.each((x, y) => {
    if (!m(x, y)) return null;
    if (y === bottom && c.hash(x, y, 1) < 0.7) return shade(P.STONE[1], -0.35);
    return m(x, y - 1) ? P.SOOT : shade(P.SOOT, 0.08);
  });
}

/**
 * A lit mouth: hottest at the bottom centre, cooling towards its rim. The renderer draws this whole face
 * full-bright, so the walls fall off into shadow away from the mouth and catch its light close to it.
 */
function hot(c: Canvas, m: Mask, glow: Ramp): void {
  let top = 16;
  let bottom = 0;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (m(x, y)) {
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    sx += x;
    sy += y;
    n++;
  }
  const cx = sx / n;
  const cy = sy / n;
  const span = Math.max(1, bottom - top);
  c.each((x, y) => {
    if (m(x, y)) return null;
    const d = Math.hypot(x - cx, y - cy);
    const lit = mix(c.get(x, y), glow[2], Math.max(0, 0.4 - d * 0.06));
    return shade(lit, -Math.min(0.42, Math.max(0, (d - 4) * 0.07)));
  });
  c.each((x, y) => {
    if (!m(x, y)) return null;
    const edge = !m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1);
    const depth = (y - top) / span;
    const v = 0.25 + depth * 0.6 - Math.abs(x - 7.5) * 0.04 + (c.hash(x, y, 2) - 0.5) * 0.25;
    return edge ? glow[1] : tone(glow, v);
  });
}

// ---- tier 1: clay -----------------------------------------------------------------------------------
const clay: Tier = {
  walls: (c) => {
    const map = c.cells(9, 4.5);
    const k = P.FIRED_CLAY;
    bevelCells(c, map, (id, x, y) => tone([k[1], k[2], k[3]], c.hash(id, 0, 1) * 0.8 + c.hash(x >> 2, y >> 2, 2) * 0.2), shade(k[0], -0.2), 0.8, 0.18, 0.25);
    // Soot licking up from the top edge.
    for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) if (c.hash(x, y, 3) < 0.6 - y * 0.2) c.blend(x, y, P.SOOT, 0.5);
  },
  crown: (c) => {
    clay.walls(c);
    const k = P.FIRED_CLAY;
    c.each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      return d < 3 ? P.SOOT : d < 4 ? shade(P.SOOT, 0.15) : d < 5.3 ? (y < 8 ? k[3] : k[1]) : null;
    });
  },
  frame: (c) => {
    const k = P.FIRED_CLAY;
    c.each((x, y) => (!archMouth(x, y) && (archMouth(x - 1, y) || archMouth(x + 1, y) || archMouth(x, y - 1) || archMouth(x, y + 1)) ? k[4] : null));
    c.rect(3, 14, 10, 1, shade(k[0], -0.1));
  },
  mouth: archMouth,
  glow: [P.EMBER[0], P.EMBER[1], P.EMBER[2], P.EMBER[2], P.EMBER[3]],
  over: (c, lit) => {
    if (!lit) return;
    for (const [x, w] of [[4, 3], [8, 4]]) c.rect(x, 13, w, 1, shade(P.COAL[1], 0.1));
    c.set(6, 12, P.EMBER[3]);
    c.set(9, 12, P.EMBER[2]);
  },
};

// ---- tier 2: blast ----------------------------------------------------------------------------------
function ironBand(c: Canvas, y: number): void {
  const iron = P.IRON_METAL;
  c.rect(0, y, 16, 2, iron[1]);
  c.rect(0, y, 16, 1, iron[2]);
  for (const x of [1, 6, 11]) rivet(c, x, y, iron[4], iron[0]);
}
const blast: Tier = {
  walls: (c) => {
    const f = P.FIREBRICK;
    c.each((x, y) => {
      const row = y >> 2;
      const u = (x + (row % 2) * 4) % 8;
      if (y % 4 === 3 || u === 7) return shade(f[0], -0.35);
      const col = tone([f[1], f[2], f[3]], c.hash(row, (x + (row % 2) * 4) >> 3, 1) * 0.9);
      return y % 4 === 0 ? shade(col, 0.1) : col;
    });
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) if (c.hash(x, y, 3) < 0.5 - y * 0.12) c.blend(x, y, P.SOOT, 0.45);
    ironBand(c, 1);
    ironBand(c, 12);
  },
  crown: (c) => {
    const iron = P.IRON_METAL;
    blast.walls(c);
    c.rect(2, 2, 12, 12, iron[1]);
    bevel(c, 2, 2, 12, 12, iron[3], iron[0]);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) c.set(x, y, (x + y) % 2 === 0 ? P.SOOT : shade(P.EMBER[0], -0.3));
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) rivet(c, x, y, iron[4], iron[0]);
  },
  frame: (c) => {
    const iron = P.IRON_METAL;
    c.rect(3, 6, 10, 8, iron[1]);
    bevel(c, 3, 6, 10, 8, iron[3], iron[0]);
    rivet(c, 3, 6, iron[4], iron[0]);
    rivet(c, 11, 6, iron[4], iron[0]);
  },
  mouth: doorMouth,
  glow: P.EMBER,
  over: (c) => {
    // Grate bars across the door.
    for (const y of [8, 10]) for (let x = 4; x <= 11; x++) c.set(x, y, shade(P.IRON_METAL[0], -0.2));
  },
};

// ---- tier 3: arc ------------------------------------------------------------------------------------
function panels(c: Canvas, ramp: Ramp, seams: number[]): void {
  const f = c.noise(4, 4, 1);
  c.each((x, y) => {
    if (seams.includes(y)) return ramp[0];
    if (seams.includes(y - 1)) return ramp[3];
    return tone([ramp[1], ramp[2], ramp[2]], f(x, y));
  });
  for (const y of seams) for (const x of [1, 14]) rivet(c, x, (y + 2) % 16, ramp[4], ramp[0]);
}
const arc: Tier = {
  walls: (c) => {
    panels(c, P.ARC_STEEL, [0, 8]);
    // Copper bus bars with ceramic insulator knobs.
    for (const x of [4, 11]) {
      c.rect(x, 0, 1, 16, P.COPPER[2]);
      c.rect(x + 1, 0, 1, 16, P.COPPER[0]);
      for (const y of [3, 11]) {
        c.rect(x - 1, y, 3, 2, P.CERAMIC[2]);
        c.set(x - 1, y, P.CERAMIC[4]);
        c.rect(x - 1, y + 1, 3, 1, P.CERAMIC[0]);
      }
    }
  },
  crown: (c) => {
    panels(c, P.ARC_STEEL, [0, 8]);
    // Three graphite electrodes in ceramic collars.
    for (const [x, y] of [[4, 4], [11, 4], [7.5, 11]]) {
      c.disc(x, y, 2.6, P.CERAMIC[1]);
      c.disc(x - 0.4, y - 0.4, 2, P.CERAMIC[3]);
      c.disc(x, y, 1.5, P.GRAPHITE[2]);
      c.set(Math.floor(x - 0.5), Math.floor(y - 0.5), P.GRAPHITE[4]);
    }
  },
  frame: (c) => {
    const s = P.ARC_STEEL;
    c.rect(2, 5, 12, 8, s[0]);
    bevel(c, 2, 5, 12, 8, s[4], s[0]);
  },
  mouth: slotMouth,
  glow: [P.ARC_GLOW[0], P.ARC_GLOW[1], P.ARC_GLOW[3], P.ARC_GLOW[4], P.ARC_GLOW[4]],
  over: (c, lit) => {
    c.rect(2, 14, 2, 1, lit ? P.CYAN : P.CYAN_OFF);
    if (!lit) return;
    // A forked arc between the electrode tips.
    c.line(5, 6, 7, 9, P.ARC_GLOW[4]);
    c.line(7, 9, 10, 7, P.ARC_GLOW[4]);
  },
};

// ---- tier 4: plasma ---------------------------------------------------------------------------------
function coilBand(c: Canvas, y: number): void {
  const k = P.COPPER;
  for (let x = 0; x < 16; x++) {
    c.set(x, y, k[3]);
    c.set(x, y + 1, x % 2 === 0 ? k[2] : k[1]);
    c.set(x, y + 2, k[0]);
  }
}
const plasma: Tier = {
  walls: (c) => {
    panels(c, P.STAR_ALLOY, [7]);
    coilBand(c, 2);
    coilBand(c, 11);
  },
  crown: (c) => {
    panels(c, P.STAR_ALLOY, [7]);
    const k = P.COPPER;
    c.each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      return d < 2.5 ? P.PLASMA[0] : d < 4.6 ? (Math.floor(Math.atan2(y - 7.5, x - 7.5) * 4) % 2 === 0 ? k[2] : k[1]) : d < 5.6 ? k[0] : null;
    });
  },
  frame: (c) => {
    const s = P.STAR_ALLOY;
    c.each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 8.5);
      return d > 3.9 && d < 5.6 ? (y < 8 ? s[4] : s[1]) : null;
    });
    for (const [x, y] of [[7, 2], [2, 8], [13, 8], [7, 14]]) c.rect(x, y, 2, 1, P.COPPER[2]);
  },
  mouth: portMouth,
  glow: [P.PLASMA[1], P.PLASMA[2], P.PLASMA[3], P.PLASMA[4], P.PLASMA[4]],
  over: (c, lit) => {
    c.rect(1, 14, 2, 1, lit ? P.CYAN : P.CYAN_OFF);
    if (!lit) return;
    // A swirl in the bottle.
    for (const [x, y] of [[6, 7], [7, 6], [8, 6], [9, 7], [9, 9], [8, 10], [7, 10]]) c.set(x, y, P.PLASMA[2]);
  },
};

// ---- tier 5: starhearth -----------------------------------------------------------------------------
const star: Tier = {
  walls: (c) => {
    panels(c, P.STAR_ALLOY, [15]);
    const g = P.GOLD;
    // Gold trim: a chevron rising towards the crown on every side.
    for (let i = 0; i < 8; i++) {
      c.set(i, 9 - (i >> 1), g[3]);
      c.set(15 - i, 9 - (i >> 1), g[3]);
      c.set(i, 10 - (i >> 1), g[1]);
      c.set(15 - i, 10 - (i >> 1), g[1]);
    }
    c.rect(0, 13, 16, 1, g[2]);
    c.rect(0, 14, 16, 1, g[0]);
  },
  crown: (c) => {
    panels(c, P.STAR_ALLOY, [15]);
    const g = P.GOLD;
    c.each((x, y) => {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.hypot(dx, dy);
      const ray = Math.abs(dx) < 1 || Math.abs(dy) < 1 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8;
      if (d < 2.2) return g[4];
      if (d < 3.2) return g[2];
      if (ray && d < 7.4) return d < 5 ? g[3] : g[1];
      return null;
    });
  },
  frame: (c) => {
    const g = P.GOLD;
    c.each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      return d > 4.4 && d < 5.8 ? (y < 8 ? g[3] : g[1]) : null;
    });
    for (const [x, y] of [[7, 0], [0, 7], [14, 7], [7, 14]]) c.rect(x, y, 2, 2, g[2]);
  },
  mouth: sunMouth,
  glow: [P.STARFIRE[1], P.STARFIRE[2], P.STARFIRE[3], P.STARFIRE[4], P.STARFIRE[4]],
  over: (c, lit) => {
    c.rect(1, 14, 2, 1, lit ? P.CYAN : P.CYAN_OFF);
    if (!lit) return;
    // The star itself: a four-pointed white spark at the centre.
    c.rect(7, 5, 2, 6, P.rgb(0xffffff));
    c.rect(5, 7, 6, 2, P.rgb(0xffffff));
  },
};

function tierSet(name: string, t: Tier): PainterSet {
  const front = (c: Canvas, lit: boolean): void => {
    t.walls(c);
    t.frame(c);
    if (lit) hot(c, t.mouth, t.glow);
    else cold(c, t.mouth);
    t.over?.(c, lit);
  };
  return {
    [`furnace_${name}_side`]: (c) => t.walls(c),
    [`furnace_${name}_top`]: (c) => t.crown(c),
    [`furnace_${name}_front`]: (c) => front(c, false),
    [`furnace_${name}_front_on`]: (c) => front(c, true),
  };
}

export const FURNACES: PainterSet = {
  ...tierSet('clay', clay),
  ...tierSet('blast', blast),
  ...tierSet('arc', arc),
  ...tierSet('plasma', plasma),
  ...tierSet('star', star),
};
