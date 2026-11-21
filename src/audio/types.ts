/**
 * The slice of the Web Audio API this module uses, as structural interfaces. A real AudioContext or
 * OfflineAudioContext satisfies them, and so does the tiny recording fake the unit tests run against,
 * which is what keeps every sound definition testable in node.
 */

export interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(target: number, time: number, timeConstant: number): unknown;
}

export interface NodeLike {
  connect(destination: NodeLike | ParamLike): unknown;
  disconnect(): void;
}

export interface SourceLike extends NodeLike {
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

export interface OscLike extends SourceLike {
  type: string;
  frequency: ParamLike;
  detune: ParamLike;
}

export interface BufferLike {
  readonly length: number;
  readonly duration: number;
  getChannelData(channel: number): Float32Array;
}

export interface BufferSourceLike extends SourceLike {
  buffer: BufferLike | null;
  loop: boolean;
  playbackRate: ParamLike;
}

export interface GainLike extends NodeLike {
  gain: ParamLike;
}

export interface FilterLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  Q: ParamLike;
}

export interface PannerLike extends NodeLike {
  pan: ParamLike;
}

export interface CompressorLike extends NodeLike {
  threshold: ParamLike;
  knee: ParamLike;
  ratio: ParamLike;
  attack: ParamLike;
  release: ParamLike;
}

export interface ShaperLike extends NodeLike {
  curve: Float32Array | null;
}

/** What sounds are rendered into: shared by realtime, offline and fake contexts. */
export interface AudioCtxLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: NodeLike;
  createOscillator(): OscLike;
  createBufferSource(): BufferSourceLike;
  createGain(): GainLike;
  createBiquadFilter(): FilterLike;
  createDynamicsCompressor(): CompressorLike;
  createWaveShaper(): ShaperLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  /** Missing in some older mobile browsers; everything falls back to centred mono without it. */
  createStereoPanner?: () => PannerLike;
}

/** A context that plays to the speakers and therefore has a lifecycle. */
export interface RealtimeCtxLike extends AudioCtxLike {
  readonly state: string;
  resume(): Promise<void> | void;
  close(): Promise<void> | void;
}
