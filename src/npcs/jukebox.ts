/**
 * The tavern jukebox's tune (docs/api/npcs.md): a looping folk melody played note by note through the 'jukebox_note' sfx, pitched by
 * semitones from middle C, with a bass note on every fourth beat. Pure data and two helpers, so it is testable without audio.
 */
export const BEAT_S = 0.28;

/** Semitones above the base note per beat; null is a rest. Two eight-beat phrases and their answer, 32 beats in all. */
export const TUNE: readonly (number | null)[] = [
  0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, null,
  5, 9, 12, 9, 7, 4, 2, 4, 0, 2, 4, 7, 4, 2, 0, null,
];

export interface Note {
  /** Playback-rate ratio for the base note. */
  pitch: number;
  bass: boolean;
}

/** The notes sounding on beat `i` (counting from 0, looping): the melody note, if any, and the bass note on every fourth beat. */
export function notesAt(i: number): Note[] {
  const b = ((i % TUNE.length) + TUNE.length) % TUNE.length;
  const out: Note[] = [];
  if (b % 4 === 0) out.push({ pitch: 0.5, bass: true });
  const semi = TUNE[b];
  if (semi !== null) out.push({ pitch: Math.pow(2, semi / 12), bass: false });
  return out;
}

/** Roles that dance when the jukebox plays: everyone but the orc, who stands there with his arms folded. */
export const DANCES = (role: string): boolean => role === 'witch' || role === 'barkeep' || role === 'artificer' || role === 'hermit';
