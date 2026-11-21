/** Faces and the goggles icon of the Bronze workshop pieces (src/content/itemsWorkshop.ts). Wood, bronze and leather. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const WOOD = [P.rgb(0x4e3418), P.rgb(0x6a4824), P.rgb(0x86602f), P.rgb(0xa07a40), P.rgb(0xb8925a)];
const BRONZE = [P.rgb(0x5a3a14), P.rgb(0x8a5c22), P.rgb(0xb07a34), P.rgb(0xd09a4c), P.rgb(0xeec27a)];
const STONE = [P.rgb(0x55534e), P.rgb(0x6e6b65), P.rgb(0x87847d), P.rgb(0xa19e96), P.rgb(0xbab7ae)];
const LEATHER = [P.rgb(0x3a2212), P.rgb(0x5a3519), P.rgb(0x7a4a24), P.rgb(0x96603a)];
const IRON = [P.rgb(0x3c4046), P.rgb(0x5e646c), P.rgb(0x8a929c), P.rgb(0xc4ccd4)];
const GLOW = P.rgb(0xffc864);

const hash = (x: number, y: number, s: number): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Planks with a grain: rows of boards, light noise. */
function boards(c: Canvas, seed: number): void {
  c.each((x, y) => {
    const board = Math.floor(y / 4);
    const n = hash(x >> 1, y, seed + board);
    const ramp = y % 4 === 3 ? WOOD[0] : n < 0.2 ? WOOD[1] : n < 0.75 ? WOOD[2] : WOOD[3];
    return ramp;
  });
}

function stoneBg(c: Canvas, seed: number): void {
  c.each((x, y) => {
    const n = hash(x >> 1, y >> 1, seed);
    return n < 0.15 ? STONE[0] : n < 0.45 ? STONE[1] : n < 0.85 ? STONE[2] : STONE[3];
  });
}

function frame(c: Canvas, ramp: readonly P.RGB[]): void {
  c.rect(0, 0, 16, 1, ramp[3]);
  c.rect(0, 0, 1, 16, ramp[3]);
  c.rect(0, 15, 16, 1, ramp[0]);
  c.rect(15, 0, 1, 16, ramp[0]);
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) c.set(x, y, ramp[4] ?? ramp[3]);
}

/** A cog of radius r at cx, cy; `turn` rotates the teeth a little (the running face). */
function cog(c: Canvas, cx: number, cy: number, r: number, turn: number): void {
  c.each((x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + turn;
    const tooth = Math.cos(a * 8) > 0.2 ? 1.6 : 0;
    if (d < 1.4) return IRON[0];
    if (d < r - 1) return d < r - 2.2 ? BRONZE[2] : BRONZE[1];
    if (d < r + tooth) return dx + dy < 0 ? BRONZE[4] : BRONZE[3];
    return null;
  });
}

function machineSide(c: Canvas): void {
  boards(c, 3);
  frame(c, BRONZE);
  c.rect(2, 7, 12, 2, BRONZE[1]);
  c.rect(2, 7, 12, 1, BRONZE[3]);
}

function hopperTop(c: Canvas): void {
  boards(c, 5);
  frame(c, BRONZE);
  c.rect(3, 3, 10, 10, WOOD[0]);
  c.rect(5, 5, 6, 6, LEATHER[0]);
  c.rect(4, 3, 8, 1, WOOD[4]);
}

function sawFront(on: boolean) {
  return (c: Canvas): void => {
    boards(c, 7);
    frame(c, BRONZE);
    cog(c, 8, 9, 5.5, on ? 0.2 : 0);
    c.rect(2, 3, 12, 1, IRON[2]);
    if (on) for (let i = 0; i < 4; i++) c.set(3 + i * 3, 2, GLOW);
  };
}

function millFront(on: boolean) {
  return (c: Canvas): void => {
    stoneBg(c, 11);
    frame(c, STONE);
    c.each((x, y) => {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (d < 6 && d > 1.5) return Math.floor((Math.atan2(y - 8, x - 8) + (on ? 0.4 : 0)) * 2) % 2 === 0 ? STONE[3] : STONE[2];
      if (d <= 1.5) return IRON[1];
      return null;
    });
    if (on) c.rect(6, 14, 4, 1, P.rgb(0xf2ead0));
  };
}

function mortarFront(on: boolean) {
  return (c: Canvas): void => {
    boards(c, 13);
    frame(c, BRONZE);
    const lift = on ? 2 : 0;
    for (const x of [3, 7, 11]) {
      c.rect(x, 2, 2, 8 - lift, IRON[1]);
      c.rect(x, 2, 1, 8 - lift, IRON[2]);
      c.rect(x - 1, 10 - lift, 4, 2, IRON[3]);
    }
    c.rect(1, 13, 14, 2, STONE[1]);
    c.rect(1, 13, 14, 1, STONE[3]);
  };
}

function loomFront(on: boolean) {
  return (c: Canvas): void => {
    boards(c, 17);
    frame(c, WOOD);
    for (let x = 3; x < 13; x += 2) c.rect(x, 2, 1, 12, P.rgb(0xd8cca0));
    c.rect(2, 9, 12, 3, P.rgb(0xc7b88a));
    c.rect(on ? 9 : 4, 7, 4, 2, BRONZE[3]);
    c.set(on ? 9 : 4, 7, BRONZE[4]);
  };
}

function crankSide(on: boolean) {
  return (c: Canvas): void => {
    boards(c, 19);
    frame(c, WOOD);
    cog(c, 8, 8, 4.5, on ? 0.3 : 0);
    // The handle: an arm to the rim and a knob.
    const [hx, hy] = on ? [12, 11] : [12, 5];
    c.rect(8, Math.min(8, hy), 1, Math.abs(hy - 8) + 1, IRON[2]);
    c.rect(8, hy, hx - 8, 1, IRON[2]);
    c.rect(hx, hy - 1, 2, 3, LEATHER[3]);
  };
}

function crankTop(c: Canvas): void {
  boards(c, 23);
  frame(c, WOOD);
  c.rect(6, 6, 4, 4, IRON[1]);
  c.rect(6, 6, 4, 1, IRON[3]);
  c.set(7, 7, IRON[0]);
}

function shaftEnd(c: Canvas): void {
  boards(c, 29);
  frame(c, BRONZE);
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d < 2.5) return d < 1 ? WOOD[0] : WOOD[3];
    if (d < 3.5) return BRONZE[2];
    return null;
  });
}

function shaftSide(on: boolean) {
  return (c: Canvas): void => {
    c.rect(0, 0, 16, 16, WOOD[1], 0);
    // A frame with an open middle and the shaft through it.
    c.rect(0, 0, 16, 2, BRONZE[2]);
    c.rect(0, 14, 16, 2, BRONZE[1]);
    c.rect(0, 0, 2, 16, BRONZE[2]);
    c.rect(14, 0, 2, 16, BRONZE[1]);
    c.rect(6, 2, 4, 12, WOOD[2]);
    for (let y = 2; y < 14; y++) c.set(6 + ((y + (on ? 2 : 0)) % 4), y, WOOD[4]);
    c.rect(9, 2, 1, 12, WOOD[0]);
  };
}

function beltTop(on: boolean) {
  return (c: Canvas): void => {
    c.each((x, y) => (x < 2 || x > 13 ? IRON[1] : (y + (on ? 2 : 0)) % 4 === 0 ? LEATHER[0] : hash(x, y, 31) < 0.3 ? LEATHER[1] : LEATHER[2]));
    c.rect(0, 0, 1, 16, IRON[3]);
    c.rect(15, 0, 1, 16, IRON[0]);
  };
}

function beltSide(c: Canvas): void {
  c.each((x, y) => (y < 2 ? LEATHER[2] : y > 13 ? IRON[0] : hash(x, y, 37) < 0.25 ? IRON[0] : IRON[1]));
  for (const x of [3, 8, 13]) {
    c.rect(x - 1, 5, 3, 3, IRON[3]);
    c.set(x, 6, IRON[0]);
  }
  c.rect(0, 2, 16, 1, LEATHER[0]);
}

function goggles(c: Canvas): void {
  c.rect(1, 7, 14, 2, LEATHER[1]);
  for (const cx of [5, 11]) {
    c.each((x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 8);
      if (d < 2.4) return d < 1.2 ? P.rgb(0xd8f0ff) : P.rgb(0x7ab8d8);
      if (d < 3.6) return x + y < cx + 8 ? BRONZE[4] : BRONZE[2];
      return null;
    });
  }
  c.rect(7, 7, 2, 1, BRONZE[1]);
}

export const WORKSHOP_TEXTURES: PainterSet = {
  ws_machine_side: machineSide,
  ws_hopper_top: hopperTop,
  ws_saw_front: sawFront(false),
  ws_saw_front_on: sawFront(true),
  ws_millstone_front: millFront(false),
  ws_millstone_front_on: millFront(true),
  ws_mortar_front: mortarFront(false),
  ws_mortar_front_on: mortarFront(true),
  ws_loom_front: loomFront(false),
  ws_loom_front_on: loomFront(true),
  ws_crank_side: crankSide(false),
  ws_crank_side_on: crankSide(true),
  ws_crank_top: crankTop,
  ws_shaft_end: shaftEnd,
  ws_shaft_side: shaftSide(false),
  ws_shaft_side_on: shaftSide(true),
  ws_belt_top: beltTop(false),
  ws_belt_top_on: beltTop(true),
  ws_belt_side: beltSide,
  item_engineer_goggles: icon(goggles),
};
