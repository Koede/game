/**
 * Machine status looks, derived from a block's own "off" texture (see src/core/machineStatus.ts).
 *
 * `<base>_stat_starved`, `<base>_stat_full` and `<base>_stat_broken` are never painted by hand: the base painter runs
 * first, then `paintStatus` lays the status on top. A block opts in with `textures.status: true`, and a
 * new machine therefore reads its state from its own face with no extra art. Each status differs from the
 * others by shape and tone (not colour alone) and sits in the top-right corner, clear of the power pip.
 */
import type { Canvas, Legend, Painter } from './canvas';
import { STATUS_KEYS, parseStatusTexture } from '../../core/machineStatus';
import { mix, rgb, SOOT } from './palette';

const RED = rgb(0xe0453a);
const RED_DIM = rgb(0x7a241f);
const AMBER = rgb(0xf0b030);
const AMBER_DIM = rgb(0x8a5a14);
const BONE = rgb(0xc9c4b8);

const LEGEND: Legend = { b: rgb(0x8d8a82), R: RED, r: RED_DIM, A: AMBER, a: AMBER_DIM, B: BONE, '#': SOOT };

/** 7x7 badges (worn is two screws gone loose): a dark housing with a 5x5 mark inside. Starved is an empty ring struck through, full is a stack of bars. */
const BADGES: Readonly<Record<string, readonly string[]>> = {
  starved: ['#######', '#.RRR.#', '#R.r.R#', '#Rr.rR#', '#R.r.R#', '#.RRR.#', '#######'],
  full: ['#######', '#AAAAA#', '#aaaaa#', '#AAAAA#', '#aaaaa#', '#AAAAA#', '#######'],
  worn: ['#######', '#.....#', '#.b.b.#', '#.....#', '#.b.b.#', '#.....#', '#######'],
  jammed: ['#######', '#..R..#', '#..R..#', '#..R..#', '#.....#', '#..R..#', '#######'],
  broken: ['#######', '#B...B#', '#.B.B.#', '#..B..#', '#.B.B.#', '#B...B#', '#######'],
};

/** Darkens the whole face toward soot (a face that is not doing its job loses its colour). */
function dim(c: Canvas, amount: number): void {
  c.each((x, y) => mix(c.get(x, y), SOOT, amount));
}

/** A jagged crack from the top-left to the bottom-right with a pale lip on one side. */
function cracks(c: Canvas): void {
  const path: ReadonlyArray<readonly [number, number]> = [[2, 4], [4, 6], [5, 8], [8, 9], [9, 12], [12, 14]];
  for (let i = 0; i + 1 < path.length; i++) {
    const [x0, y0] = path[i];
    const [x1, y1] = path[i + 1];
    c.line(x0 + 1, y0, x1 + 1, y1, rgb(0x6a6a72));
    c.line(x0, y0, x1, y1, SOOT);
  }
}

/** A few light scratches, placed by a fixed pattern so the look is the same everywhere. */
function scuffs(c: Canvas): void {
  for (const [x0, y0, x1, y1] of [[3, 9, 6, 8], [7, 12, 10, 11], [2, 6, 3, 8]]) c.line(x0, y0, x1, y1, rgb(0x9a968c));
}

/** Lays status `key` (see STATUS_KEYS) over whatever `c` already holds. */
export function paintStatus(c: Canvas, key: string): void {
  if (key === 'starved') dim(c, 0.18);
  else if (key === 'broken') {
    dim(c, 0.4);
    cracks(c);
  }
  if (key === 'jammed') dim(c, 0.12);
  if (key === 'worn') {
    dim(c, 0.1);
    scuffs(c);
  }
  const badge = BADGES[key];
  if (badge) c.sprite(badge, LEGEND, 8, 1);
}

/** The painter for a derived texture name, built from the base painter, or undefined for any other name. */
export function statusPainter(name: string, painterOf: (n: string) => Painter | undefined): Painter | undefined {
  const parsed = parseStatusTexture(name);
  const base = parsed ? painterOf(parsed.base) : undefined;
  if (!parsed || !base) return undefined;
  const key = STATUS_KEYS[parsed.status];
  return (c) => {
    // The base is painted on a stream seeded by its own name, exactly as it looks on its own, so only the status differs.
    c.withSeed(parsed.base, () => base(c));
    paintStatus(c, key);
  };
}
