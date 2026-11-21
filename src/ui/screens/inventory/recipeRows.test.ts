import { describe, expect, it } from 'vitest';
import { createBus } from '../../../core/context';
import { recipe } from '../../../core/registry';
import { HAND_RECIPES, WORKBENCH_RECIPES } from '../../../game/crafting';
import { Inventory } from '../../../game/inventory';
import { PlayerState } from '../../../game/playerState';
import { makeRecipe, recipeRows } from './recipeRows';

describe('recipeRows', () => {
  it('shows have/need per ingredient and how many can be made', () => {
    const inv = new Inventory(36);
    inv.add('fiber', 7);
    const row = recipeRows(HAND_RECIPES, [inv], inv).find((r) => r.item === 'cord');
    expect(row).toMatchObject({ id: 'cord', name: 'Cord', available: 2, ingredients: [{ item: 'fiber', name: 'Fiber', have: 7, need: 3 }] });
    expect(row?.reason).toBeUndefined();
  });

  it('says what is missing', () => {
    const inv = new Inventory(36);
    inv.add('flint', 1);
    const row = recipeRows(HAND_RECIPES, [inv], inv).find((r) => r.item === 'flint_pickaxe');
    expect(row?.available).toBe(0);
    expect(row?.reason).toBe('Missing 1 Flint, 2 Stick, 1 Cord');
  });

  it('merges variants of the same output into one row, preferring the one that can be made', () => {
    const inv = new Inventory(36);
    const planks = () => recipeRows(HAND_RECIPES, [inv], inv).filter((r) => r.item === 'plank');
    expect(planks()).toHaveLength(1);
    expect(planks()[0].id).toBe('plank');
    inv.add('pine_log', 2);
    expect(planks()[0]).toMatchObject({ id: 'plank_pine', available: 2 });
    const ids = recipeRows(HAND_RECIPES, [inv], inv).map((r) => r.item);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('counts crates as sources and explains a full pack', () => {
    const inv = new Inventory(1);
    const crate = new Inventory(27);
    crate.add('rubble', 12);
    crate.add('clay', 6);
    inv.add('stick', 99);
    const row = recipeRows(WORKBENCH_RECIPES, [inv, crate], inv).find((r) => r.item === 'furnace_clay');
    expect(row?.ingredients.map((i) => i.have)).toEqual([12, 6]);
    expect(row?.available).toBe(0);
    expect(row?.reason).toMatch(/^No room for Clay Furnace/);
  });
});

describe('makeRecipe', () => {
  it('makes as many as possible up to the asked batch, from the player first and then crates', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const crate = new Inventory(27);
    player.give('oak_log', 1);
    crate.add('oak_log', 1);
    const made: unknown[] = [];
    bus.on('item:made', (e) => made.push(e));
    const result = makeRecipe(player, recipe('plank')!, 5, [crate]);
    expect(result.ok).toBe(true);
    expect(player.inventory.count('plank')).toBe(8);
    expect(crate.count('oak_log')).toBe(0);
    expect(made).toEqual([{ item: 'plank', count: 8, station: 'hand', recipeId: 'plank' }]);
  });

  it('refuses with a reason when nothing can be made', () => {
    const player = new PlayerState(createBus());
    const result = makeRecipe(player, recipe('workbench')!, 1, []);
    expect(result.ok).toBe(false);
  });
});
