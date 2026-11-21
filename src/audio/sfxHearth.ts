/** Patches for the furnace, the forge and the machines around it. */
import type { Layer, Patch } from './patch';
import { bell, bp, hp, lp, N, noise, tone } from './sfxKit';

/** A handful of tiny bright pops at irregular moments: the first crackle of a catching fire. */
const firstCrackle = (times: readonly number[]): Layer[] =>
  times.map((at, i) => noise('white', bp(2200 + ((i * 977) % 2600), undefined, 2), 0.14 + (i % 3) * 0.05, 0.012 + (i % 2) * 0.008, { at }));

/** One blast of the klaxon: a filtered square so it warns without drilling. */
const klaxon = (freq: number, at: number): Layer =>
  tone('square', freq, 0.13, 0.04, { at, a: 0.012, hold: 0.2, curve: 'lin', filter: lp(1700, undefined, 1.2) });

export const HEARTH_SFX = {
  craft: {
    jitter: 0.5,
    layers: [
      tone('triangle', 520, 0.26, 0.05),
      noise('white', bp(2000, undefined, 1.5), 0.16, 0.02),
      tone('triangle', 780, 0.24, 0.08, { at: 0.075 }),
      noise('white', bp(2600, undefined, 1.5), 0.12, 0.02, { at: 0.075 }),
    ],
  },
  // Hammer on hot metal: a hard strike, then an inharmonic ring.
  forge: {
    jitter: 1,
    layers: [
      noise('white', hp(2500), 0.4, 0.022),
      tone('triangle', 190, 0.32, 0.06, { freqEnd: 120 }),
      tone('sine', 1480, 0.22, 0.5, { fm: { ratio: 3.51, index: 3 } }),
      tone('sine', 2217, 0.1, 0.35),
      tone('sine', 3740, 0.06, 0.2),
    ],
  },
  // The pour hisses, then the ingot rings bright.
  smelt_done: {
    layers: [
      noise('white', bp(5200, 3800, 1), 0.08, 0.25, { a: 0.03 }),
      bell(N.E6, 0.2, 0.9, 0, 0.5),
      bell(N.A6, 0.16, 0.8, 0.09, 0.5),
      tone('sine', N.E7, 0.08, 0.7, { at: 0.18 }),
    ],
  },
  fuel_add: {
    jitter: 1.5,
    layers: [
      tone('triangle', 165, 0.4, 0.09, { freqEnd: 110 }),
      noise('white', bp(720, undefined, 2), 0.3, 0.06),
      noise('white', hp(3000), 0.06, 0.2, { at: 0.05, a: 0.02 }),
    ],
  },
  // A soft whump of catching fuel that settles into crackle.
  ignite: {
    layers: [
      noise('brown', lp(220, 650), 0.6, 0.5, { a: 0.05 }),
      tone('sine', 70, 0.34, 0.4, { a: 0.04, freqEnd: 112 }),
      noise('pink', bp(800, 1800, 0.8), 0.12, 0.8, { at: 0.15, a: 0.3 }),
      ...firstCrackle([0.25, 0.33, 0.41, 0.52, 0.6, 0.74, 0.9, 1.02]),
    ],
  },
  bellows: {
    jitter: 1,
    layers: [
      noise('pink', bp(420, 1500, 0.8), 0.42, 0.4, { a: 0.15, hold: 0.08 }),
      noise('white', hp(2600), 0.07, 0.35, { a: 0.2 }),
      tone('sine', 82, 0.12, 0.4, { a: 0.1, freqEnd: 64 }),
    ],
  },
  fire_out: {
    layers: [
      noise('white', bp(5200, 800, 0.8), 0.24, 0.7, { a: 0.01 }),
      tone('sine', 200, 0.14, 0.5, { freqEnd: 70 }),
    ],
  },
  machine_on: {
    layers: [
      noise('white', hp(1800), 0.2, 0.015),
      tone('sawtooth', 60, 0.16, 0.2, { a: 0.05, hold: 0.25, freqEnd: 180, glide: 0.4, filter: lp(800) }),
      tone('sine', 440, 0.08, 0.1, { at: 0.32, freqEnd: 660 }),
    ],
  },
  machine_off: {
    layers: [
      noise('white', hp(1800), 0.18, 0.015),
      tone('sawtooth', 180, 0.16, 0.5, { freqEnd: 48, filter: lp(700) }),
    ],
  },
  machine_done: {
    layers: [
      tone('triangle', 150, 0.22, 0.05),
      bell(N.G6, 0.17, 0.4, 0.02, 0.8),
      bell(N.C7, 0.13, 0.5, 0.14, 0.8),
    ],
  },
  spark: {
    jitter: 2,
    layers: [
      noise('white', hp(3500), 0.3, 0.05),
      tone('sawtooth', 1800, 0.11, 0.06, { freqEnd: 300 }),
      noise('white', bp(6000, undefined, 2), 0.2, 0.03, { at: 0.05 }),
    ],
  },
  alarm: {
    priority: 1,
    layers: [klaxon(622, 0), klaxon(466, 0.25), klaxon(622, 0.5), klaxon(466, 0.75)],
  },
  // The Starhearth drawing power: a drone that swells and brightens.
  ignition: {
    priority: 1,
    layers: [
      tone('sawtooth', 55, 0.2, 1.2, { a: 2.5, hold: 0.5, filter: lp(200, 1400) }),
      tone('sine', 110, 0.22, 1.2, { a: 2.2, hold: 0.8 }),
      tone('sine', 165, 0.12, 1.2, { at: 0.8, a: 1.9, hold: 0.5, freqEnd: 220, glide: 2.4 }),
      noise('pink', bp(300, 2500, 0.9), 0.1, 1.0, { a: 3.0 }),
    ],
  },
} satisfies Record<string, Patch>;
