/** Every painter, by texture name. Families live in their own files; this only merges them. */
import { BUILDING } from './building';
import type { Painter, PainterSet } from './canvas';
import { CASING } from './casing';
import { CONSUMERS } from './consumers';
import { FURNACES } from './furnaces';
import { GENERATORS } from './generators';
import { GRID } from './grid';
import { PROVISIONAL } from './provisional';
import { ORES } from './ores';
import { PLANTS } from './plants';
import { TERRAIN } from './terrain';

const MISSING: PainterSet = {
  missing: (c) => c.each((x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? [255, 0, 255] : [0, 0, 0])),
};

const sets: PainterSet[] = [PROVISIONAL, TERRAIN, ORES, PLANTS, BUILDING, FURNACES, CASING, GENERATORS, CONSUMERS, GRID, MISSING];

export const PAINTERS: Readonly<Record<string, Painter>> = Object.assign({}, ...sets);
