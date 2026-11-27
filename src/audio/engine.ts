/**
 * The game's sound: plays the one-shots requested over the bus and drives the continuous ambience.
 * Nothing here can throw into the game: without a usable AudioContext the engine is simply silent.
 */
import type { GameBus, Settings } from '../core/context';
import type { GameEvents, SfxName } from '../core/gameEvents';
import { Ambience } from './ambience';
import type { AmbienceState } from './ambienceState';
import { BufferBank } from './buffers';
import { bindEventCues } from './eventCues';
import { createMasterChain, type MasterChain } from './master';
import { playPatch } from './patch';
import { SFX } from './sfx';
import type { GainLike, NodeLike, RealtimeCtxLike, SourceLike } from './types';

export interface AudioEngineOptions {
  /** Supplies the audio context (tests pass a fake). Returning null means "no audio here". */
  createContext?: () => RealtimeCtxLike | null;
  /** Source of randomness in [0, 1) for pitch variation. */
  random?: () => number;
}

export type SfxRequest = GameEvents['sfx'];

interface Voice {
  end: number;
  priority: number;
  out: GainLike;
  /** Last node of the voice, the one connected to a bus. */
  tail: NodeLike;
  sources: SourceLike[];
}

/** Simultaneous one-shots; beyond this the oldest, least important voice is cut short. */
export const MAX_VOICES = 24;
/** The same sound requested again within this many seconds is ignored. */
export const REPEAT_GUARD_S = 0.03;
/** Positioned sounds further than this many blocks from the listener are not played. */
export const HEARING_RANGE = 24;
/** Sounds closer than this are at full level. */
const FULL_LEVEL_RANGE = 2;
const MAX_PAN = 0.8;
/**
 * Level of the master bus at full volume. The compressor adds about 3 dB of make-up gain, so this
 * lands a lone sound at roughly the level its patch states.
 */
const MASTER_TRIM = 0.7;
const STEAL_FADE_S = 0.05;

function defaultContext(): RealtimeCtxLike | null {
  const scope = globalThis as { AudioContext?: new () => RealtimeCtxLike; webkitAudioContext?: new () => RealtimeCtxLike };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export class AudioEngine {
  private ctx: RealtimeCtxLike | null = null;
  private chain: MasterChain | null = null;
  private bank: BufferBank | null = null;
  private ambience: Ambience | null = null;
  /** Set when audio is unavailable or the engine was disposed: every call becomes a no-op. */
  private dead = false;
  private paused = false;
  private ambienceOut: GainLike | null = null;
  private warned = false;
  private readonly voices: Voice[] = [];
  /** Stolen voices fading out; kept only so they can be disconnected afterwards. */
  private readonly fading: Voice[] = [];
  private readonly lastPlayed = new Map<SfxName, number>();
  private readonly unsubscribe: Array<() => void>;
  private readonly createContext: () => RealtimeCtxLike | null;
  private readonly random: () => number;
  private lx = 0;
  private ly = 0;
  private lz = 0;
  private yawCos = 1;
  private yawSin = 0;

  constructor(bus: GameBus, private readonly settings: Settings, options: AudioEngineOptions = {}) {
    this.createContext = options.createContext ?? defaultContext;
    this.random = options.random ?? Math.random;
    this.unsubscribe = [
      bus.on('sfx', (request) => this.play(request)),
      bindEventCues(bus),
      bus.on('settings:changed', () => this.applyVolume()),
      bus.on('game:paused', ({ paused }) => {
        this.paused = paused;
        this.applyPause();
      }),
    ];
  }

  /** True once sound can actually be heard (a context exists and is running). */
  get running(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** One-shots currently sounding (as of the last sound played or ambience update). */
  get activeVoices(): number {
    return this.voices.length;
  }

  /**
   * Creates the audio context on first use and resumes it. Browsers only allow this inside a user
   * gesture; it is safe (and useful, phones suspend audio) to call it on every tap and key press.
   */
  resume(): void {
    if (this.dead) return;
    try {
      if (!this.ctx) {
        const ctx = this.createContext();
        if (!ctx) {
          this.dead = true;
          return;
        }
        this.chain = createMasterChain(ctx);
        this.bank = new BufferBank(ctx);
        this.ctx = ctx;
        this.chain.master.gain.value = this.masterLevel();
        this.chain.world.gain.value = this.paused ? 0 : 1;
      }
      if (this.ctx.state !== 'running') {
        const resumed = this.ctx.resume();
        if (resumed) resumed.catch(() => undefined);
      }
    } catch (err) {
      this.fail(err);
    }
  }

  /**
   * Where the player's ears are. Yaw is in radians, 0 looking north (-Z), increasing to the left
   * (counter-clockwise seen from above), i.e. the camera's rotation about +Y.
   */
  setListener(x: number, y: number, z: number, yaw: number): void {
    this.lx = x;
    this.ly = y;
    this.lz = z;
    this.yawCos = Math.cos(yaw);
    this.yawSin = Math.sin(yaw);
  }

  /** Describes the surroundings; the continuous layers glide towards it. Call every frame. */
  setAmbience(state: AmbienceState): void {
    const ctx = this.ctx;
    if (!ctx || !this.chain || !this.bank || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      if (this.voices.length > 0 || this.fading.length > 0) this.prune(now);
      if (!this.ambience) {
        // The first few calls only pre-generate sample data, one buffer per frame.
        if (this.settings.volume <= 0 || !this.bank.warm()) return;
        this.ambienceOut = ctx.createGain();
        this.ambienceOut.gain.value = this.mix('ambienceVolume');
        this.ambienceOut.connect(this.chain.world);
        this.ambience = new Ambience(ctx, this.bank, this.ambienceOut, this.chain.muffle);
      }
      this.ambience.update(state, now);
    } catch (err) {
      this.warn(err);
    }
  }

  /** Plays a one-shot. This is what an 'sfx' event on the bus does. */
  play(request: SfxRequest): void {
    const ctx = this.ctx;
    if (!ctx || !this.chain || !this.bank || ctx.state !== 'running') return;
    const patch: (typeof SFX)[SfxName] | undefined = SFX[request.name];
    if (!patch) return;
    const ui = patch.ui === true;
    if (this.paused && !ui) return;
    const volume = request.volume === undefined ? 1 : request.volume > 0 ? Math.min(request.volume, 2) : 0;
    if (this.settings.volume <= 0 || volume <= 0) return;

    try {
      const now = ctx.currentTime;
      const last = this.lastPlayed.get(request.name);
      if (last !== undefined && now - last >= 0 && now - last < REPEAT_GUARD_S) return;

      let gain = volume * (ui ? 1 : this.mix(request.name === 'jukebox_note' ? 'musicVolume' : 'effectsVolume'));
      let pan = 0;
      if (!ui && request.x !== undefined && request.y !== undefined && request.z !== undefined) {
        const dx = request.x - this.lx;
        const dy = request.y - this.ly;
        const dz = request.z - this.lz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(dist <= HEARING_RANGE)) return;
        const a = Math.min(1, 1 - (dist - FULL_LEVEL_RANGE) / (HEARING_RANGE - FULL_LEVEL_RANGE));
        gain *= a * a;
        pan = ((dx * this.yawCos - dz * this.yawSin) / Math.max(dist, 1)) * MAX_PAN;
      }
      if (!(gain > 0)) return;

      this.prune(now);
      const priority = patch.priority ?? 0;
      if (this.voices.length >= MAX_VOICES && !this.steal(priority, now)) return;
      this.lastPlayed.set(request.name, now);

      const requested = request.pitch !== undefined && request.pitch > 0 && Number.isFinite(request.pitch) ? request.pitch : 1;
      const jitter = patch.jitter ? Math.pow(2, ((this.random() * 2 - 1) * patch.jitter) / 12) : 1;
      const pitch = Math.min(4, Math.max(0.25, requested)) * jitter;

      const out = ctx.createGain();
      out.gain.value = gain;
      let tail: NodeLike = out;
      if (pan !== 0 && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        out.connect(panner);
        tail = panner;
      }
      tail.connect(ui ? this.chain.ui : this.chain.world);
      const played = playPatch(ctx, this.bank, patch, out, { when: now, gain: 1, pitch, random: this.random });
      this.voices.push({ end: played.end, priority, out, tail, sources: played.sources });
    } catch (err) {
      this.warn(err);
    }
  }

  /** Stops everything and releases the audio context. The engine is inert afterwards. */
  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.dead = true;
    const ctx = this.ctx;
    this.ctx = null;
    try {
      this.ambience?.dispose();
      for (const v of this.voices) this.silence(v);
      for (const v of this.fading) this.silence(v);
      this.chain?.dispose();
      const closed = ctx?.close();
      if (closed) closed.catch(() => undefined);
    } catch (err) {
      this.warn(err);
    }
    this.voices.length = 0;
    this.fading.length = 0;
    this.ambience = null;
    this.ambienceOut = null;
    this.chain = null;
    this.bank = null;
  }

  /** The volume slider is squared so that it feels even to the ear. */
  private masterLevel(): number {
    const v = Math.min(1, Math.max(0, this.settings.volume));
    return Number.isFinite(v) ? v * v * MASTER_TRIM : 0;
  }

  /** A mixer slider (effects, music, ambience) as a 0..1 level; old settings without it count as full. */
  private mix(key: 'effectsVolume' | 'musicVolume' | 'ambienceVolume'): number {
    const v = this.settings[key];
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  }

  private applyVolume(): void {
    if (!this.ctx || !this.chain) return;
    try {
      this.ambienceOut?.gain.setTargetAtTime(this.mix('ambienceVolume'), this.ctx.currentTime, 0.03);
      this.chain.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.03);
    } catch (err) {
      this.warn(err);
    }
  }

  private applyPause(): void {
    if (!this.ctx || !this.chain) return;
    try {
      this.chain.world.gain.setTargetAtTime(this.paused ? 0 : 1, this.ctx.currentTime, 0.05);
    } catch (err) {
      this.warn(err);
    }
  }

  /** Makes room for a new voice by cutting the oldest of the least important ones. */
  private steal(priority: number, now: number): boolean {
    let victim = -1;
    for (let i = 0; i < this.voices.length; i++) {
      const p = this.voices[i].priority;
      if (p <= priority && (victim < 0 || p < this.voices[victim].priority)) victim = i;
    }
    if (victim < 0) return false;
    const v = this.voices[victim];
    this.voices.splice(victim, 1);
    v.out.gain.setTargetAtTime(0, now, STEAL_FADE_S / 5);
    v.end = now + STEAL_FADE_S;
    for (const s of v.sources) s.stop(v.end);
    this.fading.push(v);
    return true;
  }

  /** Drops finished voices and unhooks them from the graph. */
  private prune(now: number): void {
    for (const list of [this.voices, this.fading] as const) {
      let kept = 0;
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (v.end > now) list[kept++] = v;
        else v.tail.disconnect();
      }
      list.length = kept;
    }
  }

  private silence(v: Voice): void {
    for (const s of v.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    v.tail.disconnect();
  }

  private fail(err: unknown): void {
    this.dead = true;
    this.ctx = null;
    this.chain = null;
    this.bank = null;
    this.warn(err);
  }

  private warn(err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn('[audio] disabled a sound after an error', err);
  }
}
