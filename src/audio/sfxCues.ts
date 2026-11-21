/** Musical cues (progress, victory) and the tiny interface sounds. All notes are C major pentatonic. */
import type { Layer, Patch } from './patch';
import { bell, hp, lp, N, noise, tone, warm } from './sfxKit';

/** Notes played one after another, `step` seconds apart, starting at `at`. */
const run = (notes: readonly number[], step: number, gain: number, d: number, at = 0): Layer[] =>
  notes.flatMap((f, i) => warm(f, gain, d, at + i * step));

/** High, slowly wobbling partials that glitter over a held chord. */
const shimmer = (notes: readonly number[], at: number, step: number, gain: number, d: number): Layer[] =>
  notes.map((f, i) => tone('sine', f, gain, d, { at: at + i * step, a: 0.05, trem: { rate: 5 + i * 1.3, depth: 0.7 } }));

export const CUE_SFX = {
  // Furnace upgraded: a quick climb that lands on the octave.
  upgrade: {
    priority: 1,
    layers: [
      tone('sine', N.C3, 0.13, 1.1, { a: 0.02 }),
      ...run([N.C4, N.E4, N.G4, N.C5], 0.09, 0.2, 0.35),
      ...warm(N.E5, 0.2, 0.9, 0.36),
      ...warm(N.C5, 0.12, 0.9, 0.36),
    ],
  },
  // Two notes, a fourth apart.
  objective: {
    layers: [bell(N.G5, 0.18, 0.45, 0, 0.6), bell(N.C6, 0.18, 0.6, 0.13, 0.6)],
  },
  // A new age: slower and wider than `upgrade`, over a bass note, ending on a full chord.
  age: {
    priority: 1,
    layers: [
      tone('sine', N.C3, 0.14, 2.2, { a: 0.04 }),
      tone('sine', N.G3, 0.1, 2.0, { a: 0.04 }),
      ...run([N.G3, N.C4, N.D4, N.G4, N.A4], 0.14, 0.18, 0.5),
      ...warm(N.C5, 0.17, 1.6, 0.7),
      ...warm(N.E5, 0.14, 1.6, 0.74),
      ...warm(N.G5, 0.11, 1.6, 0.78),
      ...shimmer([N.C7, N.G6], 0.9, 0.15, 0.03, 1.2),
    ],
  },
  // The Starhearth is lit: a suspended fourth resolves into C major, and the top glitters.
  win: {
    priority: 2,
    layers: [
      tone('sine', N.C3, 0.12, 3.6, { a: 0.03, hold: 0.6 }),
      ...warm(N.C4, 0.16, 3.4),
      ...warm(N.G4, 0.15, 3.4),
      ...warm(N.F4, 0.15, 0.55),
      ...warm(N.E4, 0.16, 3.0, 0.5),
      ...warm(N.C5, 0.14, 2.9, 0.55),
      ...warm(N.E5, 0.12, 2.8, 0.62),
      ...warm(N.G5, 0.1, 2.7, 0.7),
      ...shimmer([N.C6, N.E6, N.G6, N.C7, N.E7, N.G7], 0.75, 0.14, 0.035, 2.2),
      noise('white', hp(6000), 0.02, 2.0, { at: 0.6, a: 0.4 }),
    ],
  },
  ui_click: {
    ui: true,
    layers: [tone('sine', 1100, 0.11, 0.025), noise('white', hp(4000), 0.05, 0.008)],
  },
  ui_open: {
    ui: true,
    layers: [tone('sine', 520, 0.1, 0.07, { a: 0.005, freqEnd: 780 })],
  },
  ui_close: {
    ui: true,
    layers: [tone('sine', 780, 0.1, 0.07, { a: 0.005, freqEnd: 520 })],
  },
  // A soft double "no": low, short, never harsh.
  error: {
    ui: true,
    layers: [
      tone('triangle', 330, 0.2, 0.09, { a: 0.005, filter: lp(1400) }),
      tone('triangle', 262, 0.2, 0.12, { at: 0.11, a: 0.005, filter: lp(1400) }),
    ],
  },
} satisfies Record<string, Patch>;
