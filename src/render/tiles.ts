/**
 * The renderer's only door to the pixel painters. Everything in src/render that needs texels (atlas, icons,
 * held item, particle colours) goes through here so the painters stay swappable.
 */
import { averageColor, paintTexture, pipeWindow, TEXTURE_SIZE } from './textures';

export const TILE_SIZE = TEXTURE_SIZE;
export const TILE_PIXELS = TILE_SIZE * TILE_SIZE;
export const TILE_BYTES = TILE_PIXELS * 4;

/** 16x16 RGBA pixels of a texture, row-major, top row first. A fresh array the caller may keep. */
export const paintTile = (name: string): Uint8ClampedArray => paintTexture(name);

/** Mean colour of a tile's visible texels, 0..255 per channel. */
export const tileColor = (name: string): [number, number, number] => averageColor(name);

/** Whether texel (x, y) (top row first) of a pipe tile is a window onto the inside of the tube. */
export const pipeWindowTexel = (tile: string, x: number, y: number): boolean => pipeWindow(tile, x, y);
