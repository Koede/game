/** DOM-free numbers behind the HUD: compass bearing, grid summary, day countdown, gain feed, vignettes. */
import { DAY_LENGTH_S, SUNSET_AT } from '../../core/constants';
import type { UINetworkStats } from './query';

const TAU = Math.PI * 2;

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a % TAU;
  if (r <= -Math.PI) r += TAU;
  else if (r > Math.PI) r -= TAU;
  return r;
}

/**
 * Where a target lies relative to the way the player looks, in radians: 0 straight ahead, positive to the RIGHT
 * (clockwise on screen), +-PI behind. Yaw follows the game convention: 0 looks north (-Z), positive turns left.
 */
export function relativeBearing(px: number, pz: number, yaw: number, tx: number, tz: number): number {
  const heading = Math.atan2(tx - px, -(tz - pz));
  return wrapAngle(heading + yaw);
}

export type GridState = 'idle' | 'ok' | 'short' | 'overload';

export interface GridSummary {
  /** At least one network generates, consumes or stores something: the HUD shows the power strip. */
  active: boolean;
  generationW: number;
  demandW: number;
  deliveredW: number;
  storedJ: number;
  capacityJ: number;
  /** Worst satisfaction among networks that have demand (1 when none). */
  satisfaction: number;
  state: GridState;
}

/** Folds every network into one figure set for the HUD. */
export function summarizeGrid(nets: readonly UINetworkStats[]): GridSummary {
  const s: GridSummary = { active: false, generationW: 0, demandW: 0, deliveredW: 0, storedJ: 0, capacityJ: 0, satisfaction: 1, state: 'idle' };
  let overloaded = false;
  for (const n of nets) {
    if (n.generationW <= 0 && n.demandW <= 0 && n.capacityJ <= 0) continue;
    s.active = true;
    s.generationW += n.generationW;
    s.demandW += n.demandW;
    s.deliveredW += n.deliveredW;
    s.storedJ += n.storedJ;
    s.capacityJ += n.capacityJ;
    if (n.demandW > 0 && n.satisfaction < s.satisfaction) s.satisfaction = n.satisfaction;
    if (n.overloaded) overloaded = true;
  }
  if (s.active) s.state = overloaded ? 'overload' : s.satisfaction < 0.995 ? 'short' : 'ok';
  return s;
}

export interface DayInfo {
  isNight: boolean;
  /** Seconds until the next sunset (by day) or sunrise (at night). */
  untilS: number;
  /** "Night in 6 m", "Dawn in 40 s". */
  text: string;
  /** Angle of the sun hand on the dial in radians: 0 = sunrise on the left horizon, PI = sunset on the right. */
  dialAngle: number;
}

/** Short countdown for the dial: "6 m", "45 s". Rounds up so it never says "0 s" before the change. */
export function formatCountdown(seconds: number): string {
  // The epsilon keeps float noise (45.0000001) from showing a second too many.
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  return s >= 60 ? `${Math.ceil(s / 60)} m` : `${s} s`;
}

/** Under this many seconds the dial's countdown pulses once: night (or dawn) is close. */
export const DIAL_SOON_S = 120;

/** The dial's countdown in words, readable without a tooltip: "Night 9 m", "Dawn 45 s". */
export const untilLabel = (isNight: boolean, untilS: number): string => `${isNight ? 'Dawn' : 'Night'} ${formatCountdown(untilS)}`;

export function dayInfo(timeOfDay: number): DayInfo {
  const t = ((timeOfDay % 1) + 1) % 1;
  const isNight = t >= SUNSET_AT;
  const untilS = (isNight ? 1 - t : SUNSET_AT - t) * DAY_LENGTH_S;
  // The day arc fills the upper half of the dial, the night arc the lower half, each at its own pace.
  const dialAngle = isNight ? Math.PI + ((t - SUNSET_AT) / (1 - SUNSET_AT)) * Math.PI : (t / SUNSET_AT) * Math.PI;
  return { isNight, untilS, text: `${isNight ? 'Dawn' : 'Night'} in ${formatCountdown(untilS)}`, dialAngle };
}

/** Frost vignette strength 0..1: creeps in below 30 warmth, full at 0. */
export const frostLevel = (warmth: number): number => (warmth >= 30 ? 0 : Math.min(1, (30 - Math.max(0, warmth)) / 30));

export interface FeedEntry {
  item: string;
  count: number;
  /** Time (ms) the entry was last bumped; it expires FEED_LINGER_MS after that. */
  at: number;
  /** Increments on every change, so the view knows what to redraw. */
  rev: number;
}

export const FEED_LINGER_MS = 3200;
export const FEED_MAX = 5;

/** The item-gain feed: one line per item, repeated gains of the same item add up instead of stacking lines. */
export class GainFeed {
  readonly entries: FeedEntry[] = [];

  push(item: string, count: number, now: number): void {
    const existing = this.entries.find((e) => e.item === item);
    if (existing) {
      existing.count += count;
      existing.at = now;
      existing.rev++;
      // The latest gain moves to the bottom of the list, nearest the player's eye line.
      this.entries.splice(this.entries.indexOf(existing), 1);
      this.entries.push(existing);
      return;
    }
    this.entries.push({ item, count, at: now, rev: 0 });
    while (this.entries.length > FEED_MAX) this.entries.shift();
  }

  /** Drops expired entries; returns true when something was removed. */
  expire(now: number): boolean {
    const before = this.entries.length;
    for (let i = this.entries.length - 1; i >= 0; i--) if (now - this.entries[i].at > FEED_LINGER_MS) this.entries.splice(i, 1);
    return this.entries.length !== before;
  }
}

/** A vital bar this full needs no attention: the HUD dims it until it drops (rarely-used meters stay out of the way). */
export const VITAL_CALM_AT = 0.85;
export const isVitalCalm = (fraction: number): boolean => fraction >= VITAL_CALM_AT;
