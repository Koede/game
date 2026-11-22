/**
 * Folder-based content registration. A lane adds ONE file `src/content/areas/<name>.ts` with a default export of this
 * shape; `scripts/gen-indexes.mjs` (run by the npm pre-hooks and the vitest global setup) lists every file of that folder in
 * the gitignored `_generated/areas.ts`, and the registries read it. No shared file is edited to add content.
 *
 * Area files are DATA ONLY: import types and helpers from `core/types` / `./amounts`, never the registry, `items.ts`
 * or other content registries (that would be an import cycle). Textures: `src/render/textures/areas/<name>.ts`
 * default-exporting a `PainterSet`.
 */
import type { BlockSpec, FluidSpec, ItemSpec, MachineSpec, ObjectiveSpec, RecipeSpec } from '../core/types';
import { AREA_CONTENT } from './_generated/areas';

export interface AreaContent {
  blocks?: BlockSpec[];
  items?: ItemSpec[];
  recipes?: RecipeSpec[];
  machines?: MachineSpec[];
  fluids?: FluidSpec[];
  /** Goals of this area. Inserted after the objective with id `objectivesAfter` (default: at the end of the list). */
  objectives?: ObjectiveSpec[];
  objectivesAfter?: string;
  /** Block keys the world generator places on its own (progression NATURAL_BLOCKS). */
  naturalBlocks?: string[];
  /** Renamed or removed item keys: `old -> new` (see content/aliases.ts). */
  itemAliases?: Record<string, string>;
}

/** Every area, in file-name order. */
export const AREAS: readonly AreaContent[] = AREA_CONTENT;

const gather = <K extends keyof AreaContent>(key: K): NonNullable<AreaContent[K]> extends readonly (infer T)[] ? T[] : never =>
  AREAS.flatMap((a) => (a[key] ?? []) as unknown[]) as never;

export const areaBlocks = (): BlockSpec[] => gather('blocks');
export const areaItems = (): ItemSpec[] => gather('items');
export const areaRecipes = (): RecipeSpec[] => gather('recipes');
export const areaMachines = (): MachineSpec[] => gather('machines');
export const areaFluids = (): FluidSpec[] => gather('fluids');
export const areaNaturalBlocks = (): string[] => gather('naturalBlocks');
export const areaAliases = (): Record<string, string> => Object.assign({}, ...AREAS.map((a) => a.itemAliases ?? {}));

/** `base` with every area's objectives placed after their `objectivesAfter` goal (or at the end). */
export function withAreaObjectives(base: ObjectiveSpec[]): ObjectiveSpec[] {
  const out = [...base];
  for (const a of AREAS) {
    if (!a.objectives?.length) continue;
    const at = a.objectivesAfter === undefined ? -1 : out.findIndex((o) => o.id === a.objectivesAfter);
    if (a.objectivesAfter !== undefined && at < 0) throw new Error(`objectivesAfter "${a.objectivesAfter}" is not an objective`);
    out.splice(at < 0 ? out.length : at + 1, 0, ...a.objectives);
  }
  return out;
}
