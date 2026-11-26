/**
 * Sounds of exploration and companions: fishing (cast, bite, landing), stepping through a waypoint stone, a buried treasure
 * crate turning up, and a stray animal deciding to trust you. Short and mid-band so a phone speaker carries them.
 * The town's festival, gossip and sparring sounds belong to src/npcs and are not here.
 */
import type { Patch } from './patch';
import { bell, bp, hp, lp, noise, tone } from './sfxKit';

export const EXPLORE_SFX = {
  // The line whips out and the float plops onto the water.
  fish_cast: {
    jitter: 2,
    layers: [
      noise('white', bp(2600, 900, 1.4), 0.12, 0.18, { a: 0.01 }),
      tone('sine', 420, 0.2, 0.08, { at: 0.2, a: 0.004, freqEnd: 260 }),
      noise('pink', lp(900), 0.12, 0.08, { at: 0.2, a: 0.004 }),
    ],
  },
  // The float ducks under: a quick gulp and a tug on the line.
  fish_bite: {
    jitter: 1.5,
    layers: [
      tone('sine', 300, 0.26, 0.1, { a: 0.003, freqEnd: 140 }),
      noise('pink', bp(1200, 500, 1.2), 0.14, 0.1, { a: 0.004 }),
      tone('triangle', 880, 0.08, 0.05, { at: 0.08, a: 0.002, freqEnd: 1200 }),
    ],
  },
  // A fish comes out of the water: a splash and two wet flaps.
  fish_land: {
    jitter: 2,
    layers: [
      noise('white', bp(1800, 600, 0.9), 0.2, 0.22, { a: 0.005 }),
      noise('pink', bp(700, undefined, 2), 0.14, 0.05, { at: 0.24, a: 0.002 }),
      noise('pink', bp(760, undefined, 2), 0.12, 0.05, { at: 0.36, a: 0.002 }),
    ],
  },
  // Through the stone: a low hum swelling upwards and a soft high chime on arrival.
  waypoint_travel: {
    jitter: 0.5,
    layers: [
      tone('sine', 110, 0.22, 0.7, { a: 0.25, freqEnd: 220 }),
      tone('triangle', 220, 0.08, 0.6, { a: 0.3, freqEnd: 440, filter: lp(1200) }),
      noise('pink', bp(500, 2400, 1), 0.06, 0.6, { a: 0.3 }),
      bell(1318, 0.12, 0.6, 0.55),
    ],
  },
  // A shovel scrape on the crate lid, then a bright three-note flourish.
  treasure_found: {
    jitter: 1,
    layers: [
      noise('white', hp(1800), 0.1, 0.14, { a: 0.01 }),
      bell(1047, 0.12, 0.3, 0.14),
      bell(1319, 0.11, 0.3, 0.22),
      bell(1568, 0.12, 0.45, 0.3),
    ],
  },
  // A small happy chirp, rising twice.
  pet_tamed: {
    jitter: 1.5,
    layers: [
      tone('triangle', 620, 0.16, 0.09, { a: 0.006, freqEnd: 940 }),
      tone('triangle', 700, 0.16, 0.12, { at: 0.13, a: 0.006, freqEnd: 1180 }),
    ],
  },
} satisfies Record<string, Patch>;
