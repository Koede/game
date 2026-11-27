/** Tiles and icons of glass and optics (src/content/areas/optics.ts): the lens, the spyglass, the telescope's brass, the lighthouse lamp. */
import type { Canvas, PainterSet } from '../canvas';
import { rgb, shade } from '../palette';
import { icon } from '../shapes';

const GLASS = [rgb(0x4f7c8c), rgb(0x7fb0c0), rgb(0xa9d6e2), rgb(0xd4eff5), rgb(0xf6feff)];
const BRASS = [rgb(0x5a4318), rgb(0x86672a), rgb(0xb08c3c), rgb(0xd2ae58), rgb(0xf0d488)];
const LEATHER = [rgb(0x3e2416), rgb(0x5a3520), rgb(0x744829)];
const FLAME = [rgb(0xa8561a), rgb(0xe08a2a), rgb(0xf6c050), rgb(0xffe8a0), rgb(0xffffff)];
const SOOT = [rgb(0x262220), rgb(0x34302c), rgb(0x45403a)];

/** A round lens seen face on, with the light caught on its upper left. */
function lens(c: Canvas): void {
  c.disc(8, 8, 6, GLASS[1]);
  c.disc(8, 8, 5, GLASS[2]);
  c.disc(7, 7, 3, GLASS[3]);
  c.set(5, 5, GLASS[4]); c.set(6, 5, GLASS[4]); c.set(5, 6, GLASS[4]);
  c.ring(8, 8, 6, GLASS[0]);
}

/** A spyglass lying corner to corner: leather grip, brass draw tubes, a lens glinting at the wide end. */
function spyglass(c: Canvas): void {
  for (let i = 0; i < 12; i++) {
    const x = 2 + i;
    const y = 13 - i;
    const r = i < 4 ? 1 : i < 8 ? 1 : 2;
    const ramp = i < 4 ? LEATHER : BRASS;
    for (let k = -r; k <= r; k++) {
      c.set(x + (k > 0 ? 1 : 0), y + k, ramp[Math.min(ramp.length - 1, 1 + (k < 0 ? 1 : 0))]);
    }
    if (i === 4 || i === 8) c.set(x, y, BRASS[4]);
  }
  c.set(13, 1, GLASS[4]); c.set(14, 2, GLASS[3]); c.set(14, 1, GLASS[2]);
  c.set(1, 14, BRASS[1]);
}

/** Polished brass with rivet rows: the telescope's barrel and head. */
function brassTile(c: Canvas, rivets: boolean): void {
  c.each((x, y) => shade(BRASS[2], (c.hash(x, y, 31) - 0.5) * 0.14 + (y < 2 ? 0.16 : y > 13 ? -0.14 : 0)));
  for (let x = 0; x < 16; x++) c.set(x, 5, BRASS[1]), c.set(x, 10, BRASS[1]);
  if (rivets) for (const x of [2, 7, 12]) c.set(x, 7, BRASS[4]), c.set(x + 1, 8, BRASS[0]);
}

/** The lamp's plinth and cap: blackened iron with a brass rim. */
function lampTop(c: Canvas): void {
  c.each((x, y) => shade(SOOT[1], (c.hash(x, y, 41) - 0.5) * 0.2));
  c.frame(0, 0, 16, 16, BRASS[2]);
  c.frame(1, 1, 14, 14, BRASS[1]);
  c.disc(8, 8, 2, SOOT[2]);
}

/** The lantern core: panes in a brass frame, a wick in the middle; lit, the panes blaze. */
function lampSide(c: Canvas, lit: boolean): void {
  const pane = lit ? FLAME : GLASS;
  c.each((x, y) => {
    const frame = x === 0 || x === 15 || x === 7 || x === 8 || y === 0 || y === 15 || y === 7;
    if (frame) return BRASS[x === 0 || y === 0 ? 3 : 1];
    const glow = lit ? 1 - Math.hypot(x - 7.5, y - 9) / 9 : 0;
    const base = lit ? pane[Math.max(1, Math.min(4, Math.round(1 + glow * 3.4)))] : pane[1 + ((x + y) % 3 === 0 ? 1 : 0)];
    return shade(base, (c.hash(x, y, lit ? 52 : 51) - 0.5) * 0.08);
  });
  if (!lit) {
    c.set(2, 2, GLASS[4]); c.set(10, 2, GLASS[4]); c.set(2, 9, GLASS[3]); c.set(10, 9, GLASS[3]);
  } else {
    for (const [x, y] of [[7, 10], [8, 10], [7, 11], [8, 11]] as const) c.set(x, y, FLAME[4]);
  }
}

export default {
  item_lens: icon(lens),
  item_spyglass: icon(spyglass),
  telescope_top: (c: Canvas) => brassTile(c, false),
  telescope_side: (c: Canvas) => brassTile(c, true),
  lighthouse_lamp_top: lampTop,
  lighthouse_lamp_side: (c: Canvas) => lampSide(c, false),
  lighthouse_lamp_side_on: (c: Canvas) => lampSide(c, true),
} satisfies PainterSet;
