/** Patches for item and fluid transport and multiblock hearths (spec 16-17). */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const TRANSPORT_SFX = {
  // A hearth forms: the fire takes the whole chamber in one deep whoomph, then a shimmer rises as the walls glow.
  hearth_formed: {
    priority: 1,
    layers: [
      noise('brown', lp(180, 760), 0.5, 0.9, { a: 0.07 }),
      tone('sine', 48, 0.32, 0.85, { a: 0.03, freqEnd: 92, glide: 0.5 }),
      noise('pink', bp(420, 1500, 0.8), 0.5, 0.75, { at: 0.04, a: 0.14 }),
      tone('sine', 660, 0.14, 0.9, { at: 0.3, a: 0.55, freqEnd: 1320, fm: { ratio: 2.01, index: 0.8 } }),
      tone('triangle', 990, 0.06, 0.8, { at: 0.42, a: 0.6, freqEnd: 1980, trem: { rate: 9, depth: 0.45 } }),
      noise('white', hp(3800, 8200), 0.08, 0.6, { at: 0.35, a: 0.6 }),
    ],
  },
  // The wrench turns a pipe end: a soft metallic tick with a short ring.
  pipe_clunk: {
    jitter: 1,
    layers: [
      tone('triangle', 430, 0.22, 0.05, { freqEnd: 300 }),
      tone('sine', 1860, 0.16, 0.12, { fm: { ratio: 2.76, index: 1.6 } }),
      noise('white', bp(3200, undefined, 2), 0.12, 0.02),
    ],
  },
} satisfies Record<string, Patch>;
