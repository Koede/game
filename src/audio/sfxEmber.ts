/**
 * Patches for the Emberbound automatons (spec 19.5): heavy, metallic, hissing with embers. The telegraph
 * (automaton_windup) and the attacks are pitched into the 1-4 kHz band so a phone speaker carries them; the weight
 * of the low layers is there for headphones and is never the only thing that tells the player what happened.
 */
import type { Patch } from './patch';
import { bell, bp, hp, lp, noise, tone } from './sfxKit';

export const EMBER_SFX = {
  // One footfall: a dull iron thud and the clank of loose plate. Played often, so short and jittered.
  automaton_step: {
    jitter: 2,
    layers: [
      tone('triangle', 120, 0.34, 0.12, { freqEnd: 70 }),
      tone('sine', 520, 0.16, 0.16, { at: 0.005, fm: { ratio: 2.76, index: 2.4 } }),
      noise('white', bp(2400, undefined, 1.2), 0.16, 0.035),
      tone('sine', 880, 0.07, 0.09, { at: 0.03, fm: { ratio: 3.17, index: 1.5 } }),
    ],
  },
  // Waking: gears whirr up through a rising filter while embers catch with a hiss, then a little ping of readiness.
  automaton_wake: {
    jitter: 1,
    layers: [
      tone('sawtooth', 90, 0.2, 0.25, { a: 0.55, freqEnd: 260, glide: 0.55, filter: lp(420, 2600), trem: { rate: 18, depth: 0.45 } }),
      noise('pink', bp(1400, 3200, 1.1), 0.32, 0.35, { at: 0.12, a: 0.4 }),
      noise('white', hp(3600), 0.12, 0.3, { at: 0.2, a: 0.3, trem: { rate: 31, depth: 0.7 } }),
      tone('sine', 1250, 0.13, 0.25, { at: 0.62, fm: { ratio: 2.01, index: 1.2 } }),
    ],
  },
  // The telegraph: a bellows inhale and a rising hiss that swell to the moment the attack is released. Loud in the
  // band a phone speaker plays; priority so it is never the voice dropped in a crowd.
  automaton_windup: {
    priority: 1,
    layers: [
      noise('white', bp(650, 3400, 1.6), 0.55, 0.12, { a: 0.5 }),
      tone('sawtooth', 220, 0.2, 0.1, { a: 0.5, freqEnd: 660, filter: lp(900, 3200), trem: { rate: 22, depth: 0.4 } }),
      tone('sine', 1400, 0.14, 0.08, { a: 0.5, freqEnd: 2500 }),
      noise('pink', lp(500), 0.25, 0.1, { a: 0.45 }),
    ],
  },
  // A blow lands: an iron thump under a ringing clang.
  automaton_attack: {
    priority: 1,
    jitter: 1,
    layers: [
      tone('triangle', 150, 0.5, 0.2, { freqEnd: 60 }),
      noise('brown', lp(950, 300), 0.5, 0.24),
      tone('sine', 340, 0.26, 0.45, { fm: { ratio: 1.41, index: 3 } }),
      noise('white', bp(3000, undefined, 1), 0.34, 0.05),
      tone('sine', 1720, 0.1, 0.3, { at: 0.01, fm: { ratio: 2.76, index: 1.2 } }),
    ],
  },
  // A kiln sentry coughs out an ember bolt: a throaty whoosh that rises as it leaves, with crackle riding on it.
  ember_bolt: {
    jitter: 1.5,
    layers: [
      tone('sine', 95, 0.32, 0.13, { freqEnd: 48 }),
      noise('pink', bp(420, 1900, 0.9), 0.5, 0.42, { a: 0.06 }),
      noise('white', hp(3200), 0.18, 0.38, { at: 0.03, a: 0.04, trem: { rate: 37, depth: 0.85 } }),
    ],
  },
  // An arc drone strikes: a sharp crack, a falling electric whine and a short angry buzz, then a second snap.
  arc_zap: {
    jitter: 1.5,
    layers: [
      noise('white', hp(2600), 0.5, 0.03),
      tone('square', 2600, 0.1, 0.09, { freqEnd: 900 }),
      tone('sawtooth', 115, 0.24, 0.28, { a: 0.01, filter: lp(3400, 1200), trem: { rate: 50, depth: 0.6 } }),
      noise('white', bp(5200, undefined, 1.5), 0.3, 0.025, { at: 0.09 }),
    ],
  },
  // The player's blow rings off automaton plate.
  automaton_hurt: {
    jitter: 1.5,
    layers: [
      tone('sine', 680, 0.28, 0.32, { fm: { ratio: 2.76, index: 3 } }),
      tone('triangle', 210, 0.24, 0.06, { freqEnd: 120 }),
      noise('white', bp(4200, undefined, 1.4), 0.26, 0.03),
    ],
  },
  // An automaton breaks apart: a crash of plates, a last clang, the core going out, and scrap tinkling down.
  automaton_break: {
    priority: 1,
    layers: [
      noise('brown', lp(1500, 200), 0.6, 0.6),
      noise('white', bp(2500, 1200, 0.9), 0.4, 0.2),
      tone('sine', 420, 0.24, 0.5, { fm: { ratio: 1.41, index: 2.6 } }),
      tone('sine', 72, 0.32, 0.3, { freqEnd: 40 }),
      noise('pink', bp(1800, 500, 1), 0.18, 0.45, { at: 0.05, a: 0.05 }),
      bell(2400, 0.1, 0.2, 0.16, 2),
      bell(3150, 0.08, 0.18, 0.28, 2),
      bell(2050, 0.08, 0.2, 0.39, 2),
      bell(3620, 0.06, 0.16, 0.52, 2),
    ],
  },
} satisfies Record<string, Patch>;
