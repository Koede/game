/**
 * One-shot sounds are declarative patches: a list of enveloped tone and noise layers. `playPatch`
 * is the only code that turns a patch into audio nodes, so a patch can be inspected and tested
 * without any audio hardware.
 */
import type { BufferBank, NoiseColor } from './buffers';
import type { AudioCtxLike, FilterKind, NodeLike, SourceLike, Wave } from './types';

export interface FilterSpec {
  type: FilterKind;
  freq: number;
  /** Sweep target, reached at the end of the layer. */
  freqEnd?: number;
  q?: number;
}

interface LayerBase {
  /** Start offset in seconds from the beginning of the patch. */
  at?: number;
  /** Peak level. */
  gain: number;
  /** Attack seconds (default 2 ms: enough to avoid a click). */
  a?: number;
  /** Seconds held at the peak before the decay. */
  hold?: number;
  /** Decay seconds down to silence. */
  d: number;
  /** Decay shape: 'exp' rings out naturally (default), 'lin' is an even fade. */
  curve?: 'exp' | 'lin';
  filter?: FilterSpec;
  /** Amplitude wobble: `rate` Hz, `depth` 0..1. */
  trem?: { rate: number; depth: number };
}

export interface ToneLayer extends LayerBase {
  kind: 'tone';
  wave: Wave;
  freq: number;
  /** Pitch glide target, reached after `glide` seconds (default: the layer's whole length). */
  freqEnd?: number;
  glide?: number;
  /** Frequency modulation for bell and metal timbres. `index` decays to nothing over the layer. */
  fm?: { ratio: number; index: number };
}

export interface NoiseLayer extends LayerBase {
  kind: 'noise';
  color?: NoiseColor;
}

export type Layer = ToneLayer | NoiseLayer;

export interface Patch {
  layers: readonly Layer[];
  /** Overall level multiplier. */
  gain?: number;
  /** Random pitch spread in semitones (+-), so repeats do not sound machine-gunned. */
  jitter?: number;
  /** UI sounds bypass the world bus: they are never paused, muffled or positioned. */
  ui?: boolean;
  /** Voices with a higher priority are stolen last and never dropped for a lower one. */
  priority?: number;
}

export interface PlayOptions {
  /** Context time at which the patch begins. */
  when: number;
  gain: number;
  /** Frequency multiplier applied to every tone and filter. */
  pitch: number;
  /** Source of randomness in [0, 1) (which slice of the noise loop a burst plays). */
  random: () => number;
}

export interface PlayedPatch {
  /** Context time at which the last layer has stopped. */
  end: number;
  sources: SourceLike[];
}

const DEFAULT_ATTACK = 0.002;
/** Silence floor for exponential decays (-60 dB), followed by a short linear fade to true zero. */
const FLOOR = 0.001;
const RELEASE = 0.006;
const MIN_FREQ = 20;

export const layerLength = (l: Layer): number => (l.at ?? 0) + (l.a ?? DEFAULT_ATTACK) + (l.hold ?? 0) + l.d + RELEASE;

/** Seconds from the start of a patch until its last layer is silent. */
export function patchDuration(patch: Patch): number {
  let end = 0;
  for (const l of patch.layers) end = Math.max(end, layerLength(l));
  return end;
}

function clampFreq(ctx: AudioCtxLike, f: number): number {
  return Math.min(Math.max(f, MIN_FREQ), ctx.sampleRate * 0.45);
}

/**
 * Builds the nodes for `patch`, connects them to `out` and schedules every start and stop.
 * Layers whose level is zero are skipped entirely.
 */
export function playPatch(ctx: AudioCtxLike, bank: BufferBank, patch: Patch, out: NodeLike, opts: PlayOptions): PlayedPatch {
  const sources: SourceLike[] = [];
  let end = opts.when;
  const level = opts.gain * (patch.gain ?? 1);
  for (const layer of patch.layers) {
    const peak = layer.gain * level;
    if (!(peak > 0)) continue;
    const t0 = opts.when + (layer.at ?? 0);
    const tPeak = t0 + (layer.a ?? DEFAULT_ATTACK);
    const tDecay = tPeak + (layer.hold ?? 0);
    const tEnd = tDecay + layer.d;
    const tStop = tEnd + RELEASE;

    let head: NodeLike;
    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      const f0 = clampFreq(ctx, layer.freq * opts.pitch);
      osc.frequency.setValueAtTime(f0, t0);
      if (layer.freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(clampFreq(ctx, layer.freqEnd * opts.pitch), t0 + (layer.glide ?? tEnd - t0));
      }
      if (layer.fm) {
        const mod = ctx.createOscillator();
        mod.frequency.setValueAtTime(clampFreq(ctx, f0 * layer.fm.ratio), t0);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(layer.fm.index * f0, t0);
        depth.gain.exponentialRampToValueAtTime(Math.max(layer.fm.index * f0 * 0.02, 0.01), tEnd);
        mod.connect(depth);
        depth.connect(osc.frequency);
        mod.start(t0);
        mod.stop(tStop);
        sources.push(mod);
      }
      osc.start(t0);
      osc.stop(tStop);
      sources.push(osc);
      head = osc;
    } else {
      const src = ctx.createBufferSource();
      const buffer = bank.noise(layer.color ?? 'white');
      src.buffer = buffer;
      src.loop = true;
      // A random offset into the loop makes every burst a different slice of noise.
      src.start(t0, opts.random() * Math.max(0, buffer.duration - 0.01));
      src.stop(tStop);
      sources.push(src);
      head = src;
    }

    if (layer.filter) {
      const f = ctx.createBiquadFilter();
      f.type = layer.filter.type;
      f.Q.value = layer.filter.q ?? 0.7;
      f.frequency.setValueAtTime(clampFreq(ctx, layer.filter.freq * opts.pitch), t0);
      if (layer.filter.freqEnd !== undefined) {
        f.frequency.exponentialRampToValueAtTime(clampFreq(ctx, layer.filter.freqEnd * opts.pitch), tEnd);
      }
      head.connect(f);
      head = f;
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, tPeak);
    if (tDecay > tPeak) env.gain.setValueAtTime(peak, tDecay);
    if (layer.curve === 'lin') {
      env.gain.linearRampToValueAtTime(0, tEnd);
    } else {
      env.gain.exponentialRampToValueAtTime(peak * FLOOR, tEnd);
      env.gain.linearRampToValueAtTime(0, tStop);
    }
    head.connect(env);
    head = env;

    if (layer.trem) {
      const wobble = ctx.createGain();
      wobble.gain.value = 1 - layer.trem.depth / 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = layer.trem.rate;
      const depth = ctx.createGain();
      depth.gain.value = layer.trem.depth / 2;
      lfo.connect(depth);
      depth.connect(wobble.gain);
      lfo.start(t0);
      lfo.stop(tStop);
      sources.push(lfo);
      head.connect(wobble);
      head = wobble;
    }

    head.connect(out);
    if (tStop > end) end = tStop;
  }
  return { end, sources };
}
