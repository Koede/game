/**
 * Item icons of the Ember handwork (docs/api/handwork-content.md section 7): hammers, cast heads, blooms, plates, hide
 * goods, wet clay pieces and the fired moulds. Wet clay is grey-pink and glossy, fired clay is terracotta; a mould shows
 * the shape it casts as a dark hollow, so the six moulds tell apart by silhouette.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel } from './brush';
import * as P from './palette';
import { type Ramp, type RGB, mix, shade } from './palette';
import { icon, lump, plate, rampLegend } from './shapes';

const FLINT: Ramp = [P.rgb(0x2b2c37), P.rgb(0x40424f), P.rgb(0x5a5d70), P.rgb(0x7c8198), P.rgb(0xa9afc6)];

// ---- hammers -------------------------------------------------------------------------------------

function hammer(head: Ramp, lashed: boolean): (c: Canvas) => void {
  return icon((c) => {
    const w = P.WOOD;
    for (let i = 0; i <= 8; i++) {
      c.set(2 + i, 14 - i, w[3]);
      c.set(3 + i, 14 - i, w[1]);
    }
    c.set(2, 14, w[0]);
    c.set(3, 14, w[0]);
    // A square block head set across the top of the haft.
    c.rect(7, 2, 7, 5, head[2]);
    c.rect(7, 2, 7, 1, head[4]);
    c.rect(7, 3, 1, 4, head[3]);
    c.rect(13, 2, 1, 5, head[1]);
    c.rect(7, 6, 7, 1, head[0]);
    c.rect(13, 3, 1, 3, head[0]);
    if (lashed) {
      for (const [x, y] of [[9, 7], [10, 8], [10, 7], [9, 8]] as const) c.set(x, y, P.CLOTH[3]);
      c.set(11, 7, P.CLOTH[1]);
    } else {
      c.rect(9, 7, 2, 2, head[1]);
    }
  });
}

// ---- cast heads ----------------------------------------------------------------------------------

function castHead(rows: readonly string[]): (c: Canvas) => void {
  return icon((c) => {
    c.sprite(rows, rampLegend(P.BRONZE), 0, 2);
    // A sprue stub where the metal ran in.
    c.set(7, 13, P.BRONZE[0]);
  });
}

/** Mirrors the left half of a symmetric sprite to its full 16 columns ('0' stays a see-through eye for the haft). */
const mirror = (left: readonly string[]): string[] => left.map((r) => r + [...r].reverse().join(''));

// Each head is drawn so it reads as its tool at a glance: a down-curved pick with two points, a flared axe blade with a
// poll, a pointed spade, a long hoe blade at right angles, a squat double-faced maul. '0' is the haft eye.
const PICKAXE_HEAD = mirror([
  '........',
  '.....222',
  '..224555',
  '.2455555',
  '24555530',
  '24533332',
  '2432.222',
  '.22.....',
]);
const AXE_HEAD = [
  '................',
  '.22.............',
  '.2452222222.....',
  '.2455555555222..',
  '.24555555555552.',
  '.24555555500552.',
  '.24555555555552.',
  '.2455555555222..',
  '.2452222222.....',
  '.22.............',
];
const SHOVEL_HEAD = mirror([
  '........',
  '.......2',
  '......20',
  '......24',
  '....2224',
  '..224555',
  '.2455555',
  '.2455553',
  '.2455533',
  '..245533',
  '...24333',
  '....2433',
  '.....243',
  '......22',
]);
const HOE_HEAD = [
  '................',
  '.2222...........',
  '.24552..........',
  '.24052..........',
  '.24552..........',
  '.2455555555552..',
  '.2455555555552..',
  '.2433333333332..',
  '.222222222222...',
];
const MAUL_HEAD = mirror([
  '........',
  '.2222222',
  '24555555',
  '24555555',
  '24555503',
  '24555503',
  '24555553',
  '24333333',
  '.2222222',
]);

// ---- blooms and plates ---------------------------------------------------------------------------

function bloom(r: Ramp): (c: Canvas) => void {
  return icon((c) => {
    const dull: Ramp = [shade(r[0], -0.2), shade(r[1], -0.25), shade(r[2], -0.25), shade(r[3], -0.2), shade(r[4], -0.2)];
    lump(c, 7.5, 9, 6, 4.6, dull);
    // Pits and slag crusting a lump that cooled where it stood.
    for (const [x, y] of [[4, 8], [7, 6], [10, 9], [6, 11], [9, 12], [11, 7]] as const) if (c.alpha(x, y) > 0) c.set(x, y, P.SOOT);
    for (const [x, y] of [[5, 7], [8, 10], [10, 8]] as const) if (c.alpha(x, y) > 0) c.set(x, y, P.RUST[2]);
    c.set(6, 7, shade(r[4], 0.2));
  });
}

// ---- hide goods ----------------------------------------------------------------------------------

function hideSheet(base: RGB, edge: RGB, light: RGB): (c: Canvas) => void {
  return (c) => {
    c.each((x, y) => {
      const dx = (x - 7.5) / 6.8;
      const dy = (y - 8) / 5.2;
      const wob = 1 + (c.hash(x, y, 1) - 0.5) * 0.12 + Math.sin(x * 0.9) * 0.05;
      if (dx * dx + dy * dy > wob) return null;
      return dx + dy < -0.6 ? light : dx + dy > 0.7 ? edge : base;
    });
  };
}

function soakedHide(c: Canvas): void {
  const d = P.DIRT;
  hideSheet(d[1], d[0], d[2])(c);
  // Dark with water: drips and a glossy sheen.
  for (const [x, y] of [[5, 6], [9, 7], [7, 10], [11, 10]] as const) if (c.alpha(x, y) > 0) c.set(x, y, shade(d[0], -0.3));
  for (const [x, y] of [[4, 12], [10, 13], [7, 14]] as const) c.set(x, y, P.WATER[3]);
  c.set(6, 5, P.WATER[4]);
  c.set(5, 5, P.WATER[3]);
  c.outline();
}

function leather(c: Canvas): void {
  const t = P.WOOD;
  hideSheet(t[2], t[1], t[4])(c);
  // Stitched edge and a fold line.
  for (const [x, y] of [[3, 5], [4, 4], [6, 3], [9, 3], [11, 4], [12, 6], [12, 9], [11, 11], [9, 12], [6, 12], [4, 11], [3, 9]] as const) {
    if (c.alpha(x, y) > 0) c.set(x, y, t[0]);
  }
  c.line(5, 8, 10, 7, t[3]);
  c.outline();
}

function cloth(c: Canvas): void {
  const k = P.CLOTH;
  // A folded square of woven cloth: a weave of two tones, a lit fold on top.
  c.each((x, y) => {
    if (x < 2 || x > 13 || y < 3 || y > 13) return null;
    const weave = (x + y) % 2 === 0;
    const base = weave ? k[3] : k[2];
    if (y < 6) return weave ? k[4] : k[3];
    if (y > 12 || x > 12) return weave ? k[1] : k[0];
    return base;
  });
  c.rect(2, 6, 12, 1, k[1]);
  for (let x = 3; x < 14; x += 3) c.set(x, 2, k[3]);
  c.outline();
}

// ---- clay pieces ---------------------------------------------------------------------------------

const WET = P.CLAY;
const FIRED = P.FIRED_CLAY;

function slab(c: Canvas, r: Ramp): void {
  c.rect(1, 4, 14, 9, r[2]);
  c.rect(1, 4, 14, 1, r[4]);
  c.rect(1, 5, 1, 7, r[3]);
  c.rect(14, 5, 1, 8, r[1]);
  c.rect(1, 12, 14, 1, r[0]);
  c.rect(2, 13, 13, 1, shade(r[0], -0.25));
  bevel(c, 1, 4, 14, 9, r[4], r[0]);
}

/** A mould: a clay slab with the cast shape sunk into it ('#' = hollow). */
function mould(r: Ramp, cavity: readonly string[]): (c: Canvas) => void {
  return icon((c) => {
    slab(c, r);
    const hollow = shade(r[0], -0.55);
    const rim = shade(r[1], -0.1);
    cavity.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '#') {
          c.set(2 + i, 5 + j, hollow);
          if (c.get(2 + i, 4 + j) !== hollow && j > 0 && cavity[j - 1]?.[i] !== '#') c.set(2 + i, 5 + j, mix(hollow, rim, 0.3));
        }
      }
    });
    // Fired moulds are sooted at the mouth.
    if (r === FIRED) c.rect(2, 12, 12, 1, shade(r[0], -0.2));
  });
}

// Cavities are the head silhouettes themselves, so a mould and what it casts visibly match.
const CAVITY_INGOT = ['............', '..########..', '.##########.', '.##########.', '..########..', '............'];
const CAVITY_PICK = ['............', '##########..'.replace('..', '##'), '.####..####.', '.###....###.', '##........##', '............'];
const CAVITY_AXE = ['..##........', '.####..###..', '.##########.', '.##########.', '.####..###..', '..##........'];
const CAVITY_SHOVEL = ['.....##.....', '....####....', '...######...', '...######...', '....####....', '.....##.....'];
const CAVITY_HOE = ['.####.......', '.#####......', '.####.#####.', '......######', '......#####.', '......###...'];
const CAVITY_MAUL = ['.##########.', '############', '############', '############', '############', '.##########.'];

function cup(r: Ramp): (c: Canvas) => void {
  return icon((c) => {
    c.each((x, y) => {
      if (y < 4 || y > 13) return null;
      const half = 5.5 - (y - 4) * 0.28;
      if (Math.abs(x - 7.5) > half) return null;
      if (y === 4) return r[0];
      return x < 6 ? r[4] : x > 9 ? r[1] : r[3];
    });
    c.rect(3, 4, 10, 1, shade(r[0], -0.4));
    c.rect(4, 5, 8, 1, shade(r[0], -0.2));
    c.rect(11, 6, 3, 1, r[2]);
    c.rect(13, 7, 1, 3, r[2]);
    c.rect(11, 9, 3, 1, r[1]);
  });
}

function cone(r: Ramp): (c: Canvas) => void {
  return icon((c) => {
    c.each((x, y) => {
      if (y < 3 || y > 13) return null;
      const half = 6 - (y - 3) * 0.5;
      if (Math.abs(x - 7.5) > half) return null;
      return y === 3 ? r[0] : x < 6 ? r[4] : x > 9 ? r[1] : r[3];
    });
    c.rect(3, 3, 10, 1, shade(r[0], -0.4));
    c.rect(6, 12, 4, 2, r[1]);
    c.rect(7, 13, 2, 1, shade(r[0], -0.3));
  });
}

function pot(r: Ramp): (c: Canvas) => void {
  return icon((c) => {
    c.each((x, y) => {
      if (y < 5 || y > 13) return null;
      const bulge = Math.sin(((y - 5) / 8) * Math.PI);
      const half = 4 + bulge * 2.6;
      if (Math.abs(x - 7.5) > half) return null;
      return x < 5 ? r[4] : x > 10 ? r[1] : r[3];
    });
    c.rect(4, 4, 8, 2, r[2]);
    c.rect(4, 4, 8, 1, r[4]);
    c.rect(5, 5, 6, 1, shade(r[0], -0.5));
    c.rect(2, 7, 2, 1, r[3]);
    c.rect(1, 8, 2, 1, r[2]);
    c.rect(12, 8, 3, 1, r[1]);
    c.rect(14, 8, 1, 3, r[1]);
  });
}

export const HAND_ICONS: PainterSet = {
  item_flint_hammer: hammer(FLINT, true),
  item_bronze_hammer: hammer(P.BRONZE, false),
  item_bronze_pickaxe_head: castHead(PICKAXE_HEAD),
  item_bronze_axe_head: castHead(AXE_HEAD),
  item_bronze_shovel_head: castHead(SHOVEL_HEAD),
  item_bronze_hoe_head: castHead(HOE_HEAD),
  item_bronze_maul_head: castHead(MAUL_HEAD),
  item_copper_bloom: bloom(P.COPPER),
  item_tin_bloom: bloom(P.TIN),
  item_bronze_bloom: bloom(P.BRONZE),
  item_copper_plate: icon((c) => plate(c, P.COPPER)),
  item_bronze_plate: icon((c) => plate(c, P.BRONZE)),
  item_soaked_hide: soakedHide,
  item_leather: leather,
  item_cloth: cloth,
  item_unfired_cup: cup(WET),
  item_unfired_cone: cone(WET),
  item_unfired_alloy_pot: pot(WET),
  item_unfired_ingot_mould: mould(WET, CAVITY_INGOT),
  item_unfired_pickaxe_mould: mould(WET, CAVITY_PICK),
  item_unfired_axe_mould: mould(WET, CAVITY_AXE),
  item_unfired_shovel_mould: mould(WET, CAVITY_SHOVEL),
  item_unfired_hoe_mould: mould(WET, CAVITY_HOE),
  item_unfired_maul_mould: mould(WET, CAVITY_MAUL),
  item_ingot_mould: mould(FIRED, CAVITY_INGOT),
  item_pickaxe_mould: mould(FIRED, CAVITY_PICK),
  item_axe_mould: mould(FIRED, CAVITY_AXE),
  item_shovel_mould: mould(FIRED, CAVITY_SHOVEL),
  item_hoe_mould: mould(FIRED, CAVITY_HOE),
  item_maul_mould: mould(FIRED, CAVITY_MAUL),
};
