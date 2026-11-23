/** Words for the Difficulty and UI size choices (Settings panel, New World on the title screen). DOM-free. */
import { HOSTILE_CAP } from '../../core/constants';
import { DIFFICULTIES, type Difficulty, type Settings } from '../../core/context';

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = { peaceful: 'Peaceful', normal: 'Normal', hard: 'Hard' };

export const DIFFICULTY_OPTIONS: readonly { value: Difficulty; label: string }[] = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }));

/** One line on what a difficulty means (spec 19.3), shown under the choice. */
export function difficultyHint(d: Difficulty): string {
  switch (d) {
    case 'peaceful':
      return 'No automatons. Goals that need one complete themselves.';
    case 'hard':
      return `Up to ${HOSTILE_CAP.hard} automatons at once, and their blows hurt a quarter more.`;
    default:
      return `Automatons wake in the dark, up to ${HOSTILE_CAP.normal} at once. A hot furnace is always safe ground.`;
  }
}

export const UI_SCALE_OPTIONS: readonly { value: Settings['uiScale']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
];

export function uiScaleHint(scale: Settings['uiScale']): string {
  return scale === 'large'
    ? 'Bigger text and touch buttons: easier to read and hit on a small phone.'
    : 'Large makes text and touch buttons bigger for small screens.';
}
