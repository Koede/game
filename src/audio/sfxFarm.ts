/** Patches for food, farming and animals (spec 12.7): eating, working the soil, and the animals' voices. */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const FARM_SFX = {
  // A crunchy bite: three quick crackles of decreasing brightness over a soft jaw thump.
  eat: {
    jitter: 1.5,
    layers: [
      noise('white', bp(2800, 1500, 1.2), 0.5, 0.05),
      noise('white', bp(2300, 1300, 1.4), 0.38, 0.045, { at: 0.09 }),
      noise('pink', bp(1800, 1000, 1), 0.32, 0.04, { at: 0.17 }),
      tone('sine', 165, 0.14, 0.06, { freqEnd: 95 }),
    ],
  },
  // The hoe dragging through soil: a gritty band of noise that drops in pitch as the blade slows.
  till: {
    jitter: 2,
    layers: [
      noise('pink', bp(1300, 480, 0.9), 0.55, 0.2, { a: 0.025, curve: 'lin' }),
      noise('white', hp(3400), 0.1, 0.12, { a: 0.02, trem: { rate: 38, depth: 0.6 } }),
      tone('sine', 110, 0.12, 0.08, { at: 0.02, freqEnd: 75 }),
    ],
  },
  // Pressing a seed into soft earth: two muffled pats.
  plant: {
    jitter: 1.5,
    layers: [
      tone('sine', 230, 0.24, 0.07, { freqEnd: 140 }),
      noise('pink', lp(900, 350), 0.42, 0.06, { a: 0.004 }),
      tone('sine', 170, 0.14, 0.06, { at: 0.09, freqEnd: 110 }),
      noise('pink', lp(550, 260), 0.18, 0.05, { at: 0.09, a: 0.004 }),
    ],
  },
  // Pulling a ripe crop: a rustle of leaves that ends in a dry snap.
  harvest: {
    jitter: 1.5,
    layers: [
      noise('white', bp(4200, 2600, 0.8), 0.28, 0.16, { a: 0.012, trem: { rate: 28, depth: 0.7 } }),
      noise('white', hp(2600), 0.3, 0.025, { at: 0.12 }),
      tone('triangle', 950, 0.16, 0.045, { at: 0.12, freqEnd: 420 }),
    ],
  },
  // A hen: two short clucks and a higher third, each a quick downward chirp through a nasal band.
  hen: {
    jitter: 1,
    // The narrow band-pass eats most of the triangle's energy; this brings the clucks level with the other calls.
    gain: 2.4,
    layers: [
      tone('triangle', 720, 0.26, 0.055, { freqEnd: 520, filter: bp(1500, undefined, 1.5) }),
      noise('pink', bp(1600, undefined, 2), 0.18, 0.03),
      tone('triangle', 700, 0.24, 0.055, { at: 0.12, freqEnd: 510, filter: bp(1500, undefined, 1.5) }),
      tone('triangle', 900, 0.3, 0.09, { at: 0.24, freqEnd: 600, filter: bp(1800, undefined, 1.5) }),
      noise('pink', bp(1900, undefined, 2), 0.16, 0.035, { at: 0.24 }),
    ],
  },
  // A goat: a nasal, wavering bleat - a buzzy tone through a narrow formant, with a fast tremolo.
  goat: {
    jitter: 1,
    gain: 1.4,
    layers: [
      tone('sawtooth', 390, 0.24, 0.24, { a: 0.03, hold: 0.22, freqEnd: 340, filter: bp(1250, 1050, 3), trem: { rate: 13, depth: 0.55 } }),
      tone('sawtooth', 394, 0.12, 0.22, { a: 0.03, hold: 0.2, freqEnd: 344, filter: bp(2500, 2100, 4), trem: { rate: 13, depth: 0.5 } }),
      noise('pink', bp(1400, undefined, 1), 0.08, 0.3, { a: 0.03 }),
    ],
  },
  // A boar: two low grunts, rough pulses of a filtered buzz over a breathy rumble.
  boar: {
    jitter: 1,
    layers: [
      tone('sawtooth', 112, 0.4, 0.2, { a: 0.015, freqEnd: 86, filter: lp(950, 420), trem: { rate: 24, depth: 0.7 } }),
      noise('brown', lp(420), 0.3, 0.16, { a: 0.015 }),
      tone('sawtooth', 98, 0.28, 0.16, { at: 0.3, a: 0.015, freqEnd: 78, filter: lp(850, 380), trem: { rate: 22, depth: 0.7 } }),
      noise('brown', lp(380), 0.2, 0.12, { at: 0.3, a: 0.015 }),
    ],
  },
  // An animal that was hit: a short rising-then-falling squeal, distinct from the player's own 'hurt'.
  mob_hurt: {
    jitter: 1.5,
    layers: [
      tone('sawtooth', 820, 0.2, 0.16, { a: 0.01, freqEnd: 1250, glide: 0.05, filter: lp(3200, 1600) }),
      tone('triangle', 1240, 0.14, 0.12, { at: 0.05, freqEnd: 700 }),
      noise('pink', bp(2100, undefined, 1), 0.22, 0.04),
    ],
  },
} satisfies Record<string, Patch>;
