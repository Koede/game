/**
 * The FORGE tab's list: the simulation's ForgeRows (every forge recipe of the game in tech-tree order) turned
 * into kit RecipeRowViews with category, requirement badges and have/need chips. DOM-free.
 */
import { blockOfItem, furnaceTier, itemOrNull, machineOfBlock } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import type { ForgeRow } from '../../../sim';
import type { RecipeCategory, RecipeRequirement, RecipeRowView } from '../../kit/recipe';
import { pretty } from './simApi';

export type ForgeCategory = 'tools' | 'parts' | 'machines' | 'power' | 'building';

export const FORGE_CATEGORIES: readonly RecipeCategory[] = [
  { id: 'tools', label: 'Tools' },
  { id: 'parts', label: 'Parts' },
  { id: 'machines', label: 'Machines' },
  { id: 'power', label: 'Power' },
  { id: 'building', label: 'Building' },
];

/** The most one tap of the batch button asks for. */
export const FORGE_BATCH = 5;

export const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;

/** Which chip a recipe sits under, from what it makes. */
export function forgeCategory(recipe: RecipeDef): ForgeCategory {
  const key = recipe.output.item;
  const item = itemOrNull(key);
  if (item?.tool || item?.category === 'tool' || item?.category === 'misc') return 'tools';
  const block = blockOfItem(key);
  if (block) {
    if (block.power === 'cable') return 'power';
    const spec = machineOfBlock(block);
    if (spec) return spec.role === 'generator' || spec.role === 'storage' ? 'power' : 'machines';
    return 'building';
  }
  return 'parts';
}

/** How many in a row the Make buttons may ask for right now (0 = none). */
export function forgeAvailable(row: ForgeRow): number {
  if (!row.canMake) return 0;
  return Math.max(1, Math.min(row.max, row.heatAllows, 99));
}

export function forgeRowView(row: ForgeRow): RecipeRowView {
  const r = row.recipe;
  const requirements: RecipeRequirement[] = [
    { text: `${r.minTempC} °C`, kind: 'heat', met: row.tempOk, tempC: r.minTempC },
  ];
  if (row.locked) requirements.unshift({ text: furnaceTier(r.minTier).name, kind: 'tier', met: false });
  return {
    id: r.id,
    item: r.output.item,
    name: nameOf(r.output.item),
    count: r.output.count,
    category: forgeCategory(r),
    requirements,
    ingredients: row.ingredients.map((s) => ({ item: s.item, name: nameOf(s.item), have: s.have, need: s.need })),
    available: forgeAvailable(row),
    reason: row.reason ? pretty(row.reason) : undefined,
    locked: row.locked,
    action: 'Forge',
  };
}

export const forgeRowViews = (rows: readonly ForgeRow[]): RecipeRowView[] => rows.map(forgeRowView);

/** Rows that can be forged right now (the FORGE tab badge). */
export const forgeReady = (rows: readonly ForgeRow[]): number => rows.reduce((n, row) => n + (row.canMake ? 1 : 0), 0);

/** The message after a forge call that made fewer than asked (the chill or the ingredients stopped it). */
export function forgeShortfall(made: number, asked: number, item: string): string | null {
  if (made >= asked || made <= 0) return null;
  return `Forged ${made} of ${asked} ${nameOf(item)} - it ran too cold or short of ingredients`;
}
