/** Patches for brewing (BREWING_PLAN 2, 7): bubbling water, pouring, one drip, a sip. All soft; the bubbling also has an ambience field. */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const BREW_SFX = {
  // A bubble breaking in hot water: a rising "bloop" with a wet puff.
  boil_bubble: {
    jitter: 2.5,
    layers: [
      tone('sine', 320, 0.3, 0.09, { a: 0.006, freqEnd: 760 }),
      noise('pink', bp(1400, 800, 1.2), 0.18, 0.05, { a: 0.004 }),
      tone('sine', 640, 0.1, 0.06, { at: 0.07, freqEnd: 1100 }),
    ],
  },
  // Boiling water poured over the cone: a gentle rush that thins to a trickle.
  pour: {
    jitter: 1,
    layers: [
      noise('pink', bp(1900, 1100, 0.9), 0.4, 0.7, { a: 0.07, trem: { rate: 22, depth: 0.35 } }),
      noise('white', hp(4200), 0.08, 0.55, { a: 0.06 }),
      tone('sine', 190, 0.1, 0.5, { a: 0.08, freqEnd: 150 }),
    ],
  },
  // One drop falling into the cup: a clean high plink with a tiny splash.
  drip: {
    jitter: 3,
    layers: [
      tone('sine', 1500, 0.3, 0.07, { a: 0.003, freqEnd: 950 }),
      tone('sine', 2250, 0.1, 0.1, { a: 0.003, freqEnd: 1700 }),
      noise('white', bp(3600, undefined, 1.5), 0.08, 0.02),
    ],
  },
  // A sip and a swallow: soft slurp, then a low gulp.
  sip: {
    jitter: 1.5,
    layers: [
      noise('pink', bp(1000, 520, 1.1), 0.3, 0.14, { a: 0.03 }),
      tone('sine', 170, 0.22, 0.11, { at: 0.17, a: 0.01, freqEnd: 105 }),
      noise('pink', lp(700, 300), 0.12, 0.08, { at: 0.17 }),
    ],
  },
} satisfies Record<string, Patch>;
