/** Soft cues for feedback that used to be silent: toasts and, later, trades. */
import type { Patch } from './patch';
import { bell, bp, hp, lp, N, noise, tone } from './sfxKit';

export const FEEL_SFX = {
  // Good news in a toast: one small bright note.
  toast_good: {
    ui: true,
    layers: [bell(N.E5, 0.1, 0.3, 0, 0.8), bell(N.A4 * 2, 0.08, 0.3, 0.07, 0.8)],
  },
  // A warning or a bad turn: a low, soft double thud, never harsh.
  toast_warn: {
    ui: true,
    layers: [
      tone('triangle', 196, 0.16, 0.16, { a: 0.006, freqEnd: 150, filter: lp(900) }),
      tone('triangle', 165, 0.14, 0.18, { at: 0.1, a: 0.006, freqEnd: 120, filter: lp(900) }),
    ],
  },
  // A rod is cast: an airy whoosh and a small plop where the line lands.
  fish_cast: {
    layers: [
      noise('white', bp(1800, 600, 0.9), 0.14, 0.22, { a: 0.04 }),
      tone('sine', 420, 0.12, 0.12, { at: 0.2, freqEnd: 160, a: 0.004 }),
      noise('white', hp(2500), 0.06, 0.08, { at: 0.2 }),
    ],
  },
  // A fish bites: a bright, quick plink.
  fish_bite: {
    layers: [bell(N.A4 * 2, 0.14, 0.25, 0, 1), bell(N.E5 * 2, 0.1, 0.2, 0.06, 1)],
  },
} satisfies Record<string, Patch>;
