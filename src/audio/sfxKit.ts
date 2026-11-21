/** Shorthand for writing patches: layer constructors and the note table the musical cues share. */
import type { NoiseColor } from './buffers';
import type { FilterKind, Wave } from './types';
import type { FilterSpec, NoiseLayer, ToneLayer } from './patch';

type ToneExtra = Partial<Omit<ToneLayer, 'kind' | 'wave' | 'freq' | 'gain' | 'd'>>;
type NoiseExtra = Partial<Omit<NoiseLayer, 'kind' | 'color' | 'filter' | 'gain' | 'd'>>;

export const tone = (wave: Wave, freq: number, gain: number, d: number, extra: ToneExtra = {}): ToneLayer => ({
  kind: 'tone',
  wave,
  freq,
  gain,
  d,
  ...extra,
});

export const noise = (color: NoiseColor, filter: FilterSpec, gain: number, d: number, extra: NoiseExtra = {}): NoiseLayer => ({
  kind: 'noise',
  color,
  filter,
  gain,
  d,
  ...extra,
});

const filter = (type: FilterKind) => (freq: number, freqEnd?: number, q?: number): FilterSpec => ({ type, freq, freqEnd, q });
export const lp = filter('lowpass');
export const hp = filter('highpass');
export const bp = filter('bandpass');

/** A bell-like struck note: a sine with a quickly fading FM shimmer. */
export const bell = (freq: number, gain: number, d: number, at = 0, index = 1.2): ToneLayer =>
  tone('sine', freq, gain, d, { at, fm: { ratio: 3.01, index } });

/** A warm plucked note: a triangle softened by a low-pass, with a quiet sine an octave up. */
export const warm = (freq: number, gain: number, d: number, at = 0): ToneLayer[] => [
  tone('triangle', freq, gain, d, { at, a: 0.008, filter: lp(freq * 4) }),
  tone('sine', freq * 2, gain * 0.3, d * 0.7, { at, a: 0.008 }),
];

/** Equal-tempered note frequencies (Hz); the cues stay on the C major pentatonic: C D E G A. */
export const N = {
  C3: 130.81,
  G3: 196.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.26,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
  A6: 1760.0,
  C7: 2093.0,
  E7: 2637.02,
  G7: 3135.96,
} as const;
