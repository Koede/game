/**
 * Veyra's skull smoke as hand-authored pixel art: a loop of SMOKE_FRAMES frames of CELL_W x CELL_H pixels, drawn as character grids.
 * '.' is empty, the rest index PALETTE (four colours and a dark outline; every pixel is fully opaque or absent - no gradients, no soft
 * edges). Timeline: a thin curl rises from the cigar tip (0-2), thickens and twists (3-5), gathers into a skull (6-7), chatters its jaw
 * (8-11), then crumbles to dust that drops away pixel by pixel in a fixed order (12-15). Pure data and pure functions: tested without a canvas.
 */
import { SMOKE_FRAMES } from '../../npcs/smoke';

export const CELL_W = 24;
export const CELL_H = 30;

/** Palette: O dark teal outline, t teal-grey shade, m pale mint, w white. */
export const PALETTE: Readonly<Record<string, readonly [number, number, number]>> = {
  O: [31, 59, 58],
  t: [111, 159, 154],
  m: [182, 242, 210],
  w: [246, 255, 249],
};

/** The cigar's ember sits at this pixel column of the cell's bottom row (the sprite is anchored there). */
export const ANCHOR_X = 12;

// ---- the pieces -----------------------------------------------------------------------------------------------------

/** The curl, growing: each is anchored on the cell's bottom row, base around column 12. */
const CURL: readonly (readonly string[])[] = [
  ['..m.', '.m..', '.m..', '..m.', '.m..', '.m..'],
  ['..mw.', '.mw..', '.mw..', '..mw.', '...mw', '..mw.', '.mw..', '.mw..', '.mw..'],
  ['.mw...', '..mw..', '...mw.', '...mw.', '..mw..', '.mw...', '.mw...', '..mw..', '...mw.', '..mw..', '.mw...', '.mw...'],
  ['..tmw..', '.tmw...', '.tmw...', '..tmw..', '...tmw.', '...tmw.', '..tmw..', '.tmw...', '.tmw...', '..tmw..', '...tmw.', '...tmw.', '..tmw..', '.tmw...', '.tmw...'],
  [
    '..OtmwO.', '.OtmwO..', '.OtmwO..', '..OtmwO.', '...OtmwO', '...OtmwO', '..OtmwO.', '.OtmwO..', '.OtmwO..',
    '..OtmwO.', '...OtmwO', '...OtmwO', '..OtmwO.', '.OtmwO..', '.OtmwO..', '..OtmwO.', '..OtmwO.',
  ],
];

/** The skull, upper part (cranium, sockets, nose notch, cheeks) - 16 wide. */
const SKULL_TOP: readonly string[] = [
  '.....OOOOOO.....',
  '...OOwwwwwwOO...',
  '..OwwwwwwwwwmO..',
  '.OwwwwwwwwwwwmO.',
  '.OwwwwwwwwwwwmO.',
  'OwwOOOOwwOOOOwmO',
  'OwwOOOOwwOOOOwmO',
  'OwwOOOOwwOOOOwmO',
  '.OwwwwwOOwwwwmO.',
  '.OwwwwwwwwwwwmO.',
  '..OtwwwwwwwwtO..',
];
/** The jaw closed: a row of teeth and the jawline. */
const JAW_CLOSED: readonly string[] = ['...OwwOwwOwwO...', '....OOOOOOOO....'];
/** The jaw dropped: the upper teeth and their edge stay on the skull, the lower jaw hangs two rows below. */
const JAW_OPEN: readonly string[] = ['...OwwOwwOwwO...', '....OOOOOOOO....', '................', '...OwwOwwOwwO...', '....OOOOOOOO....'];

const SKULL_X = 4;
const SKULL_Y = 6;

type Grid = string[][];
const blank = (): Grid => Array.from({ length: CELL_H }, () => Array<string>(CELL_W).fill('.'));

function stamp(g: Grid, rows: readonly string[], x0: number, y0: number, flip = false): void {
  rows.forEach((row, dy) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[flip ? row.length - 1 - i : i];
      const x = x0 + i;
      const y = y0 + dy;
      if (c !== '.' && x >= 0 && y >= 0 && x < CELL_W && y < CELL_H) g[y][x] = c;
    }
  });
}

/** A fixed pseudo-random 0..1 per pixel: the order pixels appear and vanish in. */
function order(x: number, y: number, salt: number): number {
  let h = (Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 7, 0x85ebca6b) ^ Math.imul(salt + 3, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function skull(open: boolean): Grid {
  const g = blank();
  stamp(g, [...SKULL_TOP, ...(open ? JAW_OPEN : JAW_CLOSED)], SKULL_X, SKULL_Y);
  return g;
}

/** The curl's tail trailing under the skull. */
function tail(g: Grid): void {
  stamp(g, CURL[4].slice(-7), 8, 22);
}

/** The skull assembling: only the first `keep` (0..1) of its pixels, in the fixed order. */
function forming(keep: number): Grid {
  const g = blank();
  const full = skull(false);
  for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) if (full[y][x] !== '.' && order(x, y, 1) < keep) g[y][x] = keep < 0.5 && full[y][x] === 'w' ? 'm' : full[y][x];
  tail(g);
  return g;
}

/** The skull crumbling: `gone` (0..1) of its pixels vanish in the fixed order, the rest drift up and apart by whole pixels. */
function crumbling(step: number, gone: number): Grid {
  const g = blank();
  const full = skull(false);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      if (full[y][x] === '.' || order(x, y, 2) < gone) continue;
      const dx = Math.round((order(x, y, 3) - 0.5) * 2 * step);
      const dy = -Math.round(step * (1 + order(x, y, 4)));
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < CELL_W && ny < CELL_H) g[ny][nx] = step >= 2 && full[y][x] === 'O' ? 't' : full[y][x];
    }
  }
  return g;
}

function curlFrame(i: number, flip = false): Grid {
  const g = blank();
  const c = CURL[i];
  stamp(g, c, ANCHOR_X - Math.floor(c[0].length / 2), CELL_H - c.length, flip);
  return g;
}

/** All frames of the loop, as character grids (row strings). */
export function smokeGrids(): string[][] {
  const g: Grid[] = [];
  g.push(curlFrame(0), curlFrame(1), curlFrame(2), curlFrame(3), curlFrame(4), curlFrame(4, true));
  g.push(forming(0.4), forming(0.75));
  const s0 = skull(false);
  tail(s0);
  const s1 = skull(true);
  tail(s1);
  g.push(s0, s1, s0, s1);
  g.push(crumbling(1, 0.15), crumbling(2, 0.45), crumbling(3, 0.75), crumbling(4, 0.92));
  return g.map((f) => f.map((r) => r.join('')));
}

/** The loop as one RGBA strip (SMOKE_FRAMES cells in a row): alpha is 0 or 255 and nothing else. */
export function smokeAtlasRgba(): { w: number; h: number; data: Uint8ClampedArray } {
  const frames = smokeGrids();
  const w = CELL_W * SMOKE_FRAMES;
  const data = new Uint8ClampedArray(w * CELL_H * 4);
  frames.forEach((rows, f) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = PALETTE[row[x]];
        if (!c) continue;
        const o = (y * w + f * CELL_W + x) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    });
  });
  return { w, h: CELL_H, data };
}
