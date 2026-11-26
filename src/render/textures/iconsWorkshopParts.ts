/** Fronts of the modular workshop parts (src/content/itemsWorkshopParts.ts): boards, a bronze frame and one glyph each. */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const WOOD = [P.rgb(0x4e3418), P.rgb(0x6a4824), P.rgb(0x86602f), P.rgb(0xa07a40), P.rgb(0xb8925a)];
const BRONZE = [P.rgb(0x5a3a14), P.rgb(0x8a5c22), P.rgb(0xb07a34), P.rgb(0xd09a4c), P.rgb(0xeec27a)];
const IRON = [P.rgb(0x3c4046), P.rgb(0x5e646c), P.rgb(0x8a929c), P.rgb(0xc4ccd4)];
const STONE_ = [P.rgb(0x55534e), P.rgb(0x6e6b65), P.rgb(0x87847d), P.rgb(0xa19e96)];
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
  funnel: { tint: 0x60b0d0, draw: (c) => { for (let i = 0; i < 6; i++) c.rect(2 + i, 5 + i, 12 - 2 * i, 1, i < 5 ? IRON[2] : IRON[0]); c.rect(7, 11, 2, 3, IRON[3]); } },
  chute: { tint: 0x70a8d8, draw: (c) => { c.rect(5, 4, 6, 10, IRON[1]); c.rect(7, 4, 2, 10, IRON[0]); c.rect(5, 4, 1, 10, IRON[3]); c.rect(7, 12, 2, 2, GLOW); } },
  depot: { tint: 0xc0a060, draw: (c) => { c.rect(2, 10, 12, 3, STONE_[2]); c.rect(2, 10, 12, 1, STONE_[3]); c.rect(5, 7, 6, 3, WOOD[4]); } },
  basin: { tint: 0x5090c0, draw: (c) => { c.rect(2, 6, 12, 8, STONE_[1]); c.rect(3, 6, 10, 5, P.rgb(0x3a86b4)); c.rect(3, 6, 10, 1, P.rgb(0x8cc8ee)); c.rect(2, 6, 1, 8, STONE_[3]); } },
  spout: { tint: 0x40a0a0, draw: (c) => { c.rect(5, 4, 6, 3, IRON[2]); c.rect(7, 7, 2, 4, IRON[1]); for (const y of [12, 14]) c.rect(7, y, 2, 1, P.rgb(0x6cb4e0)); } },
  item_drain: { tint: 0x8080c0, draw: (c) => { c.rect(3, 4, 10, 4, IRON[1]); c.rect(4, 8, 8, 1, IRON[0]); c.rect(6, 9, 4, 5, IRON[2]); c.rect(7, 13, 2, 1, P.rgb(0x6cb4e0)); } },
  mixer: { tint: 0xe08060, draw: (c, on) => { c.rect(2, 11, 12, 3, IRON[1]); c.rect(7, 3, 2, 8, IRON[2]); const o = on ? 4 : 2; c.rect(8 - o, 9, o * 2, 1, BRONZE[4]); c.rect(8 - o, 7, 1, 3, BRONZE[3]); c.rect(7 + o, 7, 1, 3, BRONZE[3]); } },
  mech_press: { tint: 0xa0a0a8, draw: (c, on) => { c.rect(3, 3, 10, 2, IRON[1]); c.rect(6, 5, 4, on ? 7 : 4, IRON[2]); c.rect(3, on ? 12 : 9, 10, 2, IRON[3]); c.rect(2, 14, 12, 1, STONE_[2]); } },
  deployer: { tint: 0x50c080, draw: (c, on) => { c.rect(3, 6, 6, 4, IRON[2]); c.rect(on ? 9 : 8, 7, 4, 2, BRONZE[3]); c.rect(on ? 12 : 11, 5, 2, 6, BRONZE[4]); c.rect(3, 11, 10, 2, WOOD[1]); } },
  mech_arm: { tint: 0xd0c040, draw: (c, on) => { c.rect(6, 11, 4, 3, IRON[1]); const x = on ? 10 : 3; c.rect(Math.min(8, x), 7, Math.abs(x - 8) + 1, 1, BRONZE[3]); c.rect(7, 7, 2, 5, IRON[2]); c.rect(x - 1, 5, 3, 3, BRONZE[4]); } },
  mech_drill: { tint: 0xb0b0b8, draw: (c, on) => { for (let i = 0; i < 5; i++) c.rect(3 + i * 2 + (on && i % 2 ? 1 : 0), 4 + i, 8 - i * 2 > 0 ? 8 - i * 2 : 1, 1, i % 2 ? IRON[3] : IRON[1]); c.rect(7, 10, 2, 4, IRON[0]); } },
  rack: { tint: 0x80a860, draw: (c, on) => { for (let x = 3; x < 14; x += 3) c.rect(x, 4, 1, 9, WOOD[4]); c.rect(2, 4, 12, 1, WOOD[3]); c.rect(2, 12, 12, 1, WOOD[3]); for (let i = 0; i < 3; i++) c.rect(4 + i * 3, 6 + (on ? i % 2 : 0), 2, 4, P.rgb(0xc7b88a)); c.rect(6, 14, 4, 1, on ? GLOW : IRON[0]); } },
  shear_pin: { tint: 0xd0d0d8, draw: (c) => { c.rect(2, 7, 12, 2, IRON[2]); c.rect(7, 4, 2, 8, BRONZE[3]); c.rect(7, 4, 2, 1, GLOW); } },
  flywheel: { tint: 0x707880, draw: (c, on) => { cogAt(c, 8, 9, 5.5, on ? 0.15 : 0, 14); c.each((x, y) => (Math.hypot(x + 0.5 - 8, y + 0.5 - 9) < 3 ? IRON[1] : null)); c.rect(7, 8, 2, 2, IRON[0]); } },
  differential: { tint: 0xc07090, draw: (c, on) => { cogAt(c, 5, 10, 3.2, on ? 0.3 : 0, 6); cogAt(c, 11, 10, 3.2, on ? -0.3 : 0, 6); cogAt(c, 8, 6, 2.6, on ? 0.2 : 0, 6); } },
  treadwheel: { tint: 0xa0804a, draw: (c, on) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); return d < 6 && d > 4.3 ? WOOD[4] : null; }); for (let i = 0; i < 6; i++) { const a = i * 1.047 + (on ? 0.4 : 0); c.rect(Math.round(8 + Math.cos(a) * 3), Math.round(9 + Math.sin(a) * 3), 1, 1, WOOD[3]); } c.rect(7, 8, 2, 2, IRON[1]); } },
  steam_rotor: { tint: 0xdfe6e8, draw: (c, on) => { c.rect(7, 8, 2, 6, IRON[1]); c.rect(6, 7, 4, 2, BRONZE[3]); const a = on ? 1 : 0; c.rect(3 + a, 6 - a, 4, 1, BRONZE[4]); c.rect(9 - a, 8 + a, 4, 1, BRONZE[4]); c.rect(3 + a, 5 - a, 1, 2, IRON[3]); c.rect(12 - a, 9 + a, 1, 2, IRON[3]); if (on) { c.set(2, 4, P.rgb(0xdfe6e8)); c.set(13, 11, P.rgb(0xb4c0c6)); } } },
  saw_arm: { tint: 0xc05040, draw: (c, on) => { cogAt(c, 8, 9, 5, on ? 0.25 : 0, 12); c.rect(2, 4, 12, 1, IRON[3]); c.rect(7, 8, 2, 2, IRON[0]); } },
  item_vault: { tint: 0xe0c050, draw: (c) => { c.rect(2, 4, 12, 10, IRON[1]); c.rect(2, 4, 12, 1, IRON[3]); for (const y of [7, 10]) c.rect(3, y, 10, 1, IRON[0]); c.rect(6, 12, 4, 1, BRONZE[4]); } },
  vacuum_collector: { tint: 0x80d0e0, draw: (c, on) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); if (d > 6) return null; const a = Math.atan2(y - 9, x - 8) + (on ? 0.6 : 0); return d < 1.5 ? IRON[0] : Math.sin(a * 3 + d * 0.8) > 0 ? IRON[2] : IRON[1]; }); } },
  signal_wire: { tint: 0xe08030, draw: (c, on) => { c.rect(0, 7, 16, 2, on ? GLOW : IRON[1]); c.rect(7, 0, 2, 16, on ? GLOW : IRON[1]); c.rect(6, 6, 4, 4, on ? BRONZE[4] : IRON[0]); } },
  crank_lever: { tint: 0xe0c040, draw: (c, on) => { c.rect(3, 12, 10, 2, IRON[1]); const x = on ? 11 : 4; c.rect(Math.min(7, x), 6, Math.abs(x - 7) + 1, 1, IRON[2]); c.rect(7, 6, 2, 6, IRON[2]); c.rect(x - 1, 4, 3, 3, on ? GLOW : BRONZE[3]); } },
  pressure_plate: { tint: 0x909090, draw: (c, on) => { c.rect(1, 1, 14, 14, on ? IRON[1] : IRON[2]); c.rect(3, 3, 10, 10, on ? IRON[0] : IRON[3]); c.rect(5, 5, 6, 6, on ? GLOW : BRONZE[2]); } },
  metronome: { tint: 0xe0a0e0, draw: (c, on) => { c.rect(5, 12, 6, 2, WOOD[1]); for (let i = 0; i < 8; i++) c.rect(6 + (i >> 1), 12 - i, 4 - (i >> 1) * 1, 1, WOOD[3]); const x = on ? 11 : 4; c.rect(8, 4, 1, 8, IRON[3]); c.rect(x, 3, 2, 2, BRONZE[4]); } },
  signal_relay: { tint: 0x60c080, draw: (c, on) => { c.rect(2, 4, 12, 9, IRON[1]); c.rect(2, 4, 12, 1, IRON[3]); c.rect(7, 12, 2, 3, on ? P.rgb(0x80e0a0) : IRON[0]); c.rect(7, 1, 2, 3, on ? P.rgb(0x80e0a0) : IRON[0]); c.rect(4, 7, 8, 3, on ? P.rgb(0x80e0a0) : IRON[0]); c.rect(5, 8, 2, 1, BRONZE[3]); } },
  signal_timer: { tint: 0xe0c060, draw: (c, on) => { c.rect(2, 3, 12, 11, IRON[1]); c.rect(2, 3, 12, 1, IRON[3]); c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5); return d < 4.5 ? (d > 3.5 ? BRONZE[3] : on ? P.rgb(0xf8f0b0) : P.rgb(0xf4ecd0)) : null; }); c.rect(8, 5, 1, 4, IRON[0]); c.rect(8, 8, 2, 1, IRON[0]); c.rect(1, 13, 14, 2, WOOD[3]); } },
  push_button: { tint: 0xd04040, draw: (c, on) => { c.rect(2, 10, 12, 5, IRON[1]); c.rect(2, 10, 12, 1, IRON[3]); c.rect(4, on ? 8 : 5, 8, on ? 3 : 6, on ? P.rgb(0xf06060) : P.rgb(0xb03030)); c.rect(4, on ? 8 : 5, 8, 1, P.rgb(0xf08080)); } },
  signal_lamp: { tint: 0xf0f0a0, draw: (c, on) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); return d < 5 ? (on ? (d < 3 ? P.rgb(0xfff4b0) : GLOW) : P.rgb(0x6a5a30)) : null; }); c.rect(5, 14, 6, 1, IRON[1]); } },
  bell: { tint: 0xd0a040, draw: (c) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); return y > 4 && y < 12 && d < 5.5 - (11 - y) * 0.15 ? (x < 8 ? BRONZE[3] : BRONZE[2]) : null; }); c.rect(2, 12, 12, 1, BRONZE[1]); c.rect(7, 12, 2, 2, IRON[0]); c.rect(7, 2, 2, 2, IRON[1]); } },
  tally_board: { tint: 0x70b090, draw: (c) => { c.rect(2, 4, 12, 9, WOOD[0]); c.rect(3, 5, 10, 7, WOOD[4]); for (let i = 0; i < 4; i++) c.rect(4 + i * 2, 6, 1, 4, IRON[0]); c.rect(3, 8, 8, 1, IRON[0]); c.rect(9, 11, 4, 1, BRONZE[2]); } },
  clockface: { tint: 0xf0e0b0, draw: (c) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); return d < 5.5 ? (d > 4.5 ? BRONZE[3] : P.rgb(0xf4ecd0)) : null; }); c.rect(8, 5, 1, 5, IRON[0]); c.rect(8, 9, 3, 1, IRON[0]); } },
  wind_vane: { tint: 0x88c8e8, draw: (c) => { c.rect(7, 6, 2, 8, IRON[2]); c.rect(5, 13, 6, 2, BRONZE[2]); arrow(c, 8, 4, 1, BRONZE[4]); c.rect(3, 5, 5, 1, BRONZE[3]); } },
  contraption_frame: { tint: 0xc8a060, draw: (c) => { c.rect(1, 3, 14, 12, WOOD[0]); c.rect(3, 5, 10, 8, WOOD[3]); c.rect(3, 5, 10, 1, WOOD[4]); c.rect(3, 5, 10, 8, WOOD[3]); c.rect(4, 6, 8, 6, WOOD[1]); c.rect(1, 3, 3, 3, BRONZE[3]); c.rect(12, 3, 3, 3, BRONZE[3]); } },
  brake: { tint: 0xa05040, draw: (c, on) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); return d < 5 ? IRON[on ? 3 : 1] : null; }); c.rect(2, 3, 12, 2, on ? BRONZE[3] : BRONZE[1]); c.rect(2, 13, 12, 2, on ? BRONZE[3] : BRONZE[1]); } },
  cam_drum: { tint: 0xb08040, draw: (c, on) => { c.rect(2, 4, 12, 9, IRON[1]); c.rect(2, 4, 12, 1, IRON[3]); for (let i = 0; i < 4; i++) { c.rect(3 + i * 3, 6 + ((i + (on ? 1 : 0)) % 3) * 2, 2, 2, BRONZE[3]); c.rect(3 + i * 3, 5, 2, 1, IRON[0]); } c.rect(1, 13, 14, 2, WOOD[3]); } },
  logic_gate: { tint: 0x50a070, draw: (c, on) => { c.rect(2, 3, 12, 10, IRON[1]); c.rect(2, 3, 12, 1, IRON[3]); c.rect(3, 6, 4, 3, on ? P.rgb(0x80e0a0) : IRON[0]); c.rect(9, 6, 4, 3, on ? P.rgb(0x80e0a0) : IRON[0]); c.rect(7, 10, 2, 3, BRONZE[3]); c.rect(7, 4, 2, 2, BRONZE[2]); } },
  pillow_block: { tint: 0x8090a0, draw: (c) => { c.rect(2, 9, 12, 5, IRON[1]); c.rect(2, 9, 12, 1, IRON[3]); c.each((x, y) => (Math.hypot(x + 0.5 - 8, y + 0.5 - 8) < 4 ? IRON[0] : null)); c.rect(6, 7, 4, 2, BRONZE[3]); c.set(3, 11, IRON[0]); c.set(12, 11, IRON[0]); } },
  piston: { tint: 0x6080d0, draw: (c, on) => { c.rect(3, 8, 10, 6, IRON[1]); c.rect(3, 8, 10, 1, IRON[3]); c.rect(7, on ? 2 : 5, 2, on ? 7 : 4, IRON[2]); c.rect(4, on ? 1 : 4, 8, 2, BRONZE[3]); } },
  bearing: { tint: 0x40b0b0, draw: (c, on) => { c.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9); return d < 5.5 && d > 3 ? (Math.floor((Math.atan2(y - 9, x - 8) + (on ? 0.5 : 0)) * 2) % 2 === 0 ? IRON[3] : IRON[2]) : d <= 3 ? IRON[0] : null; }); } },
  rolling_mill: { tint: 0x9aa4b0, draw: (c, on) => {
    c.rect(2, 4, 12, 2, IRON[1]); c.rect(2, 4, 12, 1, IRON[3]);
    c.rect(2, 8, 12, 2, IRON[1]); c.rect(2, 8, 12, 1, IRON[3]);
    c.rect(1, 3, 1, 8, IRON[0]); c.rect(14, 3, 1, 8, IRON[0]);
    c.rect(2, 6, 12, 2, on ? GLOW : IRON[0]);
    for (let i = 0; i < 4; i++) c.rect(3 + i * 3 + (on ? 1 : 0), 4, 1, 1, IRON[0]);
    c.rect(2, 12, 12, 2, STONE_[2]);
  } },
  drop_forge: { tint: 0x8a6a50, draw: (c, on) => {
    c.rect(3, 2, 2, 11, IRON[1]); c.rect(11, 2, 2, 11, IRON[1]);
    c.rect(3, 2, 10, 2, IRON[2]);
    c.rect(6, on ? 7 : 4, 4, 3, IRON[3]); c.rect(7, 4, 2, on ? 3 : 0, IRON[0]);
    c.rect(2, 13, 12, 2, STONE_[1]); c.rect(5, 12, 6, 1, on ? GLOW : IRON[0]);
  } },
  rail: { tint: 0x907050, draw: (c) => { c.rect(0, 0, 16, 16, WOOD[1]); c.rect(2, 0, 2, 16, IRON[2]); c.rect(12, 0, 2, 16, IRON[2]); for (let y = 1; y < 16; y += 4) { c.rect(1, y, 14, 2, WOOD[3]); c.rect(1, y, 14, 1, WOOD[4]); c.set(2, y, IRON[0]); c.set(13, y, IRON[0]); } c.rect(2, 0, 1, 16, IRON[3]); } },
  skiff: { tint: 0xb06030, draw: (c) => { c.rect(2, 5, 12, 8, IRON[1]); c.rect(2, 5, 12, 1, IRON[3]); c.rect(3, 6, 10, 5, WOOD[0]); for (const x of [4, 11]) c.rect(x, 13, 2, 2, BRONZE[2]); } },
  hammer: { tint: 0x8a6a40, draw: (c, on) => { c.rect(2, 12, 12, 3, IRON[1]); c.rect(2, 12, 12, 1, IRON[3]); c.rect(7, on ? 6 : 2, 2, 5, WOOD[3]); c.rect(4, on ? 4 : 1, 8, 3, IRON[2]); c.rect(4, on ? 4 : 1, 8, 1, IRON[3]); } },
};

export const registerGlyph = (key: string, tint: number, draw: Glyph): void => { GLYPHS[key] = { tint, draw }; };

const STATIC = new Set(['contraption_frame', 'rail', 'skiff', 'bell', 'tally_board', 'clockface', 'wind_vane', 'funnel', 'chute', 'depot', 'basin', 'spout', 'item_drain', 'shear_pin', 'item_vault', 'pillow_block']);
const set: Record<string, PainterSet[string]> = {};
for (const [key, g] of Object.entries(GLYPHS)) {
  const seed = [...key].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  set[`ws_${key}_front`] = (c) => { base(c, seed, P.rgb(g.tint)); g.draw(c, false); };
  if (!STATIC.has(key)) set[`ws_${key}_front_on`] = (c) => { base(c, seed, P.rgb(g.tint)); g.draw(c, true); };
}

function cogIcon(c: Canvas): void { cogAt(c, 8, 8, 6, 0, 10); }
set.item_bronze_cog = icon(cogIcon);

function punchedCard(c: Canvas): void {
  c.rect(2, 3, 12, 10, P.rgb(0xf0e2c0));
  c.rect(2, 3, 12, 1, P.rgb(0xfff6e0));
  c.rect(2, 12, 12, 1, P.rgb(0xc8b48a));
  for (let row = 0; row < 4; row++) {
    c.rect(4, 5 + row * 2, 1, 1, IRON[0]);
    c.rect(7, 5 + row * 2, 1, 1, IRON[0]);
    c.rect(10, 5 + row * 2, 1, 1, IRON[0]);
  }
}
set.item_punched_card = icon(punchedCard);

export const WORKSHOP_PART_TEXTURES: PainterSet = set;
