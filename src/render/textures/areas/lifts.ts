/** Textures of bridges, lifts and elevators (src/content/areas/lifts.ts): the two winches, the drawbridge front and the deck. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';

/** A framed housing: timber for the lift, riveted iron for the elevator. */
function housing(c: Canvas, iron: boolean): void {
  const r = iron ? P.IRON_METAL : P.WOOD;
  const n = c.noise(4, 2, iron ? 7 : 3);
  c.each((x, y) => P.shade(r[1], (n(x, y) - 0.5) * 0.16));
  c.frame(0, 0, 16, 16, r[0]);
  c.rect(1, 1, 14, 1, r[3]);
  c.rect(1, 14, 14, 1, r[0]);
  if (iron) for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) c.set(x, y, r[4]);
  else for (let y = 4; y < 14; y += 5) c.rect(1, y, 14, 1, r[0]);
}

/** The winch face: a drum wound with rope (lift) or chain (elevator), a ratchet cog; turning, the wraps shift and a pawl lifts. */
function winch(c: Canvas, iron: boolean, on: boolean): void {
  housing(c, iron);
  const drum = iron ? P.IRON_METAL : P.WOOD;
  c.rect(3, 4, 10, 8, drum[2]);
  c.rect(3, 4, 10, 1, drum[3]);
  c.rect(3, 11, 10, 1, drum[0]);
  const wrap = iron ? P.IRON_METAL[4] : P.STRAW[3];
  const dark = iron ? P.IRON_METAL[1] : P.STRAW[1];
  for (let y = 5; y < 11; y++) {
    for (let x = 3; x < 13; x++) {
      const k = (x + y * 2 + (on ? 1 : 0)) % 3;
      if (iron) c.set(x, y, k === 0 ? dark : k === 1 ? wrap : P.IRON_METAL[3]);
      else if (k !== 2) c.set(x, y, k === 0 ? wrap : dark);
    }
  }
  // Flanges, the ratchet cog and its pawl.
  c.rect(2, 3, 1, 10, P.BRONZE[1]);
  c.rect(13, 3, 1, 10, P.BRONZE[1]);
  c.disc(8, 13, 2, P.BRONZE[on ? 4 : 3]);
  c.set(8, 13, P.BRONZE[0]);
  c.line(11, 13, on ? 13 : 12, on ? 12 : 14, P.IRON_METAL[3]);
  // The line paying out at the top.
  c.rect(7, 0, 2, 4, wrap);
  c.set(7, 0, dark);
}

/** The drawbridge front: a plank flap in a bronze frame; running, the gear teeth and chain links light up. */
function drawbridge(c: Canvas, on: boolean): void {
  housing(c, false);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) c.set(x, y, (x - 3) % 3 === 0 ? P.WOOD[0] : P.WOOD[3 - ((x + y) % 2)]);
  c.frame(2, 2, 12, 12, P.BRONZE[2]);
  for (const x of [4, 11]) {
    c.line(x, 3, x, 12, P.IRON_METAL[on ? 4 : 2]);
    for (let y = 3 + (on ? 1 : 0); y < 13; y += 2) c.set(x, y, P.IRON_METAL[1]);
  }
  c.disc(8, 8, 1, P.BRONZE[on ? 4 : 3]);
}

/** Lashed planks running along the bridge, rope ties across them. */
function deck(c: Canvas): void {
  const w = P.WOOD;
  const n = c.noise(2, 8, 5);
  c.each((x, y) => {
    const plank = Math.floor(x / 4);
    const base = w[1 + ((plank * 7) % 3)];
    if (x % 4 === 0) return w[0];
    return P.shade(base, (n(x, y) - 0.5) * 0.2);
  });
  for (const y of [2, 13]) {
    c.rect(0, y, 16, 1, P.STRAW[2]);
    for (let x = 1; x < 16; x += 4) c.set(x, y, P.STRAW[4]);
  }
}

export default {
  lift_winch: (c) => winch(c, false, false),
  lift_winch_on: (c) => winch(c, false, true),
  elevator_winch: (c) => winch(c, true, false),
  elevator_winch_on: (c) => winch(c, true, true),
  drawbridge_front: (c) => drawbridge(c, false),
  drawbridge_front_on: (c) => drawbridge(c, true),
  bridge_deck: deck,
} satisfies PainterSet;
