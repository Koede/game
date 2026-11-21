/**
 * Items and blocks of Essentia & Research (docs/OVERHAUL_PLAN.md B, docs/api/magic.md). The field notebook scans things;
 * glass vials hold VIAL_UNITS of one aspect (one item per aspect, generated from the aspect list); the gathering rod
 * draws essentia from the land into empty vials; the essentia jar keeps up to JAR_UNITS of one aspect in the world.
 * Recipes in recipesMagic.ts; which of them research unlocks is in src/magic/entries.ts.
 */
import type { BlockSpec, ItemSpec } from '../core/types';
import { ASPECTS } from '../magic/aspects';

/** Units of essentia in one filled vial. */
export const VIAL_UNITS = 4;
/** Units one essentia jar holds (eight vials). */
export const JAR_UNITS = 32;

export const vialKey = (aspect: string): string => `vial_${aspect}`;

export const MAGIC_ITEMS: ItemSpec[] = [
  {
    key: 'field_notebook', name: 'Field Notebook', category: 'tool', age: 0, stack: 1,
    desc: 'Aim it at anything and press Use to note its nature: you learn its aspects and gain lore. Use it at the sky to open the notes and the research boards.',
  },
  {
    key: 'glass_vial', name: 'Glass Vial', category: 'material', age: 0, stack: 16,
    desc: 'A small stoppered vial. A gathering rod fills it with one aspect of essentia.',
  },
  {
    key: 'vis_rod', name: 'Gathering Rod', category: 'tool', age: 0, stack: 1,
    desc: 'Hold Use to draw essentia from the land around you into an empty vial in your pack. It draws whatever the land here is richest in.',
  },
  ...ASPECTS.map((a): ItemSpec => ({
    key: vialKey(a.key), name: `Vial of ${a.name}`, category: 'material', age: 0, stack: 8,
    desc: `${VIAL_UNITS} units of ${a.name} essentia (${a.meaning}). Use it on an essentia jar to pour it in.`,
  })),
];

export const MAGIC_BLOCKS: BlockSpec[] = [
  {
    key: 'essentia_jar', name: 'Essentia Jar', category: 'machine', age: 0, hardness: 0.5, tool: 'pickaxe', minTier: 0,
    opaque: false, translucent: true, stack: 16, textures: { side: 'magic_jar_side', top: 'magic_jar_top' },
    desc: `Holds up to ${JAR_UNITS} units of one aspect. Use a filled vial on it to pour in; Use an empty vial to fill it back.`,
  },
];
