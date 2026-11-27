/**
 * Phone haptics: short buzzes for mining, breaking, placing, crafting and getting hurt, wherever `navigator.vibrate`
 * exists (Android browsers; iOS Safari has none, so nothing happens there). Listens to the bus, so nothing else needs to
 * know. Rate-limited so a held Mine feels like taps rather than one long buzz.
 */
import type { GameBus } from '../core/context';

/** Shortest time between two buzzes, in milliseconds. */
export const HAPTIC_GAP_MS = 70;

type Pattern = number | number[];

/** The buzz for each kind of event (milliseconds). */
export const HAPTIC = {
  dig: 7,
  break: 18,
  place: 10,
  craft: [10, 40, 10] as number[],
  /** A tree hitting the ground: a long double buzz. */
  fell: [30, 40, 60] as number[],
  hurt: (amount: number): number => Math.round(Math.min(90, 25 + amount * 8)),
} as const;

export type Vibrate = (pattern: Pattern) => boolean;

/** The browser's vibrate function, or null when there is none. */
export function browserVibrate(): Vibrate | null {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null;
  return (pattern) => navigator.vibrate(pattern);
}

/**
 * Subscribes the buzzes to `bus`; returns the unsubscribe function. `enabled` is read at every event (the setting can
 * change at any time), `now` and `vibrate` can be replaced in tests.
 */
export function attachHaptics(
  bus: GameBus,
  enabled: () => boolean,
  vibrate: Vibrate | null = browserVibrate(),
  now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
): () => void {
  if (!vibrate) return () => {};
  let last = -Infinity;
  const buzz = (pattern: Pattern, urgent = false): void => {
    if (!enabled()) return;
    const t = now();
    if (!urgent && t - last < HAPTIC_GAP_MS) return;
    last = t;
    vibrate(pattern);
  };
  const offs = [
    bus.on('sfx', (e) => {
      if (e.name.startsWith('dig_')) buzz(HAPTIC.dig);
      else if (e.name === 'place') buzz(HAPTIC.place);
      else if (e.name === 'craft') buzz(HAPTIC.craft);
      else if (e.name === 'tree_fall') buzz(HAPTIC.fell);
    }),
    bus.on('block:broken', () => buzz(HAPTIC.break)),
    bus.on('player:damage', (e) => buzz(HAPTIC.hurt(e.amount), true)),
  ];
  return () => offs.forEach((off) => off());
}
