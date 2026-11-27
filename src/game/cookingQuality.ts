/**
 * Cooking quality (docs/api/cooking-quality.md). A dish comes out Ordinary, Tasty (quality 1) or Exquisite (2),
 * from how varied its ingredients are, how good they were themselves, and how close the heat was to what the dish
 * wants. Quality scales what eating gives: hunger and the length of its buff (`foodStrength`). Pure; DOM-free.
 */
import { itemOrNull } from '../core/registry';
import type { ItemAmount, ItemStack } from '../core/types';
import type { Inventory } from './inventory';

export type DishQuality = 0 | 1 | 2;
export const DISH_NAME: Readonly<Record<DishQuality, string>> = { 0: 'Ordinary', 1: 'Tasty', 2: 'Exquisite' };
/** Hunger and buff-length multipliers by quality. */
export const FOOD_STRENGTH: Readonly<Record<DishQuality, { hunger: number; buff: number }>> = {
  0: { hunger: 1, buff: 1 },
  1: { hunger: 1.2, buff: 1.5 },
  2: { hunger: 1.5, buff: 2 },
};
export const TASTY_SCORE = 55;
export const EXQUISITE_SCORE = 80;

/** Food families; a dish with more families in it tastes richer. */
const FAMILIES: Readonly<Record<string, readonly string[]>> = {
  meat: ['raw_fowl', 'raw_mutton', 'raw_chop', 'cooked_fowl', 'cooked_mutton', 'cooked_chop'],
  root: ['potato', 'carrot', 'baked_potato'],
  grain: ['wheat', 'flour', 'dough', 'bread'],
  sweet: ['sugar', 'wildberries', 'sugar_cookie', 'sweet_bun'],
  fish: ['cooked_perch', 'cooked_trout', 'cooked_eel', 'cooked_glowfin', 'cooked_salmon', 'cooked_pike', 'cooked_carp', 'cooked_whitefish', 'cooked_crayfish'],
  sap: ['pine_sap', 'pine_resin'],
};

/** Temperatures (C) a dish is at its best, by output item; anything else uses DEFAULT_IDEAL_C. */
export const IDEAL_HEAT_C: Readonly<Record<string, number>> = {
  cooked_fowl: 220,
  cooked_mutton: 220,
  cooked_chop: 230,
  baked_potato: 200,
  bread: 230,
  hearth_stew: 150,
  fish_chowder: 150,
  winter_broth: 150,
  cooked_salmon: 200,
};
export const DEFAULT_IDEAL_C = 200;
/** Degrees off the ideal at which the heat stops helping at all. */
export const HEAT_TOLERANCE_C = 120;

export const familyOf = (item: string): string =>
  Object.entries(FAMILIES).find(([, list]) => list.includes(item))?.[0] ?? item;

/** 1 at the ideal heat, falling to 0 at `HEAT_TOLERANCE_C` away (scorched or lukewarm). */
export function heatScore(heatC: number, dish: string): number {
  const ideal = IDEAL_HEAT_C[dish] ?? DEFAULT_IDEAL_C;
  return Math.max(0, 1 - Math.abs(heatC - ideal) / HEAT_TOLERANCE_C);
}

export interface DishInput {
  output: string;
  inputs: readonly ItemAmount[];
  /** Temperature of the pot or oven; omit when the station has no heat (the workbench). */
  heatC?: number;
  /** Mean quality (0..2) of the ingredients used, see `ingredientQuality`. */
  ingredientQuality?: number;
}

/** The 0..100 score of a dish. Base 30, up to +24 for variety, +10 per average ingredient quality, up to +30 for heat. */
export function dishScore(d: DishInput): number {
  const families = new Set(d.inputs.map((i) => familyOf(i.item))).size;
  const variety = Math.min(24, Math.max(0, families - 1) * 12);
  const heat = d.heatC === undefined ? 0.3 : heatScore(d.heatC, d.output);
  return 30 + variety + 10 * (d.ingredientQuality ?? 0) + 30 * heat;
}

export function dishQuality(d: DishInput): DishQuality {
  const s = dishScore(d);
  return s >= EXQUISITE_SCORE ? 2 : s >= TASTY_SCORE ? 1 : 0;
}

/** Mean quality of the stacks that would be used up for `inputs` from `sources` (quality-less stacks count 0). */
export function ingredientQuality(inputs: readonly ItemAmount[], sources: readonly Inventory[]): number {
  let total = 0;
  let n = 0;
  for (const want of inputs) {
    let left = want.count;
    for (const inv of new Set(sources)) {
      for (const s of inv.slots) {
        if (left <= 0) break;
        if (!s || s.item !== want.item) continue;
        const take = Math.min(left, s.count);
        total += (s.quality ?? 0) * take;
        n += take;
        left -= take;
      }
    }
  }
  return n === 0 ? 0 : total / n;
}

/** What eating this stack gives: its hunger and buff seconds scaled by quality. */
export function foodStrength(stack: ItemStack): { hunger: number; buff: number } {
  return FOOD_STRENGTH[(stack.quality ?? 0) as DishQuality];
}

/** Whether the item is a food that quality applies to. */
export const isDish = (item: string): boolean => !!itemOrNull(item)?.food;
