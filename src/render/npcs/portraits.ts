/**
 * Dialogue portraits of the tavern's people, after Stardew Valley's: a head-and-shoulders bust on a 64 x 64 design grid (drawn at 2x,
 * 128 x 128), soft cel shading, coloured outlines, big glossy eyes, rosy cheeks. They are shown in the dialogue box when you talk to
 * someone (src/ui/hud/npcDialogue.ts). Pure functions over `Canvas`, so they are testable without a canvas element.
 */
import type { NpcRole } from '../../npcs/data';
import { Canvas, hex, lightOf, mix, shadowOf, type Rgb } from './paint';

export const PORTRAIT_GRID = 64;
export const PORTRAIT_RES = 2;
export const PORTRAIT_PX = PORTRAIT_GRID * PORTRAIT_RES;

export interface PortraitImage {
  w: number;
  h: number;
  data: Uint8Array;
}

const brow = (c: Canvas, x0: number, y0: number, x1: number, y1: number, w: number, col: Rgb): void => c.line(x0, y0, x1, y1, w, col);

/** The shared head: skin ellipse, ears, neck. Returns nothing; the face features are drawn per person. */
function head(c: Canvas, skin: Rgb, cx = 32, cy = 28, rx = 13.5, ry = 15): void {
  c.rrect(cx - 4.2, cy + ry - 6, 8.4, 14, 3, mix(skin, [120, 60, 50], 0.12));
  c.ellipse(cx - rx + 0.6, cy + 2, 2.4, 3.4, skin);
  c.ellipse(cx + rx - 0.6, cy + 2, 2.4, 3.4, skin);
  c.ellipse(cx, cy, rx, ry, skin);
}

function mouthSmile(c: Canvas, x: number, y: number, w: number, lip: Rgb): void {
  c.line(x - w, y - 0.3, x - w * 0.4, y + 0.8, 0.9, lip);
  c.line(x - w * 0.4, y + 0.8, x + w * 0.4, y + 0.8, 0.9, lip);
  c.line(x + w * 0.4, y + 0.8, x + w, y - 0.3, 0.9, lip);
}

function mara(c: Canvas): void {
  const skin = hex(0xf6d8bd);
  const hair = hex(0x35255e);
  const purple = hex(0x7b46bd);
  const gold = hex(0xe9bb3d);
  // Long glossy hair behind, hat, then the face.
  c.rrect(12, 14, 40, 52, 15, hair);
  c.poly([[21, 14], [43, 14], [38, -2], [31, -10], [27, -2]], purple);
  c.poly([[27, 14], [37, 14], [35, 6], [29, 6]], shadowOf(purple), { line: null, shade: false });
  c.ellipse(32, 14, 25, 5, hex(0x5a3190));
  c.rrect(23, 9, 18, 4.2, 2, gold, { shade: false });
  c.rrect(30, 8.6, 4, 5, 1, hex(0xe8e8f2), { shade: false });
  head(c, skin);
  // Hair framing the face: a side-swept fringe and two long locks in front of the shoulders.
  c.poly([[18.5, 20], [32, 12.5], [45.5, 20], [45, 24], [38, 19], [30, 18.5], [24, 21], [19, 29]], hair);
  c.rrect(12.5, 24, 6.5, 40, 3.2, hair);
  c.rrect(45, 24, 6.5, 40, 3.2, hair);
  c.gradient(12, 10, 52, 66, 1.08, 0.86);
  // Shoulders: a violet dress with a deep V and a star pendant.
  c.ellipse(32, 66, 24, 18, purple);
  c.poly([[23.5, 46], [40.5, 46], [32, 60]], skin, { line: hex(0x9a6a56) });
  c.dot(32, 54, 1.2, 1.2, gold);
  c.dot(32, 53.2, 0.5, 0.5, [255, 250, 200]);
  c.rrect(12.5, 24, 6.5, 40, 3.2, hair, { line: null });
  c.rrect(45, 24, 6.5, 40, 3.2, hair, { line: null });
  // Face: big green eyes with lash flicks, arched brows, small nose, full red lips, blush, a beauty mark, gold drop earrings.
  c.eye(26, 29.5, 3.3, 3.9, hex(0x2fae62), hex(0x1e1428));
  c.eye(38, 29.5, 3.3, 3.9, hex(0x2fae62), hex(0x1e1428), true);
  c.line(22.2, 27.6, 21.2, 26.6, 0.5, hex(0x1e1428));
  c.line(41.8, 27.6, 42.8, 26.6, 0.5, hex(0x1e1428));
  brow(c, 22.5, 24.8, 28.5, 23.6, 0.8, hair);
  brow(c, 35.5, 23.6, 41.5, 24.8, 0.8, hair);
  c.dot(32, 34.4, 1, 0.7, mix(skin, [150, 80, 70], 0.4));
  c.rrect(29.4, 37.4, 5.2, 2, 1, hex(0xcf3f5f), { shade: false, line: hex(0x8a2640) });
  c.dot(32, 37.9, 1.6, 0.3, hex(0xff8aa0));
  c.dot(36.8, 36.5, 0.5, 0.5, hex(0x6a3a30));
  c.blush(22.5, 34, 4, 2.6);
  c.blush(41.5, 34, 4, 2.6);
  c.dot(18.6, 34, 0.9, 0.9, gold);
  c.dot(18.6, 36, 0.8, 1.2, gold);
  c.dot(45.4, 34, 0.9, 0.9, gold);
  c.dot(45.4, 36, 0.8, 1.2, gold);
}

function rosa(c: Canvas): void {
  const skin = hex(0xf2c8a8);
  const hair = hex(0x9a4421);
  const blouse = hex(0xf7efdf);
  const vest = hex(0x93323a);
  // Ponytail swinging out behind, then the head, the hair cap and a fringe.
  c.rrect(43, 14, 11, 36, 5.5, hair);
  c.ellipse(46.5, 14, 6, 7, hair);
  head(c, skin);
  c.ellipse(32, 18, 15.5, 11.5, hair);
  c.poly([[17.5, 24], [20, 15], [32, 11], [44, 15], [46.5, 24], [43, 20], [36, 17.5], [28, 19.5], [22, 23.5]], hair);
  c.poly([[17.5, 30], [16, 22], [21, 19], [22, 28]], hair);
  c.gradient(14, 8, 56, 50, 1.1, 0.88);
  c.rrect(44.5, 12, 3, 4, 1.2, hex(0xe0aa3a), { shade: false });
  // Shoulders: a cream blouse with a lace collar, a red laced bodice, an apron strap.
  c.ellipse(32, 66, 26, 18, blouse);
  c.poly([[22, 47], [42, 47], [40, 64], [24, 64]], vest);
  c.poly([[26, 47], [38, 47], [32, 56]], skin, { line: hex(0x9a6a56) });
  for (let i = 0; i < 4; i++) c.line(28 + i * 2.7, 49 + i * 0.8, 29.5 + i * 2.7, 49.5 + i * 0.8, 0.6, hex(0xe9dcc0));
  c.line(30.5, 56, 33.5, 58.5, 0.5, hex(0xe9cfa0));
  c.line(33.5, 56, 30.5, 58.5, 0.5, hex(0xe9cfa0));
  // Face: big warm brown eyes, a wide happy smile, freckles, blush, gold hoops.
  c.eye(26, 29.6, 3.3, 3.8, hex(0x8a5a2e), hex(0x2a1810));
  c.eye(38, 29.6, 3.3, 3.8, hex(0x8a5a2e), hex(0x2a1810), true);
  c.line(22.4, 27.4, 21.4, 26.5, 0.5, hex(0x2a1810));
  c.line(41.6, 27.4, 42.6, 26.5, 0.5, hex(0x2a1810));
  brow(c, 22.5, 24.4, 28.5, 23.8, 0.8, mix(hair, [60, 20, 10], 0.3));
  brow(c, 35.5, 23.8, 41.5, 24.4, 0.8, mix(hair, [60, 20, 10], 0.3));
  c.dot(32, 34.3, 1, 0.7, mix(skin, [150, 80, 70], 0.4));
  c.ellipse(32, 38.2, 3.4, 1.8, hex(0xc2404a), { shade: false, line: hex(0x7a2430) });
  c.rrect(29.9, 37.5, 4.2, 0.9, 0.4, hex(0xfff5ee), { shade: false, line: null });
  for (const [x, y] of [[24, 33], [26, 34.2], [22.5, 34.6], [38, 34.2], [40, 33], [41.6, 34.6]] as const) c.dot(x, y, 0.4, 0.4, hex(0xb86a48));
  c.blush(22.5, 34.5, 4.2, 2.8);
  c.blush(41.5, 34.5, 4.2, 2.8);
  for (const x of [18.6, 45.4]) {
    c.dot(x, 35.5, 1.4, 1.9, hex(0xe9bb3d));
    c.dot(x, 35.5, 0.8, 1.2, skin);
  }
}

function gruk(c: Canvas): void {
  const skin = hex(0x74a84d);
  const leather = hex(0x6b4426);
  // Huge shoulders and a leather vest over a green chest, a thick neck, then the broad head.
  c.ellipse(32, 68, 31, 21, skin);
  c.poly([[6, 66], [22, 46], [26, 64], [18, 80]], leather);
  c.poly([[58, 66], [42, 46], [38, 64], [46, 80]], leather);
  c.line(26, 52, 26, 64, 1, hex(0xcaa23a));
  c.line(38, 52, 38, 64, 1, hex(0xcaa23a));
  c.rrect(24, 38, 16, 16, 5, mix(skin, [40, 70, 30], 0.2));
  // Pointed ears, a black mohawk, the head.
  c.poly([[15, 26], [6, 17], [16, 33]], skin);
  c.poly([[49, 26], [58, 17], [48, 33]], skin);
  c.poly([[27, 14], [29, -4], [33, 4], [36, -6], [38, 14]], hex(0x211c26));
  c.ellipse(32, 26.5, 16, 15, skin);
  c.rrect(19, 28, 26, 14, 7, skin, { line: null });
  c.rrect(18, 24, 28, 12, 6, skin, { line: null, shade: false });
  // Heavy brow, small gold eyes, a flat nose, a frown, two big tusks and a warm blush.
  c.poly([[18.5, 24], [30, 25.5], [30, 27.2], [18.5, 26.5]], hex(0x2a2218), { shade: false, line: null });
  c.poly([[45.5, 24], [34, 25.5], [34, 27.2], [45.5, 26.5]], hex(0x2a2218), { shade: false, line: null });
  c.eye(25, 29, 2.6, 2.2, hex(0xf0c93a), hex(0x2a2218));
  c.eye(39, 29, 2.6, 2.2, hex(0xf0c93a), hex(0x2a2218), true);
  c.ellipse(32, 33.6, 2.6, 1.9, mix(skin, [60, 100, 40], 0.3), { shade: false });
  c.dot(30.8, 33.9, 0.5, 0.5, hex(0x3d6a2a));
  c.dot(33.2, 33.9, 0.5, 0.5, hex(0x3d6a2a));
  c.rrect(24.5, 38.4, 15, 3, 1.5, hex(0x3a2a22), { shade: false, line: null });
  c.poly([[26, 38.2], [28.8, 38.2], [27.6, 33.6]], hex(0xf8f2e0), { line: hex(0x8a8070) });
  c.poly([[35.2, 38.2], [38, 38.2], [36.4, 33.6]], hex(0xf8f2e0), { line: hex(0x8a8070) });
  c.blush(21.5, 33.5, 3.4, 2.2, [210, 110, 80], 0.3);
  c.blush(42.5, 33.5, 3.4, 2.2, [210, 110, 80], 0.3);
  c.line(35.5, 21, 38.5, 25.5, 0.45, hex(0x4e7a35)); // an old scar
}

function orrin(c: Canvas): void {
  const skin = hex(0xe8bf9a);
  const hair = hex(0x57402f);
  const brass = hex(0xd5aa4c);
  const coat = hex(0x4d6f93);
  // Shoulders in a blue work coat with a leather apron strap, a collar, then the head.
  c.ellipse(32, 66, 25, 18, coat);
  c.poly([[26, 46], [30, 46], [34, 66], [22, 66]], hex(0x80583a));
  c.poly([[38, 46], [34, 46], [30, 66], [42, 66]], hex(0x80583a));
  c.rrect(21, 44, 22, 5, 2.5, mix(coat, [255, 255, 255], 0.18));
  head(c, skin);
  // Untidy brown hair with a cowlick, goggles pushed up on the forehead.
  c.poly([[18, 22], [20, 11], [27, 7], [31, 3], [36, 8], [44, 9], [46, 22], [41, 17], [32, 16], [24, 18]], hair);
  c.poly([[28, 8], [30, 0], [33, 8]], hair);
  c.line(18.5, 19.5, 45.5, 19.5, 2.3, hex(0x3a3434));
  for (const x of [25, 39]) {
    c.ellipse(x, 18.6, 5, 4.6, brass);
    c.ellipse(x, 18.6, 3.5, 3.2, hex(0x7ec8f0), { shade: false, line: hex(0x4a86b0) });
    c.dot(x - 1.1, 17.4, 0.9, 0.9, [255, 255, 255]);
  }
  // Face: blue eyes, a happy lopsided grin under a thick moustache, a soot smudge, blush.
  c.eye(26, 29.6, 3.1, 3.6, hex(0x3b86c4), hex(0x241c1a));
  c.eye(38, 29.6, 3.1, 3.6, hex(0x3b86c4), hex(0x241c1a), true);
  brow(c, 22.5, 24.4, 28.5, 23.8, 1, hair);
  brow(c, 35.5, 23.8, 41.5, 24.2, 1, hair);
  c.dot(32, 34, 1.1, 0.8, mix(skin, [150, 80, 70], 0.4));
  c.ellipse(26.5, 37.1, 5, 1.9, hair, { line: null });
  c.ellipse(37.5, 37.1, 5, 1.9, hair, { line: null });
  c.rrect(28, 38.8, 8, 2.6, 1.3, hex(0xa85a44), { shade: false, line: hex(0x6a3024) });
  c.blush(22.5, 34.2, 4, 2.6);
  c.blush(41.5, 34.2, 4, 2.6);
  c.dot(23.8, 36.6, 1.5, 0.9, [80, 68, 60]);
  c.gradient(20, 6, 46, 24, 1.08, 0.9);
}

function bram(c: Canvas): void {
  const skin = hex(0xd9ac88);
  const rag = hex(0x6c6c51);
  const beard = hex(0xd2cfc6);
  // A ragged olive hood and shoulders, then the face inside it.
  c.ellipse(32, 68, 28, 20, mix(rag, [0, 0, 0], 0.12));
  c.poly([[8, 66], [10, 30], [16, 8], [32, 0], [48, 8], [54, 30], [56, 66]], rag);
  c.rrect(12, 30, 40, 30, 12, mix(rag, [0, 0, 0], 0.35), { shade: false });
  c.ellipse(32, 29, 13.2, 14.4, skin);
  c.poly([[19, 14], [45, 14], [47, 22], [32, 17.5], [17, 22]], mix(rag, [0, 0, 0], 0.3), { shade: false, line: null });
  c.rrect(11, 22, 4, 4, 1, hex(0x92703c), { shade: false });
  // A big grey beard over the lower face, bushy white brows, squinting grey-blue eyes, a red nose.
  c.poly([[19.5, 32], [44.5, 32], [43, 44], [37, 56], [32, 60], [27, 56], [21, 44]], beard);
  c.line(24, 36, 26, 50, 0.5, mix(beard, [110, 110, 120], 0.45));
  c.line(40, 36, 38, 50, 0.5, mix(beard, [110, 110, 120], 0.45));
  c.line(32, 40, 32, 56, 0.5, mix(beard, [110, 110, 120], 0.45));
  c.ellipse(32, 34.2, 2.4, 2, hex(0xd98b78), { shade: false });
  c.rrect(26, 36.8, 12, 3, 1.5, hex(0xb89a8c), { shade: false, line: null });
  c.rrect(28.5, 38.8, 7, 1.8, 0.9, hex(0x8a3a3a), { shade: false, line: null });
  c.eye(26, 29.4, 2.6, 2, hex(0x6a8aa8), hex(0x2a2420));
  c.eye(38, 29.4, 2.6, 2, hex(0x6a8aa8), hex(0x2a2420), true);
  c.poly([[21.5, 25.8], [29.5, 24.4], [29.5, 26.4], [22, 27.6]], beard, { shade: false });
  c.poly([[42.5, 25.8], [34.5, 24.4], [34.5, 26.4], [42, 27.6]], beard, { shade: false });
  c.blush(22, 33, 3.4, 2.2, [220, 110, 100], 0.32);
  c.blush(42, 33, 3.4, 2.2, [220, 110, 100], 0.32);
  // A coin that never runs out, catching the light at the collar.
  c.ellipse(46, 54, 3.2, 3.2, hex(0xd9b640));
  c.dot(45, 53, 0.9, 0.9, [255, 246, 190]);
  c.line(43.5, 55.5, 48.5, 55.5, 0.3, hex(0x8a6a20));
}

const PAINTERS: Partial<Record<NpcRole, (c: Canvas) => void>> = { witch: mara, barkeep: rosa, orc: gruk, artificer: orrin, hermit: bram };

/** True for the roles that have a portrait (people, not the board or the clock). */
export const hasPortrait = (role: NpcRole): boolean => PAINTERS[role] !== undefined;

/** Paints a portrait at PORTRAIT_PX square, on a warm parchment-and-wood backdrop like a dialogue card. */
export function paintPortrait(role: NpcRole): PortraitImage {
  const c = new Canvas(PORTRAIT_GRID, PORTRAIT_GRID, PORTRAIT_RES);
  const draw = PAINTERS[role];
  if (draw) draw(c);
  // A soft backdrop behind the figure: a tinted vertical gradient.
  const bgTop: Rgb = hex(0xf2dfb8);
  const bgBottom: Rgb = hex(0xd6b27c);
  for (let y = 0; y < c.ph; y++) {
    const t = y / c.ph;
    const col = mix(bgTop, bgBottom, t);
    for (let x = 0; x < c.pw; x++) {
      const i = (y * c.pw + x) * 4;
      if (c.data[i + 3] === 0) {
        // A faint vignette toward the corners.
        const dx = (x / c.pw - 0.5) * 2;
        const dy = (y / c.ph - 0.5) * 2;
        const k = 1 - 0.14 * (dx * dx + dy * dy);
        c.data[i] = Math.round(col[0] * k);
        c.data[i + 1] = Math.round(col[1] * k);
        c.data[i + 2] = Math.round(col[2] * k);
        c.data[i + 3] = 255;
      }
    }
  }
  return { w: c.pw, h: c.ph, data: c.data };
}

export { lightOf };
