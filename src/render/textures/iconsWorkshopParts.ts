/** Fronts of the modular workshop parts (src/content/itemsWorkshopParts.ts): boards, a bronze frame and one glyph each. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const WOOD = [P.rgb(0x4e3418), P.rgb(0x6a4824), P.rgb(0x86602f), P.rgb(0xa07a40), P.rgb(0xb8925a)];
const BRONZE = [P.rgb(0x5a3a14), P.rgb(0x8a5c22), P.rgb(0xb07a34), P.rgb(0xd09a4c), P.rgb(0xeec27a)];
const IRON = [P.rgb(0x3c4046), P.rgb(0x5e646c), P.rgb(0x8a929c), P.rgb(0xc4ccd4)];
const GLOW = P.rgb(0xffc864);

const hash = (x: number, y: number, s: number): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function base(c: Canvas, seed: number, tint: P.RGB): void {
  c.each((x, y) => {
    const n = hash(x >> 1, y, seed + Math.floor(y / 4));
    return y % 4 === 3 ? WOOD[0] : n < 0.2 ? WOOD[1] : n < 0.75 ? WOOD[2] : WOOD[3];
  });
  c.rect(0, 0, 16, 1, BRONZE[3]);
  c.rect(0, 0, 1, 16, BRONZE[3]);
  c.rect(0, 15, 16, 1, BRONZE[0]);
  c.rect(15, 0, 1, 16, BRONZE[0]);
  // The identity stripe along the top, one tint per part.
  c.rect(1, 1, 14, 2, tint);
}

function cogAt(c: Canvas, cx: number, cy: number, r: number, turn: number, teeth = 8): void {
  c.each((x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + turn;
    const tooth = Math.cos(a * teeth) > 0.2 ? 1.4 : 0;
    if (d < 1.2) return IRON[0];
    if (d < r - 0.8) return d < r - 2 ? BRONZE[1] : BRONZE[2];
    if (d < r + tooth) return dx + dy < 0 ? BRONZE[4] : BRONZE[3];
    return null;
  });
}

const arrow = (c: Canvas, x: number, y: number, dir: 1 | -1, col: P.RGB): void => {
  c.rect(x, y, 6, 1, col);
  for (let i = 0; i < 3; i++) c.rect(dir === 1 ? x + 6 - i : x + i, y - 2 + i, 1, 5 - 2 * i, col);
};

type Glyph = (c: Canvas, on: boolean) => void;

const GLYPHS: Record<string, { tint: number; draw: Glyph }> = {
  reverse_box: { tint: 0x6aa0d8, draw: (c, on) => { cogAt(c, 5, 10, 3.6, on ? 0.3 : 0); cogAt(c, 11, 10, 3.6, on ? -0.3 : 0.2); arrow(c, 5, 5, -1, IRON[3]); } },
  ratio_dial: { tint: 0xd8a040, draw: (c, on) => {
    c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9.5); return d < 5.2 ? (d < 4.2 ? P.rgb(0xe8e0c0) : IRON[1]) : null; });
    const a = on ? 0.9 : -0.6;
    for (let i = 0; i < 4; i++) c.set(Math.round(8 + Math.cos(a + i * 0) * (1 + i)), Math.round(9.5 + Math.sin(a) * (1 + i)), IRON[0]);
    c.rect(4, 14, 8, 1, BRONZE[2]);
  } },
  clutch: { tint: 0xc05050, draw: (c, on) => { c.rect(2, 7, 4, 4, IRON[2]); c.rect(10, 7, 4, 4, IRON[2]); c.rect(on ? 6 : 5, 8, on ? 4 : 2, 2, BRONZE[3]); c.rect(on ? 6 : 9, 8, on ? 4 : 2, 2, BRONZE[3]); c.rect(7, 12, 2, 2, on ? GLOW : IRON[0]); } },
  split_box: { tint: 0x70c070, draw: (c, on) => { cogAt(c, 8, 10, 4, on ? 0.25 : 0); c.rect(7, 4, 2, 2, IRON[2]); c.rect(2, 9, 2, 2, IRON[2]); c.rect(12, 9, 2, 2, IRON[2]); } },
  sequence_gearshift: { tint: 0xb070d0, draw: (c, on) => {
    c.rect(2, 5, 12, 9, IRON[1]);
    for (let i = 0; i < 6; i++) if (hash(i, 3, 41) > 0.45) c.rect(3 + i * 2, 6, 1, 7, BRONZE[3]);
    c.rect(on ? 9 : 4, 4, 2, 1, GLOW);
  } },
  governor: { tint: 0xd0d060, draw: (c, on) => { c.rect(7, 4, 2, 10, IRON[2]); const o = on ? 4 : 2; for (const sx of [-1, 1]) { c.rect(8 + sx * o - 1, 7, 2, 2, BRONZE[4]); c.rect(8 + Math.min(0, sx * o), 8, Math.abs(sx * o), 1, IRON[2]); } c.rect(5, 13, 6, 1, BRONZE[2]); } },
  worm_gear: { tint: 0x60b0a0, draw: (c, on) => { cogAt(c, 8, 10, 4.5, on ? 0.2 : 0, 12); for (let i = 0; i < 7; i++) c.rect(2 + i * 2, 4 + ((i + (on ? 1 : 0)) % 2), 1, 2, IRON[3]); c.rect(2, 6, 13, 1, IRON[1]); } },
  chain_sprocket: { tint: 0x9090a0, draw: (c, on) => { cogAt(c, 8, 10, 4.6, on ? 0.2 : 0, 10); for (let i = 0; i < 4; i++) c.rect(1 + i * 4 + (on ? 1 : 0), 4, 2, 1, IRON[3]); } },
  belt_pulley: { tint: 0x8a5a30, draw: (c, on) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 10); return d < 4.6 ? (d < 1.5 ? IRON[0] : d < 3.4 ? WOOD[4] : P.rgb(0x7a4a24)) : null; }); c.rect(0, 5 + (on ? 1 : 0), 16, 1, P.rgb(0x5a3519)); c.rect(0, 15, 16, 1, BRONZE[0]); } },
  clockwork_motor: { tint: 0xe0e0e0, draw: (c, on) => { c.rect(3, 5, 10, 9, IRON[1]); cogAt(c, 8, 9.5, 3, on ? 0.4 : 0, 6); c.rect(6, 3, 4, 2, BRONZE[3]); c.rect(12, 7 + (on ? 2 : 0), 3, 1, BRONZE[4]); } },
};

export const registerGlyph = (key: string, tint: number, draw: Glyph): void => { GLYPHS[key] = { tint, draw }; };

const set: Record<string, PainterSet[string]> = {};
for (const [key, g] of Object.entries(GLYPHS)) {
  const seed = [...key].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  set[`ws_${key}_front`] = (c) => { base(c, seed, P.rgb(g.tint)); g.draw(c, false); };
  set[`ws_${key}_front_on`] = (c) => { base(c, seed, P.rgb(g.tint)); g.draw(c, true); };
}

function cogIcon(c: Canvas): void { cogAt(c, 8, 8, 6, 0, 10); }
set.item_bronze_cog = icon(cogIcon);

export const WORKSHOP_PART_TEXTURES: PainterSet = set;
