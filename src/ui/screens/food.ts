/**
 * How food reads in the UI, DOM-free: "+8 food" and "Well-Fed 6 min" for item cards, the carry bar, the hotbar
 * name and recipe rows; the "returns the bucket" note for recipes with byproducts; which recipes the furnace's
 * Kitchen chip gathers; and the HUD's hunger state.
 */
import { HUNGRY_AT, MAX_FOOD } from '../../core/constants';
import { DRINK_BUFFS } from '../../core/brewing';
import { drinkBrewedFrom, itemOrNull } from '../../core/registry';
import type { DamageCause } from '../../core/gameEvents';
import type { DrinkSpec, FoodSpec, RecipeDef } from '../../core/types';
import type { RecipeCategory, RecipeRequirement } from '../kit/recipe';

/** The chip that gathers cooking and baking at the furnace (spec 12.8: category Food). */
export const KITCHEN: RecipeCategory = { id: 'kitchen', label: 'Kitchen' };

const BUFF_NAMES: Record<NonNullable<FoodSpec['buff']>, string> = { well_fed: 'Well-Fed', sugar_rush: 'Sugar Rush' };

/** 360 -> "6 min", 90 -> "1.5 min", 45 -> "45 s". */
export function buffDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round((seconds / 60) * 2) / 2;
  return `${minutes} min`;
}

/** "Well-Fed 6 min", or null for a food without a buff. */
export function buffText(food: FoodSpec): string | null {
  if (!food.buff) return null;
  const name = BUFF_NAMES[food.buff];
  return food.buffS ? `${name} ${buffDuration(food.buffS)}` : name;
}

/** "+8 food". */
export const foodText = (food: FoodSpec): string => `+${food.hunger} food`;

/** "Swift 3 min": a cup of tea or coffee and the buff it gives (the "+N food" of drinks). */
export const drinkText = (drink: DrinkSpec): string => `${DRINK_BUFFS[drink.buff].name} ${buffDuration(drink.buffS)}`;

/** "Brews Light Roast": what an ingredient makes in a cup with a drip cone, or null for any other item. */
export function brewsText(itemKey: string): string | null {
  const made = drinkBrewedFrom(itemKey);
  return made ? `Brews ${made.name}` : null;
}

/** One line about an item as food or drink ("+12 food, Well-Fed 6 min", "Swift 3 min"), or null when it is neither. */
export function foodLine(itemKey: string): string | null {
  const def = itemOrNull(itemKey);
  if (def?.drink) return drinkText(def.drink);
  const food = def?.food;
  if (!food) return null;
  const buff = buffText(food);
  return buff ? `${foodText(food)}, ${buff}` : foodText(food);
}

/** The item card rows of a food item: [["Eat", "+8 food"], ["Buff", "Well-Fed 6 min"]]. */
export function foodRows(itemKey: string): [string, string][] {
  const def = itemOrNull(itemKey);
  if (def?.drink) {
    const rows: [string, string][] = [['Drink', drinkText(def.drink)], ['Effect', DRINK_BUFFS[def.drink.buff].effect]];
    if (def.drink.warmth) rows.push(['Warms', `+${def.drink.warmth} warmth`]);
    if (def.drink.hunger) rows.push(['Eat', `+${def.drink.hunger} food`]);
    return rows;
  }
  const brews = brewsText(itemKey);
  if (brews) {
    const made = drinkBrewedFrom(itemKey);
    return made?.drink ? [['Brews', `${made.name}: ${drinkText(made.drink)}`], ['Effect', DRINK_BUFFS[made.drink.buff].effect]] : [];
  }
  const food = def?.food;
  if (!food) return [];
  const rows: [string, string][] = [['Eat', foodText(food)]];
  const buff = buffText(food);
  if (buff) rows.push(['Buff', buff]);
  return rows;
}

/** Containers come back from recipes that use what they held (a water bucket gives back the empty bucket). */
const isContainer = (itemKey: string): boolean => /bucket/i.test(itemOrNull(itemKey)?.name ?? itemKey);

/** What a recipe gives back besides its product: "Returns the bucket", "Also gives 2 Slag". */
export function byproductNotes(recipe: RecipeDef): string[] {
  return recipe.byproducts.map((b) => {
    if (isContainer(b.item)) return b.count > 1 ? `Returns ${b.count} buckets` : 'Returns the bucket';
    const name = itemOrNull(b.item)?.name ?? b.item;
    return `Also gives ${b.count > 1 ? `${b.count} ` : ''}${name}`;
  });
}

/**
 * The badges a recipe row adds after its requirements: what eating the product restores, its buff, and what the
 * recipe gives back. Facts, not requirements, so they carry no met / unmet state.
 */
export function productBadges(recipe: RecipeDef): RecipeRequirement[] {
  const out: RecipeRequirement[] = [];
  const made = itemOrNull(recipe.output.item);
  if (made?.drink) out.push({ text: drinkText(made.drink), kind: 'food' });
  const brews = brewsText(recipe.output.item);
  if (brews) out.push({ text: brews, kind: 'food' });
  const food = made?.food;
  if (food) {
    out.push({ text: foodText(food), kind: 'food' });
    const buff = buffText(food);
    if (buff) out.push({ text: buff, kind: 'food' });
  }
  for (const note of byproductNotes(recipe)) out.push({ text: note, kind: 'note' });
  return out;
}

/** Brewing items that are neither a drink nor an ingredient (the chain's steps, the cup, cone and kettle): they sit with the drinks in the Kitchen chip. */
const BREWING_STAGES: ReadonlySet<string> = new Set(['tea_leaves', 'coffee_cherries', 'roasted_beans', 'dark_beans', 'clay_cup', 'drip_cone', 'kettle_pot']);

const isFood = (itemKey: string): boolean => {
  const def = itemOrNull(itemKey);
  return def !== null && (def.food !== undefined || def.category === 'food' || def.drink !== undefined || def.brews !== undefined || BREWING_STAGES.has(itemKey));
};

/** The Kitchen chip gathers every recipe that makes food or uses food (roasts, baked potato, bread, stews, and the tea and coffee chain). */
export function isKitchenRecipe(recipe: RecipeDef): boolean {
  return isFood(recipe.output.item) || recipe.inputs.some((i) => isFood(i.item));
}

export type HungerState = 'fed' | 'hungry' | 'starving';

/** The meter's state: Hungry at or below HUNGRY_AT, starving at an empty bar. */
export function hungerState(food: number): HungerState {
  if (food <= 0) return 'starving';
  return food <= HUNGRY_AT ? 'hungry' : 'fed';
}

/** Strength of the hunger vignette 0..1: nothing while fed, 0.35 on turning Hungry, rising to 1 at an empty bar. */
export function hungerLevel(food: number): number {
  if (!(food <= HUNGRY_AT)) return 0;
  const f = Math.min(Math.max(food, 0), MAX_FOOD);
  return 0.35 + 0.65 * (1 - f / HUNGRY_AT);
}

/** The death screen's extra line: starvation never kills on its own, but it left the player at 1 health. */
export function hungerNote(cause: DamageCause | null, food: number): string | null {
  if (cause === 'hunger' || hungerState(food) !== 'starving') return null;
  return 'You were starving, and an empty stomach had worn your health down. Eat before you head out again.';
}

/** 252 -> "4:12" (buff timers on the HUD). */
export function clockTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
