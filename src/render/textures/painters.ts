/** Every painter, by texture name. Families live in their own files; this only merges them. */
import { AIR_TEXTURES } from './air';
import { BREW } from './brew';
import { AREA_PAINTERS } from './_generated/areas';
import { BUILDING } from './building';
import { DISTILL_TEXTURES } from './distill';
import type { Painter, PainterSet } from './canvas';
import { CASING } from './casing';
import { CONSUMERS } from './consumers';
import { EMBER_TEXTURES } from './ember';
import { FARM } from './farm';
import { FURNACES } from './furnaces';
import { GENERATORS } from './generators';
import { GRID } from './grid';
import { HEARTH_SHELL } from './hearthShell';
import { BREW_ICONS } from './iconsBrew';
import { GROUND_ICONS } from './iconsGround';
import { SUGAR_ICONS } from './iconsSugar';
import { MAGIC_TEXTURES } from './iconsMagic';
import { WORKSHOP_TEXTURES } from './iconsWorkshop';
import { WORKSHOP_PART_TEXTURES } from './iconsWorkshopParts';
import { GLASS_TEXTURES } from './iconsGlass';
import { HAND_TEXTURES } from './hand';
import { HAND_ICONS } from './iconsHand';
import { FOOD_ICONS } from './iconsFood';
import { MATERIAL_ICONS } from './iconsMaterials';
import { PART_ICONS } from './iconsParts';
import { TOOL_ICONS } from './iconsTools';
import { VEHICLE_ICONS } from './iconsVehicle';
import { WORLD_ICONS } from './iconsWorld';
import { ORES } from './ores';
import { PLANTS } from './plants';
import { TERRAIN } from './terrain';
import { TRANSPORT } from './transport';
import { WORLD_GROUND } from './worldGround';
import { WORLD_PLANTS } from './worldPlants';

const MISSING: PainterSet = {
  missing: (c) => c.each((x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? [255, 0, 255] : [0, 0, 0])),
};

const sets: PainterSet[] = [TERRAIN, ORES, PLANTS, BUILDING, FURNACES, CASING, GENERATORS, CONSUMERS, GRID, MATERIAL_ICONS, TOOL_ICONS, PART_ICONS, FARM, FOOD_ICONS, WORLD_PLANTS, WORLD_GROUND, WORLD_ICONS, HEARTH_SHELL, TRANSPORT, EMBER_TEXTURES, BREW, BREW_ICONS, VEHICLE_ICONS, GROUND_ICONS, SUGAR_ICONS, HAND_TEXTURES, HAND_ICONS, DISTILL_TEXTURES, MAGIC_TEXTURES, WORKSHOP_TEXTURES, WORKSHOP_PART_TEXTURES, GLASS_TEXTURES, AIR_TEXTURES, ...AREA_PAINTERS, MISSING];

export const PAINTERS: Readonly<Record<string, Painter>> = Object.assign({}, ...sets);
