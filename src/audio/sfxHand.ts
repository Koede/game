/**
 * Stroke sounds of the Ember handwork stations and the metal pour (docs/api/handwork-content.md). Played once per stroke
 * and repeated while Use is held (2-4 a second), so each is short, jittered and sits near the world dig sounds in level.
 * The mid band (700-3000 Hz) carries each one so a phone speaker plays it.
 */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const HAND_SFX = {
  // An axe biting into wood: a sharp wedge crack over a hollow knock, with a bright chip of splinter.
  chop: {
    jitter: 2,
    layers: [
      noise('white', bp(1500, 700, 1.6), 0.62, 0.045, { a: 0.001 }),
      tone('triangle', 240, 0.34, 0.1, { freqEnd: 120 }),
      tone('sine', 820, 0.16, 0.04, { at: 0.004, freqEnd: 480 }),
      noise('white', hp(3800), 0.12, 0.03, { at: 0.012 }),
    ],
  },
  // Stone on stone turning: a gritty rasp that fades and a low rumble of the heavy runner.
  grind: {
    jitter: 2.5,
    layers: [
      noise('pink', bp(1700, 900, 0.9), 0.5, 0.2, { a: 0.02, curve: 'lin' }),
      noise('white', hp(3200), 0.1, 0.14, { a: 0.03, trem: { rate: 34, depth: 0.7 } }),
      tone('sawtooth', 95, 0.07, 0.17, { a: 0.03, freqEnd: 80, filter: lp(380) }),
    ],
  },
  // Hammer on a stone anvil: a bright tap and a short ring of the metal, then a dull stone thud under it.
  hammer: {
    jitter: 2,
    layers: [
      noise('white', bp(2800, undefined, 1.1), 0.4, 0.025, { a: 0.001 }),
      tone('sine', 1180, 0.3, 0.16, { fm: { ratio: 2.76, index: 1.4 } }),
      tone('sine', 2350, 0.1, 0.07, { at: 0.002 }),
      tone('triangle', 150, 0.28, 0.08, { freqEnd: 85 }),
    ],
  },
  // A shuttle thrown through the warp: a wooden clack, then the soft whisper of thread.
  loom: {
    jitter: 2,
    layers: [
      tone('triangle', 520, 0.28, 0.045, { freqEnd: 360 }),
      noise('white', bp(2100, 1200, 1.3), 0.4, 0.035, { a: 0.001 }),
      noise('pink', bp(3600, 2400, 0.8), 0.17, 0.16, { at: 0.04, a: 0.03, curve: 'lin' }),
      tone('sine', 700, 0.1, 0.05, { at: 0.17, freqEnd: 520 }),
    ],
  },
  // A palm working wet clay: a slow squelchy smear that falls in pitch, with a soft pat at the end.
  scrape: {
    jitter: 2.5,
    layers: [
      noise('pink', bp(1100, 520, 1.1), 0.5, 0.17, { a: 0.03, curve: 'lin' }),
      noise('brown', lp(700, 300), 0.3, 0.12, { a: 0.02 }),
      tone('sine', 210, 0.16, 0.08, { at: 0.13, freqEnd: 130 }),
    ],
  },
  // Molten metal into a mould: a gurgle of low bubbles, a rush, and a hiss of steam as it meets the clay.
  cast_pour: {
    jitter: 1.5,
    layers: [
      noise('pink', bp(900, 1900, 0.9), 0.4, 0.75, { a: 0.08, curve: 'lin' }),
      tone('sine', 150, 0.2, 0.55, { a: 0.05, freqEnd: 260, trem: { rate: 14, depth: 0.7 } }),
      tone('sine', 330, 0.12, 0.35, { at: 0.12, freqEnd: 500, trem: { rate: 21, depth: 0.8 } }),
      noise('white', hp(3400), 0.22, 0.6, { at: 0.35, a: 0.1, trem: { rate: 30, depth: 0.6 } }),
    ],
  },
} satisfies Record<string, Patch>;
