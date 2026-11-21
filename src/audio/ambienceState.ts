/**
 * What the continuous soundscape should be doing right now. The game loop fills in an AmbienceState
 * every frame; `computeTargets` turns it into mixer levels and filter settings. Pure arithmetic, so
 * the mapping is tested without any audio.
 */
import { MUFFLE_OPEN_HZ } from './master';

export interface AmbienceState {
  /** How hot the nearest furnace is, 0 (cold, silent) .. 1 (as hot as it gets). */
  furnaceHeat: number;
  /** Distance to that furnace in blocks. */
  furnaceDistance: number;
  /** That furnace is being heated electrically (arc furnace and above, switched on). */
  furnaceElectric: boolean;
  /** Amount of running machinery nearby, 0..1. */
  machineHum: number;
  /** Altitude / openness to the sky, 0 (sheltered) .. 1 (exposed summit). */
  wind: number;
  night: boolean;
  /** The listener's head is under water. */
  underwater: boolean;
  /** How cold the player is, 0..1: adds a thin whistle to the wind. */
  cold: number;
  /** Starhearth ignition progress, 0 (not igniting) .. 1. */
  ignition: number;
}

/** A silent state. The game loop can keep one of these and mutate it every frame. */
export const createAmbienceState = (): AmbienceState => ({
  furnaceHeat: 0,
  furnaceDistance: 0,
  furnaceElectric: false,
  machineHum: 0,
  wind: 0,
  night: false,
  underwater: false,
  cold: 0,
  ignition: 0,
});

/** Mixer settings derived from an AmbienceState. Levels are 0..1 before each layer's own trim. */
export interface AmbienceTargets {
  /** Fire as a whole: proximity to the furnace. */
  fire: number;
  roar: number;
  roarCutoff: number;
  flame: number;
  flameFreq: number;
  crackle: number;
  crackleDense: number;
  arc: number;
  machine: number;
  wind: number;
  windFreq: number;
  whistle: number;
  night: number;
  water: number;
  /** Cutoff of the world bus low-pass (wide open unless under water). */
  muffle: number;
  ignition: number;
  /** Cents below the final chord; the chord climbs an octave as ignition completes. */
  ignitionDetune: number;
  ignitionCutoff: number;
}

export const createAmbienceTargets = (): AmbienceTargets => ({
  fire: 0,
  roar: 0,
  roarCutoff: 220,
  flame: 0,
  flameFreq: 450,
  crackle: 0,
  crackleDense: 0,
  arc: 0,
  machine: 0,
  wind: 0,
  windFreq: 320,
  whistle: 0,
  night: 0,
  water: 0,
  muffle: MUFFLE_OPEN_HZ,
  ignition: 0,
  ignitionDetune: -1200,
  ignitionCutoff: 400,
});

/** The fire is at full strength within this many blocks and inaudible past FIRE_NEAR + FIRE_RANGE. */
const FIRE_NEAR = 1.5;
const FIRE_RANGE = 20;
export const UNDERWATER_CUTOFF_HZ = 520;

/** Clamps to 0..1; anything that is not a number counts as 0. */
const unit = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/** Writes the targets for `s` into `out` (no allocation) and returns it. */
export function computeTargets(s: AmbienceState, out: AmbienceTargets): AmbienceTargets {
  const heat = unit(s.furnaceHeat);
  const near = unit(1 - (s.furnaceDistance - FIRE_NEAR) / FIRE_RANGE);
  const prox = heat > 0 ? near * near : 0;
  // An electrically heated furnace hums more than it burns.
  const burn = s.furnaceElectric ? 0.45 : 1;

  // Heard from under water the fire is distant as well as muffled.
  out.fire = s.underwater ? prox * 0.35 : prox;
  out.roar = (0.2 + 0.8 * heat) * (s.furnaceElectric ? 0.65 : 1);
  out.roarCutoff = 220 + 1500 * Math.pow(heat, 1.3);
  out.flame = 0.3 + 0.5 * heat;
  out.flameFreq = 450 + 1100 * heat;
  // A young fire already crackles; a hot one adds the dense bed on top.
  out.crackle = Math.min(1, 0.4 + heat * 2) * burn;
  out.crackleDense = heat * burn;
  out.arc = s.furnaceElectric ? out.fire * (0.35 + 0.65 * heat) : 0;

  out.machine = unit(s.machineHum) * (s.underwater ? 0.4 : 1);

  const wind = unit(s.wind);
  const cold = unit(s.cold);
  out.wind = s.underwater ? 0 : wind * (0.5 + 0.5 * wind) * (0.8 + 0.2 * cold);
  out.windFreq = 320 + 520 * wind + 160 * cold;
  out.whistle = s.underwater ? 0 : cold * wind;

  out.night = s.night && !s.underwater ? 1 : 0;
  out.water = s.underwater ? 1 : 0;
  out.muffle = s.underwater ? UNDERWATER_CUTOFF_HZ : MUFFLE_OPEN_HZ;

  const ignition = unit(s.ignition);
  out.ignition = ignition > 0 ? 0.25 + 0.75 * ignition : 0;
  out.ignitionDetune = -1200 * (1 - ignition);
  out.ignitionCutoff = 400 + 4200 * ignition * ignition;
  return out;
}
