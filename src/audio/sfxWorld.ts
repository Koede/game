/** Patches for the physical world: digging, moving, getting hurt, things breaking and blowing up. */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const WORLD_SFX = {
  // Digging: one short filtered-noise burst per material, each with its own body resonance.
  dig_stone: {
    jitter: 2,
    layers: [
      noise('white', bp(1900, 900, 1.2), 0.8, 0.07),
      tone('triangle', 210, 0.15, 0.05, { freqEnd: 110 }),
    ],
  },
  dig_dirt: {
    jitter: 2,
    layers: [
      noise('pink', lp(750, 280), 0.35, 0.1, { a: 0.004 }),
      noise('pink', bp(800, 450, 0.8), 0.65, 0.08, { a: 0.004 }),
      tone('sine', 120, 0.1, 0.06, { freqEnd: 80 }),
    ],
  },
  dig_wood: {
    jitter: 2,
    layers: [
      noise('white', bp(950, 700, 3), 0.7, 0.05),
      tone('triangle', 330, 0.26, 0.07, { freqEnd: 210 }),
      tone('sine', 540, 0.2, 0.035),
    ],
  },
  dig_sand: {
    jitter: 2,
    layers: [
      noise('white', bp(3200, 1800, 0.7), 0.36, 0.13, { a: 0.01 }),
      noise('pink', lp(600), 0.14, 0.06),
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
      tone('triangle', 190, 0.24, 0.12, { freqEnd: 85 }),
      noise('pink', bp(900, 500, 1), 0.5, 0.1, { at: 0.04 }),
    ],
  },
  place: {
    jitter: 1,
    layers: [
      tone('triangle', 300, 0.36, 0.07, { freqEnd: 190 }),
      noise('pink', bp(1100, undefined, 0.8), 0.6, 0.035),
      tone('sine', 150, 0.22, 0.1, { freqEnd: 85 }),
    ],
  },
  step: {
    jitter: 3,
    layers: [
      tone('sine', 96, 0.05, 0.05, { freqEnd: 70 }),
      noise('pink', lp(520, 300), 0.12, 0.06, { a: 0.004 }),
      noise('pink', bp(1000, 600, 0.8), 0.38, 0.045, { a: 0.004 }),
    ],
  },
  jump: {
    jitter: 1,
    layers: [
      tone('sine', 360, 0.12, 0.1, { a: 0.01, freqEnd: 620 }),
      noise('white', bp(1200, 2400, 0.8), 0.07, 0.09, { a: 0.02 }),
    ],
  },
  land: {
    jitter: 1.5,
    layers: [
      tone('sine', 135, 0.28, 0.14, { freqEnd: 60 }),
      noise('pink', lp(420), 0.25, 0.1),
      noise('pink', bp(750, 400, 0.7), 0.65, 0.09),
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
      tone('triangle', 380, 0.34, 0.16, { freqEnd: 170, filter: lp(1500) }),
      noise('pink', bp(800, undefined, 0.7), 0.4, 0.06),
    ],
  },
  death: {
    priority: 1,
    layers: [
      tone('triangle', 392, 0.3, 1.1, { freqEnd: 98, glide: 0.9, filter: lp(2000, 500) }),
      tone('triangle', 196, 0.2, 1.2, { freqEnd: 65, glide: 1.0, filter: lp(900) }),
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
      noise('brown', lp(1400, 70), 0.9, 2.2, { a: 0.005 }),
      tone('sine', 78, 0.55, 1.2, { freqEnd: 32 }),
      noise('white', lp(3200, 300), 0.5, 0.5),
      noise('pink', bp(520, 240, 0.6), 0.5, 1.8, { at: 0.05, a: 0.05 }),
      noise('pink', lp(320, 120), 0.3, 2.4, { at: 0.2, a: 0.12 }),
    ],
  },
} satisfies Record<string, Patch>;
