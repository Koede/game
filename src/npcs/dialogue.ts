/**
 * Picks a line from a phrase bank: mostly the time-of-day pool and the general pool, rarely a rare line, never one said lately
 * (docs/api/npcs.md). Deterministic for a given rng, so it is testable.
 */
import type { PhraseBank } from './scripts/types';

export type Phase = 'morning' | 'day' | 'evening' | 'night';

/** timeOfDay (0 = dawn) to a phase of the day: the same cut points the clock uses, roughly. */
export function phaseOfTime(tod: number): Phase {
  if (tod < 0.22) return 'morning';
  if (tod < 0.62) return 'day';
  if (tod < 0.75) return 'evening';
  return 'night';
}

/** timeOfDay (0..1, 0 = dawn) as a 24-hour clock reading: dawn is 06:00. */
export function clockHM(tod: number): { h: number; m: number } {
  const minutes = Math.floor((((6 * 60 + tod * 24 * 60) % 1440) + 1440) % 1440);
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

export const clockText = (tod: number): string => {
  const { h, m } = clockHM(tod);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Number of different phrases in a bank (for the tests and the docs). */
export function bankSize(b: PhraseBank): number {
  return b.greet.length + b.idle.length + b.morning.length + b.evening.length + b.night.length + b.rare.length + b.farewell.length + Object.keys(b.hints).length;
}

export class LinePicker {
  /** Recently said lines per speaker. */
  private readonly recent = new Map<string, string[]>();

  constructor(private readonly rng: () => number = Math.random, private readonly memory = 14) {}

  pick(speaker: string, bank: PhraseBank, phase: Phase, opts: { greeting?: boolean } = {}): string {
    const r = this.rng();
    let pool: readonly string[];
    if (opts.greeting && r < 0.6) pool = bank.greet;
    else if (r < 0.1) pool = bank.rare;
    else if (r < 0.5) pool = phase === 'morning' ? bank.morning : phase === 'evening' ? bank.evening : phase === 'night' ? bank.night : bank.idle;
    else pool = bank.idle;
    if (pool.length === 0) pool = bank.idle;
    const seen = this.recent.get(speaker) ?? [];
    const fresh = pool.filter((l) => !seen.includes(l));
    const from = fresh.length > 0 ? fresh : pool;
    const line = from[Math.min(from.length - 1, Math.floor(this.rng() * from.length))];
    seen.push(line);
    while (seen.length > this.memory) seen.shift();
    this.recent.set(speaker, seen);
    return line;
  }

  /** A line from an ad hoc list (the orc's hire lines, the hermit's sale lines), no repeats lately. */
  from(speaker: string, lines: readonly string[]): string {
    return this.pick(speaker, { greet: [], idle: lines, morning: [], evening: [], night: [], rare: [], farewell: [], hints: {} }, 'day');
  }
}
