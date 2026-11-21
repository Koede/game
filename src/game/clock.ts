/**
 * The day / night clock (spec 3.5). timeOfDay runs 0..1 over DAY_LENGTH_S seconds:
 *   dawn  [0, TWILIGHT)                      the light ramps up from night level
 *   day   [TWILIGHT, SUNSET_AT - TWILIGHT)
 *   dusk  [SUNSET_AT - TWILIGHT, SUNSET_AT)  the light ramps down
 *   night [SUNSET_AT, 1)
 */
import { DAY_LENGTH_S, SUNSET_AT, TWILIGHT } from '../core/constants';
import type { GameBus } from '../core/context';
import type { DayPhase } from '../core/gameEvents';
import { lerp, smoothstep } from '../core/math';

/** Sunlight factor in the middle of the night. */
export const NIGHT_SUNLIGHT = 0.08;
/** timeOfDay of a brand-new world: early morning, the light is already full. */
export const START_TIME_OF_DAY = TWILIGHT;
/** Where skipToDawn lands: half-way up the dawn ramp, so the player wakes to a rising sun. */
export const WAKE_TIME_OF_DAY = TWILIGHT / 2;

const DUSK_AT = SUNSET_AT - TWILIGHT;
/** Wraps into [0, 1) without disturbing values that are already inside (a double modulo would add rounding noise). */
const wrap = (t: number): number => t - Math.floor(t);

export interface ClockSnapshot {
  timeOfDay: number;
  day: number;
}

export function phaseAt(timeOfDay: number): DayPhase {
  if (timeOfDay < TWILIGHT) return 'dawn';
  if (timeOfDay < DUSK_AT) return 'day';
  if (timeOfDay < SUNSET_AT) return 'dusk';
  return 'night';
}

/** Sunlight factor: 1 by day, NIGHT_SUNLIGHT at night, smooth ramps through dawn and dusk. */
export function sunlightAt(timeOfDay: number): number {
  if (timeOfDay < TWILIGHT) return lerp(NIGHT_SUNLIGHT, 1, smoothstep(0, TWILIGHT, timeOfDay));
  if (timeOfDay < DUSK_AT) return 1;
  if (timeOfDay < SUNSET_AT) return lerp(1, NIGHT_SUNLIGHT, smoothstep(DUSK_AT, SUNSET_AT, timeOfDay));
  return NIGHT_SUNLIGHT;
}

export class GameClock {
  /** 0..1, 0 = sunrise, SUNSET_AT = sunset. */
  timeOfDay: number;
  /** 1 on the first day; goes up at every sunrise. */
  day = 1;
  private lastPhase: DayPhase;

  constructor(private readonly bus: GameBus | null = null, timeOfDay = START_TIME_OF_DAY) {
    this.timeOfDay = wrap(timeOfDay);
    this.lastPhase = phaseAt(this.timeOfDay);
  }

  get phase(): DayPhase {
    return phaseAt(this.timeOfDay);
  }

  get isNight(): boolean {
    return this.timeOfDay >= SUNSET_AT;
  }

  /** Seconds of world time since the first sunrise (jumps forward when a night is skipped). */
  get worldTimeS(): number {
    return (this.day - 1 + this.timeOfDay) * DAY_LENGTH_S;
  }

  sunlight(): number {
    return sunlightAt(this.timeOfDay);
  }

  /** Angle of the sun along its arc: 0 at sunrise, PI at sunset, back to 2 PI through the night. */
  sunAngle(): number {
    const t = this.timeOfDay;
    return t < SUNSET_AT ? (t / SUNSET_AT) * Math.PI : Math.PI * (1 + (t - SUNSET_AT) / (1 - SUNSET_AT));
  }

  tick(dt: number): void {
    if (dt <= 0) return;
    const t = this.timeOfDay + dt / DAY_LENGTH_S;
    this.day += Math.floor(t);
    this.timeOfDay = t - Math.floor(t);
    this.announce();
  }

  /** Jumps to the next dawn. Returns the seconds of world time skipped. */
  skipToDawn(): number {
    const before = this.worldTimeS;
    if (this.timeOfDay > WAKE_TIME_OF_DAY) this.day++;
    this.timeOfDay = WAKE_TIME_OF_DAY;
    this.announce();
    return this.worldTimeS - before;
  }

  /** Sets the time within the current day (debugging, tests). */
  setTimeOfDay(timeOfDay: number): void {
    this.timeOfDay = wrap(timeOfDay);
    this.announce();
  }

  toJSON(): ClockSnapshot {
    return { timeOfDay: this.timeOfDay, day: this.day };
  }

  /** Restores a snapshot without announcing a phase change. */
  load(snapshot: ClockSnapshot): void {
    this.timeOfDay = wrap(snapshot.timeOfDay);
    this.day = Math.max(1, Math.floor(snapshot.day));
    this.lastPhase = phaseAt(this.timeOfDay);
  }

  private announce(): void {
    const phase = phaseAt(this.timeOfDay);
    if (phase === this.lastPhase) return;
    this.lastPhase = phase;
    this.bus?.emit('time:phase', { phase });
  }
}
