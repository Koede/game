/** The painted faces of the tavern's fixtures (src/content/areas/tavern_fixtures.ts): a cork notice board with pinned notes, and a clock dial. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { shade } from '../palette';

const CORK = P.rgb(0xb08a5a);
const PAPER = [P.rgb(0xf1e6c8), P.rgb(0xe6d6a8), P.rgb(0xf6efd9)];
const INK = P.rgb(0x3a2c20);
const PIN = P.rgb(0xc2302a);

function questBoard(c: Canvas): void {
  // Planked frame, cork inside.
  c.rect(0, 0, 16, 16, P.WOOD[2]);
  c.rect(1, 1, 14, 14, shade(CORK, -0.05));
  c.each((x, y) => (c.hash(x, y, 9) > 0.8 ? shade(CORK, -0.15) : null));
  // Three pinned notes, each with a few lines of writing.
  const notes: [number, number, number, number][] = [[2, 2, 6, 5], [9, 3, 5, 6], [4, 9, 8, 5]];
  notes.forEach(([x, y, w, h], i) => {
    c.rect(x, y, w, h, PAPER[i % PAPER.length]);
    c.rect(x + 1, y + 1, Math.max(1, w - 2), 1, INK);
    c.rect(x + 1, y + 3, Math.max(1, w - 3), 1, shade(INK, 0.3));
    c.rect(x + Math.floor(w / 2), y - 1, 1, 1, PIN);
  });
}

function wallClock(c: Canvas): void {
  // A plank backing with the dial inside a brass rim.
  c.rect(0, 0, 16, 16, P.WOOD[1]);
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d > 7) return null;
    if (d > 6) return P.GOLD[3];
    return P.rgb(0xf4ecd0);
  });
  // Twelve hour ticks and two hands fixed at ten past ten.
  for (const [x, y] of [[8, 2], [14, 8], [8, 14], [2, 8]] as const) c.rect(x, y, 1, 1, INK);
  c.line(8, 8, 8, 4, INK);
  c.line(8, 8, 11, 8, INK);
  c.rect(8, 8, 1, 1, PIN);
}

const AMBER = [P.rgb(0x7a3b10), P.rgb(0xb8651c), P.rgb(0xe8a23a), P.rgb(0xffd877)];

/** A jukebox front: an arched wooden cabinet, a window with a record (glowing when it plays), a brass grille and a coin slot. */
function jukeboxFront(lit: boolean): (c: Canvas) => void {
  return (c) => {
    c.rect(0, 0, 16, 16, P.WOOD[1]);
    c.rect(1, 1, 14, 14, P.WOOD[2]);
    // The arch: round the top corners off in the cabinet colour of the backing.
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [13, 1], [14, 1], [14, 2]] as const) c.set(x, y, P.WOOD[0], 255);
    // The window: dark when idle, amber and bright when playing.
    for (let y = 3; y < 9; y++) for (let x = 4; x < 12; x++) {
      const d = Math.hypot(x - 7.5, y - 5.5);
      c.set(x, y, d < 3.2 ? (lit ? AMBER[3] : P.rgb(0x2a2630)) : lit ? AMBER[2] : P.rgb(0x1b1820), 255);
    }
    c.set(7, 5, lit ? P.rgb(0xfff4c0) : P.rgb(0x5a5566), 255);
    c.rect(4, 3, 8, 1, P.GOLD[3], 255);
    c.rect(4, 9, 8, 1, P.GOLD[2], 255);
    // The speaker grille and the coin slot.
    for (let x = 4; x < 12; x += 2) c.rect(x, 10, 1, 3, P.GOLD[1], 255);
    c.rect(6, 13, 4, 1, P.GOLD[3], 255);
    c.rect(7, 14, 2, 1, P.IRON[0], 255);
    if (lit) for (const [x, y] of [[2, 4], [13, 5], [2, 8], [13, 9]] as const) c.set(x, y, AMBER[3], 255);
  };
}

export default {
  jukebox_front: jukeboxFront(false),
  jukebox_front_on: jukeboxFront(true),
  quest_board_front: questBoard,
  wall_clock_front: wallClock,
} satisfies PainterSet;
