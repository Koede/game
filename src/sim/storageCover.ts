/**
 * How long a grid's batteries can carry the lights through a night. Pure arithmetic on a network snapshot: the grid
 * monitor and the storage screens show `coverText` next to the stored charge.
 */
import { DAY_LENGTH_S, SUNSET_AT } from '../core/constants';

/** The night, in seconds of game time (from sunset to the end of the day). */
export const NIGHT_S = Math.round((1 - SUNSET_AT) * DAY_LENGTH_S);

export interface CoverInput {
  storedJ: number;
  /** Most the switched-on storage can give at once, in watts. */
  storageRateW: number;
  demandW: number;
}

export interface Cover {
  /** Seconds the stored charge alone (no generation) carries the present demand; Infinity with no demand. */
  aloneS: number;
  /** The share of the present demand storage can deliver at once, 0..1 (limited by its discharge rate). */
  share: number;
  /** The charge alone carries the whole demand through a night. */
  nightOk: boolean;
}

export function storageCover({ storedJ, storageRateW, demandW }: CoverInput): Cover {
  if (demandW <= 0) return { aloneS: Infinity, share: 1, nightOk: true };
  const delivered = Math.min(demandW, Math.max(0, storageRateW));
  const share = delivered / demandW;
  const aloneS = delivered > 0 ? Math.max(0, storedJ) / delivered : 0;
  return { aloneS, share, nightOk: share >= 1 && aloneS >= NIGHT_S };
}

/** "14 min", "50 s", "2 h 5 min": a length of game time. */
export function formatSpan(s: number): string {
  if (!Number.isFinite(s)) return 'indefinitely';
  const t = Math.max(0, Math.round(s));
  if (t < 90) return `${t} s`;
  const m = Math.round(t / 60);
  return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** One line for the monitor, or '' when there is nothing stored or nothing to carry. */
export function coverText(input: CoverInput): string {
  if (input.demandW <= 0 || input.storedJ <= 0) return '';
  const c = storageCover(input);
  if (c.share < 1) return `Only ${Math.round(c.share * 100)}% of the load at once`;
  return c.nightOk ? `Lasts the night (${formatSpan(c.aloneS)})` : `Lasts ${formatSpan(c.aloneS)} unaided`;
}
