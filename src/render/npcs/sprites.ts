/**
 * Pixel sprites of the tavern's people (docs/api/npcs.md): 24 x 40 RGBA, drawn procedurally so they are testable without a canvas.
 * Mara the witch (violet hat and dress, long dark hair), Rosa the barkeep (auburn ponytail, white blouse, apron, a mug) and
 * Gruk the orc smith (green, tusked, broad, leather vest, bracers). All adults, stylised in the game's 16 px style.
 */
import type { NpcSprite } from '../../npcs/data';

export const SPRITE_W = 24;
export const SPRITE_H = 40;

type Rgb = readonly [number, number, number];
const hex = (n: number): Rgb => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const dark = (c: Rgb, k: number): Rgb => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];

class Pixels {
  readonly data = new Uint8Array(SPRITE_W * SPRITE_H * 4);
  px(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H) return;
    const i = (y * SPRITE_W + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  /** The same rect mirrored about the vertical axis of the sprite. */
  pair(x: number, y: number, w: number, h: number, c: Rgb): void {
    this.rect(x, y, w, h, c);
    this.rect(SPRITE_W - x - w, y, w, h, c);
  }
  /** Dark outline round every opaque pixel that touches a transparent one. */
  outline(c: Rgb): void {
    const mask = new Uint8Array(SPRITE_W * SPRITE_H);
    for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) mask[y * SPRITE_W + x] = this.data[(y * SPRITE_W + x) * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < SPRITE_H; y++) {
      for (let x = 0; x < SPRITE_W; x++) {
        if (mask[y * SPRITE_W + x]) continue;
        const near = (dx: number, dy: number): boolean => {
          const nx = x + dx;
          const ny = y + dy;
          return nx >= 0 && ny >= 0 && nx < SPRITE_W && ny < SPRITE_H && mask[ny * SPRITE_W + nx] === 1;
        };
        if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) this.px(x, y, c);
      }
    }
  }
}

const OUTLINE = hex(0x1c1520);

function face(p: Pixels, skin: Rgb, x0: number, y0: number, w: number, h: number): void {
  p.rect(x0, y0, w, h, skin);
  p.rect(x0, y0 + h - 1, w, 1, dark(skin, 0.9));
}

function witch(p: Pixels): void {
  const skin = hex(0xf1cfb0);
  const hair = hex(0x2a1d46);
  const hairHi = hex(0x453067);
  const purple = hex(0x6c3fa8);
  const purpleDark = hex(0x45286f);
  const gold = hex(0xe8b93c);
  // Hat: a tall bent cone, a wide brim and a gold band.
  for (let y = 1; y <= 5; y++) p.rect(11 - Math.floor((y - 1) * 0.9) + 1, y, 2 + Math.floor((y - 1) * 1.8), 1, y % 2 ? purple : purpleDark);
  p.rect(13, 0, 3, 1, purpleDark);
  p.rect(15, 1, 1, 1, purpleDark);
  p.rect(7, 5, 10, 1, gold);
  p.rect(3, 6, 18, 2, purpleDark);
  p.rect(4, 6, 16, 1, purple);
  // Long dark hair framing the face, down past the shoulders.
  p.pair(6, 8, 3, 20, hair);
  p.pair(6, 9, 1, 17, hairHi);
  p.rect(8, 8, 8, 2, hair);
  // Face.
  face(p, skin, 8, 9, 8, 9);
  p.rect(9, 12, 2, 1, hex(0x2c7a4a));
  p.rect(13, 12, 2, 1, hex(0x2c7a4a));
  p.px(9, 11, hex(0xf8f0ff));
  p.px(14, 11, hex(0xf8f0ff));
  p.rect(9, 11, 2, 1, hair);
  p.rect(13, 11, 2, 1, hair);
  p.rect(11, 15, 2, 1, hex(0xc4405a));
  p.px(8, 14, hex(0xe9a3a0));
  p.px(15, 14, hex(0xe9a3a0));
  p.rect(11, 18, 2, 2, skin);
  // Bodice with a low V neckline, a gold belt and a star pendant, then a flared skirt.
  p.rect(8, 20, 8, 9, purple);
  p.rect(10, 20, 4, 3, skin);
  p.px(11, 22, gold);
  p.px(12, 22, gold);
  p.rect(8, 25, 8, 1, gold);
  p.rect(6, 29, 12, 4, purple);
  p.rect(5, 33, 14, 4, purple);
  p.rect(5, 36, 14, 1, purpleDark);
  p.rect(7, 31, 1, 5, purpleDark);
  p.rect(16, 31, 1, 5, purpleDark);
  // Arms in long sleeves, hands.
  p.pair(5, 20, 3, 9, purple);
  p.pair(5, 28, 3, 1, gold);
  p.pair(5, 29, 3, 2, skin);
  // Boots.
  p.rect(8, 37, 3, 3, hex(0x2a2030));
  p.rect(13, 37, 3, 3, hex(0x2a2030));
}

function barkeep(p: Pixels): void {
  const skin = hex(0xe8b896);
  const hair = hex(0x8a3f1f);
  const hairHi = hex(0xb35a2c);
  const blouse = hex(0xf2ead8);
  const vest = hex(0x7a2f2f);
  const apron = hex(0xe3d3ad);
  // Hair: a high ponytail swinging to one side.
  p.rect(7, 5, 10, 4, hair);
  p.rect(8, 5, 6, 1, hairHi);
  p.rect(6, 8, 2, 7, hair);
  p.rect(16, 8, 2, 4, hair);
  p.rect(17, 6, 3, 2, hair);
  p.rect(18, 8, 2, 8, hair);
  p.rect(19, 15, 1, 4, hairHi);
  p.rect(16, 6, 1, 1, hex(0xd5a032)); // tie
  // Face with a warm smile.
  face(p, skin, 8, 8, 8, 10);
  p.rect(9, 12, 2, 1, hex(0x3b2a1e));
  p.rect(13, 12, 2, 1, hex(0x3b2a1e));
  p.px(9, 11, hair);
  p.px(10, 11, hair);
  p.px(13, 11, hair);
  p.px(14, 11, hair);
  p.rect(10, 15, 4, 1, hex(0xb5413f));
  p.px(9, 14, hex(0xe9a3a0));
  p.px(14, 14, hex(0xe9a3a0));
  p.rect(11, 18, 2, 2, skin);
  // Blouse with rolled sleeves, a red vest laced up the front, an apron to the knee.
  p.rect(7, 20, 10, 11, blouse);
  p.rect(8, 20, 3, 10, vest);
  p.rect(13, 20, 3, 10, vest);
  p.rect(11, 21, 2, 9, hex(0xd8c89d));
  p.px(11, 23, hex(0x6a2626));
  p.px(12, 25, hex(0x6a2626));
  p.px(11, 27, hex(0x6a2626));
  p.rect(7, 28, 10, 1, hex(0x4a2b19)); // belt
  p.rect(7, 29, 10, 8, apron);
  p.rect(7, 29, 10, 1, hex(0xc9b78c));
  p.rect(9, 32, 6, 3, hex(0xcdbb90)); // pocket
  p.pair(5, 20, 3, 5, blouse);
  p.pair(5, 25, 3, 5, skin);
  // The right hand holds a full mug.
  p.rect(18, 27, 4, 5, hex(0xc9a24a));
  p.rect(18, 27, 4, 1, hex(0xfff6d8));
  p.rect(21, 28, 2, 3, hex(0xc9a24a));
  p.rect(19, 28, 2, 3, hex(0xe8c76a));
  // Skirt below the apron, boots.
  p.rect(7, 37, 10, 1, hex(0x3a2a26));
  p.rect(8, 38, 3, 2, hex(0x3b2a1e));
  p.rect(13, 38, 3, 2, hex(0x3b2a1e));
}

function orc(p: Pixels): void {
  const skin = hex(0x6fa04a);
  const skinDark = hex(0x4e7a35);
  const leather = hex(0x6b4426);
  const leatherDark = hex(0x46291a);
  // Head: a black mohawk, heavy brow, yellow eyes, jutting jaw and two tusks.
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
  // Broad shoulders, a leather vest open on a muscled chest, studded straps.
  p.rect(4, 19, 16, 13, skin);
  p.rect(4, 19, 16, 1, skinDark);
  p.rect(11, 21, 2, 8, skinDark); // sternum line
  p.rect(7, 23, 4, 1, skinDark);
  p.rect(13, 23, 4, 1, skinDark);
  p.rect(5, 19, 4, 12, leather);
  p.rect(15, 19, 4, 12, leather);
  p.rect(5, 19, 1, 12, leatherDark);
  p.rect(18, 19, 1, 12, leatherDark);
  p.px(7, 22, hex(0xc7c9d1));
  p.px(16, 22, hex(0xc7c9d1));
  p.rect(4, 29, 16, 3, leatherDark); // belt
  p.rect(11, 29, 2, 3, hex(0xcaa23a));
  // Big arms with iron bracers, fists.
  p.pair(1, 20, 4, 8, skin);
  p.pair(1, 20, 4, 1, skinDark);
  p.pair(1, 24, 4, 4, hex(0x8c8f9a));
  p.pair(1, 28, 4, 3, skin);
  // Trousers and heavy boots.
  p.rect(5, 32, 14, 5, hex(0x5a4635));
  p.rect(11, 33, 2, 4, hex(0x3d2e22));
  p.rect(4, 37, 7, 3, leatherDark);
  p.rect(13, 37, 7, 3, leatherDark);
}

const PAINTERS: Record<NpcSprite, (p: Pixels) => void> = { witch, barkeep, orc };

export function paintNpc(sprite: NpcSprite): { w: number; h: number; data: Uint8Array } {
  const p = new Pixels();
  PAINTERS[sprite](p);
  p.outline(OUTLINE);
  return { w: SPRITE_W, h: SPRITE_H, data: p.data };
}
