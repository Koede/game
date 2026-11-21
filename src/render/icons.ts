/**
 * Item icons for the UI, drawn once per item on a 2D canvas and cached: cube-like block items as small
 * isometric cubes with shaded faces, everything else as its 16x16 pixel icon scaled up with nearest-neighbour.
 */
import { blockOfItem, itemOrNull, TEXTURE_NAMES } from '../core/registry';
import { Face } from '../core/types';
import { paintTile, TILE_SIZE } from './tiles';

/** Side of every icon canvas in pixels (4x the texture; the UI scales it down crisply). */
export const ICON_SIZE = 64;

export type IconProvider = (itemKey: string) => HTMLCanvasElement | null;

function tileCanvas(name: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(paintTile(name), TILE_SIZE, TILE_SIZE), 0, 0);
  return c;
}

/**
 * Isometric cube corners on a 64px canvas, seen from above the south-east: top rhombus, then the left
 * (south, carries the block's front texture) and right (east) faces.
 */
const S = ICON_SIZE;
const CX = S / 2;
const HALF_W = 28;
const HALF_H = 14;
const SIDE_H = 30;

function drawFace(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  ox: number,
  oy: number,
  ux: number,
  uy: number,
  vx: number,
  vy: number,
  srcH: number,
  shade: number,
): void {
  const k = 1 / TILE_SIZE;
  // A hair of overlap hides the seams between faces.
  ctx.setTransform(ux * k * 1.02, uy * k * 1.02, vx * (1 / srcH) * 1.02, vy * (1 / srcH) * 1.02, ox, oy);
  ctx.drawImage(tile, 0, TILE_SIZE - srcH, TILE_SIZE, srcH, 0, 0, TILE_SIZE, srcH);
  if (shade > 0) {
    ctx.fillStyle = `rgba(12, 8, 6, ${shade})`;
    ctx.fillRect(0, 0, TILE_SIZE, srcH);
  }
}

function drawCube(ctx: CanvasRenderingContext2D, layers: readonly number[], height: number): void {
  const top = tileCanvas(TEXTURE_NAMES[layers[Face.PY]]);
  const left = tileCanvas(TEXTURE_NAMES[layers[Face.NZ]]);
  const right = tileCanvas(TEXTURE_NAMES[layers[Face.PX]]);
  const sideH = SIDE_H * height;
  const topY = 4 + (SIDE_H - sideH);
  const srcH = Math.max(1, Math.round(TILE_SIZE * height));
  // Top: texel (0,0) (north-west) at the back corner, u towards the right corner, v towards the left one.
  drawFace(ctx, top, CX, topY, HALF_W, HALF_H, -HALF_W, HALF_H, TILE_SIZE, 0);
  drawFace(ctx, left, CX - HALF_W, topY + HALF_H, HALF_W, HALF_H, 0, sideH, srcH, 0.2);
  drawFace(ctx, right, CX, topY + 2 * HALF_H, HALF_W, -HALF_H, 0, sideH, srcH, 0.4);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // A soft dark rim so light cubes read on light slots and dark ones on dark slots.
  ctx.strokeStyle = 'rgba(10, 7, 5, 0.55)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(CX, topY);
  ctx.lineTo(CX + HALF_W, topY + HALF_H);
  ctx.lineTo(CX + HALF_W, topY + HALF_H + sideH);
  ctx.lineTo(CX, topY + 2 * HALF_H + sideH);
  ctx.lineTo(CX - HALF_W, topY + HALF_H + sideH);
  ctx.lineTo(CX - HALF_W, topY + HALF_H);
  ctx.closePath();
  ctx.stroke();
  // A pale highlight along the top's front edges.
  ctx.strokeStyle = 'rgba(255, 244, 220, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CX - HALF_W + 1, topY + HALF_H);
  ctx.lineTo(CX, topY + 2 * HALF_H - 0.5);
  ctx.lineTo(CX + HALF_W - 1, topY + HALF_H);
  ctx.stroke();
}

/** Draws one item's icon on a fresh canvas, or returns null for an unknown item. */
export function drawIcon(itemKey: string): HTMLCanvasElement | null {
  const def = itemOrNull(itemKey);
  if (!def) return null;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const placed = blockOfItem(itemKey);
  if (def.iconLayer < 0 && placed) {
    drawCube(ctx, placed.layers, placed.shape === 'slab' ? 0.5 : 1);
  } else {
    const tile = tileCanvas(TEXTURE_NAMES[Math.max(0, def.iconLayer)]);
    ctx.drawImage(tile, 0, 0, S, S);
  }
  return canvas;
}

/** The UI's icon source (kit IconProvider): one cached canvas per item key. */
export function createIconProvider(): IconProvider {
  const cache = new Map<string, HTMLCanvasElement | null>();
  return (itemKey: string): HTMLCanvasElement | null => {
    let icon = cache.get(itemKey);
    if (icon === undefined) {
      icon = drawIcon(itemKey);
      cache.set(itemKey, icon);
    }
    return icon;
  };
}
