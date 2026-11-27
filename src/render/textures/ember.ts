/**
 * The Emberbound (spec 19): what is salvaged from the automatons (scrap, ember cores), what is forged to fight them
 * (four mauls, two armours) and the ward beacon's faces. Mauls share the tool handle's diagonal but carry a heavy
 * square head across it, so they never read as a pickaxe or an axe; the arc maul's head holds a glowing core.
 */
import type { Canvas, Painter, PainterSet } from './canvas';
import { bevel, rivet } from './brush';
import { CASE_IRON, plate, pip } from './casing';
import * as P from './palette';
import { type RGB, type Ramp, mix, shade } from './palette';
import { icon, rampLegend } from './shapes';

const I = CASE_IRON;
const WHITE: RGB = P.rgb(0xffffff);
/** Leather wrap on a maul's grip. */
const GRIP: Ramp = [P.rgb(0x2a1a14), P.rgb(0x3e2619), P.rgb(0x553521), P.rgb(0x6d4a2e), P.rgb(0x8a6540)];

// ---- salvage -------------------------------------------------------------------------------------

/** Whether (x, y) lies inside a convex polygon given clockwise in pixel-centre coordinates. */
function inside(pts: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if ((bx - ax) * (py - ay) - (by - ay) * (px - ax) < 0) return false;
  }
  return true;
}

/** Salvage: a torn plate with a rivet row and rust, a broken cog over it, and a loose bolt. */
function scrapMetal(c: Canvas): void {
  const m = P.IRON_METAL;
  const r = P.RUST;
  // The plate, tilted, its lower-left corner torn away.
  const sheet: Array<[number, number]> = [[1, 4], [9, 1], [11, 7], [3, 11]];
  const rust = c.noise(4, 4, 3);
  c.each((x, y) => {
    if (!inside(sheet, x, y) || (x < 3 && y > 8)) return null;
    if (rust(x, y) > 0.55) return m[1];
    return (x + y) / 18 < 0.5 ? r[3] : r[2];
  });
  for (const [x, y] of [[3, 5], [5, 4], [7, 3]] as const) c.set(x, y, r[0]);
  c.line(3, 11, 11, 7, r[1]);
  // A broken cog: a toothed ring with its hub hole, a wedge of it missing.
  c.each((x, y) => {
    const dx = x + 0.5 - 10;
    const dy = y + 0.5 - 10.5;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    if (a > 1.8 && a < 2.9) return null; // the broken-off wedge
    const tooth = Math.cos(a * 6) > 0.25;
    if (d < 1.6 || d > (tooth ? 5.6 : 4.2)) return null;
    if (d < 2.5) return m[1];
    const lit = (-dx - dy) / 7;
    return lit > 0.3 ? m[4] : lit > -0.2 ? m[3] : lit > -0.6 ? m[2] : m[1];
  });
  for (const [x, y] of [[12, 13], [13, 12], [7, 13]] as const) c.set(x, y, r[1]);
  // A bolt lying across the plate.
  c.line(2, 13, 5, 13, m[3]);
  c.rect(1, 12, 2, 3, m[4]);
  c.set(2, 14, m[1]);
}

/** A cracked dark shell around a still-burning heart: glowing seams, a bright core showing through, two sparks. */
function emberCore(c: Canvas): void {
  const s = P.IRON;
  const e = P.EMBER;
  c.each((x, y) => {
    const dx = x + 0.5 - 7.5;
    const dy = y + 0.5 - 8.5;
    const d = Math.hypot(dx, dy * 1.08);
    if (d > 5.8) return null;
    const lit = (-dx - dy) / 8;
    return lit > 0.35 ? s[4] : lit > -0.1 ? s[3] : lit > -0.5 ? s[2] : s[1];
  });
  // The heart, seen through a broken facet: hot white at its middle.
  c.disc(8, 9, 2.2, e[3]);
  c.disc(8, 9, 1.2, e[4]);
  c.set(8, 8, shade(e[4], 0.6));
  // Seams of fire running out from it.
  c.line(9, 7, 12, 4, e[2]);
  c.line(6, 10, 3, 12, e[2]);
  c.line(9, 11, 11, 13, e[1]);
  c.line(6, 7, 5, 4, e[1]);
  c.set(12, 4, e[3]);
  c.set(3, 12, e[3]);
  // Sparks rising off it.
  c.set(13, 1, e[4]);
  c.set(2, 3, e[3]);
}

// ---- mauls ---------------------------------------------------------------------------------------

/** A maul: a leather-wrapped haft up the diagonal and a heavy square head across its top end. */
function maul(c: Canvas, head: Ramp, arc = false): void {
  // Haft from (1, 14) to (9, 6), its lower third wrapped in leather.
  const w = P.WOOD;
  for (let i = 0; i <= 8; i++) {
    const x = 1 + i;
    const y = 14 - i;
    const wrapped = i <= 3;
    c.set(x, y, wrapped ? (i % 2 === 0 ? GRIP[3] : GRIP[2]) : w[3]);
    c.set(x + 1, y, wrapped ? GRIP[1] : w[1]);
  }
  c.set(1, 14, GRIP[0]);
  c.set(2, 14, GRIP[0]);
  // Head: a block centred on (11, 4.5), long across the haft (direction (1, 1)) and short along it.
  c.each((x, y) => {
    const dx = x + 0.5 - 11;
    const dy = y + 0.5 - 4.5;
    const across = (dx + dy) / Math.SQRT2;
    const along = (dx - dy) / Math.SQRT2;
    if (Math.abs(across) > 4.6 || Math.abs(along) > 2.4) return null;
    // Striking faces at both ends are bright, the top-left flank lit, the bottom-right in shade.
    if (Math.abs(across) > 3.7) return across < 0 ? head[4] : head[2];
    return along > 0.9 ? head[3] : along > -0.9 ? head[2] : head[1];
  });
  // A collar where the haft enters the head.
  c.set(9, 6, shade(head[0], -0.2));
  c.set(10, 6, head[0]);
  if (arc) {
    // The ember core set in the head, and a crackle of arc light leaping off it.
    c.set(11, 4, P.EMBER[4]);
    c.set(10, 4, P.EMBER[3]);
    c.set(11, 5, P.EMBER[3]);
    c.set(12, 5, P.EMBER[2]);
    c.set(14, 0, P.ARC_GLOW[2]);
    c.set(15, 1, P.ARC_GLOW[3]);
    c.set(13, 1, P.ARC_GLOW[1]);
  } else {
    // A punched maker's mark in the head.
    c.set(11, 4, head[0]);
  }
}

// ---- armour --------------------------------------------------------------------------------------

/** The padded coat (iconsParts) sewn with riveted iron plates on the shoulders and chest. */
function platedCoat(c: Canvas): void {
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
  const m = P.IRON_METAL;
  // Shoulder plates and two chest plates either side of the opening.
  c.rect(2, 4, 3, 2, m[3]);
  c.rect(11, 4, 3, 2, m[2]);
  c.rect(5, 6, 3, 4, m[3]);
  c.rect(8, 6, 3, 4, m[2]);
  c.rect(5, 6, 3, 1, m[4]);
  c.rect(8, 9, 3, 1, m[1]);
  for (const [x, y] of [[5, 7], [10, 7], [3, 4], [12, 4]] as const) c.set(x, y, m[0]);
  c.set(7, 6, shade(m[4], 0.4));
}

/** A steel breastplate with a centre ridge and flared shoulder guards over a padded lining. */
function steelCuirass(c: Canvas, s: Ramp = P.STEEL): void {
  const k = P.CLOTH;
  c.sprite(
    [
      '...kk......kk...',
      '..k334....4433k.',
      '.k33443..3443321',
      '.33.34455443.21.',
      '....34455442....',
      '....34455432....',
      '....22222221....',
      '....34455432....',
      '.....222221.....',
      '.....344542.....',
      '......2221......',
      '.......11.......',
    ],
    { ...rampLegend(s), k: k[3] },
    0,
    2,
  );
  // The padded lining showing at the neck, and rivets down the flanks.
  c.rect(6, 2, 4, 1, k[2]);
  c.rect(7, 3, 2, 1, k[1]);
  for (const y of [6, 9]) {
    c.set(4, y, s[4]);
    c.set(11, y, s[0]);
  }
  c.set(7, 5, WHITE);
}

// ---- the ward beacon -----------------------------------------------------------------------------

/** Side: a caged glass column with two ember cores in it, copper circuit traces on the frame, the power pip. */
function wardSide(c: Canvas, lit: boolean): void {
  plate(c);
  const glow = P.EMBER;
  const brass = P.BRONZE;
  // The window in an old bronze frame: dark glass when idle, a warm glowing column when powered.
  c.rect(5, 1, 6, 13, brass[1]);
  c.rect(5, 1, 1, 13, brass[3]);
  for (let y = 2; y <= 12; y++) {
    for (let x = 6; x <= 9; x++) {
      const edge = x === 6 || x === 9;
      if (lit) c.set(x, y, edge ? glow[2] : glow[3]);
      else c.set(x, y, edge ? mix(P.GLASS[0], P.SOOT, 0.55) : mix(P.GLASS[0], P.SOOT, 0.7));
    }
  }
  // Two ember cores held in the column: dull coals idle, white-hot when the beacon burns.
  for (const cy of [4, 9]) {
    c.rect(7, cy, 2, 2, lit ? glow[4] : glow[1]);
    c.set(7, cy, lit ? WHITE : glow[2]);
    c.set(8, cy + 1, lit ? glow[3] : glow[0]);
  }
  // Cage bars across the window.
  for (const y of [2, 7, 12]) c.rect(5, y, 6, 1, lit ? brass[3] : brass[1]);
  // Circuit traces on the casing, catching the light when it is on.
  const trace = lit ? P.COPPER[4] : P.COPPER[1];
  c.line(2, 4, 4, 4, trace);
  c.line(2, 4, 2, 9, trace);
  c.line(11, 6, 13, 6, trace);
  c.line(13, 6, 13, 10, trace);
  c.set(2, 9, lit ? P.CYAN : P.CYAN_OFF);
  c.set(13, 10, lit ? P.CYAN : P.CYAN_OFF);
  pip(c, lit);
}

/** Top: a round lens in a bolted collar; lit, it burns gold with a bright ring. */
function wardTop(c: Canvas, lit: boolean): void {
  plate(c);
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d < 3.6) {
      if (!lit) return mix(P.GLASS[0], P.SOOT, d < 1.6 ? 0.5 : 0.72);
      return d < 1.6 ? WHITE : d < 2.6 ? P.EMBER[4] : P.EMBER[3];
    }
    if (d < 5.2) return x + y < 16 ? I[4] : I[0];
    if (d < 6.1 && lit) return P.GOLD[3];
    return null;
  });
  for (const [x, y] of [[8, 2], [8, 13], [2, 8], [13, 8]] as const) rivet(c, x, y, I[4], I[0]);
  bevel(c, 0, 0, 16, 16, I[1], I[0]);
}

const paint = (fn: (c: Canvas, lit: boolean) => void, lit: boolean): Painter => (c) => fn(c, lit);

export const EMBER_TEXTURES: PainterSet = {
  item_scrap_metal: icon(scrapMetal),
  item_ember_core: icon(emberCore),
  item_bronze_maul: icon((c) => maul(c, P.BRONZE)),
  item_iron_maul: icon((c) => maul(c, P.IRON_METAL)),
  item_steel_maul: icon((c) => maul(c, P.STEEL)),
  item_arc_maul: icon((c) => maul(c, P.ARC_STEEL, true)),
  item_plated_coat: icon(platedCoat),
  item_steel_cuirass: icon(steelCuirass),
  item_bronze_vest: icon((c) => steelCuirass(c, P.BRONZE)),
  item_arc_mail: icon((c) => steelCuirass(c, P.ARC_STEEL)),
  item_superalloy_hauberk: icon((c) => steelCuirass(c, P.SUPERALLOY)),
  item_superalloy_maul: icon((c) => maul(c, P.SUPERALLOY, true)),
  ward_beacon_side: paint(wardSide, false),
  ward_beacon_side_on: paint(wardSide, true),
  ward_beacon_top: paint(wardTop, false),
  ward_beacon_top_on: paint(wardTop, true),
};
