/**
 * The renderer's only door to the pixel painters. Everything in src/render that needs texels (atlas, icons,
 * held item, particle colours) goes through here so the painters stay swappable.
 */
import { hash32 } from '../core/math';

export const TILE_SIZE = 16;
export const TILE_PIXELS = TILE_SIZE * TILE_SIZE;
export const TILE_BYTES = TILE_PIXELS * 4;

/** TEMPORARY stand-in until src/render/textures lands: a flat hashed colour with a darker border. */
export function paintTile(name: string): Uint8ClampedArray {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  const out = new Uint8ClampedArray(TILE_BYTES);
  const r = 60 + (hash32(h, 1) % 150);
  const g = 60 + (hash32(h, 2) % 150);
  const b = 60 + (hash32(h, 3) % 150);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15 ? 0.7 : 0.85 + (hash32(h, x, y) % 30) / 100;
      const i = (y * TILE_SIZE + x) * 4;
      out[i] = r * edge;
      out[i + 1] = g * edge;
      out[i + 2] = b * edge;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Mean colour of a tile's visible texels, 0..255 per channel. */
export function tileColor(name: string): [number, number, number] {
  const px = paintTile(name);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    r += px[i];
    g += px[i + 1];
    b += px[i + 2];
    n++;
  }
  return n === 0 ? [0, 0, 0] : [r / n, g / n, b / n];
}
