/**
 * The world's weather timetable (spec 15): a sequence of segments, each a state drawn from WEATHER_CHANCE and
 * lasting WEATHER_MIN_S..WEATHER_MAX_S, with the change into it eased over WEATHER_BLEND_MIN_S..MAX_S. Every
 * number is a hash of the world seed and the segment index, so the weather at any moment follows from the seed
 * and the elapsed world time alone. The first segment is always clear (a new world opens under a clear sky).
 */
import {
  WEATHER_BLEND_MAX_S, WEATHER_BLEND_MIN_S, WEATHER_CHANCE, WEATHER_MAX_S, WEATHER_MIN_S,
} from '../core/constants';
import { hashFloat } from '../core/math';
import type { WeatherKind } from '../core/types';

export interface WeatherSegment {
  readonly index: number;
  readonly kind: WeatherKind;
  /** World time (s) the segment starts, and how long it lasts. */
  readonly startS: number;
  readonly lengthS: number;
  /** Seconds the change from the previous segment's state eases over (unused when the state did not change). */
  readonly blendS: number;
}

/** Order in which WEATHER_CHANCE is accumulated when drawing. */
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'cloudy', 'rain', 'storm'];

const SALT_KIND = 1;
const SALT_LENGTH = 2;
const SALT_BLEND = 3;

/** The state a uniform number r in [0, 1) draws from WEATHER_CHANCE. */
export function drawWeather(r: number): WeatherKind {
  let acc = 0;
  for (const kind of WEATHER_KINDS) {
    acc += WEATHER_CHANCE[kind];
    if (r < acc) return kind;
  }
  return WEATHER_KINDS[WEATHER_KINDS.length - 1];
}

/** Segments are generated on demand and kept (one per 4-12 minutes of play: a long game holds a few thousand). */
export class WeatherSchedule {
  private readonly segments: WeatherSegment[] = [];
  /** Index of the segment found by the last lookup: lookups move forward from it. */
  private cursor = 0;

  constructor(readonly seed: number) {}

  segment(index: number): WeatherSegment {
    const list = this.segments;
    while (list.length <= index) {
      const i = list.length;
      const prev = i > 0 ? list[i - 1] : null;
      list.push({
        index: i,
        kind: i === 0 ? 'clear' : drawWeather(hashFloat(this.seed, i, SALT_KIND)),
        startS: prev ? prev.startS + prev.lengthS : 0,
        lengthS: WEATHER_MIN_S + hashFloat(this.seed, i, SALT_LENGTH) * (WEATHER_MAX_S - WEATHER_MIN_S),
        blendS: WEATHER_BLEND_MIN_S + hashFloat(this.seed, i, SALT_BLEND) * (WEATHER_BLEND_MAX_S - WEATHER_BLEND_MIN_S),
      });
    }
    return list[index];
  }

  /** The segment that holds world time `timeS` (times before 0 belong to the first). */
  at(timeS: number): WeatherSegment {
    let i = this.cursor;
    if (timeS < this.segment(i).startS) i = 0;
    for (;;) {
      const s = this.segment(i);
      if (timeS < s.startS + s.lengthS || timeS < 0) {
        this.cursor = i;
        return s;
      }
      i++;
    }
  }

  /** The state the sky changes from at the start of a segment. */
  previousKind(seg: WeatherSegment): WeatherKind {
    return seg.index > 0 ? this.segment(seg.index - 1).kind : seg.kind;
  }

  /** The first segment after `seg` whose state differs from `kind` (a draw of the same state only extends it). */
  nextChange(seg: WeatherSegment, kind: WeatherKind): WeatherSegment {
    let i = seg.index + 1;
    // Twenty identical draws in a row happen with odds below 1e-6; the cap only guards against a broken table.
    for (let n = 0; n < 20; n++, i++) if (this.segment(i).kind !== kind) break;
    return this.segment(i);
  }
}
