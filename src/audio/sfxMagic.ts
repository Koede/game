/**
 * Sounds of Essentia & Research (docs/api/magic.md): soft glassy chimes and hums, kept short and in the mid band so a
 * phone speaker carries them. The rod hum repeats while Use is held (about 5 a second), so it is quiet and brief.
 */
import type { Patch } from './patch';
import { bp, hp, noise, tone } from './sfxKit';

export const MAGIC_SFX = {
  // A notebook scan: two bell partials a fifth apart, a glassy shimmer on top.
  scan_chime: {
    jitter: 1,
    layers: [
      tone('sine', 1320, 0.22, 0.35, { a: 0.004 }),
      tone('sine', 1980, 0.12, 0.3, { at: 0.05, a: 0.004 }),
      noise('white', hp(6000), 0.04, 0.12, { a: 0.01 }),
    ],
  },
  // Essentia poured into a jar: a breathy glass gurgle rising in pitch.
  essentia_pour: {
    jitter: 2,
    layers: [
      noise('pink', bp(1400, 900, 1.2), 0.3, 0.22, { a: 0.02, trem: { rate: 18, depth: 0.6 } }),
      tone('sine', 660, 0.14, 0.25, { freqEnd: 990 }),
    ],
  },
  // The rod drawing from the land: a soft rising hum with a faint airy edge.
  rod_hum: {
    jitter: 3,
    layers: [
      tone('triangle', 420, 0.12, 0.16, { a: 0.02, freqEnd: 520 }),
      noise('white', bp(3000, 1500, 1), 0.04, 0.12, { a: 0.03 }),
    ],
  },
  // A research board solved: a little rising arpeggio of three bells.
  research_solve: {
    jitter: 0,
    layers: [
      tone('sine', 880, 0.2, 0.3, { a: 0.003 }),
      tone('sine', 1109, 0.2, 0.3, { at: 0.09, a: 0.003 }),
      tone('sine', 1319, 0.24, 0.45, { at: 0.18, a: 0.003 }),
    ],
  },
  // An infusion or an arcane craft: a low swell with a bright glass ring over it.
  infuse: {
    jitter: 1,
    layers: [
      tone('sawtooth', 110, 0.12, 0.6, { a: 0.15, freqEnd: 165, filter: bp(600, 400, 1) }),
      tone('sine', 1760, 0.12, 0.5, { at: 0.2, a: 0.01, fm: { ratio: 1.5, index: 0.6 } }),
      noise('white', hp(5000), 0.05, 0.4, { a: 0.1 }),
    ],
  },
  // A focus cast: a quick whoosh and a bright zing.
  cast: {
    jitter: 2,
    layers: [
      noise('white', bp(2200, 1800, 1.4), 0.32, 0.18, { a: 0.01, curve: 'lin' }),
      tone('sine', 1500, 0.18, 0.14, { freqEnd: 2600 }),
    ],
  },
} satisfies Record<string, Patch>;
