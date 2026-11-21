/** Small, dependency-free math helpers shared by every module (safe in workers and in node). */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Floor-modulo: result is always in [0, m). */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Deterministic 32-bit integer hash of up to four integers. Returns an unsigned 32-bit int. */
export function hash32(a: number, b = 0, c = 0, d = 0): number {
  let h = 0x9e3779b9 ^ (a | 0);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= b | 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= c | 0;
  h = Math.imul(h ^ (h >>> 16), 0x27d4eb2f);
  h ^= d | 0;
  h = Math.imul(h ^ (h >>> 15), 0x165667b1);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic float in [0, 1) from up to four integers. */
export function hashFloat(a: number, b = 0, c = 0, d = 0): number {
  return hash32(a, b, c, d) / 4294967296;
}

/** Seeded PRNG (mulberry32). Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns any string into a 32-bit seed. */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

function grad3(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function grad2(hash: number, x: number, y: number): number {
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

/** Seeded gradient (Perlin) noise. All outputs are roughly in [-1, 1]. */
export class Noise {
  private readonly p = new Uint8Array(512);

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  noise2(x: number, y: number): number {
    const p = this.p;
    let X = Math.floor(x);
    let Y = Math.floor(y);
    x -= X;
    y -= Y;
    X &= 255;
    Y &= 255;
    const u = fade(x);
    const v = fade(y);
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    const n = lerp(
      lerp(grad2(p[A], x, y), grad2(p[B], x - 1, y), u),
      lerp(grad2(p[A + 1], x, y - 1), grad2(p[B + 1], x - 1, y - 1), u),
      v,
    );
    return n * 0.7071;
  }

  noise3(x: number, y: number, z: number): number {
    const p = this.p;
    let X = Math.floor(x);
    let Y = Math.floor(y);
    let Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    X &= 255;
    Y &= 255;
    Z &= 255;
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad3(p[AA], x, y, z), grad3(p[BA], x - 1, y, z), u),
        lerp(grad3(p[AB], x, y - 1, z), grad3(p[BB], x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(grad3(p[AA + 1], x, y, z - 1), grad3(p[BA + 1], x - 1, y, z - 1), u),
        lerp(grad3(p[AB + 1], x, y - 1, z - 1), grad3(p[BB + 1], x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  }

  /** Fractal Brownian motion over noise2. Output roughly in [-1, 1]. */
  fbm2(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Fractal Brownian motion over noise3. Output roughly in [-1, 1]. */
  fbm3(x: number, y: number, z: number, octaves = 3, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
