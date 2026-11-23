/** Icons and jar faces of Essentia & Research (src/content/itemsMagic.ts), 16x16, light from the top left. */
import { WAND_CAPS, WAND_CORES, wandKey } from '../../content/itemsMagic';
import { ASPECTS } from '../../magic/aspects';
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const GLASS = [P.rgb(0x5d7c88), P.rgb(0x86a9b6), P.rgb(0xaed0db), P.rgb(0xd2eaf0), P.rgb(0xf2fbfd)];
const CORK = [P.rgb(0x6b4a25), P.rgb(0x9a7040), P.rgb(0xc49a62)];
const LEATHER = [P.rgb(0x4a2a14), P.rgb(0x6b3d1d), P.rgb(0x8c5528), P.rgb(0xa86a36)];
const PAGE = [P.rgb(0xcfc3a0), P.rgb(0xe8dfc2), P.rgb(0xfaf4e2)];
const WOOD = [P.rgb(0x4e3418), P.rgb(0x74502a), P.rgb(0x9a7040)];
const COPPER = [P.rgb(0x8a4a24), P.rgb(0xc0703a), P.rgb(0xe8a070)];

const hex = (s: string): P.RGB => P.rgb(parseInt(s.slice(1), 16));
const shade = (c: P.RGB, f: number): P.RGB => [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f))];

/** A round-bellied vial with a cork; `fill` colours the liquid. */
function vial(c: Canvas, fill: P.RGB | null): void {
  c.rect(7, 1, 3, 2, CORK[1]);
  c.set(7, 1, CORK[2]);
  c.rect(7, 3, 3, 3, GLASS[2]);
  c.rect(5, 6, 7, 8, GLASS[1]);
  c.rect(4, 7, 9, 6, GLASS[1]);
  c.rect(5, 6, 1, 7, GLASS[4]);
  c.rect(11, 7, 1, 6, GLASS[0]);
  if (fill) {
    c.rect(5, 9, 7, 4, fill);
    c.rect(4, 9, 9, 3, fill);
    c.rect(5, 9, 6, 1, shade(fill, 1.35));
    c.rect(9, 11, 3, 2, shade(fill, 0.7));
    c.set(6, 10, shade(fill, 1.6));
  }
  c.set(6, 7, GLASS[4]);
}

function notebook(c: Canvas): void {
  c.rect(3, 2, 10, 12, LEATHER[2]);
  c.rect(3, 2, 10, 1, LEATHER[3]);
  c.rect(3, 13, 10, 1, LEATHER[0]);
  c.rect(12, 3, 1, 10, PAGE[0]);
  c.rect(4, 3, 1, 10, LEATHER[1]);
  // A strap and a little aspect glyph on the cover.
  c.rect(10, 2, 1, 12, LEATHER[0]);
  c.rect(6, 6, 3, 3, PAGE[1]);
  c.set(7, 7, P.rgb(0xa77fe0));
  c.set(6, 6, PAGE[2]);
}

function scribing(c: Canvas): void {
  // An ink pot (dark glass, ink at the lip) with a quill leaning out of it to the top right.
  c.rect(2, 9, 7, 5, GLASS[0]);
  c.rect(3, 8, 5, 1, GLASS[1]);
  c.rect(3, 10, 1, 3, GLASS[2]);
  c.rect(4, 7, 3, 1, P.rgb(0x1a1424));
  c.rect(3, 13, 5, 1, P.rgb(0x2a3a44));
  for (let i = 0; i < 8; i++) {
    c.set(6 + i, 9 - i, PAGE[1]);
    if (i > 1) c.set(7 + i, 9 - i, PAGE[2]);
    if (i > 2) c.set(6 + i, 8 - i, PAGE[0]);
  }
  c.set(5, 10, P.rgb(0x1a1424));
}

function rod(c: Canvas): void {
  for (let i = 0; i < 9; i++) {
    c.set(3 + i, 13 - i, WOOD[1]);
    c.set(4 + i, 13 - i, WOOD[2]);
  }
  c.set(3, 13, WOOD[0]);
  // Copper collar and a glass bulb at the tip.
  c.rect(10, 5, 2, 2, COPPER[1]);
  c.set(10, 5, COPPER[2]);
  c.rect(11, 1, 4, 4, GLASS[2]);
  c.rect(12, 2, 2, 2, P.rgb(0xb8c4ff));
  c.set(12, 2, GLASS[4]);
}

function jarSide(c: Canvas): void {
  c.rect(0, 0, 16, 16, GLASS[2], 110);
  c.rect(0, 0, 16, 2, WOOD[1]);
  c.rect(0, 0, 16, 1, WOOD[2]);
  c.rect(1, 2, 1, 13, GLASS[4], 200);
  c.rect(14, 2, 1, 13, GLASS[0], 200);
  c.rect(0, 15, 16, 1, GLASS[0], 220);
  c.rect(3, 4, 1, 8, GLASS[4], 150);
}

function jarTop(c: Canvas): void {
  c.rect(0, 0, 16, 16, WOOD[1]);
  c.rect(1, 1, 14, 14, WOOD[0]);
  c.rect(2, 2, 12, 12, WOOD[2]);
  for (let i = 3; i < 13; i += 3) c.rect(2, i, 12, 1, WOOD[1]);
  c.rect(6, 6, 4, 4, CORK[1]);
  c.rect(6, 6, 4, 1, CORK[2]);
  c.rect(6, 9, 4, 1, CORK[0]);
  c.set(7, 7, GLASS[3]);
}

const vials: PainterSet = Object.fromEntries(ASPECTS.map((a) => [`item_vial_${a.key}`, icon((c) => vial(c, hex(a.color)))]));

/** A wand: the core's rod with a metal cap at the grip and at the tip. */
const REED_R = [WOOD[0], WOOD[1], WOOD[2], P.rgb(0xc4a064)];
const wands: PainterSet = Object.fromEntries(WAND_CORES.flatMap((core) => WAND_CAPS.map((cap) => [`item_${wandKey(core.key, cap.key)}`, icon((c) => {
  rodOf(c, core.key === 'reed' ? REED_R : core.key === 'bronze' ? BRONZE_R : IRON_R, P.rgb(cap.color));
  const m = P.rgb(cap.color);
  c.rect(2, 12, 3, 3, m);
  c.set(2, 12, shade(m, 1.4));
  c.rect(10, 5, 4, 1, m);
  c.rect(10, 5, 1, 4, m);
})])));

/** Golem bodies: the servant's four faces in wood, stone and iron. */
const BODY_PAL: Record<string, readonly P.RGB[]> = {
  wood_golem: [P.rgb(0x4e3418), P.rgb(0x74502a), P.rgb(0x9a7040), P.rgb(0xb88a50)],
  stone_golem: [P.rgb(0x4a4a4e), P.rgb(0x6a6a70), P.rgb(0x8a8a90), P.rgb(0xaaaab0)],
  iron_golem: [P.rgb(0x555c66), P.rgb(0x7a828e), P.rgb(0xa0a8b4), P.rgb(0xc8d0dc)],
};
const golems: PainterSet = Object.fromEntries(Object.entries(BODY_PAL).flatMap(([key, pal]) => [
  [`magic_${key}_side`, (c: Canvas) => clay(c, 41, pal)],
  [`magic_${key}_top`, (c: Canvas) => { clay(c, 43, pal); c.rect(5, 5, 6, 6, pal[3]); }],
  [`magic_${key}_front`, (c: Canvas) => servantFace(c, false, pal)],
  [`magic_${key}_front_on`, (c: Canvas) => servantFace(c, true, pal)],
]));
const marker = (arrow: P.RGB, out: boolean) => (c: Canvas): void => {
  c.each((x, y) => (x < 1 || x > 14 || y < 1 || y > 14 ? WOOD[0] : WOOD[noise(x, y, 81) < 0.4 ? 1 : 2]));
  c.rect(7, 4, 2, 8, arrow);
  c.rect(5, out ? 5 : 10, 6, 1, arrow);
  c.rect(6, out ? 4 : 11, 4, 1, arrow);
  c.set(7, out ? 4 : 11, P.rgb(0xffffff));
};

/** A round charm: a leather cord, a disc, one rune glyph in the colour of its power. */
const charm = (glyph: P.RGB, shape: (c: Canvas, g: P.RGB) => void) => icon((c) => {
  c.rect(7, 1, 2, 3, LEATHER[1]);
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9);
    if (d < 5.5) return d > 4.3 ? COPPER[0] : d > 3.4 ? COPPER[1] : STONE[3];
    return null;
  });
  shape(c, glyph);
});

/** A rune stone: a small slab with a glyph in the colour of what it upgrades. */
const runeStone = (glyph: P.RGB, shape: (c: Canvas, g: P.RGB) => void) => icon((c) => {
  c.rect(3, 3, 10, 10, STONE[1]);
  c.rect(3, 3, 10, 1, STONE[3]);
  c.rect(3, 12, 10, 1, STONE[0]);
  c.rect(4, 4, 8, 8, STONE[2]);
  shape(c, glyph);
});

export const MAGIC_TEXTURES: PainterSet = {
  item_focus_mod_reach: runeStone(P.rgb(0xaee8ff), (c, g) => { c.rect(5, 7, 6, 1, g); c.set(10, 6, g); c.set(10, 8, g); c.set(9, 5, g); c.set(9, 9, g); }),
  item_focus_mod_power: runeStone(P.rgb(0xffa040), (c, g) => { c.rect(7, 5, 2, 6, g); c.rect(5, 7, 6, 2, g); }),
  item_focus_mod_cost: runeStone(P.rgb(0xa0f0a0), (c, g) => { c.rect(6, 5, 4, 1, g); c.rect(6, 5, 1, 3, g); c.rect(6, 7, 4, 1, g); c.rect(9, 7, 1, 3, g); c.rect(6, 10, 4, 1, g); }),
  item_charm_ward: charm(P.rgb(0x6fb0ff), (c, g) => { c.rect(6, 7, 4, 1, g); c.rect(7, 8, 2, 3, g); c.set(7, 11, g); c.set(8, 11, g); }),
  item_charm_speed: charm(P.rgb(0xffe060), (c, g) => { c.rect(6, 7, 3, 1, g); c.rect(7, 8, 3, 1, g); c.rect(6, 9, 3, 1, g); c.rect(7, 10, 3, 1, g); }),
  item_charm_hunger: charm(P.rgb(0xe8622a), (c, g) => { c.rect(6, 8, 4, 3, g); c.rect(7, 7, 2, 1, g); c.set(7, 6, g); }),
  magic_mirror: (c) => {
    c.rect(0, 0, 16, 16, WOOD[0]);
    c.rect(1, 1, 14, 14, WOOD[2]);
    c.rect(2, 2, 12, 12, GLASS[2]);
    c.rect(3, 3, 10, 10, GLASS[3]);
    c.rect(4, 4, 3, 1, GLASS[4]);
    c.rect(4, 5, 1, 3, GLASS[4]);
    c.rect(9, 9, 3, 3, P.rgb(0xa77fe0), 140);
    c.set(10, 10, P.rgb(0xe8d8ff));
  },
  ...golems,
  magic_marker_pull: marker(P.rgb(0x3fa0d8), false),
  magic_marker_drop: marker(P.rgb(0xe8a020), true),
  ...wands,
  item_field_notebook: icon(notebook),
  item_scribing_tools: icon(scribing),
  item_sanity_soap: icon((c) => {
    c.rect(3, 6, 10, 6, P.rgb(0xd8e6ea));
    c.rect(3, 6, 10, 1, P.rgb(0xf4fbfc));
    c.rect(3, 11, 10, 1, P.rgb(0x9db7bf));
    c.rect(5, 8, 6, 2, P.rgb(0xbff2f0));
    c.set(4, 3, P.rgb(0xf4fbfc));
    c.set(7, 2, P.rgb(0xbff2f0));
    c.set(10, 4, P.rgb(0xf4fbfc));
  }),
  item_glass_vial: icon((c) => vial(c, null)),
  item_vis_rod: icon(rod),
  ...vials,
  magic_jar_side: jarSide,
  magic_jar_top: jarTop,
  item_bronze_rod: icon((c) => rodOf(c, BRONZE_R, P.rgb(0xe0a060))),
  item_iron_rod: icon((c) => rodOf(c, IRON_R, P.rgb(0x9fd6ff))),
  item_focus_kindle: icon((c) => focus(c, P.rgb(0xe8622a), P.rgb(0xffd95a))),
  item_focus_light: icon((c) => focus(c, P.rgb(0xffd95a), P.rgb(0xfffbe0))),
  item_focus_ward: icon((c) => focus(c, P.rgb(0x6f8fa8), P.rgb(0xcfe6ee))),
  item_focus_blink: icon((c) => focus(c, P.rgb(0xa77fe0), P.rgb(0xe8d8ff))),
  item_vein_lens: icon(lens),
  magic_void_jar_side: (c) => {
    jarSide(c);
    c.rect(4, 5, 8, 8, P.rgb(0x3a2a55), 200);
    c.rect(6, 7, 4, 4, P.rgb(0x5a3a6e), 230);
    c.set(7, 8, P.rgb(0xb8c4ff));
  },
  magic_void_jar_top: (c) => {
    jarTop(c);
    c.rect(6, 6, 4, 4, P.rgb(0x3a2a55));
    c.set(7, 7, P.rgb(0xa77fe0));
  },
  magic_tube: tube,
  magic_desk_top: deskTop,
  magic_crucible_side: (c) => {
    c.rect(0, 0, 16, 16, P.rgb(0x3a3438));
    c.rect(0, 0, 16, 2, P.rgb(0x5a5258));
    c.rect(0, 14, 16, 2, P.rgb(0x241f22));
    c.rect(3, 5, 10, 6, P.rgb(0x4a4045));
    c.rect(5, 6, 6, 1, P.rgb(0x8a63c8));
  },
  magic_crucible_top: (c) => {
    c.rect(0, 0, 16, 16, P.rgb(0x5a5258));
    c.rect(2, 2, 12, 12, P.rgb(0x241f22));
    c.rect(3, 3, 10, 10, P.rgb(0x3f8fd8));
    c.rect(5, 5, 4, 3, P.rgb(0x86b8e8));
    c.set(10, 9, P.rgb(0xbff2f0));
  },
  magic_desk_side: deskSide,
  magic_altar_top: (c) => altarTop(c, false),
  magic_altar_top_on: (c) => altarTop(c, true),
  magic_altar_side: altarSide,
  magic_pedestal_top: pedestalTop,
  magic_pedestal_side: pedestalSide,
  magic_servant_side: (c) => clay(c, 41),
  magic_servant_top: (c) => {
    clay(c, 43);
    c.rect(5, 5, 6, 6, CLAY[3]);
  },
  magic_servant_front: (c) => servantFace(c, false),
  magic_servant_front_on: (c) => servantFace(c, true),
  magic_light: lightMote,
};

// ---- the second slice: rods, foci, lens, tubes, desk, altar, pedestal, servant, light ------------------------------

const BRONZE_R = [P.rgb(0x5a3a14), P.rgb(0x8a5c22), P.rgb(0xb07a34), P.rgb(0xd09a4c)];
const IRON_R = [P.rgb(0x3c4046), P.rgb(0x5e646c), P.rgb(0x8a929c), P.rgb(0xc4ccd4)];
const STONE = [P.rgb(0x4a4844), P.rgb(0x63605a), P.rgb(0x7d7a73), P.rgb(0x98958c), P.rgb(0xb5b2a8)];
const CLAY = [P.rgb(0x7a4a32), P.rgb(0x9a6040), P.rgb(0xb87850), P.rgb(0xd49668)];
const RUNE = P.rgb(0xa77fe0);

const noise = (x: number, y: number, s: number): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function rodOf(c: Canvas, ramp: readonly P.RGB[], tip: P.RGB): void {
  for (let i = 0; i < 9; i++) {
    c.set(3 + i, 13 - i, ramp[1]);
    c.set(4 + i, 13 - i, ramp[2]);
  }
  c.set(3, 13, ramp[0]);
  c.rect(9, 6, 2, 2, ramp[3]);
  c.rect(11, 1, 4, 4, GLASS[2]);
  c.rect(12, 2, 2, 2, tip);
  c.set(12, 2, GLASS[4]);
  c.set(6, 10, ramp[3]);
}

function focus(c: Canvas, color: P.RGB, glint: P.RGB): void {
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d < 4) return d < 2 ? glint : color;
    if (d < 6) return x + y < 16 ? BRONZE_R[3] : BRONZE_R[1];
    return null;
  });
  c.set(6, 6, P.rgb(0xffffff));
}

function lens(c: Canvas): void {
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 7, y + 0.5 - 7);
    if (d < 3.6) return d < 1.6 ? P.rgb(0xfff2c4) : P.rgb(0xc7a24a);
    if (d < 5) return COPPER[1];
    return null;
  });
  for (let i = 0; i < 4; i++) c.set(10 + i, 10 + i, WOOD[1]);
  c.set(5, 5, P.rgb(0xffffff));
}

function tube(c: Canvas): void {
  c.rect(0, 0, 16, 16, GLASS[2], 70);
  c.rect(5, 0, 6, 16, GLASS[2], 170);
  c.rect(5, 0, 1, 16, GLASS[4], 230);
  c.rect(10, 0, 1, 16, GLASS[0], 230);
  c.rect(0, 5, 16, 6, GLASS[2], 170);
  c.rect(0, 5, 16, 1, GLASS[4], 230);
  c.rect(0, 10, 16, 1, GLASS[0], 230);
  c.rect(6, 6, 4, 4, COPPER[1]);
  c.set(6, 6, COPPER[2]);
}

function deskTop(c: Canvas): void {
  c.each((x, y) => (noise(x >> 1, y, 51) < 0.25 ? WOOD[0] : y % 5 === 4 ? WOOD[0] : WOOD[1]));
  c.rect(2, 3, 8, 10, PAGE[1]);
  c.rect(2, 3, 8, 1, PAGE[2]);
  for (const y of [5, 7, 9, 11]) c.rect(3, y, 6, 1, PAGE[0]);
  c.rect(11, 4, 3, 3, GLASS[2]);
  c.set(12, 5, RUNE);
  c.rect(11, 9, 1, 5, WOOD[2]);
}

function deskSide(c: Canvas): void {
  c.each((x, y) => (y < 3 ? WOOD[2] : x < 2 || x > 13 ? WOOD[0] : noise(x, y, 53) < 0.2 ? WOOD[0] : noise(x, y, 54) < 0.3 ? COPPER[0] : WOOD[1]));
  c.rect(4, 6, 8, 1, RUNE);
  c.set(7, 8, RUNE);
  c.set(8, 9, RUNE);
  c.rect(0, 2, 16, 1, WOOD[0]);
}

function altarTop(c: Canvas, on: boolean): void {
  c.each((x, y) => STONE[noise(x >> 1, y >> 1, 61) < 0.3 ? 1 : noise(x, y, 62) < 0.5 ? 2 : 3]);
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d > 5 && d < 6.2) return on ? P.rgb(0xffd95a) : RUNE;
    if (d < 2) return on ? P.rgb(0xfffbe0) : STONE[4];
    return null;
  });
}

function altarSide(c: Canvas): void {
  c.each((x, y) => STONE[y < 2 ? 4 : y > 13 ? 0 : noise(x >> 1, y >> 1, 63) < 0.35 ? 1 : 2]);
  for (const x of [3, 8, 12]) c.rect(x, 5, 1, 6, RUNE);
}

function pedestalTop(c: Canvas): void {
  c.each((x, y) => STONE[noise(x >> 1, y >> 1, 71) < 0.3 ? 2 : 3]);
  c.rect(4, 4, 8, 8, STONE[1]);
  c.rect(5, 5, 6, 6, STONE[4]);
  c.set(8, 8, RUNE);
}

function pedestalSide(c: Canvas): void {
  c.each((x, y) => (x >= 4 && x <= 11 ? STONE[noise(x, y, 73) < 0.4 ? 1 : 2] : y < 3 || y > 12 ? STONE[3] : STONE[0]));
  c.rect(4, 7, 8, 1, RUNE);
}

function clay(c: Canvas, seed: number, pal: readonly P.RGB[] = CLAY): void {
  c.each((x, y) => pal[noise(x >> 1, y >> 1, seed) < 0.2 ? 0 : noise(x, y, seed + 1) < 0.45 ? 1 : noise(x, y, seed + 2) < 0.8 ? 2 : 3]);
  c.set(3, 12, P.rgb(0x5a3422));
  c.set(11, 4, P.rgb(0xe8b088));
}

function servantFace(c: Canvas, on: boolean, pal: readonly P.RGB[] = CLAY): void {
  clay(c, 47, pal);
  const eye = on ? P.rgb(0xffd95a) : P.rgb(0x3a2212);
  c.rect(4, 5, 2, 2, eye);
  c.rect(10, 5, 2, 2, eye);
  c.rect(6, 10, 4, 1, pal[0]);
  c.rect(3, 2, 10, 1, pal[3]);
}

function lightMote(c: Canvas): void {
  c.each((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    if (d < 1.2) return P.rgb(0xffffff);
    if (d < 2.4) return P.rgb(0xfffbe0);
    if (d < 3.6) return P.rgb(0xfff2a0);
    if (d < 4.6) return P.rgb(0xffd95a);
    if (d < 5.5) return P.rgb(0xe0a040);
    return null;
  });
}
