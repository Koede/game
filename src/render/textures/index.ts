/**
 * Hearthwatt's procedural textures: one deterministic 16x16 RGBA painter per texture name of the registry.
 * DOM-free and pure - the renderer uploads the results to the GPU, the UI scales item icons from them and
 * the particle system takes debris colours from averageColor().
 */
import { Canvas, TEXTURE_SIZE, type Painter } from './canvas';
import { PAINTERS } from './painters';
import { applyReadability } from './readability';

export { TEXTURE_SIZE } from './canvas';
export { pipeWindow } from './transport';

const BYTES = TEXTURE_SIZE * TEXTURE_SIZE * 4;
const cache = new Map<string, Uint8ClampedArray>();

/** The obvious "nobody painted this" tile: an 8-pixel-period magenta and black checker. */
function checker(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(BYTES);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const i = (y * TEXTURE_SIZE + x) * 4;
      const on = ((x >> 2) + (y >> 2)) % 2 === 0;
      out[i] = on ? 255 : 0;
      out[i + 2] = on ? 255 : 0;
      out[i + 3] = 255;
    }
  }
  return out;
}

const painterOf = (name: string): Painter | undefined =>
  Object.prototype.hasOwnProperty.call(PAINTERS, name) ? PAINTERS[name] : undefined;

/** True when `name` has its own painter (every entry of the registry's TEXTURE_NAMES does). */
export function hasPainter(name: string): boolean {
  return painterOf(name) !== undefined;
}

function painted(name: string): Uint8ClampedArray {
  let px = cache.get(name);
  if (!px) {
    const paint = painterOf(name);
    if (paint) {
      const canvas = new Canvas(name);
      paint(canvas);
      // Every painted texture goes through the readability tone curve (readability.ts); unknown names stay the raw checker.
      px = name === 'missing' ? canvas.data : applyReadability(canvas.data);
    } else px = checker();
    cache.set(name, px);
  }
  return px;
}

/**
 * The 16x16 RGBA pixels of a texture: row-major, top row first (row 0 is the top of a side face as seen
 * standing in front of it), 1024 bytes. Always a fresh array the caller may keep and mutate. Names without
 * a painter come back as a magenta/black checker.
 */
export function paintTexture(name: string): Uint8ClampedArray {
  return painted(name).slice();
}

/** Mean colour of a texture's opaque pixels (alpha >= 128; all visible pixels if none are), 0..255 per channel. */
export function averageColor(name: string): [number, number, number] {
  const px = painted(name);
  for (const threshold of [128, 1]) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < threshold) continue;
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
    if (n > 0) return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }
  return [0, 0, 0];
}
