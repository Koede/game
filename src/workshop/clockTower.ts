/**
 * The town clock tower (a Bronze signal part, src/workshop/signals.ts): a great dial with a bell behind it. It keeps the sun's
 * time and gives it to three things:
 *
 * - Signals: it lights for STRIKE_S seconds at the top of every in-game hour (it strikes), so a line can run once an hour.
 * - Timers: a signal timer within TOWER_RANGE blocks of a tower is wound by it and gains clock settings (each hour, by day, by
 *   night, at dawn) besides its beats in seconds. Away from a tower those settings sit idle.
 * - The town: a tower within TOWN_CLOCK_RANGE of the town sets the town's hours (TOWER_SCHEDULES). The residents keep to them:
 *   where they stand, when they work, when the bar is open (src/npcs/manager.ts phase()).
 *
 * Pure and DOM-free: time of day in, decisions out.
 */
import { DAY_LENGTH_S, SUNSET_AT } from '../core/constants';

/** Blocks from a tower within which a signal timer is wound by it. */
export const TOWER_RANGE = 16;
/** Blocks from the town (its tavern or camp) within which a tower sets the town's hours. */
export const TOWN_CLOCK_RANGE = 64;
/** Seconds the tower stays lit when it strikes the hour. */
export const STRIKE_S = 3;
/** Real seconds in one in-game hour. */
export const HOUR_S = DAY_LENGTH_S / 24;

/** The town's hours, picked by tapping the tower. `shift` is in hours: positive runs the town's day earlier. */
export const TOWER_SCHEDULES: readonly { name: string; shift: number; note: string }[] = [
  { name: 'Sun hours', shift: 0, note: 'the town keeps to the sun' },
  { name: 'Early risers', shift: 1, note: 'the town wakes, works and goes to bed an hour sooner' },
  { name: 'Night owls', shift: -2, note: 'the town starts two hours late and the tavern stays open two hours longer' },
];

/** The clock settings a signal timer gains next to a tower (after its beats in seconds). */
export const CLOCK_TIMER_PRESETS: readonly { key: 'hour' | 'day' | 'night' | 'dawn'; name: string }[] = [
  { key: 'hour', name: 'struck each hour by the clock tower' },
  { key: 'day', name: 'on from sunrise to sunset' },
  { key: 'night', name: 'on from sunset to sunrise' },
  { key: 'dawn', name: 'on for the first hour after sunrise' },
];

const wrap = (t: number): number => t - Math.floor(t);
const scheduleOf = (i: number) => TOWER_SCHEDULES[Number.isInteger(i) && i >= 0 && i < TOWER_SCHEDULES.length ? i : 0];

/** The time of day the town lives by under schedule `i` (0..1, 0 = sunrise). */
export function townTod(tod: number, schedule: number): number {
  return wrap(tod + scheduleOf(schedule).shift / 24);
}

/** The schedule's name and what it means, for the toast and the describe line. */
export function scheduleText(schedule: number): string {
  const s = scheduleOf(schedule);
  return `${s.name}: ${s.note}`;
}

/** The hour hand reading (1..12) of time of day `tod` (0 = sunrise = six o'clock). */
export function strikeCount(tod: number): number {
  const h = Math.floor(wrap(tod) * 24 + 6) % 12;
  return h === 0 ? 12 : h;
}

/** True during the first STRIKE_S seconds of an in-game hour: the tower is striking. */
export function striking(tod: number): boolean {
  return (wrap(tod) * 24 % 1) * HOUR_S < STRIKE_S;
}

/** Whether a clock setting of a timer is on at time of day `tod`. */
export function clockTimerOn(key: (typeof CLOCK_TIMER_PRESETS)[number]['key'], tod: number): boolean {
  const t = wrap(tod);
  if (key === 'hour') return striking(t);
  if (key === 'day') return t < SUNSET_AT;
  if (key === 'night') return t >= SUNSET_AT;
  return t < 1 / 24;
}
