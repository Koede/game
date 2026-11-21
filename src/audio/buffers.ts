/**
 * Generated sample data: looping noise beds, the fire's crackle, slow control signals and the night
 * chimes. Everything here is pure arithmetic on Float32Arrays (seeded, so it is reproducible) and is
 * wrapped into context buffers lazily by BufferBank.
 */
import { mulberry32 } from '../core/math';
import type { AudioCtxLike, BufferLike } from './types';

export type NoiseColor = 'white' | 'pink' | 'brown';

/** Scales to the given peak and removes any DC offset, so loops neither clip nor thump. */
function normalise(data: Float32Array, peak: number): void {
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length || 1;
  let max = 1e-9;
  for (let i = 0; i < data.length; i++) {
    data[i] -= mean;
    const a = Math.abs(data[i]);
    if (a > max) max = a;
  }
  const k = peak / max;
  for (let i = 0; i < data.length; i++) data[i] *= k;
}

/**
 * Fills `data` with noise that loops without a seam: coloured noise has slow drift, so the tail is
 * cross-faded into the head (equal power, the two halves are uncorrelated).
 */
export function fillNoise(data: Float32Array, color: NoiseColor, seed: number): void {
  const rng = mulberry32(seed);
  const n = data.length;
  const fade = color === 'white' ? 0 : Math.min(2048, n >> 2);
  const raw = fade > 0 ? new Float32Array(n + fade) : data;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let brown = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = rng() * 2 - 1;
    if (color === 'white') {
      raw[i] = w;
    } else if (color === 'pink') {
      // Paul Kellet's economy pink filter: three leaky integrators approximate -3 dB/octave.
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      raw[i] = b0 + b1 + b2 + w * 0.1848;
    } else {
      brown = brown * 0.995 + w * 0.06;
      raw[i] = brown;
    }
  }
  if (fade > 0) {
    for (let i = 0; i < n; i++) data[i] = raw[i];
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = raw[i] * Math.sqrt(t) + raw[n + i] * Math.sqrt(1 - t);
    }
  }
  normalise(data, 0.9);
}

/**
 * Sparse fire crackle: `density` pops per second, mostly tiny bright ticks with the occasional
 * woody pop. Pops wrap around the end so the loop is seamless.
 */
export function fillCrackle(data: Float32Array, sampleRate: number, density: number, seed: number): void {
  const rng = mulberry32(seed);
  const n = data.length;
  data.fill(0);
  const count = Math.max(1, Math.round((n / sampleRate) * density));
  for (let p = 0; p < count; p++) {
    const start = Math.floor(rng() * n);
    const loud = rng();
    const amp = 0.08 + 0.92 * loud * loud * loud;
    const woody = rng() < 0.22;
    const tau = (woody ? 0.006 + rng() * 0.01 : 0.0006 + rng() * 0.003) * sampleRate;
    const len = Math.floor(tau * 6);
    const tone = (2 * Math.PI * (350 + rng() * 700)) / sampleRate;
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const w = rng() * 2 - 1;
      const env = Math.exp(-i / tau);
      // Differencing the noise brightens a tick into a snap; woody pops ring on a damped sine instead.
      const s = woody ? Math.sin(i * tone) * (0.6 + 0.4 * w) : (w - prev) * 0.7;
      prev = w;
      data[(start + i) % n] += s * env * amp;
    }
  }
  normalise(data, 0.9);
}

/**
 * A smooth random control signal in [-1, 1] (`knotsPerSecond` random targets per second, cosine
 * interpolated, two octaves). Used to make fire flicker and wind gust. The loop closes on itself.
 */
export function fillFlicker(data: Float32Array, sampleRate: number, knotsPerSecond: number, seed: number): void {
  const rng = mulberry32(seed);
  const n = data.length;
  const octave = (knots: number): Float32Array => {
    const k = new Float32Array(Math.max(2, knots));
    for (let i = 0; i < k.length; i++) k[i] = rng() * 2 - 1;
    return k;
  };
  const seconds = n / sampleRate;
  const slow = octave(Math.round(seconds * knotsPerSecond));
  const fast = octave(Math.round(seconds * knotsPerSecond * 2.7));
  const sample = (knots: Float32Array, phase: number): number => {
    const x = phase * knots.length;
    const i = Math.floor(x);
    const t = (1 - Math.cos((x - i) * Math.PI)) / 2;
    return knots[i % knots.length] * (1 - t) + knots[(i + 1) % knots.length] * t;
  };
  for (let i = 0; i < n; i++) {
    const phase = i / n;
    data[i] = sample(slow, phase) * 0.7 + sample(fast, phase) * 0.3;
  }
  normalise(data, 1);
}

/** Pentatonic degrees (semitones above A) the night chimes are drawn from. */
const NIGHT_SCALE = [0, 3, 5, 7, 10, 12, 15, 17];

/**
 * The night's own sound: a few far-apart glassy notes with long tails. There are no creatures in
 * this world, so the night is quiet and a little starlit rather than alive.
 */
export function fillNightChimes(data: Float32Array, sampleRate: number, seed: number): void {
  const rng = mulberry32(seed);
  const n = data.length;
  data.fill(0);
  const seconds = n / sampleRate;
  const notes = Math.max(2, Math.round(seconds / 2.6));
  for (let k = 0; k < notes; k++) {
    // One note per slot, jittered inside it, so they never bunch up.
    const start = Math.floor(((k + 0.15 + rng() * 0.7) / notes) * n);
    const semis = NIGHT_SCALE[Math.floor(rng() * NIGHT_SCALE.length)];
    const freq = 440 * Math.pow(2, semis / 12);
    const w = (2 * Math.PI * freq) / sampleRate;
    const amp = 0.35 + rng() * 0.65;
    const tau = (0.5 + rng() * 0.5) * sampleRate;
    const attack = 0.03 * sampleRate;
    const len = Math.min(n, Math.floor(tau * 6));
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / attack) * Math.exp(-i / tau);
      data[(start + i) % n] += (Math.sin(i * w) + 0.18 * Math.sin(i * w * 2.005)) * env * amp;
    }
  }
  normalise(data, 0.9);
}

/** Rate for control and night buffers: they hold nothing above a few kHz, so they can be small. */
const LOW_RATE = 22050;
const FLICKER_RATE = 8000;

/** Lazily builds and caches every generated buffer for one audio context. */
export class BufferBank {
  private readonly cache = new Map<string, BufferLike>();

  constructor(private readonly ctx: AudioCtxLike) {}

  private get(key: string, seconds: number, sampleRate: number, fill: (data: Float32Array, rate: number) => void): BufferLike {
    let buffer = this.cache.get(key);
    if (!buffer) {
      buffer = this.ctx.createBuffer(1, Math.floor(seconds * sampleRate), sampleRate);
      fill(buffer.getChannelData(0), sampleRate);
      this.cache.set(key, buffer);
    }
    return buffer;
  }

  noise(color: NoiseColor): BufferLike {
    const seed = color === 'white' ? 11 : color === 'pink' ? 23 : 37;
    return this.get(color, color === 'white' ? 2 : 3.7, this.ctx.sampleRate, (d) => fillNoise(d, color, seed));
  }

  /** `dense` is the busier of the two crackle beds; they have different lengths so they never line up. */
  crackle(dense: boolean): BufferLike {
    return dense
      ? this.get('crackle-dense', 5.3, this.ctx.sampleRate, (d, r) => fillCrackle(d, r, 26, 71))
      : this.get('crackle-sparse', 7.9, this.ctx.sampleRate, (d, r) => fillCrackle(d, r, 7, 53));
  }

  flicker(): BufferLike {
    return this.get('flicker', 11, FLICKER_RATE, (d, r) => fillFlicker(d, r, 5, 97));
  }

  nightChimes(): BufferLike {
    return this.get('night', 15, LOW_RATE, (d, r) => fillNightChimes(d, r, 131));
  }
}
