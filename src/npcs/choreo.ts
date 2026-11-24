/**
 * The tavern dance (docs/api/npcs.md): a 60-second choreography of fifteen different moves that loops seamlessly. The sprites are the
 * owner's blueprint art, so nothing is redrawn: a move is a `Pose`, the way the renderer bends, squashes, hops, slides and spins the
 * picture. Time comes from the jukebox (`BEAT_S` per beat, 240 beats = 60 s); each dancer starts a few moves apart so the floor is
 * never in step, and each has their own style (the women swing wider through the hips, Bram is all stomps and little jumps).
 */
import { BEAT_S } from './jukebox';

export const LOOP_BEATS = 240;
export const LOOP_S = LOOP_BEATS * BEAT_S;
export const SECTION_BEATS = 16;

/** How the picture is deformed this instant. Lengths are fractions of the person's height unless noted. */
export interface Pose {
  /** Blocks off the floor. */
  hop: number;
  /** Blocks sideways (screen-right positive). */
  side: number;
  /** The head's sideways lean relative to the feet (shear). */
  lean: number;
  /** S-curve: hips one way, shoulders the other. */
  curve: number;
  /** Vertical scale (squash below 1, stretch above); the width compensates. */
  squash: number;
  /** Horizontal scale -1..1 (a turn: the cosine of the spin angle; negative shows the mirror image). */
  turn: number;
}

type Move = (b: number) => Pose;
const TAU = Math.PI * 2;
const sin = Math.sin;
const abs = Math.abs;
const still: Pose = { hop: 0, side: 0, lean: 0, curve: 0, squash: 1, turn: 1 };
const p = (o: Partial<Pose>): Pose => ({ ...still, ...o });
const flip = (b: number): number => (Math.floor(b) % 2 === 0 ? 1 : -1);

/** Beat b (0..16) within a move; every move is at rest-compatible values at b = 0 and b = 16. */
export const MOVES: readonly { name: string; at: Move }[] = [
  { name: 'bounce', at: (b) => p({ hop: 0.12 * abs(sin(Math.PI * b)), squash: 0.93 + 0.1 * abs(sin(Math.PI * b)) }) },
  { name: 'sway', at: (b) => p({ lean: 0.09 * sin((TAU * b) / 8), curve: -0.04 * sin((TAU * b) / 8), hop: 0.02 * abs(sin((Math.PI * b) / 2)) }) },
  { name: 'hip swing', at: (b) => p({ curve: 0.09 * sin((TAU * b) / 4), lean: -0.03 * sin((TAU * b) / 4), hop: 0.03 * abs(sin((Math.PI * b) / 2)) }) },
  { name: 'shimmy', at: (b) => p({ curve: 0.045 * sin(TAU * b * 2), lean: 0.02 * sin(TAU * b * 2 + 1.2), hop: 0.03 * abs(sin(TAU * b)) }) },
  { name: 'twirl', at: (b) => p({ turn: Math.cos((TAU * b) / 8), hop: 0.16 * abs(sin((Math.PI * b) / 8)), curve: 0.05 * sin((TAU * b) / 4) }) },
  { name: 'slide', at: (b) => p({ side: 0.42 * sin((TAU * b) / 16), lean: 0.08 * sin((TAU * b) / 8), hop: 0.03 * abs(sin(Math.PI * b)) }) },
  { name: 'jump', at: (b) => p({ hop: 0.34 * abs(sin((Math.PI * b) / 2)), squash: 0.92 + 0.16 * abs(sin((Math.PI * b) / 2)) }) },
  { name: 'dip', at: (b) => p({ squash: 1 - 0.14 * ((1 - Math.cos((TAU * b) / 4)) / 2), lean: 0.03 * sin((TAU * b) / 4) }) },
  { name: 'step touch', at: (b) => p({ turn: flip(b), hop: 0.07 * abs(sin(Math.PI * b)), side: 0.12 * sin(Math.PI * b), curve: 0.03 * flip(b) }) },
  { name: 'pop', at: (b) => p({ lean: 0.09 * flip(b), curve: -0.03 * flip(b), hop: 0.02 * abs(sin(Math.PI * b)) }) },
  { name: 'conga', at: (b) => p({ side: 0.34 * sin((TAU * b) / 8), lean: 0.07 * sin((TAU * b) / 8), hop: 0.09 * abs(sin(Math.PI * b)) }) },
  { name: 'wave', at: (b) => p({ curve: 0.1 * sin((TAU * b) / 8), lean: 0.05 * sin((TAU * b) / 8 - 1), squash: 1 + 0.02 * sin((TAU * b) / 4) }) },
  { name: 'stomp', at: (b) => p({ hop: 0.2 * Math.max(0, sin(Math.PI * b)), squash: 1 - 0.1 * Math.max(0, -sin(Math.PI * b)), lean: 0.04 * flip(b) }) },
  { name: 'spin pop', at: (b) => p({ turn: Math.cos((TAU * b) / 4), hop: 0.1 * abs(sin((Math.PI * b) / 4)) }) },
  { name: 'finale', at: (b) => p({ hop: 0.06 * abs(sin((Math.PI * b) / 2)) * (b < 12 ? 1 : (16 - b) / 4), curve: 0.04 * sin((TAU * b) / 8) * (b < 12 ? 1 : (16 - b) / 4) }) },
];

/** Who dances how: where in the routine they start (in moves) and how big and hippy they move. */
const STYLE: Readonly<Record<string, { start: number; size: number; hips: number }>> = {
  mara: { start: 0, size: 1.05, hips: 1.3 },
  rosa: { start: 5, size: 1, hips: 1.3 },
  orrin: { start: 10, size: 0.9, hips: 0.8 },
  veyra: { start: 7, size: 0.95, hips: 1.1 },
  bram: { start: 3, size: 0.75, hips: 0.7 },
};

export function danceMoveIndex(id: string, danceS: number): number {
  const s = STYLE[id] ?? STYLE.mara;
  const beat = (((danceS / BEAT_S) % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
  return (Math.floor(beat / SECTION_BEATS) + s.start) % MOVES.length;
}

/** The pose of dancer `id` `danceS` seconds after the music started. Repeats exactly every LOOP_S. */
export function dancePose(id: string, danceS: number): Pose {
  const s = STYLE[id] ?? STYLE.mara;
  const beat = (((danceS / BEAT_S) % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
  const sec = Math.floor(beat / SECTION_BEATS);
  const move = MOVES[(sec + s.start) % MOVES.length];
  const q = move.at(beat - sec * SECTION_BEATS);
  return {
    hop: q.hop * s.size,
    side: q.side * s.size,
    lean: q.lean * s.size,
    curve: q.curve * s.hips,
    squash: 1 + (q.squash - 1) * s.size,
    turn: q.turn,
  };
}

export const STILL: Pose = still;

/**
 * Which pose frame of the dancer's atlas to show (0 standing, 1-4 poses; assets/npcs/faces/poses.py), stepping on the beat with each move's
 * own pattern. Like dancePose it is a pure function of the time since the music started and repeats every LOOP_S.
 */
const FRAME_PATTERN: readonly (readonly number[])[] = [
  [1, 2], [1, 1, 2, 2], [3, 4], [1, 2], [0, 1, 0, 2], [3, 4], [1, 0], [0, 3, 0, 4], [3, 4], [1, 2], [3, 0, 4, 0], [1, 1, 2, 2], [3, 4, 3, 4], [1, 2], [1, 2, 1, 0],
];

export function danceFrame(id: string, danceS: number): number {
  const beat = (((danceS / BEAT_S) % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
  const pattern = FRAME_PATTERN[danceMoveIndex(id, danceS)];
  return pattern[Math.floor(beat) % pattern.length];
}
