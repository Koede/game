/**
 * Pixel sprites of the tavern's people and props (docs/api/npcs.md): 24 x 40 RGBA (props are their own size), drawn procedurally so
 * they are testable without a canvas. Mara the witch and Rosa the barkeep are drawn as clearly feminine adult women (long lashes,
 * painted lips, earrings, hair with volume, a cinched waist over a flared skirt), Gruk the orc smith is broad and big, Orrin the
 * artificer wears goggles and an apron, Old Bram is a hooded, bearded hermit. The quest board and the wall clock are props; the clock's
 * hands are drawn for the minute of the day it is given.
 *
 * Resolution: the figures are DESIGNED on the 24 x 40 grid and rendered at RES (3) times that, so every texture is 72 x 120: thin outlines,
 * rounded silhouette corners and a light-from-the-left shading pass (rim light, darker right side, soft top-to-bottom falloff) give them
 * the finer detail of a higher-resolution sprite while the drawing code stays in base units.
 */

/** Render scale over the 24 x 40 design grid. */
export const RES = 3;
import type { NpcSprite } from '../../npcs/data';

export const SPRITE_W = 24;
export const SPRITE_H = 40;

type Rgb = readonly [number, number, number];
const hex = (n: number): Rgb => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const dark = (c: Rgb, k: number): Rgb => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
const light = (c: Rgb, k: number): Rgb => [Math.min(255, Math.round(c[0] + (255 - c[0]) * k)), Math.min(255, Math.round(c[1] + (255 - c[1]) * k)), Math.min(255, Math.round(c[2] + (255 - c[2]) * k))];

class Pixels {
  /** Hi-res buffer (w * RES x h * RES). */
  readonly data: Uint8Array;
  constructor(readonly w = SPRITE_W, readonly h = SPRITE_H) {
    this.data = new Uint8Array(w * RES * h * RES * 4);
  }
  private hw(): number {
    return this.w * RES;
  }
  private hh(): number {
    return this.h * RES;
  }
  /** One hi-res pixel. */
  hpx(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= this.hw() || y >= this.hh()) return;
    const i = (y * this.hw() + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
  }
  /** One design-grid pixel (a RES x RES block). */
  px(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) this.hpx(x * RES + i, y * RES + j, c);
  }
  rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  /** The same rect mirrored about the vertical axis of the sprite. */
  pair(x: number, y: number, w: number, h: number, c: Rgb): void {
    this.rect(x, y, w, h, c);
    this.rect(this.w - x - w, y, w, h, c);
  }
  /** A filled ellipse on the design grid, with hi-res edges: round things come out round. */
  disc(cx: number, cy: number, rx: number, ry: number, c: Rgb): void {
    for (let y = Math.floor((cy - ry) * RES); y <= Math.ceil((cy + ry) * RES); y++) {
      for (let x = Math.floor((cx - rx) * RES); x <= Math.ceil((cx + rx) * RES); x++) {
        if (((x / RES - cx) / rx) ** 2 + ((y / RES - cy) / ry) ** 2 <= 1) this.hpx(x, y, c);
      }
    }
  }
  private alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.hw() || y >= this.hh()) return 0;
    return this.data[(y * this.hw() + x) * 4 + 3];
  }
  /** Rounds convex corners of the silhouette: a pixel with two touching empty sides (a stair step) is dropped. */
  round(): void {
    const w = this.hw();
    const drop: number[] = [];
    for (let y = 0; y < this.hh(); y++) {
      for (let x = 0; x < w; x++) {
        if (!this.alpha(x, y)) continue;
        const up = !this.alpha(x, y - 1);
        const down = !this.alpha(x, y + 1);
        const left = !this.alpha(x - 1, y);
        const right = !this.alpha(x + 1, y);
        if ((up || down) && (left || right) && this.alpha(x + (left ? 1 : -1), y + (up ? 1 : -1))) drop.push(y * w + x);
      }
    }
    for (const i of drop) this.data[i * 4 + 3] = 0;
  }
  /** Light from the upper left: a lit left rim, a darker right edge, a soft falloff down the figure. */
  shade(): void {
    const w = this.hw();
    const h = this.hh();
    const out = new Uint8Array(this.data);
    const rim = RES * 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!this.data[i + 3]) continue;
        let k = 1.06 - 0.16 * (y / h);
        if (!this.alpha(x - rim, y)) k += 0.1;
        if (!this.alpha(x + rim, y)) k -= 0.14;
        if (!this.alpha(x, y - rim)) k += 0.06;
        for (let ch = 0; ch < 3; ch++) out[i + ch] = Math.max(0, Math.min(255, Math.round(this.data[i + ch] * k)));
      }
    }
    this.data.set(out);
  }
  /** A one-hi-res-pixel dark outline round the silhouette. */
  outline(c: Rgb): void {
    const w = this.hw();
    const h = this.hh();
    const add: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.alpha(x, y)) continue;
        if (this.alpha(x + 1, y) || this.alpha(x - 1, y) || this.alpha(x, y + 1) || this.alpha(x, y - 1)) add.push(y * w + x);
      }
    }
    for (const i of add) this.hpx(i % w, Math.floor(i / w), c);
  }
}

const OUTLINE = hex(0x1c1520);
const LIP = hex(0xc4405a);
const BLUSH = hex(0xe9a3a0);

function face(p: Pixels, skin: Rgb, x0: number, y0: number, w: number, h: number): void {
  p.rect(x0, y0, w, h, skin);
  p.rect(x0, y0 + h - 1, w, 1, dark(skin, 0.9));
}

/** A woman's eyes: a lash line, an iris with a highlight and a flick of lash at each outer corner. */
function womanEyes(p: Pixels, y: number, iris: Rgb, lash: Rgb): void {
  p.rect(9, y - 1, 2, 1, lash);
  p.rect(13, y - 1, 2, 1, lash);
  p.px(8, y - 1, lash);
  p.px(15, y - 1, lash);
  p.rect(9, y, 2, 1, iris);
  p.rect(13, y, 2, 1, iris);
  p.px(9, y, [250, 250, 255]);
  p.px(13, y, [250, 250, 255]);
}

function witch(p: Pixels): void {
  const skin = hex(0xf6d7ba);
  const hair = hex(0x2a1d46);
  const hairHi = hex(0x5a3f86);
  const purple = hex(0x7a45b8);
  const purpleDark = hex(0x4a2a78);
  const gold = hex(0xe8b93c);
  // Hat: a tall bent cone, a wide brim, a gold band and a little silver buckle.
  for (let y = 1; y <= 5; y++) p.rect(11 - Math.floor((y - 1) * 0.9) + 1, y, 2 + Math.floor((y - 1) * 1.8), 1, y % 2 ? purple : purpleDark);
  p.rect(13, 0, 3, 1, purpleDark);
  p.rect(15, 1, 1, 1, purpleDark);
  p.rect(7, 5, 10, 1, gold);
  p.px(11, 5, hex(0xe8e8f0));
  p.rect(3, 6, 18, 2, purpleDark);
  p.rect(4, 6, 16, 1, purple);
  // Long glossy dark hair with a curl at each shoulder, framing the face.
  p.pair(6, 8, 3, 21, hair);
  p.pair(6, 10, 1, 17, hairHi);
  p.pair(5, 26, 3, 3, hair);
  p.rect(8, 8, 8, 2, hair);
  p.rect(8, 9, 3, 1, hairHi);
  // A delicate face: soft chin, long lashes, green eyes, rosy cheeks, full lips, a beauty mark, drop earrings.
  face(p, skin, 8, 9, 8, 9);
  p.rect(9, 17, 6, 1, skin);
  womanEyes(p, 12, hex(0x2c9a5a), hex(0x1c1220));
  p.rect(9, 10, 2, 1, hair);
  p.rect(13, 10, 2, 1, hair);
  p.px(8, 14, BLUSH);
  p.px(15, 14, BLUSH);
  p.rect(10, 15, 4, 1, LIP);
  p.rect(11, 16, 2, 1, dark(LIP, 0.85));
  p.px(14, 15, dark(skin, 0.6));
  p.px(7, 15, gold);
  p.px(16, 15, gold);
  p.rect(11, 18, 2, 2, skin);
  // A corseted bodice with a bust line, a deep V neckline with a star pendant, a tiny waist, a gold belt, hips and a flared skirt.
  p.rect(8, 20, 8, 5, purple);
  p.rect(7, 21, 1, 3, purple);
  p.rect(16, 21, 1, 3, purple);
  p.rect(9, 20, 6, 2, skin);
  p.rect(10, 22, 4, 1, skin);
  p.px(12, 23, gold);
  p.px(10, 22, dark(skin, 0.88));
  p.px(13, 22, dark(skin, 0.88));
  p.rect(9, 24, 6, 3, purple); // the waist is narrow
  p.rect(9, 25, 6, 1, gold);
  p.rect(10, 26, 1, 1, purpleDark);
  p.rect(13, 26, 1, 1, purpleDark);
  p.rect(8, 27, 8, 2, purple); // the hips
  p.rect(6, 29, 12, 3, purple);
  p.rect(5, 32, 14, 3, purple);
  p.rect(4, 35, 16, 2, purple);
  p.rect(4, 36, 16, 1, purpleDark);
  p.rect(7, 30, 1, 5, purpleDark);
  p.rect(16, 30, 1, 5, purpleDark);
  p.rect(11, 29, 2, 7, purpleDark);
  // Slender arms in bell sleeves, small hands.
  p.pair(6, 21, 2, 7, purple);
  p.pair(5, 27, 3, 2, purpleDark);
  p.pair(6, 29, 2, 2, skin);
  // Heeled boots under the hem.
  p.rect(8, 37, 3, 3, hex(0x2a2030));
  p.rect(13, 37, 3, 3, hex(0x2a2030));
}

function barkeep(p: Pixels): void {
  const skin = hex(0xeebf9f);
  const hair = hex(0x93421f);
  const hairHi = hex(0xc16a35);
  const blouse = hex(0xf6efe0);
  const vest = hex(0x8a2f36);
  const apron = hex(0xe9dab4);
  // Hair: a high ponytail with a ribbon, a side fringe, curls at the neck.
  p.rect(7, 5, 10, 4, hair);
  p.rect(8, 5, 6, 1, hairHi);
  p.rect(7, 8, 3, 3, hair); // fringe
  p.rect(6, 8, 2, 8, hair);
  p.rect(16, 8, 2, 5, hair);
  p.rect(17, 6, 3, 2, hair);
  p.rect(18, 8, 2, 9, hair);
  p.rect(19, 15, 2, 5, hairHi);
  p.rect(16, 6, 1, 2, hex(0xd9a634)); // ribbon
  // Face: lashes, brown eyes, rosy cheeks, full lips, hoop earrings.
  face(p, skin, 8, 8, 8, 10);
  p.rect(9, 17, 6, 1, skin);
  womanEyes(p, 12, hex(0x5a3a22), hex(0x2a1810));
  p.px(9, 10, hair);
  p.px(10, 10, hair);
  p.px(13, 10, hair);
  p.px(14, 10, hair);
  p.px(8, 14, BLUSH);
  p.px(15, 14, BLUSH);
  p.rect(10, 15, 4, 1, hex(0xc03f4a));
  p.rect(11, 16, 2, 1, hex(0x9a2f3b));
  p.px(7, 14, hex(0xe8c76a));
  p.px(7, 15, hex(0xe8c76a));
  p.px(16, 14, hex(0xe8c76a));
  p.px(16, 15, hex(0xe8c76a));
  p.rect(11, 18, 2, 2, skin);
  // Blouse with a lace neckline and puffed sleeves; a laced red bodice that nips in at the waist; an apron over full hips.
  p.rect(8, 20, 8, 4, blouse);
  p.rect(9, 20, 6, 1, skin);
  p.rect(10, 21, 4, 1, skin);
  p.pair(5, 20, 3, 4, blouse); // puffed sleeve
  p.pair(6, 24, 2, 4, skin);
  p.rect(8, 22, 3, 3, vest);
  p.rect(13, 22, 3, 3, vest);
  p.rect(11, 22, 2, 4, hex(0xd8c89d));
  p.px(11, 23, hex(0x6a2626));
  p.px(12, 25, hex(0x6a2626));
  p.rect(9, 25, 6, 2, vest); // the waist, narrow
  p.rect(9, 26, 6, 1, hex(0x4a2b19)); // belt
  p.rect(7, 27, 10, 2, apron); // the hips
  p.rect(6, 29, 12, 4, apron);
  p.rect(6, 29, 12, 1, hex(0xc9b78c));
  p.rect(9, 31, 6, 2, hex(0xcdbb90)); // pocket
  p.rect(4, 33, 16, 3, hex(0x8a3a3a)); // the skirt below the apron, flared
  p.rect(4, 35, 16, 1, hex(0x6a2a2e));
  // A tray hand holding a full mug.
  p.rect(17, 26, 4, 5, hex(0xc9a24a));
  p.rect(17, 26, 4, 1, hex(0xfff6d8));
  p.rect(20, 27, 2, 3, hex(0xc9a24a));
  p.rect(18, 27, 2, 3, hex(0xe8c76a));
  p.pair(17, 24, 1, 2, skin);
  p.rect(8, 36, 3, 4, hex(0x3b2a1e));
  p.rect(13, 36, 3, 4, hex(0x3b2a1e));
}

/**
 * Veyra the dark elf alchemist (owner references: docs/art-refs/veyra_pose_ref.png and the lab-coat elf): deep magenta skin, long near-black
 * navy hair with a fringe over one eye, red eyes behind round gold glasses, pointed ears, a long white coat with a ragged hem over a deep
 * teal outfit with gold shoulders, a vial bandolier and a skull charm, white gloves, mismatched gold-toed boots. One hand is on her hip
 * (a small silver flask at it); the other is raised holding a lime flask with a curl of pale mint vapour rising from it.
 */
function alchemist(p: Pixels): void {
  const skin = hex(0x6a1a5a);
  const hair = hex(0x12142a);
  const hairHi = hex(0x3a3f6e);
  const teal = hex(0x2f6f6b);
  const tealDark = hex(0x1e4a4c);
  const gold = hex(0xd9b23a);
  const coat = hex(0xe8e6ee);
  const coatShade = hex(0xb4acd0);
  const lime = hex(0xb8e04a);
  const mint = hex(0xa8dcc0);
  const mintDark = hex(0x7fc9a0);
  // Long straight hair behind the shoulders, a cap on the crown and a long fringe sweeping over her left (viewer's left) eye.
  p.rect(8, 3, 8, 3, hair);
  p.rect(7, 5, 2, 22, hair);
  p.rect(15, 5, 2, 20, hair);
  p.rect(6, 12, 2, 16, hair);
  p.rect(9, 3, 3, 1, hairHi);
  p.rect(7, 8, 1, 14, hairHi);
  // Long pointed ears.
  p.px(6, 9, skin);
  p.px(5, 8, skin);
  p.px(4, 7, skin);
  p.px(17, 9, skin);
  p.px(18, 8, skin);
  p.px(19, 7, skin);
  face(p, skin, 8, 6, 8, 11);
  p.rect(9, 17, 6, 1, skin);
  p.rect(8, 6, 6, 2, hair);
  p.rect(8, 8, 3, 3, hair); // the fringe over one eye
  p.px(11, 10, hair);
  p.rect(13, 6, 3, 1, hair);
  // Round gold glasses; red eyes behind them; blue-grey lips.
  p.rect(12, 10, 4, 3, gold);
  p.rect(13, 11, 2, 1, hex(0xe83a3a));
  p.px(13, 11, hex(0xffe0e0));
  p.px(14, 11, hex(0xc01c2c));
  p.px(11, 11, gold);
  p.rect(8, 11, 1, 1, gold);
  p.px(9, 11, hex(0xe83a3a));
  p.rect(10, 15, 4, 1, hex(0x5a5a80));
  p.px(11, 14, dark(skin, 0.7));
  p.rect(11, 18, 2, 2, dark(skin, 0.9));
  // The deep teal outfit under a long white coat with big pockets, a ragged hem and gold shoulder pieces.
  p.rect(8, 20, 8, 10, teal);
  p.rect(8, 20, 8, 1, tealDark);
  p.rect(10, 20, 4, 1, skin);
  p.rect(6, 20, 3, 17, coat);
  p.rect(15, 20, 3, 17, coat);
  p.rect(6, 28, 1, 9, coatShade);
  p.rect(17, 20, 1, 17, coatShade);
  p.rect(5, 31, 14, 5, coat);
  p.rect(5, 35, 14, 1, coatShade);
  for (const x of [5, 7, 10, 13, 16, 18]) p.rect(x, 36, 1, 2, coat); // the ragged hem
  p.rect(7, 31, 3, 3, coatShade); // pockets
  p.rect(14, 31, 3, 3, coatShade);
  p.rect(8, 30, 8, 5, tealDark);
  p.rect(11, 30, 2, 7, tealDark);
  p.rect(6, 20, 2, 1, gold);
  p.rect(16, 20, 2, 1, gold);
  // A bandolier of glowing lime vials across the chest, a gold belt and a little skull charm.
  for (let i = 0; i < 7; i++) {
    p.px(8 + i, 21 + i, hex(0x4a3020));
    if (i % 2 === 1) p.px(8 + i, 22 + i, lime);
  }
  p.rect(8, 29, 8, 1, gold);
  p.px(10, 30, hex(0xf2eee0));
  p.px(10, 31, hex(0xf2eee0));
  p.px(9, 30, dark(skin, 0.5));
  // Left arm (viewer's left): a hand on her hip and a small silver flask at it.
  p.rect(4, 21, 2, 4, coat);
  p.rect(3, 24, 2, 4, coat);
  p.rect(4, 27, 2, 2, hex(0xf6f4fa));
  p.px(6, 29, hex(0xc7c9d1));
  p.px(6, 30, hex(0xeef0f6));
  // Right arm raised out and up, a white glove, a round flask of bright lime liquid, and a curl of pale mint vapour rising from it.
  p.rect(18, 20, 2, 2, coat);
  p.rect(19, 18, 2, 2, coat);
  p.rect(20, 16, 2, 2, hex(0xf6f4fa));
  p.disc(21.5, 14, 1.6, 1.4, lime);
  p.rect(21, 12, 1, 1, hex(0xd8d4e4));
  for (let k = 0; k < 11; k++) {
    const x = 21 + Math.round(Math.sin(k * 0.95) * 1.8);
    const y = 11 - k;
    if (y < 0) break;
    p.px(x, y, k % 2 ? mint : mintDark);
    if (k % 3 === 1) p.px(x + 1, y, mintDark);
  }
  // Mismatched ankle boots with gold toes.
  p.rect(8, 37, 3, 3, hex(0x2a2030));
  p.px(8, 39, gold);
  p.rect(13, 37, 3, 3, hex(0x4a2a58));
  p.px(15, 39, gold);
}

function orc(p: Pixels): void {
  const skin = hex(0x6fa04a);
  const skinDark = hex(0x4e7a35);
  const leather = hex(0x6b4426);
  const leatherDark = hex(0x46291a);
  p.rect(10, 1, 4, 5, hex(0x1d1a1f));
  p.rect(11, 0, 2, 1, hex(0x1d1a1f));
  face(p, skin, 6, 5, 12, 11);
  p.rect(6, 5, 12, 1, skinDark);
  p.rect(7, 9, 4, 1, hex(0x241c1a));
  p.rect(13, 9, 4, 1, hex(0x241c1a));
  p.rect(8, 10, 2, 1, hex(0xf2d54a));
  p.rect(14, 10, 2, 1, hex(0xf2d54a));
  p.rect(7, 14, 10, 3, skin);
  p.rect(9, 15, 6, 1, hex(0x2a1a15));
  p.rect(8, 13, 1, 4, hex(0xf4efdf));
  p.rect(15, 13, 1, 4, hex(0xf4efdf));
  p.px(11, 12, skinDark);
  p.px(12, 12, skinDark);
  p.rect(9, 17, 6, 2, skin);
  p.rect(4, 19, 16, 13, skin);
  p.rect(4, 19, 16, 1, skinDark);
  p.rect(11, 21, 2, 8, skinDark);
  p.rect(7, 23, 4, 1, skinDark);
  p.rect(13, 23, 4, 1, skinDark);
  p.rect(5, 19, 4, 12, leather);
  p.rect(15, 19, 4, 12, leather);
  p.rect(5, 19, 1, 12, leatherDark);
  p.rect(18, 19, 1, 12, leatherDark);
  p.px(7, 22, hex(0xc7c9d1));
  p.px(16, 22, hex(0xc7c9d1));
  p.rect(4, 29, 16, 3, leatherDark);
  p.rect(11, 29, 2, 3, hex(0xcaa23a));
  p.pair(1, 20, 4, 8, skin);
  p.pair(1, 20, 4, 1, skinDark);
  p.pair(1, 24, 4, 4, hex(0x8c8f9a));
  p.pair(1, 28, 4, 3, skin);
  p.rect(5, 32, 14, 5, hex(0x5a4635));
  p.rect(11, 33, 2, 4, hex(0x3d2e22));
  p.rect(4, 37, 7, 3, leatherDark);
  p.rect(13, 37, 7, 3, leatherDark);
}

function artificer(p: Pixels): void {
  const skin = hex(0xe3b896);
  const hair = hex(0x4a3a2c);
  const coat = hex(0x4a6a8a);
  const apron = hex(0x7a5a38);
  const brass = hex(0xd1a84a);
  // Untidy hair, goggles pushed up on the forehead with brass rims and blue lenses, a bushy moustache.
  p.rect(7, 4, 10, 5, hair);
  p.rect(6, 6, 2, 5, hair);
  p.rect(16, 6, 2, 5, hair);
  p.rect(9, 3, 2, 1, hair);
  p.rect(14, 2, 2, 2, hair);
  face(p, skin, 8, 8, 8, 10);
  p.rect(7, 7, 10, 3, hex(0x34302e)); // goggle strap
  p.rect(8, 6, 3, 3, brass);
  p.rect(13, 6, 3, 3, brass);
  p.rect(9, 7, 1, 1, hex(0x7fc4ee));
  p.rect(14, 7, 1, 1, hex(0x7fc4ee));
  p.rect(9, 11, 2, 1, hex(0x241c1a));
  p.rect(13, 11, 2, 1, hex(0x241c1a));
  p.px(9, 12, hex(0x3b6a8a));
  p.px(14, 12, hex(0x3b6a8a));
  p.rect(9, 14, 6, 2, hair); // moustache
  p.px(9, 16, hair);
  p.px(14, 16, hair);
  p.rect(11, 16, 2, 1, hex(0xa6543c));
  p.rect(11, 18, 2, 2, skin);
  // A blue work coat, a leather apron with tools in the pocket, rolled sleeves, a big wrench.
  p.rect(6, 20, 12, 12, coat);
  p.rect(8, 21, 8, 12, apron);
  p.rect(8, 21, 8, 1, dark(apron, 0.8));
  p.rect(10, 26, 4, 3, dark(apron, 0.85));
  p.px(10, 25, brass);
  p.px(13, 25, hex(0xc7c9d1));
  p.pair(3, 20, 3, 6, coat);
  p.pair(3, 26, 3, 4, skin);
  p.rect(19, 22, 2, 14, hex(0x9a9ca6)); // the wrench
  p.rect(18, 20, 4, 3, hex(0x9a9ca6));
  p.rect(19, 20, 2, 2, hex(0x34302e));
  p.rect(7, 32, 10, 5, hex(0x3a4a5a));
  p.rect(11, 33, 2, 4, hex(0x2a3744));
  p.rect(6, 37, 5, 3, hex(0x3b2a1e));
  p.rect(13, 37, 5, 3, hex(0x3b2a1e));
}

function hermit(p: Pixels): void {
  const skin = hex(0xd8aa86);
  const rag = hex(0x6a6a50);
  const ragDark = hex(0x4c4c38);
  const beard = hex(0xc9c6bd);
  // A drooping, patched hood and a long grey beard.
  p.rect(6, 4, 12, 4, ragDark);
  p.rect(5, 7, 14, 5, rag);
  p.rect(4, 11, 3, 8, rag);
  p.rect(17, 11, 3, 8, rag);
  p.rect(9, 3, 6, 1, ragDark);
  p.rect(7, 5, 2, 2, hex(0x8a6a38)); // a patch
  face(p, skin, 8, 9, 8, 7);
  p.rect(9, 11, 2, 1, hex(0x241c1a));
  p.rect(13, 11, 2, 1, hex(0x241c1a));
  p.px(9, 10, hex(0x9a9890));
  p.px(14, 10, hex(0x9a9890));
  p.px(11, 13, hex(0xb8785c)); // nose
  p.px(12, 13, hex(0xb8785c));
  p.rect(8, 14, 8, 3, beard);
  p.rect(8, 17, 8, 4, beard);
  p.rect(9, 21, 6, 3, beard);
  p.rect(11, 24, 2, 2, beard);
  // A ragged coat with rope belt, a sack of odd things on his back.
  p.rect(6, 19, 12, 14, rag);
  p.rect(6, 19, 12, 1, ragDark);
  p.rect(5, 26, 14, 1, hex(0x8a6a38));
  p.rect(6, 28, 4, 3, ragDark);
  p.rect(14, 22, 3, 3, hex(0x8a6a38));
  p.pair(3, 20, 3, 9, rag);
  p.pair(3, 29, 3, 2, skin);
  p.rect(8, 33, 3, 4, ragDark);
  p.rect(13, 33, 3, 4, ragDark);
  p.rect(7, 37, 5, 3, hex(0x3b2a1e));
  p.rect(12, 37, 5, 3, hex(0x3b2a1e));
  // A coin purse that never empties, at the belt.
  p.rect(16, 27, 3, 3, hex(0xcaa23a));
  p.px(17, 26, hex(0xfff0a0));
}

/** Pell the trader (code-drawn fallback until the drop-in art lands): a wide-brimmed hat, a long green coat, a pack and a lit lantern. */
function trader(p: Pixels): void {
  const skin = hex(0xd8aa86);
  const hat = hex(0x7a5232);
  const hatDark = hex(0x4e3320);
  const coat = hex(0x3d6b4a);
  const coatDark = hex(0x2a4a33);
  const pack = hex(0x8a6a38);
  const iron = hex(0x4a4a4a);
  // The pack sits behind the right shoulder.
  p.rect(17, 14, 4, 9, pack);
  p.rect(17, 14, 4, 1, hex(0x5e4a28));
  // A tall crown, a band and a wide brim.
  p.rect(7, 3, 10, 4, hat);
  p.rect(7, 6, 10, 1, hex(0x9a3a2a));
  p.rect(3, 7, 18, 2, hatDark);
  face(p, skin, 8, 9, 8, 7);
  p.rect(9, 11, 2, 1, hex(0x241c1a));
  p.rect(13, 11, 2, 1, hex(0x241c1a));
  p.rect(9, 13, 6, 1, hex(0x8a8478)); // a moustache
  p.rect(10, 14, 4, 1, hex(0xa85a4a)); // a small smile
  // A long coat with a belt and buckle, flaring at the hem.
  p.rect(6, 17, 12, 15, coat);
  p.rect(4, 17, 2, 10, coat);
  p.rect(18, 17, 2, 10, coat);
  p.rect(5, 30, 14, 3, coatDark);
  p.rect(6, 21, 12, 1, coatDark);
  p.rect(11, 21, 2, 1, hex(0xcaa23a));
  // A lantern hanging from the left hand, lit.
  p.rect(2, 24, 1, 3, iron);
  p.rect(1, 27, 4, 4, iron);
  p.rect(2, 28, 2, 2, hex(0xffd65a));
  p.px(2, 27, hex(0xfff0a0));
  // Trousers and boots.
  p.rect(8, 33, 3, 4, hex(0x3b2a1e));
  p.rect(13, 33, 3, 4, hex(0x3b2a1e));
  p.rect(7, 37, 5, 3, hex(0x2a1c14));
  p.rect(12, 37, 5, 3, hex(0x2a1c14));
}

function board(p: Pixels): void {
  const wood = hex(0x7a5232);
  const woodDark = hex(0x4a3020);
  const paper = hex(0xf0e4c4);
  p.rect(0, 0, p.w, p.h, woodDark);
  p.rect(1, 1, p.w - 2, p.h - 2, wood);
  p.rect(2, 2, p.w - 4, p.h - 4, hex(0x8a6038));
  // Pinned notes, some with scrawled lines, one with a red seal, one with a coin.
  const notes: Array<[number, number, number, number, Rgb]> = [
    [3, 3, 8, 10, paper], [13, 4, 8, 7, hex(0xe8dcb8)], [4, 15, 7, 9, hex(0xe8dcb8)], [13, 13, 8, 12, paper], [5, 26, 6, 4, hex(0xf6ecd0)],
  ];
  for (const [x, y, w, h, c] of notes) {
    p.rect(x, y, w, h, c);
    for (let ly = y + 2; ly < y + h - 1; ly += 2) p.rect(x + 1, ly, w - 3, 1, dark(c, 0.62));
    p.px(x + (w >> 1), y, hex(0xc43c3c));
  }
  p.rect(17, 14, 3, 3, hex(0xc43c3c));
  p.disc(15.5, 27.5, 2.2, 2.2, hex(0xcaa23a));
  p.px(15, 27, hex(0xfff0a0));
  p.rect(0, p.h - 3, p.w, 3, woodDark);
}

/** A round wall clock: wooden rim, cream face with twelve marks, an hour hand, a longer minute hand and a brass centre. */
function clock(p: Pixels, minutes: number): void {
  const c = 7.5;
  p.disc(c, c, 7.6, 7.6, hex(0x5a3a22));
  p.disc(c, c, 6.2, 6.2, hex(0xf3ead2));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.px(Math.round(c + Math.sin(a) * 5.2), Math.round(c - Math.cos(a) * 5.2), hex(0x3a2a1e));
  }
  const hand = (turn: number, len: number, col: Rgb): void => {
    const a = turn * Math.PI * 2;
    for (let t = 0; t <= len; t += 0.5) p.px(Math.round(c + Math.sin(a) * t), Math.round(c - Math.cos(a) * t), col);
  };
  const m = ((minutes % 1440) + 1440) % 1440;
  hand(((m / 60) % 12) / 12, 3.2, hex(0x2a1c14));
  hand((m % 60) / 60, 5, hex(0x7a2a24));
  p.rect(7, 7, 2, 2, hex(0xcaa23a));
}

/** A tavern jukebox: arched wooden cabinet, glowing amber window with a record, brass speaker grille and coin slot. */
function jukebox(p: Pixels): void {
  const wood = hex(0x7a4a2a);
  const dark = hex(0x4a2c18);
  p.rect(1, 3, 14, p.h - 3, dark);
  p.rect(2, 3, 12, p.h - 4, wood);
  p.disc(8, 5, 6, 3.5, wood);
  p.disc(8, 5, 4.5, 2.4, hex(0xe8a43a));
  p.rect(4, 8, 8, 8, hex(0xf3c45a));
  p.disc(8, 12, 3, 3, hex(0x2a1c14));
  p.disc(8, 12, 1, 1, hex(0xc43c3c));
  p.rect(4, 18, 8, 5, hex(0xcaa23a));
  for (let x = 5; x < 12; x += 2) p.rect(x, 19, 1, 3, hex(0x6a4a1a));
  p.rect(7, 24, 2, 2, hex(0x2a1c14));
  p.rect(2, p.h - 2, 12, 2, dark);
}

const PERSON: Partial<Record<NpcSprite, (p: Pixels) => void>> = { witch, barkeep, orc, artificer, alchemist, hermit, trader };

export interface SpriteImage {
  w: number;
  h: number;
  data: Uint8Array;
}

/** Pixel size of each kind of sprite. */
export function spriteSize(sprite: NpcSprite): { w: number; h: number } {
  if (sprite === 'board') return { w: 24 * RES, h: 32 * RES };
  if (sprite === 'clock') return { w: 16 * RES, h: 16 * RES };
  if (sprite === 'jukebox') return { w: 16 * RES, h: 28 * RES };
  return { w: SPRITE_W * RES, h: SPRITE_H * RES };
}

/** Design-grid size (24 x 40 for people): what the world size of a sprite is measured in. */
export function designSize(sprite: NpcSprite): { w: number; h: number } {
  const s = spriteSize(sprite);
  return { w: s.w / RES, h: s.h / RES };
}

export function paintNpc(sprite: NpcSprite, minutes = 0): SpriteImage {
  const d = designSize(sprite);
  const p = new Pixels(d.w, d.h);
  if (sprite === 'board') board(p);
  else if (sprite === 'clock') clock(p, minutes);
  else if (sprite === 'jukebox') jukebox(p);
  else PERSON[sprite]!(p);
  p.round();
  p.shade();
  p.outline(OUTLINE);
  return { w: d.w * RES, h: d.h * RES, data: p.data };
}

/** Used by the tests to compare a figure's softness: the share of lit pixels in the rows of a given band. */
export function opaqueIn(img: SpriteImage, y0: number, y1: number): number {
  let n = 0;
  for (let y = y0 * RES; y < y1 * RES; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] > 0) n++;
  return Math.round(n / (RES * RES));
}

export { light };
