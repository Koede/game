/**
 * The grid: three cables and the two storage blocks.
 *
 * A cable texture is a plus: the mesher's 6/16 core samples the centre (rows and columns 5..10) and every arm
 * samples one band of it, so the bands carry lengthwise stripes and the corners stay transparent. The same
 * texture is the cable's flat item icon.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel } from './brush';
import { plate, well } from './casing';
import * as P from './palette';
import { type RGB, shade } from './palette';

interface CableLook {
  /** Colour across the band: index 0 is the band's first row (or column), 5 its last. */
  band: readonly RGB[];
  /** Repeating mark along the arm (twist, clamp): every `period` pixels on the listed band rows. */
  mark?: { period: number; colour: RGB; rows: readonly number[] };
  collar: readonly [RGB, RGB, RGB];
  core?: RGB;
}

const inBand = (v: number): boolean => v >= 5 && v <= 10;

function cable(c: Canvas, look: CableLook): void {
  c.each((x, y) => {
    const h = inBand(y);
    const v = inBand(x);
    if (!h && !v) return null;
    if (h && v) return null;
    if (h) {
      let col = look.band[y - 5];
      if (look.mark && x % look.mark.period === 0 && look.mark.rows.includes(y - 5)) col = look.mark.colour;
      return col;
    }
    let col = look.band[x - 5];
    if (look.mark && y % look.mark.period === 0 && look.mark.rows.includes(x - 5)) col = look.mark.colour;
    return col;
  });
  // The junction collar over the core.
  const [hi, mid, lo] = look.collar;
  c.rect(5, 5, 6, 6, mid);
  bevel(c, 5, 5, 6, 6, hi, lo);
  c.rect(7, 7, 2, 2, look.core ?? shade(mid, -0.25));
  c.set(7, 7, look.core ? shade(look.core, 0.4) : hi);
}

const COPPER: CableLook = {
  band: [P.COPPER[0], P.COPPER[3], P.COPPER[2], P.COPPER[2], P.COPPER[1], P.COPPER[0]],
  mark: { period: 2, colour: P.COPPER[4], rows: [2, 3] },
  collar: [P.BRONZE[4], P.BRONZE[2], P.BRONZE[0]],
};
const HEAVY: CableLook = {
  band: [P.GRAPHITE[0], P.GRAPHITE[3], P.GRAPHITE[2], P.ALUMINUM[2], P.GRAPHITE[1], P.GRAPHITE[0]],
  mark: { period: 4, colour: P.ALUMINUM[3], rows: [0, 1, 2, 3, 4, 5] },
  collar: [P.STEEL[4], P.STEEL[2], P.STEEL[0]],
};
const SUPER: CableLook = {
  band: [P.SUPERALLOY[0], P.SUPERALLOY[2], P.CYAN, P.CYAN_GLOW, P.SUPERALLOY[1], P.SUPERALLOY[0]],
  mark: { period: 4, colour: P.SUPERALLOY[3], rows: [0, 1, 4, 5] },
  collar: [P.SUPERALLOY[4], P.SUPERALLOY[2], P.SUPERALLOY[0]],
  core: P.CYAN,
};

function battery(c: Canvas, lit = false): void {
  plate(c);
  // Terminals: copper positive, dark negative.
  c.rect(3, 2, 3, 2, P.COPPER[2]);
  c.set(3, 2, P.COPPER[4]);
  c.rect(10, 2, 3, 2, P.GRAPHITE[2]);
  c.set(10, 2, P.GRAPHITE[4]);
  c.rect(4, 1, 1, 1, P.rgb(0xd04030));
  // Charge window: four cells, three lit.
  well(c, 4, 5, 8, 7);
  for (let k = 0; k < 4; k++) c.rect(5, 6 + k * 2, 7, 1, k === 0 && !lit ? P.CYAN_OFF : P.CYAN);
  c.rect(2, 13, 9, 1, P.HAZARD);
}

function lithiumBank(c: Canvas, lit = false): void {
  plate(c);
  // Six lilac-capped cells in a rack, and a charge strip along the bottom.
  for (const y of [4.5, 8.5]) {
    for (const x of [4, 8, 12]) {
      c.disc(x - 0.5, y, 1.9, P.LILAC[1]);
      c.disc(x - 0.9, y - 0.4, 1.1, P.LILAC[3]);
      c.set(Math.floor(x - 1), Math.floor(y - 1), P.LILAC[4]);
    }
  }
  well(c, 3, 11, 7, 1);
  c.rect(3, 11, lit ? 10 : 5, 1, P.CYAN);
}

export const GRID: PainterSet = {
  copper_cable: (c) => cable(c, COPPER),
  heavy_cable: (c) => cable(c, HEAVY),
  super_cable: (c) => cable(c, SUPER),
  battery_front: battery,
  battery_front_on: (c) => battery(c, true),
  lithium_bank_front: lithiumBank,
  lithium_bank_front_on: (c) => lithiumBank(c, true),
};
