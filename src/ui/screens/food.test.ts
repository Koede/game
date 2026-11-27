import { describe, expect, it } from 'vitest';
import { HUNGRY_AT } from '../../core/constants';
import { recipe, RECIPES } from '../../core/registry';
import type { RecipeDef } from '../../core/types';
import { WORKBENCH_RECIPES } from '../../game/crafting';
import { Inventory } from '../../game/inventory';
import {
  buffDuration, buffText, byproductNotes, clockTime, foodLine, foodRows, hungerLevel, hungerNote, hungerState, isKitchenRecipe,
  productBadges,
} from './food';
import { itemCard } from './inventory/slotViews';
import { recipeRows } from './inventory/recipeRows';

const r = (id: string): RecipeDef => {
  const found = recipe(id);
  if (!found) throw new Error(id);
  return found;
};

describe('food text', () => {
  it('says what a food restores, and its buff', () => {
    expect(foodLine('cooked_chop')).toBe('+8 food');
    expect(foodLine('hearth_stew')).toBe('+12 food, Well-Fed 6 min');
    expect(foodLine('iron_ingot')).toBeNull();
    expect(buffText({ hunger: 12, buff: 'well_fed', buffS: 360 })).toBe('Well-Fed 6 min');
    expect(buffText({ hunger: 3 })).toBeNull();
  });

  it('formats buff durations', () => {
    expect(buffDuration(360)).toBe('6 min');
    expect(buffDuration(90)).toBe('1.5 min');
    expect(buffDuration(45)).toBe('45 s');
    expect(clockTime(359.2)).toBe('6:00');
    expect(clockTime(251)).toBe('4:11');
    expect(clockTime(-3)).toBe('0:00');
  });

  it('puts food and the buff on the item card', () => {
    expect(foodRows('bread')).toEqual([['Eat', '+6 food']]);
    // The lookup rows (made at / used in) come last.
    expect(itemCard({ item: 'hearth_stew', count: 2 }).rows?.slice(0, 3)).toEqual([
      ['Count', '2'],
      ['Eat', '+12 food'],
      ['Buff', 'Well-Fed 6 min'],
    ]);
    expect(itemCard({ item: 'coal', count: 1 }).rows?.some(([k]) => k === 'Eat')).toBe(false);
  });

  it('says which bucket a lava fuel leaves behind', () => {
    expect(itemCard({ item: 'lava_bucket', count: 1 }).rows).toContainEqual(['Leaves', 'Bronze Bucket']);
  });
});

describe('recipe facts', () => {
  it('shows +N food on rows that make food, and nothing on others', () => {
    expect(productBadges(r('cooked_chop'))).toEqual([{ text: '+8 food', kind: 'food' }]);
    expect(productBadges(r('copper_ingot'))).toEqual([]);
  });

  it('notes the returned bucket for recipes with byproducts', () => {
    expect(byproductNotes(r('dough'))).toEqual(['Returns the bucket']);
    expect(productBadges(r('hearth_stew'))).toEqual([
      { text: '+12 food', kind: 'food' },
      { text: 'Well-Fed 6 min', kind: 'food' },
      { text: 'Returns the bucket', kind: 'note' },
    ]);
    expect(byproductNotes({ ...r('copper_ingot'), byproducts: [{ item: 'rubble', count: 2 }] })).toEqual(['Also gives 2 Rubble']);
  });

  it('carries the facts into workbench rows', () => {
    const inv = new Inventory(36);
    const dough = recipeRows(WORKBENCH_RECIPES, [inv], inv).find((row) => row.item === 'dough');
    expect(dough?.requirements).toEqual([{ text: 'Returns the bucket', kind: 'note' }]);
  });

  it('gathers every cooking and baking recipe at the furnace, and nothing else', () => {
    const kitchen = RECIPES.filter((x) => x.station === 'furnace' && isKitchenRecipe(x)).map((x) => x.id);
    expect(kitchen).toEqual(
      expect.arrayContaining(['cooked_fowl', 'cooked_mutton', 'cooked_chop', 'baked_potato', 'bread', 'hearth_stew', 'hearth_stew_mutton', 'hearth_stew_fowl']),
    );
    for (const id of kitchen) expect(r(id).output.item).not.toMatch(/ingot|hoe|bucket/);
    expect(isKitchenRecipe(r('bronze_hoe'))).toBe(false);
  });
});

describe('hunger state', () => {
  it('turns Hungry at the threshold and starving at an empty bar', () => {
    expect(hungerState(20)).toBe('fed');
    expect(hungerState(HUNGRY_AT + 0.01)).toBe('fed');
    expect(hungerState(HUNGRY_AT)).toBe('hungry');
    expect(hungerState(0.4)).toBe('hungry');
    expect(hungerState(0)).toBe('starving');
  });

  it('deepens the vignette as the bar empties', () => {
    expect(hungerLevel(20)).toBe(0);
    expect(hungerLevel(HUNGRY_AT + 0.5)).toBe(0);
    expect(hungerLevel(HUNGRY_AT)).toBeCloseTo(0.35);
    expect(hungerLevel(HUNGRY_AT / 2)).toBeGreaterThan(0.35);
    expect(hungerLevel(0)).toBe(1);
    expect(hungerLevel(Number.NaN)).toBe(0);
  });

  it('adds the starving line to the death screen only when hunger was not the cause', () => {
    expect(hungerNote('cold', 0)).toMatch(/starving/);
    expect(hungerNote('cold', 8)).toBeNull();
    expect(hungerNote('hunger', 0)).toBeNull();
  });
});

describe('drink text', () => {
  it('names the buff and its length like "+N food"', () => {
    expect(foodLine('light_roast')).toBe('Swift 3 min');
    expect(foodLine('green_tea')).toBe('Spring 3 min');
    expect(foodRows('berry_tea')).toEqual([['Drink', 'Mending 3 min'], ['Effect', 'Heal 2 times as fast']]);
    expect(foodRows('black_tea_cup')).toContainEqual(['Warms', '+10 warmth']);
  });

  it('an ingredient says which drink it brews', () => {
    expect(foodRows('ground_coffee')).toEqual([['Brews', 'Light Roast: Swift 3 min'], ['Effect', 'Walk, sprint and swim 20% faster']]);
    expect(foodRows('trail_blend')[0]).toEqual(['Brews', 'Trail Blend: Lasting 3 min']);
    expect(foodRows('dried_tea')[0][1]).toBe('Green Tea: Spring 3 min');
  });

  it('the item card of a cup of coffee carries the buff rows', () => {
    expect(itemCard({ item: 'dark_roast', count: 1 }).rows).toContainEqual(['Drink', 'Vigor 3 min']);
  });

  it('recipe rows badge the drink an ingredient makes, and the tea and coffee chain sits in the Kitchen chip', () => {
    expect(productBadges(r('ground_coffee')).map((b) => b.text)).toContain('Brews Light Roast');
    for (const id of ['dried_tea', 'black_tea', 'roasted_beans', 'dark_beans', 'ground_coffee', 'trail_blend', 'berry_tea_blend', 'kettle_pot']) {
      expect(isKitchenRecipe(r(id)), id).toBe(true);
    }
    expect(isKitchenRecipe(r('copper_ingot'))).toBe(false);
  });
});
