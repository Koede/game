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


// ---- The jukebox model's materials (src/world/jukeboxModel.ts) ----------------------------------------------------------------

/** Varnished walnut with a vertical grain. */
function jukeWood(c: Canvas): void {
  const base = P.rgb(0x7a3f22);
  c.each((x, y) => {
    const streak = c.hash(x, 0, 31);
    return shade(base, (streak - 0.5) * 0.28 + (c.hash(x, y, 32) - 0.5) * 0.08 + (x % 8 === 0 ? -0.1 : 0));
  });
}

/** Polished chrome: bands of grey across the width, a bright highlight and a dark edge, tiling along the height. */
function jukeChrome(c: Canvas): void {
  const bands = [0x8a95a3, 0xb4c0cc, 0xdfe8f0, 0xffffff, 0xeaf1f6, 0xbac6d2, 0x96a2b0, 0x76828f];
  c.each((x) => P.rgb(bands[x >> 1]));
}

/** Polished brass in the same bands, warm. */
function jukeBrass(c: Canvas): void {
  const bands = [P.GOLD[0], P.GOLD[1], P.GOLD[2], P.GOLD[4], P.GOLD[3], P.GOLD[2], P.GOLD[1], P.GOLD[0]];
  c.each((x) => bands[x >> 1]);
}

/** Dark speaker cloth with a faint weave: the brass slats stand in front of it. */
function jukeGrille(c: Canvas): void {
  const cloth = P.rgb(0x2b1a1c);
  c.each((x, y) => ((x + y) % 2 === 0 ? shade(cloth, 0.07) : cloth));
  for (const x of [1, 5, 8, 11, 14]) c.rect(x, 0, 1, 16, shade(cloth, -0.25));
  // Worn tassel-cloth: a few lighter threads and a dim brass edge.
  c.each((x, y) => (c.hash(x, y, 41) > 0.93 ? shade(cloth, 0.3) : null));
  c.rect(0, 0, 16, 1, shade(P.GOLD[0], -0.1));
  c.rect(0, 15, 16, 1, shade(P.GOLD[1], -0.2));
}

const RECORD_LABELS = [P.rgb(0xc2302a), P.rgb(0xe0b040), P.rgb(0x3a8a5a), P.rgb(0x3a62b8), P.rgb(0xc2302a)];

/** The record window (the middle 8 rows are drawn: the model samples rows 4-12): a carousel of discs on edge in front of a back wall. */
function jukeWindow(lit: boolean): (c: Canvas) => void {
  return (c) => {
    const wall = lit ? P.rgb(0xe8a23a) : P.rgb(0x16141c);
    const glow = lit ? P.rgb(0xffd877) : P.rgb(0x2a2630);
    c.rect(0, 0, 16, 16, wall);
    // A soft light from the middle of the wall.
    for (let y = 4; y < 12; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, (y - 7.5) * 2);
      if (d < 6) c.set(x, y, lit ? shade(glow, 0.2 - d * 0.03) : shade(wall, 0.12 - d * 0.015), 255);
    }
    // Five records seen almost edge-on, each with a coloured label; they line up across the window.
    RECORD_LABELS.forEach((label, i) => {
      const cx = 1.5 + i * 3.1;
      c.rect(Math.round(cx), 5, 2, 6, lit ? P.rgb(0x4a2208) : P.rgb(0x0c0b10));
      c.rect(Math.round(cx), 7, 2, 2, lit ? shade(label, 0.3) : shade(label, -0.35));
    });
    // The tone arm and a glint of the glass.
    c.rect(0, 4, 16, 1, lit ? P.GOLD[3] : P.rgb(0x4a4658));
    c.rect(0, 11, 16, 1, lit ? P.GOLD[2] : P.rgb(0x3a3648));
    if (lit) c.set(14, 5, P.rgb(0xfff4c0), 255); else c.set(14, 5, P.rgb(0x7a7690), 255);
  };
}

/** The selector panel (rows 6-9 are sampled): a cream plate with eight buttons, a title strip, and the dark coin slot at the right. */
function jukePanel(c: Canvas): void {
  c.rect(0, 0, 16, 16, P.rgb(0x3a2418));
  c.rect(0, 6, 16, 4, P.rgb(0xd9c9a0));
  c.rect(0, 6, 16, 1, P.rgb(0xf0e4c0));
  for (let i = 0; i < 6; i++) c.rect(1 + i * 2, 7, 1, 2, i % 3 === 0 ? P.rgb(0xc2302a) : i % 3 === 1 ? P.rgb(0x2a2630) : P.rgb(0x3a62b8));
  c.rect(13, 7, 2, 2, P.rgb(0xb8c0c8));
  c.rect(14, 7, 1, 2, P.rgb(0x15121a));
}

/** The bubble tube (columns 6-9 are sampled): four colours, each a run of glass bubbles; the lit twin is bright. */
function jukeBubble(lit: boolean): (c: Canvas) => void {
  const hues = [0xe03a3a, 0xf0a030, 0x4ac060, 0x3a8ae0];
  return (c) => {
    c.rect(0, 0, 16, 16, P.rgb(0x1c1418));
    hues.forEach((hex, i) => {
      const col = P.rgb(hex);
      c.rect(6, i * 4, 4, 4, lit ? shade(col, 0.1) : shade(col, -0.45));
      c.set(7, i * 4 + 1, lit ? P.rgb(0xffffff) : shade(col, -0.1), 255);
      c.set(8, i * 4 + 2, lit ? shade(col, 0.55) : shade(col, -0.3), 255);
      c.rect(6, i * 4 + 3, 4, 1, lit ? shade(col, -0.2) : shade(col, -0.6));
    });
  };
}

export default {
  jukebox_front: jukeboxFront(false),
  jukebox_front_on: jukeboxFront(true),
  jukebox_wood: jukeWood,
  jukebox_chrome: jukeChrome,
  jukebox_brass: jukeBrass,
  jukebox_grille: jukeGrille,
  jukebox_window: jukeWindow(false),
  jukebox_window_on: jukeWindow(true),
  jukebox_panel: jukePanel,
  jukebox_bubble: jukeBubble(false),
  jukebox_bubble_on: jukeBubble(true),
  quest_board_front: questBoard,
  wall_clock_front: wallClock,
} satisfies PainterSet;
