/**
 * Sounds of the glass distillery (docs/DISTILLERY_PLAN.md 15): a short bubble, a single drip, and a glass chime when a
 * step completes. Kept brief and in the mid band so a phone speaker carries them, the same way Essentia sounds are.
 */
import type { Patch } from './patch';
import { bp, hp, noise, tone } from './sfxKit';

export const DISTILL_SFX = {
  // A bubble breaking in a heated flask: a rising bloop with a wet puff, quieter than a kettle.
  distill_bubble: {
    jitter: 2,
    layers: [
      tone('sine', 360, 0.24, 0.08, { a: 0.005, freqEnd: 820 }),
      noise('pink', bp(1600, 700, 1.1), 0.14, 0.05, { a: 0.005 }),
    ],
  },
  // One drop leaving glass: a high plink and a tiny splash.
  distill_drip: {
    jitter: 2.5,
    layers: [
      tone('sine', 1760, 0.26, 0.06, { a: 0.003, freqEnd: 1180 }),
      noise('white', bp(4200, undefined, 1.4), 0.06, 0.03, { a: 0.002 }),
    ],
  },
  // Liquid running through a tube or down a condenser: a soft wash that flutters, with a faint glassy tick.
  distill_trickle: {
    jitter: 2,
    layers: [
      noise('pink', bp(1500, 900, 1.2), 0.1, 0.14, { a: 0.02, trem: { rate: 18, depth: 0.5 } }),
      tone('sine', 900, 0.03, 0.12, { a: 0.01, freqEnd: 1300 }),
    ],
  },
  // A stopcock turned by hand: a short mechanical click with a tick of glass.
  distill_tap: {
    jitter: 2,
    layers: [
      noise('white', hp(2400), 0.16, 0.02, { a: 0.001 }),
      tone('triangle', 1100, 0.18, 0.03, { a: 0.001, freqEnd: 700 }),
    ],
  },
  // A step finished: two glass partials a fifth apart, short enough to sit under a toast.
  distill_chime: {
    jitter: 1,
    layers: [
      tone('sine', 1568, 0.2, 0.28, { a: 0.004 }),
      tone('sine', 2349, 0.1, 0.22, { at: 0.06, a: 0.004 }),
      noise('white', hp(6200), 0.03, 0.1, { a: 0.01 }),
    ],
  },
} satisfies Record<string, Patch>;
