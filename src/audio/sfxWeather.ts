/** Patches for the living world and the weather (spec 13-15): thunder, steam vents, and lava in a bucket. */
import type { Patch } from './patch';
import { bp, hp, lp, noise, tone } from './sfxKit';

export const WEATHER_SFX = {
  // Thunder: a bright crack, then a long low roll that swells and fades in uneven waves. Distant strikes are asked
  // for with a lower volume and pitch (see docs/api/world-content.md), which drops the crack below the roll.
  thunder: {
    priority: 1,
    jitter: 2,
    layers: [
      noise('white', lp(5200, 700), 0.32, 0.28, { a: 0.004 }),
      noise('brown', lp(900, 110), 0.85, 3.1, { a: 0.03 }),
      noise('brown', lp(320, 80), 0.7, 3.4, { at: 0.12, a: 0.3, trem: { rate: 2.6, depth: 0.6 } }),
      noise('pink', bp(240, 90, 0.7), 0.45, 2.6, { at: 0.35, a: 0.25, trem: { rate: 1.7, depth: 0.7 } }),
      tone('sine', 52, 0.38, 2.3, { a: 0.08, freqEnd: 31 }),
    ],
  },
  // A steam vent breathing out: a hissing swell, its sharp top end rising as the jet opens, over a low rush.
  steam_hiss: {
    jitter: 1.5,
    layers: [
      noise('white', hp(2200, 3200), 0.3, 0.75, { a: 0.2, hold: 0.45, curve: 'lin', trem: { rate: 7, depth: 0.25 } }),
      noise('pink', bp(4800, 6200, 0.7), 0.24, 0.8, { a: 0.24, hold: 0.35 }),
      noise('brown', lp(280), 0.2, 0.55, { a: 0.12, hold: 0.3 }),
    ],
  },
  // Lava in a bronze bucket: a thick double glop and a crackling sizzle on the hot metal.
  scoop_lava: {
    jitter: 1.5,
    layers: [
      tone('sine', 150, 0.5, 0.18, { freqEnd: 72 }),
      noise('brown', lp(520, 180), 0.45, 0.22, { a: 0.01 }),
      noise('white', hp(3400), 0.24, 0.42, { at: 0.06, a: 0.04, trem: { rate: 31, depth: 0.7 } }),
      tone('sine', 96, 0.3, 0.14, { at: 0.17, freqEnd: 58 }),
    ],
  },
} satisfies Record<string, Patch>;
