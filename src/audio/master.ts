/**
 * The output stage every sound passes through:
 *
 *   world bus -> muffle (underwater low-pass) -+
 *                                              +-> master gain -> compressor -> soft clip -> speakers
 *   ui bus ------------------------------------+
 */
import type { AudioCtxLike, FilterLike, GainLike, NodeLike } from './types';

export interface MasterChain {
  /** Volume control; everything below it is level-independent protection. */
  master: GainLike;
  /** World sounds and ambience: silenced while paused, muffled under water. */
  world: GainLike;
  /** Interface sounds: always audible. */
  ui: GainLike;
  muffle: FilterLike;
  dispose(): void;
}

/** Fully open cutoff of the muffle filter. */
export const MUFFLE_OPEN_HZ = 18000;

/** The soft clipper sees the signal at half level, so its curve covers inputs up to +-2. */
const CLIP_HEADROOM = 2;
const CLIP_KNEE = 0.7;
const CLIP_CEILING = 0.95;

/** Transparent below the knee, then bends smoothly towards the ceiling: output can never clip. */
export function softClip(x: number): number {
  const a = Math.abs(x);
  if (a <= CLIP_KNEE) return x;
  const span = CLIP_CEILING - CLIP_KNEE;
  return Math.sign(x) * (CLIP_KNEE + span * Math.tanh((a - CLIP_KNEE) / span));
}

export function softClipCurve(points = 2049): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) curve[i] = softClip(((i / (points - 1)) * 2 - 1) * CLIP_HEADROOM);
  return curve;
}

export function createMasterChain(ctx: AudioCtxLike, destination: NodeLike = ctx.destination): MasterChain {
  const master = ctx.createGain();
  const world = ctx.createGain();
  const ui = ctx.createGain();
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = MUFFLE_OPEN_HZ;
  muffle.Q.value = 0.5;

  // Gentle bus compression keeps a pile-up of sounds comfortable; the clipper is the hard guarantee.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;

  const pre = ctx.createGain();
  pre.gain.value = 1 / CLIP_HEADROOM;
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();

  world.connect(muffle);
  muffle.connect(master);
  ui.connect(master);
  master.connect(comp);
  comp.connect(pre);
  pre.connect(clip);
  clip.connect(destination);

  return {
    master,
    world,
    ui,
    muffle,
    dispose() {
      for (const node of [world, muffle, ui, master, comp, pre, clip]) node.disconnect();
    },
  };
}
