/** Item icons of components and gear: bricks, insulators, frames, boards, cells, rods, the star core, clothes. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { type RGB, type Ramp, mix, shade } from './palette';
import { capsule, glassFill, icon, rampLegend } from './shapes';

const WHITE: RGB = P.rgb(0xffffff);

function firebrick(c: Canvas): void {
  // One pale brick in three-quarter view: top, front and end faces, speckled with grog.
  const f = P.FIREBRICK;
  c.sprite(
    [
      '...555555555555.',
      '..5444444444443.',
      '.54444444444432.',
      '.33333333333322.',
      '.33333333333322.',
      '.33333333333321.',
      '.22222222222211.',
      '.11111111111111.',
    ],
    rampLegend(f),
    0,
    5,
  );
  for (const [x, y] of [[3, 9], [6, 10], [10, 9], [12, 11], [8, 7], [4, 11]]) c.set(x, y, f[0]);
}

function ceramicInsulator(c: Canvas): void {
  // A glazed spool: three sheds stacked on a stem, iron caps top and bottom.
  const k = P.CERAMIC;
  for (const y of [4, 7, 10]) {
    c.rect(3, y, 10, 2, k[2]);
    c.rect(3, y, 10, 1, k[4]);
    c.rect(4, y + 2, 8, 1, k[0]);
  }
  c.rect(6, 2, 4, 12, k[1]);
  for (const y of [4, 7, 10]) {
    c.rect(3, y, 10, 1, k[4]);
    c.rect(3, y + 1, 10, 1, k[2]);
  }
  c.rect(6, 1, 4, 1, P.IRON_METAL[3]);
  c.rect(6, 13, 4, 2, P.IRON_METAL[1]);
  c.set(4, 4, WHITE);
}

function bellows(c: Canvas): void {
  // Two teardrop boards hinged at a brass nozzle, leather pleats between them.
  const w = P.WOOD;
  const leather = P.rgb(0x6a4030);
  c.each((x, y) => {
    const u = (x - 6) / 6;
    const v = (y - 7.5) / 6;
    if (u < -1 || u > 1 || Math.abs(v) > 0.9 - u * 0.35) return null;
    if (Math.abs(v) > 0.7 - u * 0.35) return y < 8 ? w[3] : w[1];
    return x % 2 === 0 ? leather : shade(leather, 0.2);
  });
  c.rect(12, 7, 3, 2, P.BRONZE[3]);
  c.rect(12, 8, 3, 1, P.BRONZE[1]);
  c.rect(1, 6, 2, 4, w[2]);
  c.set(1, 6, w[4]);
}

function chassis(c: Canvas): void {
  // A square iron frame with bronze diagonal braces and corner gussets.
  const i = P.IRON_METAL;
  for (let k = 2; k <= 13; k++) {
    c.set(k, 2, i[4]);
    c.set(k, 3, i[2]);
    c.set(k, 12, i[2]);
    c.set(k, 13, i[0]);
    c.set(2, k, i[3]);
    c.set(3, k, i[2]);
    c.set(12, k, i[1]);
    c.set(13, k, i[0]);
  }
  for (let k = 4; k <= 11; k++) {
    c.set(k, k, P.BRONZE[3]);
    c.set(15 - k, k, P.BRONZE[2]);
  }
  for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) c.rect(x, y, 2, 2, i[3]);
  c.rect(7, 7, 2, 2, P.BRONZE[4]);
}

function siliconWafer(c: Canvas): void {
  // A thin disc seen at an angle, its surface a grid of dies with a blue sheen; one flat edge.
  c.each((x, y) => {
    const d = Math.hypot((x - 7.5) / 7, (y - 8) / 5);
    if (d > 1 || y > 12) return null;
    if (d > 0.86) return y < 8 ? P.rgb(0x9aa6c0) : P.rgb(0x3a4258);
    const grid = x % 3 === 0 || y % 2 === 0;
    const sheen = (x - y) / 14;
    return grid ? P.rgb(0x4c5878) : mix(P.rgb(0x6a7aa8), P.rgb(0xb4c8e8), Math.max(0, Math.min(1, 0.5 - sheen)));
  });
  c.rect(4, 13, 8, 1, P.rgb(0x2a3044));
}

function circuit(c: Canvas): void {
  // A dark teal board, copper traces running to a black chip with silver legs.
  const board: RGB = P.rgb(0x1d4a44);
  c.rect(1, 2, 14, 12, board);
  c.rect(1, 2, 14, 1, shade(board, 0.25));
  c.rect(1, 13, 14, 1, shade(board, -0.35));
  for (const [x0, y0, x1, y1] of [[2, 4, 5, 4], [2, 11, 5, 11], [11, 4, 13, 4], [11, 11, 13, 9], [2, 7, 4, 7]]) c.line(x0, y0, x1, y1, P.COPPER[3]);
  for (const [x, y] of [[2, 4], [2, 11], [13, 4], [13, 9], [2, 7]]) c.set(x, y, P.GOLD[4]);
  c.rect(5, 5, 6, 6, P.GRAPHITE[1]);
  c.rect(5, 5, 6, 1, P.GRAPHITE[3]);
  for (let k = 6; k <= 9; k += 1) {
    c.set(k, 4, P.TIN[3]);
    c.set(k, 11, P.TIN[3]);
  }
  c.set(6, 6, P.CYAN);
}

function enrichedPellet(c: Canvas): void {
  // Two squat glowing pellets, one standing behind the other.
  for (const [x0, y0] of [[6, 3], [3, 7]]) {
    c.rect(x0, y0 + 1, 7, 5, P.URANIUM[2]);
    c.rect(x0, y0 + 1, 2, 5, P.URANIUM[3]);
    c.rect(x0 + 5, y0 + 1, 2, 5, P.URANIUM[1]);
    c.rect(x0 + 1, y0, 5, 2, P.URANIUM[4]);
    c.rect(x0 + 1, y0 + 6, 5, 1, P.URANIUM[0]);
  }
  c.set(5, 8, WHITE);
}

function fuelRod(c: Canvas): void {
  // A long clad rod standing upright, green pellets showing through three windows.
  const s = P.SUPERALLOY;
  c.rect(6, 1, 4, 14, s[2]);
  c.rect(6, 1, 1, 14, s[4]);
  c.rect(9, 1, 1, 14, s[0]);
  c.rect(6, 1, 4, 1, s[4]);
  for (const y of [3, 7, 11]) {
    c.rect(7, y, 2, 2, P.URANIUM[3]);
    c.set(7, y, P.URANIUM[4]);
  }
  c.rect(5, 14, 6, 1, s[1]);
}

const emptyCell = (c: Canvas): void => capsule(c, P.ALUMINUM, glassFill(P.GLASS));

function deuteriumCell(c: Canvas): void {
  const glow: Ramp = [P.rgb(0x1c3a78), P.rgb(0x2c64c0), P.rgb(0x4ea0f0), P.rgb(0x9ad4ff), WHITE];
  capsule(c, P.ALUMINUM, (x, y) => (x === 5 ? glow[4] : y < 7 ? glow[3] : x > 9 ? glow[1] : glow[2]));
  c.set(7, 9, WHITE);
  c.set(8, 7, glow[4]);
}

function magnetRing(c: Canvas): void {
  // A torus wound with copper, a cold cyan field glowing in its bore.
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 6.6) return null;
    if (d < 3) return d < 2 ? mix(P.CYAN, P.SOOT, 0.6) : P.CYAN;
    if (d < 3.7) return P.SUPERALLOY[0];
    const wind = Math.floor(Math.atan2(y - 7.5, x - 7.5) * 5) % 2 === 0;
    const lit = x + y < 15;
    return wind ? (lit ? P.COPPER[4] : P.COPPER[2]) : lit ? P.COPPER[2] : P.COPPER[1];
  });
}

function starCore(c: Canvas): void {
  // A golden sun held in two crossed superalloy rings.
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    return d < 2 ? WHITE : d < 3.4 ? P.STARFIRE[3] : d < 4.6 ? P.STARFIRE[2] : null;
  });
  c.each((x, y) => {
    const a = Math.abs(Math.hypot((x - 7.5) / 7, (y - 7.5) / 3) - 1) < 0.14;
    const b = Math.abs(Math.hypot((x - 7.5) / 3, (y - 7.5) / 7) - 1) < 0.14;
    return a ? P.SUPERALLOY[3] : b ? P.SUPERALLOY[2] : null;
  });
}

function fuelCanister(c: Canvas): void {
  // A squared can in oxide red with a handle, a spout cap and an amber band.
  const k = P.OXIDE_RED;
  c.rect(3, 4, 10, 11, k[2]);
  c.rect(3, 4, 2, 11, k[3]);
  c.rect(11, 4, 2, 11, k[1]);
  c.rect(3, 4, 10, 1, k[4]);
  c.rect(3, 14, 10, 1, k[0]);
  c.rect(3, 9, 10, 2, P.AMBER[3]);
  c.rect(3, 10, 10, 1, P.AMBER[1]);
  c.rect(5, 1, 5, 1, P.IRON_METAL[3]);
  c.rect(5, 2, 1, 2, P.IRON_METAL[2]);
  c.rect(9, 2, 1, 2, P.IRON_METAL[2]);
  c.rect(10, 2, 2, 2, P.IRON_METAL[4]);
}

function pail(c: Canvas, water: boolean): void {
  // A tapered stave bucket with two iron hoops and a wire bail.
  const w = P.WOOD;
  for (let y = 6; y <= 14; y++) {
    const inset = Math.floor((y - 6) / 4);
    for (let x = 2 + inset; x <= 13 - inset; x++) {
      const stave = (x - inset) % 3 === 0;
      c.set(x, y, x < 5 ? w[3] : x > 10 ? w[1] : stave ? w[1] : w[2]);
    }
  }
  for (const y of [8, 12]) c.rect(2 + Math.floor((y - 6) / 4), y, 12 - 2 * Math.floor((y - 6) / 4), 1, P.IRON_METAL[2]);
  c.rect(2, 5, 12, 1, water ? P.WATER[3] : w[0]);
  c.rect(3, 6, 10, 1, water ? P.WATER[2] : shade(w[0], -0.3));
  if (water) c.set(5, 5, P.WATER[4]);
  c.line(2, 5, 4, 1, P.IRON_METAL[3]);
  c.line(4, 1, 11, 1, P.IRON_METAL[3]);
  c.line(11, 1, 13, 5, P.IRON_METAL[1]);
}

function paddedCoat(c: Canvas): void {
  // A quilted coat: shoulders, sleeves, a front opening and diamond stitching.
  const k = P.CLOTH;
  c.sprite(
    [
      '....44..44....',
      '..444433444...',
      '.43333333333..',
      '4433333,33332.',
      '433.33333.322.',
      '43..33,33..21.',
      '42..33333..21.',
      '3...33,33...1.',
      '....33333.....',
      '....33,33.....',
      '....33333.....',
      '....22222.....',
    ],
    { ...rampLegend(k), ',': k[1] },
    1,
    2,
  );
  for (const [x, y] of [[6, 6], [8, 8], [6, 10], [8, 12]]) c.set(x, y, k[4]);
}

function shieldSuit(c: Canvas): void {
  // A sealed suit: domed helmet with a fused-quartz visor, plated torso, hazard trim.
  const s = P.SUPERALLOY;
  c.disc(7.5, 3.5, 3, s[2]);
  c.rect(5, 2, 6, 3, P.QUARTZ[3]);
  c.rect(5, 2, 2, 1, WHITE);
  c.rect(3, 7, 10, 6, s[2]);
  c.rect(3, 7, 10, 1, s[4]);
  c.rect(3, 7, 2, 6, s[3]);
  c.rect(11, 7, 2, 6, s[1]);
  c.rect(1, 8, 2, 5, s[1]);
  c.rect(13, 8, 2, 5, s[0]);
  c.rect(3, 11, 10, 1, P.HAZARD);
  c.rect(4, 13, 3, 2, s[1]);
  c.rect(9, 13, 3, 2, s[0]);
  c.set(7, 9, P.CYAN);
}

export const PART_ICONS: PainterSet = {
  item_firebrick: icon(firebrick),
  item_ceramic_insulator: icon(ceramicInsulator),
  item_bellows: icon(bellows),
  item_chassis: icon(chassis),
  item_silicon_wafer: icon(siliconWafer),
  item_circuit: icon(circuit),
  item_enriched_pellet: icon(enrichedPellet),
  item_fuel_rod: icon(fuelRod),
  item_empty_cell: icon(emptyCell),
  item_deuterium_cell: icon(deuteriumCell),
  item_magnet_ring: icon(magnetRing),
  item_star_core: icon(starCore),
  item_fuel_canister: icon(fuelCanister),
  item_pail: icon((c) => pail(c, false)),
  item_water_pail: icon((c) => pail(c, true)),
  item_padded_coat: icon(paddedCoat),
  item_shield_suit: icon(shieldSuit),
};
