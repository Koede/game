/**
 * Ores: the host rock of the world plus flecks that differ in SHAPE as well as colour, so no two ores can be
 * confused at a glance - chunks, streaks, cubes, bands, crystals, shards, nodules, blades, laths, glowing
 * blots and laminae.
 */
import type { Canvas, PainterSet } from './canvas';
import { tone } from './brush';
import * as P from './palette';
import { type RGB, shade } from './palette';
import { deepBase, stoneBase } from './terrain';

const inStone = (c: Canvas): void => c.withSeed('stone', () => stoneBase(c));
const inDeep = (c: Canvas): void => c.withSeed('deepstone', () => deepBase(c));

/** Dark rim on the lower-right of everything drawn since `before`, so flecks sit IN the rock. */
function seat(c: Canvas, before: Uint8ClampedArray, rim: RGB): void {
  const changed = (x: number, y: number): boolean => {
    const i = (((y + 16) % 16) * 16 + ((x + 16) % 16)) * 4;
    return c.data[i] !== before[i] || c.data[i + 1] !== before[i + 1] || c.data[i + 2] !== before[i + 2];
  };
  const mark: [number, number][] = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (changed(x, y)) continue;
      if (changed(x - 1, y) || changed(x, y - 1)) mark.push([x, y]);
    }
  }
  for (const [x, y] of mark) c.blend(x, y, rim, 0.55);
}

function flecks(c: Canvas, host: (c: Canvas) => void, draw: (c: Canvas) => void, rim: RGB): void {
  host(c);
  const before = c.data.slice();
  draw(c);
  seat(c, before, rim);
}

/** Coal: black angular chunks with a single cold glint. */
function coal(c: Canvas): void {
  const k = P.COAL;
  const shapes = [
    ['.##', '###', '##.'],
    ['##.', '###', '.##', '..#'],
    ['.#', '##', '##'],
  ];
  for (const [i, [x, y]] of c.scatter(5, 5).entries()) {
    const s = shapes[i % shapes.length];
    s.forEach((row, dy) => [...row].forEach((ch, dx) => ch === '#' && c.wset(x + dx, y + dy, dy === 0 ? k[2] : k[1])));
    c.wset(x + 1, y + 1, k[0]);
    c.wset(x + 1, y, k[4]);
  }
}

/** Copper: orange streaks crusted with green verdigris along their upper edge. */
function copper(c: Canvas): void {
  const k = P.COPPER;
  const green = P.VERDIGRIS;
  for (const [x, y] of c.scatter(4, 6)) {
    const len = 3 + c.int(2);
    for (let i = 0; i < len; i++) {
      c.wset(x + i, y + (i >> 1), i % 2 === 0 ? k[4] : k[3]);
      c.wset(x + i, y + (i >> 1) - 1, i % 2 === 0 ? green : shade(green, 0.25));
    }
    c.wset(x - 1, y, green);
    c.wset(x + len, y + (len >> 1), shade(green, -0.2));
  }
}

/** Tin: small silvery cubes with a clear lit face and a dark side. */
function tin(c: Canvas): void {
  const k = P.TIN;
  for (const [i, [x, y]] of c.scatter(5, 5).entries()) {
    const s = i % 2 === 0 ? 2 : 3;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) c.wset(x + dx, y + dy, k[2]);
    for (let d = 0; d < s; d++) c.wset(x + d, y, k[4]);
    c.wset(x, y, k[4]);
    for (let d = 0; d <= s; d++) {
      c.wset(x + s, y + d, k[0]);
      c.wset(x + d, y + s, k[0]);
    }
  }
}

/** Iron: rusty bands - broken lenses of oxide that follow the bedding of the rock. */
function iron(c: Canvas): void {
  const k = P.RUST;
  const wob = c.noise(8, 8, 3);
  const gap = c.noise(4, 4, 4);
  for (const base of [3, 11]) {
    for (let x = 0; x < 16; x++) {
      const g = gap(x, base);
      if (g < 0.3) continue;
      const y = base + Math.round((wob(x, base) - 0.5) * 4);
      const thick = g > 0.6 ? 3 : g > 0.42 ? 2 : 1;
      for (let t = 0; t < thick; t++) c.wset(x, y + t, t === 0 ? k[2] : t === thick - 1 ? k[0] : k[1]);
      if (thick === 3 && c.hash(x, base, 3) < 0.4) c.wset(x, y, k[3]);
    }
  }
}

/** Sulfur: clusters of small yellow prisms pointing up. */
function sulfur(c: Canvas): void {
  const k = P.SULFUR;
  for (const [x, y] of c.scatter(4, 6)) {
    for (const [ox, h] of [[0, 3], [2, 2], [-2, 2]]) {
      for (let d = 0; d < h; d++) c.wset(x + ox, y - d, d === h - 1 ? k[4] : k[2]);
      c.wset(x + ox + 1, y, k[1]);
    }
    c.wset(x, y + 1, k[0]);
  }
}

/** Quartz: rose-white shards, long and pointed. */
function quartz(c: Canvas): void {
  const k = P.QUARTZ;
  for (const [i, [x, y]] of c.scatter(4, 6).entries()) {
    const dir = i % 2 === 0 ? 1 : -1;
    for (let d = 0; d < 4; d++) {
      c.wset(x + d * dir, y - d, d === 3 ? k[2] : k[1]);
      if (d < 3) c.wset(x + d * dir + dir, y - d, k[0]);
      if (d < 2) c.wset(x + d * dir, y - d + 1, shade(k[0], -0.2));
    }
  }
}

/** Bauxite: a red-brown earthy rock full of round nodules (pisolites). */
function bauxite(c: Canvas): void {
  const k = P.OXIDE_RED;
  const f = c.noise(4, 4, 1);
  c.each((x, y) => tone([shade(k[1], -0.2), shade(k[1], -0.08), k[1]], f(x, y) * 1.1 - 0.05));
  const big = ['.##.', '####', '####', '.##.'];
  const small = ['##', '##'];
  for (const [i, [x, y]] of c.scatter(8, 4).entries()) {
    const body = i % 3 === 1 ? shade(P.CLAY[2], -0.15) : k[3];
    const s = i % 3 === 0 ? big : small;
    const n = s.length;
    s.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        if (ch !== '#') return;
        const lit = dx + dy < n - 1 ? 0.25 : dx + dy > n ? -0.3 : 0;
        c.wset(x + dx, y + dy, shade(body, lit));
      }),
    );
  }
}

/** Wolframite: long steel-blue blades with a bright edge. */
function wolframite(c: Canvas): void {
  const k = P.STEEL;
  for (const [i, [x, y]] of c.scatter(3, 7).entries()) {
    const len = 5 + (i % 2);
    for (let d = 0; d < len; d++) {
      c.wset(x + d, y + (d >> 1), k[1]);
      c.wset(x + d, y + (d >> 1) - 1, d % 2 === 0 ? k[3] : k[2]);
    }
    c.wset(x + 1, y - 1, k[4]);
  }
}

/** Spodumene: pale lilac laths - flat rectangles standing upright. */
function spodumene(c: Canvas): void {
  const k = P.LILAC;
  for (const [i, [x, y]] of c.scatter(4, 6).entries()) {
    const h = 4 + (i % 2);
    for (let d = 0; d < h; d++) {
      c.wset(x, y + d, k[3]);
      c.wset(x + 1, y + d, k[2]);
    }
    c.wset(x, y, k[4]);
    c.wset(x + 1, y + h - 1, k[1]);
  }
}

/** Pitchblende: irregular pitch-black blots, a faint green glow seeping from their lower rims. */
function pitchblende(c: Canvas): void {
  const u = P.URANIUM;
  const tar: RGB = P.rgb(0x0c100c);
  const blots = [
    ['.##.', '####', '###.', '.#..'],
    ['##..', '###.', '.###', '..#.'],
    ['.#.', '###', '##.'],
  ];
  for (const [i, [x, y]] of c.scatter(4, 6).entries()) {
    const b = blots[i % blots.length];
    b.forEach((row, dy) => [...row].forEach((ch, dx) => ch === '#' && c.wset(x + dx, y + dy, dy === 0 ? shade(tar, 0.25) : tar)));
    // Glow where a blot's lower edge meets the rock.
    b.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        const below = b[dy + 1]?.[dx];
        if (ch === '#' && below !== '#') c.wset(x + dx, y + dy + 1, (dx + i) % 2 === 0 ? u[2] : u[1]);
      }),
    );
    c.wset(x + 1, y + 1, u[3]);
  }
}

/** Oil shale: dark laminated layers with thin amber seams. */
function oilShale(c: Canvas): void {
  const d: RGB[] = [P.rgb(0x221d1c), P.rgb(0x2d2725), P.rgb(0x39322e), P.rgb(0x463d36)];
  const wob = c.noise(16, 4, 2);
  const grain = c.noise(4, 2, 3);
  c.each((x, y) => {
    const yy = y + (wob(x, y) - 0.5) * 3;
    const layer = Math.floor(((yy + 16) % 16) / 2);
    return tone(d, (layer % 4) / 4 + (grain(x, y) - 0.5) * 0.3);
  });
  for (const base of [4, 12]) {
    for (let x = 0; x < 16; x++) {
      if (c.hash(x >> 1, base, 5) < 0.3) continue;
      const y = base + Math.round((wob(x, base) - 0.5) * 3);
      const h = c.hash(x, base, 6);
      c.wset(x, y, h < 0.15 ? P.AMBER[4] : h < 0.6 ? P.AMBER[2] : P.AMBER[1]);
    }
  }
}

export const ORES: PainterSet = {
  coal_ore: (c) => flecks(c, inStone, coal, P.STONE[0]),
  copper_ore: (c) => flecks(c, inStone, copper, P.STONE[0]),
  tin_ore: (c) => flecks(c, inStone, tin, P.STONE[0]),
  iron_ore: (c) => flecks(c, inStone, iron, P.STONE[0]),
  sulfur_ore: (c) => flecks(c, inStone, sulfur, P.STONE[0]),
  quartz_ore: (c) => flecks(c, inStone, quartz, P.STONE[0]),
  bauxite,
  wolframite: (c) => flecks(c, inDeep, wolframite, P.DEEPSTONE[0]),
  spodumene: (c) => flecks(c, inDeep, spodumene, P.DEEPSTONE[0]),
  pitchblende: (c) => flecks(c, inDeep, pitchblende, P.DEEPSTONE[0]),
  oil_shale: oilShale,
};
