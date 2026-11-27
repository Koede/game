/**
 * The town's clock (src/workshop/clockTower.ts): the clock tower nearest the town, within TOWN_CLOCK_RANGE, sets the hours the
 * residents keep. The manager reads the town's time of day through `tod` (where people stand, when they work, when the bar is
 * open) and calls `strike` each tick: when the town's part of the day turns, the tower strikes and the player near it hears why.
 * Without a tower the town keeps the sun's hours and nothing strikes.
 */
import { TOWN_CLOCK_RANGE, TOWER_SCHEDULES, townTod } from '../workshop/clockTower';
import { clockText, type Phase } from './dialogue';

export interface TowerView { x: number; y: number; z: number; schedule: number }

/** What the town does as the tower strikes the start of each part of its day. */
export const STRIKE_LINES: Readonly<Record<Phase, string>> = {
  morning: 'the town is up and about',
  day: 'the town goes to work',
  evening: 'work is done and the tavern fills',
  night: 'the town goes to bed',
};

/** Blocks from the tower within which the player is told it struck. */
export const STRIKE_HEAR_RANGE = 48;

export class TownClock {
  /** The tower that keeps the town's time, or null (the town keeps the sun's hours). */
  tower: TowerView | null = null;
  private last: Phase | null = null;

  /** Picks the tower nearest the town (`at`, its origin) within TOWN_CLOCK_RANGE. */
  refresh(towers: readonly TowerView[] | undefined, at: readonly [number, number, number] | null): void {
    let best: TowerView | null = null;
    let bestD = TOWN_CLOCK_RANGE;
    if (at && towers) {
      for (const t of towers) {
        const d = Math.hypot(t.x - at[0], t.z - at[2]);
        if (d <= bestD) [best, bestD] = [t, d];
      }
    }
    if (!best) this.last = null;
    this.tower = best;
  }

  /** The time of day the town lives by: the sun's, shifted by the tower's schedule. */
  tod(sun: number): number {
    return this.tower ? townTod(sun, this.tower.schedule) : sun;
  }

  /** The schedule's name, or null without a tower. */
  scheduleName(): string | null {
    return this.tower ? TOWER_SCHEDULES[Math.min(Math.max(0, this.tower.schedule), TOWER_SCHEDULES.length - 1)].name : null;
  }

  /**
   * Called each tick with the town's phase now. Returns the toast when the tower strikes a new part of the day and the player
   * stands within STRIKE_HEAR_RANGE of it; null otherwise (and on the first tick, and without a tower).
   */
  strike(phase: Phase, sun: number, player: { x: number; z: number } | null): string | null {
    if (!this.tower) return null;
    const was = this.last;
    this.last = phase;
    if (was === null || was === phase) return null;
    if (!player || Math.hypot(player.x - this.tower.x, player.z - this.tower.z) > STRIKE_HEAR_RANGE) return null;
    return `The clock tower rings at ${clockText(sun)}: ${STRIKE_LINES[phase]}.`;
  }
}
