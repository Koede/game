/** Patches of the Current Age engines: the chainsaw cutting and a felled tree, and the tractor's engine. */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const VEHICLE_SFX = {
  // The chain biting wood: a buzzing saw tone with a fast tremolo over a ragged band of noise.
  saw_cut: {
    jitter: 3,
    layers: [
      tone('sawtooth', 190, 0.3, 0.3, { a: 0.02, freqEnd: 260, trem: { rate: 46, depth: 0.7 }, filter: lp(2400) }),
      noise('white', bp(3200, 1800, 0.9), 0.3, 0.3, { a: 0.02, trem: { rate: 31, depth: 0.8 } }),
      tone('triangle', 95, 0.22, 0.3, { a: 0.03, freqEnd: 120 }),
    ],
  },
  // The warning creak: a wood groaning under load, wavering slowly.
  tree_creak: {
    jitter: 2,
    layers: [
      tone('sawtooth', 110, 0.22, 0.9, { a: 0.12, freqEnd: 74, trem: { rate: 5, depth: 0.5 }, filter: lp(620) }),
      noise('pink', bp(520, 300, 1), 0.2, 0.8, { a: 0.1, trem: { rate: 4, depth: 0.6 } }),
    ],
  },
  // An axe biting wood: a short thwack and its ring.
  tree_chop: {
    jitter: 3,
    layers: [
      noise('white', bp(1800, 900, 1.2), 0.5, 0.08, { a: 0.002 }),
      tone('triangle', 180, 0.3, 0.07, { a: 0.002, freqEnd: 110 }),
    ],
  },
  // A trunk coming down: the crack of the last fibres, a rush of branches and a heavy thud.
  tree_fall: {
    jitter: 2,
    layers: [
      noise('white', hp(2400), 0.4, 0.07, { at: 0.02 }),
      noise('pink', bp(1500, 500, 0.8), 0.4, 0.5, { at: 0.1, a: 0.15 }),
      tone('sine', 85, 0.6, 0.35, { at: 0.5, freqEnd: 42 }),
      noise('brown', lp(420, 160), 0.55, 0.4, { at: 0.5, a: 0.008 }),
    ],
  },
  // One chug of a small engine; the game repeats it faster as the revs climb (pitch).
  engine: {
    jitter: 1,
    layers: [
      tone('sawtooth', 62, 0.34, 0.12, { a: 0.006, freqEnd: 52, filter: lp(520, 260) }),
      noise('brown', lp(380, 160), 0.4, 0.09, { a: 0.004 }),
      tone('square', 124, 0.08, 0.06, { a: 0.004, filter: lp(700) }),
    ],
  },
  // Cranking, catching and settling to an idle.
  engine_start: {
    layers: [
      tone('sawtooth', 48, 0.3, 0.45, { a: 0.02, freqEnd: 70, trem: { rate: 16, depth: 0.8 }, filter: lp(500) }),
      noise('brown', lp(420, 200), 0.4, 0.45, { a: 0.02, trem: { rate: 14, depth: 0.7 } }),
      tone('sawtooth', 70, 0.34, 0.5, { at: 0.45, a: 0.01, freqEnd: 56, trem: { rate: 22, depth: 0.5 }, filter: lp(600) }),
      noise('white', bp(900, 500, 1), 0.2, 0.2, { at: 0.45 }),
    ],
  },
} satisfies Record<string, Patch>;