/** Built blocks: masonry, glass, concrete, the workbench, the crate and the electric lamp. */
import type { Canvas, PainterSet } from './canvas';
import { bevel, rivet, tone } from './brush';
import * as P from './palette';
import { type RGB, mix, shade } from './palette';

/** Courses of bricks: `rows` courses, bricks `w` wide, every other course shifted by half a brick. */
function masonry(c: Canvas, rows: number, w: number, face: (id: number, x: number, y: number) => RGB, mortar: RGB, chip: RGB): void {
  const h = 16 / rows;
  c.each((x, y) => {
    const row = Math.floor(y / h);
    const shift = row % 2 === 0 ? 0 : w / 2;
    const u = (x + shift) % w;
    const v = y % h;
    const id = row * 8 + Math.floor((x + shift) / w);
    if (v === h - 1 || u === w - 1) return mortar;
    let col = face(id, x, y);
    if (v === 0 || u === 0) col = shade(col, 0.16);
    else if (v === h - 2 || u === w - 2) col = shade(col, -0.14);
    return col;
  });
  for (const [x, y] of c.scatter(3, 6)) c.set(x, y, chip);
}

function brick(c: Canvas): void {
  const b = P.BRICK;
  const f = c.noise(4, 2, 1);
  masonry(c, 4, 8, (id, x, y) => tone([b[1], b[2], b[3]], (c.hash(id, 0, 1) * 0.6 + f(x, y) * 0.4) * 1.1), P.MORTAR, b[0]);
}

function stoneBrick(c: Canvas): void {
  const s = P.STONE;
  const f = c.noise(4, 4, 1);
  masonry(c, 2, 8, (id, x, y) => tone([s[1], s[2], s[3]], 0.25 + c.hash(id, 0, 2) * 0.3 + f(x, y) * 0.45), shade(s[0], -0.25), s[0]);
}

function concrete(c: Canvas): void {
  const k = P.CONCRETE;
  const f = c.noise(4, 4, 1);
  c.each((x, y) => tone([k[1], k[2], k[3]], 0.3 + f(x, y) * 0.45));
  // Formwork seam and the plugged holes of the form ties.
  for (let x = 0; x < 16; x++) c.set(x, 7, c.hash(x, 7, 3) < 0.8 ? shade(k[2], 0.12) : k[1]);
  for (let x = 0; x < 16; x++) c.set(x, 8, shade(k[1], -0.05));
  for (const x of [3, 11]) {
    c.set(x, 3, k[0]);
    c.set(x + 1, 4, k[3]);
    c.set(x + 4, 12, k[0]);
    c.set(x + 5, 13, k[3]);
  }
  for (const [x, y] of c.scatter(5, 4)) if (y !== 7 && y !== 8) c.set(x, y, k[1]);
}

/** Glass: an opaque pale frame, a faintly tinted pane and a couple of diagonal glints. */
function glass(c: Canvas): void {
  const g = P.GLASS;
  c.fill(g[2], 46);
  c.frame(0, 0, 16, 16, g[1]);
  c.rect(1, 1, 14, 1, g[3], 255);
  c.rect(1, 1, 1, 14, g[3], 255);
  c.rect(1, 14, 14, 1, g[0], 255);
  c.rect(14, 1, 1, 14, g[0], 255);
  for (const [x0, y0, len] of [[3, 7, 4], [4, 9, 2], [9, 13, 3]]) {
    for (let i = 0; i < len; i++) c.set(x0 + i, y0 - i, g[4], 190);
  }
  c.set(12, 3, g[4], 210);
}

function workbenchTop(c: Canvas): void {
  const w = P.WOOD;
  const grain = c.noise(8, 1, 1);
  c.each((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return w[0];
    if (y === 7) return shade(w[0], 0.1);
    let col = tone([w[2], w[3], w[4]], 0.3 + grain(x, y) * 0.6);
    if (y === 1 || y === 8) col = shade(col, 0.1);
    return col;
  });
  // A vise on the right edge and a mallet lying on the bench.
  const iron = P.IRON_METAL;
  c.rect(11, 2, 4, 4, iron[1]);
  bevel(c, 11, 2, 4, 4, iron[3], iron[0]);
  c.rect(12, 6, 2, 1, iron[0]);
  c.line(3, 13, 7, 9, w[0]);
  c.line(3, 12, 6, 9, w[1]);
  c.rect(6, 8, 3, 2, w[1]);
  c.rect(6, 8, 3, 1, w[3]);
  c.set(9, 4, w[0]);
  c.set(10, 12, w[1]);
  c.set(12, 11, w[1]);
}

function workbenchSide(c: Canvas): void {
  const w = P.WOOD;
  const back: RGB = shade(P.OAK_BARK[0], -0.35);
  c.fill(back);
  // Thick top board, apron, two legs and a low shelf.
  for (let x = 0; x < 16; x++) {
    c.set(x, 0, w[4]);
    c.set(x, 1, w[3]);
    c.set(x, 2, w[2]);
    c.set(x, 3, w[0]);
    c.set(x, 11, w[3]);
    c.set(x, 12, w[1]);
  }
  for (const x0 of [1, 12]) {
    c.rect(x0, 4, 3, 12, w[2]);
    c.rect(x0, 4, 1, 12, w[3]);
    c.rect(x0 + 2, 4, 1, 12, w[1]);
  }
  c.rect(1, 11, 14, 1, w[3]);
  c.rect(1, 12, 14, 1, w[1]);
  // A saw hanging from the apron and a pot of nails on the shelf.
  const iron = P.IRON_METAL;
  c.rect(6, 4, 1, 2, w[1]);
  c.rect(5, 6, 4, 4, iron[3]);
  for (let x = 5; x < 9; x++) c.set(x, 9, x % 2 === 0 ? iron[1] : iron[4]);
  c.rect(10, 9, 2, 2, iron[2]);
  c.set(10, 9, iron[4]);
}

function crate(c: Canvas): void {
  const w = P.WOOD;
  const grain = c.noise(8, 1, 2);
  c.each((x, y) => {
    const v = y % 4;
    const col = tone([w[1], w[2], w[3]], 0.3 + grain(x, y) * 0.6);
    return v === 3 ? shade(w[0], -0.1) : v === 0 ? shade(col, 0.1) : col;
  });
  // Frame boards and a diagonal brace, darker and heavier than plain planks.
  for (let i = 0; i < 16; i++) {
    for (const [x, y] of [[i, 0], [i, 1], [i, 14], [i, 15], [0, i], [1, i], [14, i], [15, i]]) c.set(x, y, w[1]);
  }
  bevel(c, 0, 0, 16, 16, w[3], w[0]);
  bevel(c, 2, 2, 12, 12, w[0], w[3]);
  for (let i = 2; i < 14; i++) {
    c.set(i, 15 - i, w[3]);
    c.set(i + 1, 15 - i, w[1]);
    c.set(i, 16 - i, w[0]);
  }
  const iron = P.IRON_METAL;
  for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) rivet(c, x, y, iron[4], iron[0]);
}

/** The lamp is a lantern: iron cage, glass, a bulb that is either cold or blazing (plus the cyan power pip). */
function lamp(c: Canvas, lit: boolean): void {
  const iron = P.IRON;
  const glassDim: RGB = mix(P.GLASS[0], P.IRON[2], 0.55);
  c.each((x, y) => {
    if (!lit) return tone([shade(glassDim, -0.2), glassDim, shade(glassDim, 0.12)], 1 - Math.hypot(x - 7.5, y - 8) / 9);
    const d = Math.hypot(x - 7.5, y - 8);
    return d < 2.2 ? P.rgb(0xfffbe8) : d < 4 ? P.rgb(0xffe9a8) : d < 6 ? P.rgb(0xf3c46a) : P.rgb(0xd09a48);
  });
  // Bulb and filament.
  if (!lit) {
    c.rect(6, 6, 4, 5, shade(glassDim, 0.25));
    c.rect(7, 7, 2, 3, P.COPPER[1]);
  } else c.rect(7, 7, 2, 3, P.rgb(0xffffff));
  // Cage: caps, corner posts and a middle bar.
  c.rect(0, 0, 16, 2, iron[2]);
  c.rect(0, 14, 16, 2, iron[2]);
  c.rect(0, 0, 2, 16, iron[2]);
  c.rect(14, 0, 2, 16, iron[2]);
  c.rect(0, 0, 16, 1, iron[4]);
  c.rect(0, 15, 16, 1, iron[0]);
  c.rect(1, 2, 1, 12, iron[3]);
  c.rect(14, 2, 1, 12, iron[1]);
  c.rect(2, 2, 12, 1, iron[0]);
  c.rect(7, 14, 2, 1, lit ? P.CYAN : P.CYAN_OFF);
}

export const BUILDING: PainterSet = {
  brick,
  stone_brick: stoneBrick,
  concrete,
  glass,
  workbench_top: workbenchTop,
  workbench_side: workbenchSide,
  crate,
  lamp: (c) => lamp(c, false),
  lamp_on: (c) => lamp(c, true),
};
