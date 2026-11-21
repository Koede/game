/** The continuous soundscape: follows an AmbienceState smoothly, building each layer on first use. */
import type { BufferBank } from './buffers';
import { type AmbienceLayer, buildArc, buildFire, buildIgnition, buildMachine, buildNight, buildWater, buildWind, Follow, Rig } from './ambienceLayers';
import { type AmbienceState, type AmbienceTargets, computeTargets, createAmbienceTargets } from './ambienceState';
import { buildGusts, buildRain } from './ambienceWeather';
import { MUFFLE_OPEN_HZ } from './master';
import type { AudioCtxLike, FilterLike, NodeLike } from './types';

interface Slot {
  /** A layer is only built once its level first rises above zero. */
  level: (t: AmbienceTargets) => number;
  build: (rig: Rig) => AmbienceLayer;
  layer: AmbienceLayer | null;
}

/** Parameters glide, so there is nothing to gain from re-targeting them more often than this. */
const UPDATE_INTERVAL_S = 0.04;

export class Ambience {
  private readonly rig: Rig;
  private readonly targets = createAmbienceTargets();
  private readonly muffle: Follow;
  private readonly slots: Slot[] = [
    { level: (t) => t.fire, build: buildFire, layer: null },
    { level: (t) => t.arc, build: buildArc, layer: null },
    { level: (t) => t.machine, build: buildMachine, layer: null },
    { level: (t) => t.wind, build: buildWind, layer: null },
    { level: (t) => t.night, build: buildNight, layer: null },
    { level: (t) => t.water, build: buildWater, layer: null },
    { level: (t) => t.ignition, build: buildIgnition, layer: null },
    { level: (t) => t.rain, build: buildRain, layer: null },
    { level: (t) => t.gust, build: buildGusts, layer: null },
  ];
  private lastUpdate = -Infinity;

  /** `muffle` is the world bus low-pass: closing it is how being under water sounds. */
  constructor(ctx: AudioCtxLike, bank: BufferBank, out: NodeLike, muffle: FilterLike) {
    this.rig = new Rig(ctx, bank, out);
    this.muffle = new Follow(muffle.frequency, 0.08, MUFFLE_OPEN_HZ);
  }

  /** Cheap enough to call every frame: no allocation, and no audio work unless something changed. */
  update(state: AmbienceState, now: number): void {
    if (now - this.lastUpdate < UPDATE_INTERVAL_S) return;
    this.lastUpdate = now;
    const t = computeTargets(state, this.targets);
    this.muffle.to(t.muffle, now);
    for (const slot of this.slots) {
      if (!slot.layer) {
        if (slot.level(t) <= 0) continue;
        slot.layer = slot.build(this.rig);
      }
      slot.layer.apply(t, now);
    }
  }

  dispose(): void {
    this.rig.dispose();
    for (const slot of this.slots) slot.layer = null;
  }
}
