/**
 * The weather of one world (spec 15). The sky follows the seed's timetable (weatherSchedule.ts) at the elapsed
 * world time, so it needs no saving to stay consistent; the snapshot still keeps the state, a debug override and
 * the lightning counters. Each tick fills one WeatherState that the simulation, renderer, audio and HUD read.
 *
 * Also here: the shared rules everyone needs to ask "does it rain on this spot?" (falling kind, intensity, open
 * sky), so the furnace, the crops, survival and the renderer agree.
 */
import {
  LIGHTNING_MAX_DIST, LIGHTNING_MAX_S, LIGHTNING_MIN_DIST, LIGHTNING_MIN_S, SOUND_SPEED, WEATHER_CLOUD_COVER,
  WEATHER_INTENSITY, WEATHER_MAX_S,
} from '../core/constants';
import type { GameBus } from '../core/context';
import { clamp, hashFloat, smoothstep } from '../core/math';
import { blockOf } from '../core/registry';
import { WORLD_HEIGHT, type BiomeKey, type IWorld, type Precipitation, type WeatherKind, type WeatherState } from '../core/types';
import { isWet, moonPhase, precipitationFor, weatherValue } from '../core/weather';
import { WEATHER_KINDS, WeatherSchedule } from './weatherSchedule';

export type WeatherBiomeLookup = (x: number, z: number) => BiomeKey;

/** A debug override (`force`): the sky holds `kind` until `untilS`, then eases back to the timetable. */
export interface ForcedWeather {
  kind: WeatherKind;
  previous: WeatherKind;
  startS: number;
  blendS: number;
  untilS: number;
}

export interface WeatherSnapshot {
  state: WeatherState;
  forced: ForcedWeather | null;
  /** Lightning flashes so far (the index of the next flash's random numbers) and when the next one is due. */
  flashes: number;
  nextFlashS: number;
}

/** A forced state lasts as long as the longest natural one, eases in over FORCED_BLEND_S and back out over RELEASE_BLEND_S. */
export const FORCED_WEATHER_S = WEATHER_MAX_S;
export const FORCED_BLEND_S = 8;
export const RELEASE_BLEND_S = 30;
/** When what falls changes underfoot (walking from the dunes into the woods), the old fades out and the new in over this long. */
export const PRECIP_FADE_S = 2;
/** Seconds between biome samples at the player. */
export const BIOME_SAMPLE_S = 0.5;
/** A storm flashes while it is at least this far into the sky (storm weight 0..1). */
export const LIGHTNING_FROM = 0.5;
/** Thunder that is overdue by more than this (time jumped: a night was rested through) is dropped. */
const THUNDER_STALE_S = 10;

const WET_KIND = (k: WeatherKind): boolean => k === 'rain' || k === 'storm';

export const createWeatherState = (): WeatherState => ({
  kind: 'clear', previous: 'clear', blend: 1, precipitation: 'none', intensity: 0,
  cloudCover: WEATHER_CLOUD_COVER.clear, moonPhase: moonPhase(0), next: 'clear', nextInS: 0,
});

/** The state whose precipitation is falling: the wet one of the two being blended (rain while it clears up). */
export function fallingKind(w: Pick<WeatherState, 'kind' | 'previous'>): WeatherKind {
  if (WET_KIND(w.kind)) return w.kind;
  return WET_KIND(w.previous) ? w.previous : w.kind;
}

/** Strength 0..1 of whatever falls, before any local fade: WEATHER_INTENSITY eased across the change. */
export const skyIntensity = (w: Pick<WeatherState, 'kind' | 'previous' | 'blend'>): number => weatherValue(WEATHER_INTENSITY, w);

/** How much of a storm the sky holds, 0..1 (lightning, gusts). */
export function stormLevel(w: Pick<WeatherState, 'kind' | 'previous' | 'blend'>): number {
  const into = w.kind === 'storm' ? w.blend : 0;
  const from = w.previous === 'storm' && w.kind !== 'storm' ? 1 - w.blend : 0;
  return into + from;
}

/** True when rain or snow soaks a place of this biome and height right now (chill, furnace loss, crop water). */
export function wetAt(w: WeatherState, biome: BiomeKey, y: number): boolean {
  return isWet(precipitationFor(fallingKind(w), biome, y), skyIntensity(w));
}

/** Whether a block stops rain: anything solid, or a liquid. Plants, torches and cables let it through. */
const blocksRain = (x: number, y: number, z: number, world: IWorld): boolean => {
  const def = blockOf(world.getVoxel(x, y, z));
  return def.solid || def.liquid !== null;
};

/** No roof anywhere above (x, y, z) up to the top of the world: rain and snow reach this cell. */
export function openSkyAbove(world: IWorld, x: number, y: number, z: number): boolean {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const top = world.surfaceY(bx, bz);
  for (let yy = Math.max(0, Math.floor(y)); yy <= top && yy < WORLD_HEIGHT; yy++) if (blocksRain(bx, yy, bz, world)) return false;
  return true;
}

export class Weather {
  readonly state: WeatherState = createWeatherState();
  readonly schedule: WeatherSchedule;
  private forced: ForcedWeather | null = null;
  private flashes = 0;
  private nextFlashS = -1;
  private readonly thunder: { dueS: number; distance: number }[] = [];
  private biome: BiomeKey = 'woodland';
  private biomeIn = 0;
  /** What falls where the player is, as shown (it fades across a change of kind), and its fade 0..1. */
  private shown: Precipitation = 'none';
  private fade = 0;
  /** The next update settles every fade at once (first update, instant override, load). */
  private settle = true;
  private lastKind: WeatherKind | null = null;
  private timeS = 0;

  constructor(readonly seed: number, private readonly bus: GameBus | null, private readonly biomeAt: WeatherBiomeLookup) {
    this.schedule = new WeatherSchedule(seed);
  }

  /** The debug override, if one is active. */
  get override(): Readonly<ForcedWeather> | null {
    return this.forced;
  }

  /**
   * Brings the state to world time `timeS` (GameClock.worldTimeS) for the player at `place` (feet). `day` is the
   * clock's 1-based day (tonight's moon). `dt` drives local fades; 0 settles them at once.
   */
  update(dt: number, timeS: number, day: number, place: { x: number; y: number; z: number }): void {
    const s = this.state;
    this.timeS = timeS;
    this.sky(timeS, s);
    s.cloudCover = weatherValue(WEATHER_CLOUD_COVER, s);
    s.moonPhase = moonPhase(day - 1);
    this.biomeIn -= dt;
    if (this.settle || this.biomeIn <= 0) {
      this.biomeIn = BIOME_SAMPLE_S;
      this.biome = this.biomeAt(Math.floor(place.x), Math.floor(place.z));
    }
    this.precipitation(dt, precipitationFor(fallingKind(s), this.biome, place.y));
    if (this.lastKind !== null && s.kind !== this.lastKind) this.bus?.emit('weather:changed', { kind: s.kind, previous: s.previous });
    this.lastKind = s.kind;
    this.lightning(timeS);
    this.settle = false;
  }

  /** Biome at the player as last sampled. */
  get biomeHere(): BiomeKey {
    return this.biome;
  }

  /**
   * Debug / tests: the sky turns to `kind` now (over FORCED_BLEND_S, or at once with `instant`) and stays for
   * FORCED_WEATHER_S of world time, then eases back to the timetable. Call `update` afterwards to see it.
   */
  force(kind: WeatherKind, timeS: number, instant = false): void {
    const s = this.state;
    this.forced = { kind, previous: instant ? kind : s.blend >= 0.5 ? s.kind : s.previous, startS: timeS, blendS: instant ? 0 : FORCED_BLEND_S, untilS: timeS + FORCED_WEATHER_S };
    if (instant) this.settle = true;
  }

  /** Ends a debug override at once (the timetable eases back in). */
  release(): void {
    if (this.forced) this.forced.untilS = Math.min(this.forced.untilS, this.timeS);
  }

  toJSON(): WeatherSnapshot {
    return { state: { ...this.state }, forced: this.forced ? { ...this.forced } : null, flashes: this.flashes, nextFlashS: this.nextFlashS };
  }

  /** Restores a snapshot; the state shows as saved until the next update recomputes it from the time. */
  load(s: WeatherSnapshot): void {
    Object.assign(this.state, s.state);
    this.forced = s.forced && WEATHER_KINDS.includes(s.forced.kind) ? { ...s.forced } : null;
    this.flashes = Math.max(0, Math.floor(s.flashes) || 0);
    this.nextFlashS = Number.isFinite(s.nextFlashS) ? s.nextFlashS : -1;
    this.shown = this.state.precipitation;
    this.fade = 1;
    this.lastKind = this.state.kind;
    this.settle = true;
    this.thunder.length = 0;
  }

  // ---- internals --------------------------------------------------------------------------------------------

  /** kind / previous / blend / next / nextInS at time t. */
  private sky(t: number, out: WeatherState): void {
    const sched = this.schedule;
    const f = this.forced;
    if (f && t < f.startS) this.forced = null;
    const seg = sched.at(t);
    if (f && this.forced) {
      if (t < f.untilS) {
        out.kind = f.kind;
        out.previous = f.previous;
        out.blend = f.blendS <= 0 ? 1 : smoothstep(0, 1, (t - f.startS) / f.blendS);
        const after = sched.at(f.untilS);
        out.next = after.kind !== f.kind ? after.kind : sched.nextChange(after, f.kind).kind;
        out.nextInS = after.kind !== f.kind ? f.untilS - t : sched.nextChange(after, f.kind).startS - t;
        return;
      }
      const into = (t - f.untilS) / RELEASE_BLEND_S;
      if (into < 1 && f.kind !== seg.kind) {
        out.kind = seg.kind;
        out.previous = f.kind;
        out.blend = smoothstep(0, 1, into);
        this.nextOf(seg, t, out);
        return;
      }
      this.forced = null;
    }
    const previous = sched.previousKind(seg);
    out.kind = seg.kind;
    out.previous = previous;
    out.blend = previous === seg.kind ? 1 : smoothstep(0, 1, (t - seg.startS) / seg.blendS);
    this.nextOf(seg, t, out);
  }

  private nextOf(seg: ReturnType<WeatherSchedule['at']>, t: number, out: WeatherState): void {
    const next = this.schedule.nextChange(seg, seg.kind);
    out.next = next.kind;
    out.nextInS = Math.max(0, next.startS - t);
  }

  /** What falls at the player: a change of kind fades the old one out before the new one fades in. */
  private precipitation(dt: number, target: Precipitation): void {
    const s = this.state;
    const step = dt / PRECIP_FADE_S;
    if (this.settle || dt <= 0) {
      this.shown = target;
      this.fade = 1;
    } else if (target !== this.shown) {
      this.fade -= step;
      if (this.fade <= 0) {
        this.fade = 0;
        this.shown = target;
      }
    } else this.fade = Math.min(1, this.fade + step);
    s.precipitation = this.shown;
    s.intensity = this.shown === 'none' ? 0 : clamp(skyIntensity(s) * this.fade, 0, 1);
  }

  /** Storm flashes on a deterministic cadence, each followed by its thunder after distance / SOUND_SPEED. */
  private lightning(t: number): void {
    const q = this.thunder;
    for (let i = q.length - 1; i >= 0; i--) {
      const th = q[i];
      if (t < th.dueS) continue;
      q.splice(i, 1);
      if (t - th.dueS > THUNDER_STALE_S) continue;
      const d = th.distance;
      this.bus?.emit('sfx', { name: 'thunder', volume: clamp(1.3 - d / 700, 0.25, 1.2), pitch: 1 - (0.3 * d) / LIGHTNING_MAX_DIST });
    }
    const stormy = stormLevel(this.state) >= LIGHTNING_FROM;
    // Out of a storm (or after time jumped far ahead), the first flash comes one interval after it builds.
    if (!stormy || this.nextFlashS < 0 || t - this.nextFlashS > LIGHTNING_MAX_S) {
      this.nextFlashS = t + this.interval();
      return;
    }
    if (t < this.nextFlashS) return;
    const n = this.flashes++;
    const r = hashFloat(this.seed, n, 0x5a);
    const distance = LIGHTNING_MIN_DIST + r * r * (LIGHTNING_MAX_DIST - LIGHTNING_MIN_DIST);
    const bearing = (hashFloat(this.seed, n, 0x5b) * 2 - 1) * Math.PI;
    this.bus?.emit('weather:lightning', { distance, bearing });
    if (q.length < 8) q.push({ dueS: t + distance / SOUND_SPEED, distance });
    this.nextFlashS = t + this.interval();
  }

  private interval(): number {
    return LIGHTNING_MIN_S + hashFloat(this.seed, this.flashes, 0x59) * (LIGHTNING_MAX_S - LIGHTNING_MIN_S);
  }
}
