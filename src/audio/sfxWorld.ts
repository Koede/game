/** Patches for the physical world: digging, moving, getting hurt, things breaking and blowing up. */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const WORLD_SFX = {
  // Digging: one short filtered-noise burst per material, each with its own body resonance.
  dig_stone: {
    jitter: 2,
    layers: [
      noise('white', bp(1900, 900, 1.2), 0.5, 0.07),
      tone('triangle', 190, 0.28, 0.05, { freqEnd: 95 }),
    ],
  },
  dig_dirt: {
    jitter: 2,
    layers: [
      noise('pink', lp(750, 280), 0.6, 0.1, { a: 0.004 }),
      tone('sine', 110, 0.2, 0.06, { freqEnd: 70 }),
    ],
  },
  dig_wood: {
    jitter: 2,
    layers: [
      noise('white', bp(950, 700, 3), 0.45, 0.05),
      tone('triangle', 330, 0.3, 0.07, { freqEnd: 210 }),
      tone('sine', 540, 0.12, 0.035),
    ],
  },
  dig_sand: {
    jitter: 2,
    layers: [
      noise('white', bp(4200, 2600, 0.7), 0.3, 0.13, { a: 0.01 }),
      noise('pink', lp(500), 0.18, 0.06),
    ],
  },
  dig_metal: {
    jitter: 1.5,
    layers: [
      tone('sine', 1250, 0.2, 0.14, { fm: { ratio: 2.76, index: 2 } }),
      noise('white', bp(3600, undefined, 1.5), 0.3, 0.03),
      tone('triangle', 240, 0.18, 0.04, { freqEnd: 150 }),
    ],
  },
  break: {
    jitter: 1.5,
    layers: [
      noise('white', lp(2600, 400), 0.5, 0.18),
      tone('triangle', 150, 0.4, 0.14, { freqEnd: 60 }),
      noise('pink', bp(900, 500, 1), 0.3, 0.1, { at: 0.04 }),
    ],
  },
  place: {
    jitter: 1,
    layers: [
      tone('sine', 230, 0.45, 0.07, { freqEnd: 140 }),
      noise('pink', lp(950), 0.3, 0.04),
    ],
  },
  step: {
    jitter: 3,
    layers: [
      noise('pink', lp(520, 300), 0.24, 0.06, { a: 0.004 }),
      tone('sine', 96, 0.16, 0.05, { freqEnd: 70 }),
    ],
  },
  jump: {
    jitter: 1,
    layers: [
      tone('sine', 230, 0.12, 0.1, { a: 0.01, freqEnd: 390 }),
      noise('white', bp(1200, 2400, 0.8), 0.07, 0.09, { a: 0.02 }),
    ],
  },
  land: {
    jitter: 1.5,
    layers: [
      tone('sine', 125, 0.5, 0.14, { freqEnd: 50 }),
      noise('pink', lp(420), 0.38, 0.1),
    ],
  },
  splash: {
    jitter: 1.5,
    layers: [
      noise('white', bp(1600, 500, 0.7), 0.4, 0.45, { a: 0.01 }),
      noise('white', hp(3200), 0.14, 0.3, { at: 0.03, a: 0.02 }),
      tone('sine', 300, 0.22, 0.15, { freqEnd: 90 }),
      tone('sine', 620, 0.1, 0.05, { at: 0.18, freqEnd: 1250 }),
      tone('sine', 820, 0.08, 0.04, { at: 0.27, freqEnd: 1550 }),
    ],
  },
  pickup: {
    jitter: 1,
    layers: [
      tone('sine', 880, 0.17, 0.09, { freqEnd: 1320 }),
      tone('sine', 1320, 0.11, 0.08, { at: 0.05, freqEnd: 1760 }),
    ],
  },
  hurt: {
    jitter: 1,
    layers: [
      tone('triangle', 310, 0.36, 0.16, { freqEnd: 140, filter: lp(1200) }),
      noise('pink', lp(900), 0.32, 0.06),
    ],
  },
  death: {
    priority: 1,
    layers: [
      tone('sine', 330, 0.3, 1.1, { freqEnd: 82, glide: 0.9 }),
      tone('triangle', 165, 0.24, 1.2, { freqEnd: 55, glide: 1.0, filter: lp(700) }),
      noise('brown', lp(320), 0.4, 0.8, { a: 0.02 }),
      tone('sine', 98, 0.2, 1.3, { at: 0.3, a: 0.05 }),
    ],
  },
  tool_break: {
    layers: [
      noise('white', hp(2200), 0.42, 0.04),
      tone('triangle', 720, 0.3, 0.1, { freqEnd: 200 }),
      tone('sine', 900, 0.16, 0.15, { at: 0.05, fm: { ratio: 2.3, index: 2 } }),
      tone('sine', 640, 0.12, 0.13, { at: 0.13, fm: { ratio: 2.3, index: 2 } }),
    ],
  },
  explosion: {
    priority: 1,
    layers: [
      noise('brown', lp(1400, 70), 1.0, 2.2, { a: 0.005 }),
      tone('sine', 72, 0.8, 1.2, { freqEnd: 28 }),
      noise('white', bp(2400, 600, 0.6), 0.45, 0.14),
      noise('pink', lp(320, 120), 0.35, 2.4, { at: 0.2, a: 0.12 }),
    ],
  },
} satisfies Record<string, Patch>;
