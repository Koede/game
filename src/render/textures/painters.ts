/** Every painter, by texture name. Families live in their own files; this only merges them. */
import type { Painter, PainterSet } from './canvas';
import { PROVISIONAL } from './provisional';

const MISSING: PainterSet = {
  missing: (c) => c.each((x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? [255, 0, 255] : [0, 0, 0])),
};

const sets: PainterSet[] = [PROVISIONAL, MISSING];

export const PAINTERS: Readonly<Record<string, Painter>> = Object.assign({}, ...sets);
