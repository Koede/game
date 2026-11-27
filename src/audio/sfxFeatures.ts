/** Sounds for later features that had none: the camera shutter, a blueprint arriving, a legendary weapon's verb, a buff. */
import type { Patch } from './patch';
import { bell, bp, hp, lp, N, noise, tone, warm } from './sfxKit';

export const FEATURE_SFX = {
  // Camera shutter: a dry mechanical double click with a soft whirr of the film advance.
  shutter: {
    layers: [
      noise('white', bp(2600, undefined, 1.4), 0.3, 0.012, { a: 0.001 }),
      tone('square', 1500, 0.07, 0.018, { freqEnd: 900, filter: lp(3200) }),
      noise('white', bp(2200, undefined, 1.4), 0.26, 0.014, { at: 0.07, a: 0.001 }),
      tone('square', 1000, 0.06, 0.02, { at: 0.07, freqEnd: 620, filter: lp(3000) }),
      noise('pink', bp(1400, 900, 1), 0.07, 0.16, { at: 0.12, a: 0.03 }),
    ],
  },
  // A blueprint unrolls: the dry rustle of paper, then two bright notes of a plan taking shape.
  blueprint_unfurl: {
    layers: [
      noise('white', bp(3400, 1800, 0.8), 0.16, 0.32, { a: 0.05, trem: { rate: 22, depth: 0.5 } }),
      noise('pink', hp(1800), 0.07, 0.2, { at: 0.18 }),
      bell(N.E5, 0.12, 0.5, 0.3),
      bell(N.A4 * 2, 0.12, 0.6, 0.4),
    ],
  },
  // A legendary weapon's verb fires: a bright ringing sweep with a low thump under it.
  legend_proc: {
    priority: 1,
    layers: [
      tone('sine', 220, 0.3, 0.3, { freqEnd: 90, a: 0.004 }),
      tone('sine', 880, 0.14, 0.5, { freqEnd: 1760, fm: { ratio: 2.01, index: 1 }, a: 0.01 }),
      noise('white', hp(3500), 0.1, 0.28, { a: 0.02, trem: { rate: 14, depth: 0.6 } }),
      ...warm(N.G5, 0.08, 0.6, 0.08),
    ],
  },
  // A buff takes hold: a short rising pair, softer than an objective.
  buff_gain: {
    layers: [bell(N.G4, 0.13, 0.35, 0, 0.8), bell(N.D4 * 2, 0.12, 0.45, 0.09, 0.8)],
  },
} satisfies Record<string, Patch>;
