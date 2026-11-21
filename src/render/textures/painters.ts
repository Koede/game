/** Every painter, by texture name. Families live in their own files; this only merges them. */
import { BUILDING } from './building';
import type { Painter, PainterSet } from './canvas';
import { CASING } from './casing';
import { CONSUMERS } from './consumers';
import { FARM } from './farm';
import { FURNACES } from './furnaces';
import { GENERATORS } from './generators';
import { GRID } from './grid';
import { FOOD_ICONS } from './iconsFood';
import { MATERIAL_ICONS } from './iconsMaterials';
import { PART_ICONS } from './iconsParts';
import { TOOL_ICONS } from './iconsTools';
import { WORLD_ICONS } from './iconsWorld';
import { ORES } from './ores';
import { PLANTS } from './plants';
import { TERRAIN } from './terrain';
import { WORLD_GROUND } from './worldGround';
import { WORLD_PLANTS } from './worldPlants';

const MISSING: PainterSet = {
  missing: (c) => c.each((x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? [255, 0, 255] : [0, 0, 0])),
};

const sets: PainterSet[] = [TERRAIN, ORES, PLANTS, BUILDING, FURNACES, CASING, GENERATORS, CONSUMERS, GRID, MATERIAL_ICONS, TOOL_ICONS, PART_ICONS, FARM, FOOD_ICONS, WORLD_PLANTS, WORLD_GROUND, WORLD_ICONS, MISSING];

export const PAINTERS: Readonly<Record<string, Painter>> = Object.assign({}, ...sets);
