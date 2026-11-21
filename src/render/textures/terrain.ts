/** Natural ground: rock, soil, sand, snow, ice, liquids and the hazards of the deep. */
import type { Canvas, PainterSet } from './canvas';
import { bevelCells, crack, strata, tone } from './brush';
import * as P from './palette';
import { type RGB, type Ramp, mix, shade } from './palette';

/** Soft two-octave field in 0..1 that tiles (cell sizes divide 16). */
function field(c: Canvas, big: number, small: number, salt = 0, weight = 0.4): (x: number, y: number) => number {
  const a = c.noise(big, big, salt);
  const b = c.noise(small, small, salt + 7);
  return (x, y) => a(x, y) * (1 - weight) + b(x, y) * weight;
}

/** Stone: soft tonal patches and a couple of hairline cracks. Ores paint it under their flecks. */
export function stoneBase(c: Canvas, ramp: Ramp = P.STONE): void {
  const f = field(c, 4, 2, 0, 0.35);
  const broad = c.noise(8, 8, 1);
  const mid = [ramp[1], ramp[2], ramp[2], ramp[3]];
  c.each((x, y) => tone(mid, 0.5 + (f(x, y) - 0.5) * 2.3 + (broad(x, y) - 0.5) * 0.5));
  crack(c, c.int(16), c.int(16), 6, 1, 0, ramp[0], ramp[4]);
  crack(c, c.int(16), c.int(16), 4, 1, 1, ramp[0], ramp[4]);
}

/** The deep host rock of the late ores: darker, cooler, with a faint layering. */
export function deepBase(c: Canvas): void {
  const f = field(c, 8, 4, 3, 0.4);
  const band = strata(c, 4, 1.5, 5);
  const ramp = P.DEEPSTONE;
  c.each((x, y) => {
    const v = 0.5 + (f(x, y) - 0.5) * 2 + (band(x, y) % 2 === 0 ? 0.08 : -0.08);
    return tone([ramp[1], ramp[2], ramp[3]], v);
  });
  crack(c, c.int(16), c.int(16), 5, 1, 0, ramp[0], ramp[4]);
}

function grassTop(c: Canvas): void {
  const f = field(c, 4, 2, 0, 0.4);
  const g = P.GRASS;
  c.each((x, y) => tone([g[1], g[2], g[3]], 0.5 + (f(x, y) - 0.5) * 2));
  // Short blade tips: a lighter pixel over a darker one, scattered but never clumped.
  for (const [x, y] of c.scatter(14, 3)) {
    c.wset(x, y, g[4]);
    c.wset(x, y + 1, g[0]);
  }
}

function grassSide(c: Canvas): void {
  dirt(c);
  const g = P.GRASS;
  const drip = c.noise(4, 4, 11);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + Math.floor(drip(x, 0) * 3.2) + (c.hash(x, 0, 3) < 0.25 ? 1 : 0);
    for (let y = 0; y < depth; y++) {
      const t = y / depth;
      c.set(x, y, y === 0 ? g[3] : t > 0.7 ? g[1] : c.hash(x, y, 4) < 0.3 ? g[3] : g[2]);
    }
    c.set(x, depth, shade(P.DIRT[1], -0.15));
  }
}

function dirt(c: Canvas): void {
  const f = field(c, 4, 2, 0, 0.4);
  const d = P.DIRT;
  c.each((x, y) => tone([d[1], d[2], d[3]], 0.5 + (f(x, y) - 0.5) * 2));
  // Small stones and roots: a few 2px lighter pebbles with a dark underside.
  for (const [x, y] of c.scatter(5, 5)) {
    c.wset(x, y, d[4]);
    c.wset(x + 1, y, d[3]);
    c.wset(x, y + 1, d[0]);
    c.wset(x + 1, y + 1, d[0]);
  }
  for (const [x, y] of c.scatter(4, 5)) c.wset(x, y, d[0]);
}

function sand(c: Canvas): void {
  const f = field(c, 8, 4, 0, 0.35);
  const ripple = c.noise(16, 4, 2);
  const s = P.SAND;
  c.each((x, y) => {
    // x / 3 shifts the ripples by exactly one period across the tile, so they slant yet still wrap.
    const w = Math.sin(((y + ripple(x, y) * 5 + x / 3) / 16) * Math.PI * 2 * 3);
    return tone([s[1], s[2], s[3]], 0.5 + (f(x, y) - 0.5) * 1.4 + w * 0.22);
  });
  for (const [x, y] of c.scatter(6, 4)) c.wset(x, y, c.hash(x, y) < 0.5 ? s[4] : s[0]);
}

function gravel(c: Canvas): void {
  const map = c.cells(15, 3.2);
  const g: RGB[] = [P.STONE[1], P.STONE[2], P.STONE[3], mix(P.STONE[2], P.DIRT[3], 0.45), mix(P.STONE[3], P.SAND[1], 0.3)];
  bevelCells(c, map, (id) => g[id % g.length], shade(P.DIRT[0], -0.2), 0.9, 0.25, 0.35);
}

function rubble(c: Canvas): void {
  const map = c.cells(8, 5);
  const s = P.STONE;
  bevelCells(c, map, (id, x, y) => (c.hash(x >> 2, y >> 2, id) < 0.35 ? s[2] : id % 3 === 0 ? s[3] : s[2]), shade(s[0], -0.35), 1.1, 0.3, 0.35);
}

function clay(c: Canvas): void {
  const band = c.noise(16, 4, 1);
  const f = field(c, 8, 4, 0, 0.3);
  const k = P.CLAY;
  c.each((x, y) => tone([k[1], k[2], k[3]], 0.5 + (f(x, y) - 0.5) * 1.3 + (band(x, y) - 0.5) * 0.9));
  // Smooth wet smears: short horizontal highlights with a shadow under them.
  for (const [x, y] of c.scatter(4, 6)) {
    const w = 3 + c.int(3);
    for (let i = 0; i < w; i++) {
      c.wset(x + i, y, k[4]);
      c.wset(x + i + 1, y + 1, k[0]);
    }
  }
}

function snow(c: Canvas): void {
  const f = field(c, 4, 2, 0, 0.4);
  const s = P.SNOW;
  c.each((x, y) => tone([s[2], s[2], s[3], s[3]], 0.5 + (f(x, y) - 0.5) * 1.8));
  for (const [x, y] of c.scatter(6, 4)) {
    c.wset(x, y, s[0]);
    c.wset(x + 1, y, s[1]);
  }
  for (const [x, y] of c.scatter(5, 4)) c.wset(x, y, s[4]);
}

function ice(c: Canvas): void {
  const f = field(c, 16, 8, 0, 0.4);
  const i = P.ICE;
  c.each((x, y) => tone([i[1], i[2], i[3]], 0.45 + (f(x, y) - 0.5) * 1.8 + (((x + y) & 15) < 3 ? 0.25 : 0)));
  // Trapped bubbles, then a couple of white fracture lines.
  for (const [x, y] of c.scatter(4, 6)) {
    c.wset(x, y, i[0]);
    c.wset(x + 1, y - 1, i[4]);
  }
  crack(c, c.int(16), c.int(16), 7, 1, 1, i[4]);
  crack(c, c.int(16), c.int(16), 5, 1, -1, i[4]);
  for (const [x, y] of c.scatter(3, 6)) c.wset(x, y, P.SNOW[4]);
}

function basalt(c: Canvas): void {
  // Columnar joints: five slightly uneven columns, each its own tone, split by dark joints and the odd crack.
  const b = P.BASALT;
  const edges = [0, 3, 7, 10, 13];
  const shift = c.noise(4, 4, 3);
  const col = (x: number): number => {
    let k = 0;
    for (let i = 0; i < edges.length; i++) if (x >= edges[i]) k = i;
    return k;
  };
  const f = field(c, 8, 4, 0, 0.5);
  c.each((x, y) => {
    const k = col(x);
    const v = 0.45 + (k % 2 === 0 ? 0.1 : -0.1) + (f(x, y) - 0.5) * 1.2 + (shift(k * 4, y) - 0.5) * 0.4;
    return tone([b[1], b[2], b[3]], v);
  });
  for (const e of edges) {
    for (let y = 0; y < 16; y++) c.set(e, y, b[0]);
    for (let y = 0; y < 16; y++) if (c.hash(e, y, 9) < 0.6) c.set((e + 1) % 16, y, b[3]);
  }
  // Glassy vesicles catching the light.
  for (const [x, y] of c.scatter(4, 6)) if (!edges.includes(x)) c.wset(x, y, b[4]);
  for (let i = 0; i < 3; i++) {
    const k = c.int(edges.length);
    const y = c.int(16);
    const x0 = edges[k] + 1;
    const x1 = k + 1 < edges.length ? edges[k + 1] : 16;
    for (let x = x0; x < x1; x++) {
      c.set(x, y, b[0]);
      c.wset(x, y + 1, b[3]);
    }
  }
}

function limestone(c: Canvas): void {
  const band = strata(c, 4, 1.2, 2);
  const f = field(c, 8, 4, 0, 0.4);
  const l = P.LIMESTONE;
  c.each((x, y) => tone([l[1], l[2], l[3]], 0.5 + (f(x, y) - 0.5) * 1.2 + (band(x, y) % 2 === 0 ? 0.15 : -0.12)));
  // Tiny fossil shells: a 3px arc with a dark mouth.
  for (const [x, y] of c.scatter(3, 7)) {
    c.wset(x, y, l[4]);
    c.wset(x + 1, y - 1, l[4]);
    c.wset(x + 2, y, l[4]);
    c.wset(x + 1, y, l[0]);
  }
  for (const [x, y] of c.scatter(5, 4)) c.wset(x, y, l[0]);
}

function corestone(c: Canvas): void {
  const map = c.cells(7, 5);
  const k = P.CORESTONE;
  bevelCells(c, map, (id) => (id % 2 === 0 ? k[1] : k[2]), k[0], 1, 0.12, 0.2);
  // Glints of the crystal the world rests on.
  for (const [x, y] of c.scatter(4, 6)) {
    c.wset(x, y, k[4]);
    c.wset(x + 1, y + 1, k[3]);
  }
}

function water(c: Canvas): void {
  const f = field(c, 8, 4, 0, 0.4);
  const w = P.WATER;
  c.each((x, y) => tone([w[0], w[1], w[2]], 0.5 + (f(x, y) - 0.5) * 1.6));
  // Wavelets: short light strokes with a darker trough just under them.
  for (const [x, y] of c.scatter(7, 4)) {
    const len = 3 + c.int(2);
    for (let i = 0; i < len; i++) {
      c.wset(x + i, y, i === 0 || i === len - 1 ? w[3] : w[4]);
      c.wset(x + i, y + 1, w[0]);
    }
  }
  for (let i = 3; i < c.data.length; i += 4) c.data[i] = 205;
}

function crust(c: Canvas, plates: Ramp, glow: Ramp, count: number): void {
  const map = c.cells(count, 5);
  const heat = c.noise(8, 8, 5);
  c.each((x, y) => {
    const e = map.edge[y * 16 + x];
    const h = heat(x, y);
    if (e < 0.8) return h > 0.4 ? glow[4] : glow[3];
    if (e < 1.8) return glow[2];
    return tone([plates[0], plates[1], plates[2]], map.centre[y * 16 + x] / 6 + h * 0.4);
  });
}

function lava(c: Canvas): void {
  crust(c, [P.LAVA[0], shade(P.LAVA[0], -0.25), P.LAVA[1], P.LAVA[1], P.LAVA[2]], P.LAVA, 6);
}

function corium(c: Canvas): void {
  const slag: Ramp = [P.rgb(0x1a1d12), P.rgb(0x262b18), P.rgb(0x353c1e), P.rgb(0x48512a), P.rgb(0x5e6a34)];
  const map = c.cells(5, 6);
  const hot = c.noise(8, 8, 4);
  bevelCells(c, map, (id, x, y) => tone(slag, 0.25 + (id % 3) * 0.2 + (hot(x, y) - 0.5) * 0.4), null);
  // Glowing fissures only where the seams run hot, and a few embedded radiant beads.
  c.each((x, y) => {
    const k = y * 16 + x;
    if (map.edge[k] >= 0.75) return null;
    const h = hot(x, y);
    return h > 0.62 ? P.URANIUM[4] : h > 0.45 ? P.URANIUM[2] : slag[0];
  });
  for (const [x, y] of c.scatter(4, 6)) {
    c.wset(x, y, P.URANIUM[3]);
    c.wset(x + 1, y, P.URANIUM[2]);
  }
}

export const TERRAIN: PainterSet = {
  corestone,
  stone: (c) => stoneBase(c),
  rubble,
  dirt,
  grass_top: grassTop,
  grass_side: grassSide,
  sand,
  gravel,
  clay,
  snow,
  ice,
  basalt,
  limestone,
  water,
  lava,
  corium,
};
