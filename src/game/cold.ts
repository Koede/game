/**
 * Why the player is losing warmth, and the warnings that say so. Survival works out the biggest drain every tick
 * (the cold's cause); ColdWatch turns falling warmth into two toasts that name the cause and the remedy, so a new
 * player learns that rain is beaten by a roof and night by a fire before the cold starts to hurt. DOM-free.
 */
import { HUNGRY_AT } from '../core/constants';
import type { GameBus } from '../core/context';

/** What drains the player's warmth the most right now. */
export type ColdCause = 'night' | 'rain' | 'snow' | 'frost' | 'water';

/** Warmth levels that warn on the way down, mildest first. */
export const COLD_WARN_AT: readonly number[] = [50, 20];
/** A warning comes back only after warmth has been this far above its level again. */
export const COLD_WARN_REARM = 10;
/**
 * On the first day (until the first dawn) the night, frost and weather never take warmth below this: a clear
 * first night costs ~97 of 100 warmth, and a new player has no torches yet. Cold water still drains to 0.
 */
export const FIRST_DAY_WARMTH_FLOOR = 10;

/** What is chilling the player and what to do about it, one clause each. */
export const COLD_REMEDY: Readonly<Record<ColdCause, string>> = {
  night: 'Night is cold - stand by your furnace or a torch',
  rain: 'Rain is soaking you - get under a roof or by a fire',
  snow: 'Snow is soaking you - get under a roof or by a fire',
  frost: 'Frostfell cold - a fire or a padded coat helps',
  water: 'Cold water - get out and dry off by a fire',
};

/** The short HUD line under the bars while the player cools (visible on touch, where titles never show). */
export const COLD_TAG: Readonly<Record<ColdCause, string>> = {
  night: 'Cold night: find a fire',
  rain: 'Soaked: find a roof',
  snow: 'Snowed on: find a roof',
  frost: 'Frostfell: find a fire',
  water: 'Cold water: get out',
};

export type SurvivalNoteTone = 'cold' | 'warn' | 'bad';

/**
 * The one short line the HUD shows under the bars, most urgent first: low warmth (with its cause), an empty or low
 * food bar, then plain cooling. Null when nothing needs saying.
 */
export function survivalNote(coldCause: ColdCause | null, warmth: number, food: number): { text: string; tone: SurvivalNoteTone } | null {
  if (coldCause && warmth < COLD_WARN_AT[0]) return { text: COLD_TAG[coldCause], tone: warmth < COLD_WARN_AT[1] ? 'bad' : 'cold' };
  if (food <= 0) return { text: 'Starving: eat now', tone: 'bad' };
  if (food <= HUNGRY_AT) return { text: 'Hungry: eat something', tone: 'warn' };
  return coldCause ? { text: COLD_TAG[coldCause], tone: 'cold' } : null;
}

/** The toast for warning `level` (an index into COLD_WARN_AT: 0 = getting cold, 1 = freezing). */
export function coldWarning(level: number, cause: ColdCause): string {
  return level <= 0 ? `Getting cold. ${COLD_REMEDY[cause]}.` : `Freezing! ${COLD_REMEDY[cause]}. At 0 warmth the cold hurts.`;
}

/** Warns once per level as warmth falls past COLD_WARN_AT, with hysteresis like the Hungry warning. */
export class ColdWatch {
  private readonly armed = COLD_WARN_AT.map(() => true);

  constructor(private readonly bus: GameBus) {}

  /** `cause` is null while warmth is not falling: nothing is announced then. */
  update(warmth: number, cause: ColdCause | null): void {
    const armed = this.armed;
    for (let i = 0; i < COLD_WARN_AT.length; i++) if (warmth >= COLD_WARN_AT[i] + COLD_WARN_REARM) armed[i] = true;
    if (cause === null) return;
    for (let i = COLD_WARN_AT.length - 1; i >= 0; i--) {
      if (warmth >= COLD_WARN_AT[i] || !armed[i]) continue;
      // The most urgent level speaks; the milder ones it passed stay quiet.
      for (let j = 0; j <= i; j++) armed[j] = false;
      this.bus.emit('toast', { text: coldWarning(i, cause), kind: 'warn' });
      return;
    }
  }

  /** Every warning may speak again (a respawn). */
  reset(): void {
    this.armed.fill(true);
  }
}
