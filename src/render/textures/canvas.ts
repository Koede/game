/**
 * A 16x16 RGBA pixel canvas with the few drawing tools the painters share. Everything random comes from a
 * stream seeded by the texture's name, so a tile never depends on which tiles were painted before it.
 */
import { clamp, hashFloat, lerp, mod, mulberry32, seedFromString } from '../../core/math';
import { type RGB, mix, shade } from './palette';

export const TEXTURE_SIZE = 16;
const N = TEXTURE_SIZE;

export type Painter = (c: Canvas) => void;
export type PainterSet = Readonly<Record<string, Painter>>;
/** Maps the characters of an ASCII sprite to colours; characters without an entry are left untouched. */
export type Legend = Readonly<Record<string, RGB>>;
export type Point = readonly [number, number];

/** Nearest scattered point per pixel, and how far the pixel is from the border to the next cell. */
export interface CellMap {
  id: Uint8Array;
  edge: Float32Array;
  centre: Float32Array;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const wrapDelta = (d: number): number => {
  const m = mod(d, N);
  return m > N / 2 ? m - N : m;
};

/** Legend entries `keys[i] -> ramp[i]`, for sprites shaded with one material ramp. */
export function tones(keys: string, ramp: readonly RGB[]): Record<string, RGB> {
  const out: Record<string, RGB> = {};
  for (let i = 0; i < keys.length; i++) out[keys[i]] = ramp[i];
  return out;
}

/** Registers the idle and the running (`_on`) variant of one painter. */
export function pair(name: string, paint: (c: Canvas, lit: boolean) => void): Record<string, Painter> {
  return { [name]: (c) => paint(c, false), [`${name}_on`]: (c) => paint(c, true) };
}

export class Canvas {
  readonly data = new Uint8ClampedArray(N * N * 4);
  rand: () => number;
  private seed: number;

  constructor(seedName: string) {
    this.seed = seedFromString(seedName);
    this.rand = mulberry32(this.seed);
  }

  /** Runs `fn` on another texture's random stream, so a shared base (an ore's host rock) matches it exactly. */
  withSeed(seedName: string, fn: () => void): void {
    const { seed, rand } = this;
    this.seed = seedFromString(seedName);
    this.rand = mulberry32(this.seed);
    fn();
    this.seed = seed;
    this.rand = rand;
  }

  int(n: number): number {
    return Math.floor(this.rand() * n);
  }

  // ---- pixels ----------------------------------------------------------------------------------

  set(x: number, y: number, c: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (Math.floor(y) * N + Math.floor(x)) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }

  /** Wrapping set: anything drawn with it continues on the opposite edge, which is what makes tiles seamless. */
  wset(x: number, y: number, c: RGB): void {
    this.set(mod(Math.floor(x), N), mod(Math.floor(y), N), c);
  }

  get(x: number, y: number): RGB {
    const i = (mod(Math.floor(y), N) * N + mod(Math.floor(x), N)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  alpha(x: number, y: number): number {
    return x < 0 || y < 0 || x >= N || y >= N ? 0 : this.data[(y * N + x) * 4 + 3];
  }

  /** Blends `c` over the existing pixel (wrapping); transparent pixels stay transparent. */
  blend(x: number, y: number, c: RGB, t: number): void {
    const px = mod(Math.floor(x), N);
    const py = mod(Math.floor(y), N);
    if (this.data[(py * N + px) * 4 + 3] === 0) return;
    this.set(px, py, mix(this.get(px, py), c, t), this.data[(py * N + px) * 4 + 3]);
  }

  /** Darkens (negative) or lightens (positive) the existing pixel. */
  lit(x: number, y: number, amount: number): void {
    const px = mod(Math.floor(x), N);
    const py = mod(Math.floor(y), N);
    const a = this.data[(py * N + px) * 4 + 3];
    if (a > 0) this.set(px, py, shade(this.get(px, py), amount), a);
  }

  // ---- shapes ----------------------------------------------------------------------------------

  fill(c: RGB, a = 255): void {
    this.rect(0, 0, N, N, c, a);
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c, a);
  }

  frame(x: number, y: number, w: number, h: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, wrap = false): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(lerp(x0, x1, t));
      const y = Math.round(lerp(y0, y1, t));
      if (wrap) this.wset(x, y, c);
      else this.set(x, y, c);
    }
  }

  /** Filled circle around a centre given in pixel coordinates (x.5 centres sit between pixels). */
  disc(cx: number, cy: number, r: number, c: RGB, wrap = false): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x - cx, y - cy) > r) continue;
        if (wrap) this.wset(x, y, c);
        else this.set(x, y, c);
      }
    }
  }

  ring(cx: number, cy: number, r: number, c: RGB, thickness = 1): void {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (Math.abs(Math.hypot(x - cx, y - cy) - r) <= thickness / 2) this.set(x, y, c);
      }
    }
  }

  /** Paints every pixel from a function of its position; returning null leaves the pixel alone. */
  each(fn: (x: number, y: number) => RGB | null): void {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = fn(x, y);
        if (c) this.set(x, y, c);
      }
    }
  }

  sprite(rows: readonly string[], legend: Legend, ox = 0, oy = 0, wrap = false): void {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const c = legend[row[x]];
        if (!c) continue;
        if (wrap) this.wset(ox + x, oy + y, c);
        else this.set(ox + x, oy + y, c);
      }
    }
  }

  // ---- seeded, tileable randomness ---------------------------------------------------------------

  /** Deterministic value in [0, 1) for a pixel of this texture. */
  hash(x: number, y: number, salt = 0): number {
    return hashFloat(this.seed, mod(x, N), mod(y, N), salt);
  }

  /** Smooth value noise in [0, 1) that repeats every 16 pixels. Cell sizes must divide 16. */
  noise(cellX: number, cellY = cellX, salt = 0): (x: number, y: number) => number {
    const seed = this.seed;
    const px = N / cellX;
    const py = N / cellY;
    const at = (ix: number, iy: number): number => hashFloat(seed, mod(ix, px), mod(iy, py), salt);
    return (x, y) => {
      const fx = x / cellX;
      const fy = y / cellY;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = smooth(fx - ix);
      const ty = smooth(fy - iy);
      return lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
    };
  }

  /** Fills the tile with soft patches of the ramp's colours: two octaves of noise, posterised. */
  mottle(ramp: readonly RGB[], cellX = 4, cellY = cellX, contrast = 1, salt = 0): void {
    const a = this.noise(cellX, cellY, salt);
    const b = this.noise(Math.max(1, cellX / 2), Math.max(1, cellY / 2), salt + 1);
    this.each((x, y) => {
      const v = clamp(0.5 + (a(x, y) * 0.65 + b(x, y) * 0.35 - 0.5) * 2.1 * contrast, 0, 0.9999);
      return ramp[Math.floor(v * ramp.length)];
    });
  }

  /** `count` points spread over the tile, kept `minDist` apart (measured across the wrapping edges). */
  scatter(count: number, minDist: number): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const p: Point = [this.int(N), this.int(N)];
        const limit = attempt < 30 ? minDist : minDist / 2;
        if (pts.every((q) => Math.hypot(wrapDelta(p[0] - q[0]), wrapDelta(p[1] - q[1])) >= limit)) {
          pts.push(p);
          break;
        }
      }
    }
    return pts;
  }

  /** Tileable Voronoi cells around scattered points: pebbles, crust plates, masonry. */
  cells(count: number, minDist: number): CellMap {
    const pts = this.scatter(count, minDist);
    const map: CellMap = { id: new Uint8Array(N * N), edge: new Float32Array(N * N), centre: new Float32Array(N * N) };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let best = Infinity;
        let second = Infinity;
        let id = 0;
        pts.forEach((p, i) => {
          const d = Math.hypot(wrapDelta(x - p[0]), wrapDelta(y - p[1]));
          if (d < best) {
            second = best;
            best = d;
            id = i;
          } else if (d < second) second = d;
        });
        map.id[y * N + x] = id;
        map.edge[y * N + x] = second - best;
        map.centre[y * N + x] = best;
      }
    }
    return map;
  }

  // ---- icons -------------------------------------------------------------------------------------

  /** Surrounds everything drawn so far with a 1px outline: a deep shade of the pixels it touches. */
  outline(depth = 0.72): void {
    const src = this.data.slice();
    const opaque = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < N && y < N && src[(y * N + x) * 4 + 3] > 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (opaque(x, y)) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!opaque(x + dx, y + dy)) continue;
          const i = ((y + dy) * N + x + dx) * 4;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          n++;
        }
        if (n > 0) this.set(x, y, shade([r / n, g / n, b / n], -depth));
      }
    }
  }
}
