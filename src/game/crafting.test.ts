import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { recipe } from '../core/registry';
import type { RecipeDef } from '../core/types';
import {
  BENCH_RECIPES,
  BUILD_RECIPES,
  HAND_RECIPES,
  WORKBENCH_RECIPES,
  availability,
  craft,
  craftByPlayer,
  ingredientStatus,
  maxCraftable,
  mergeAmounts,
  takeIngredients,
  tally,
} from './crafting';
import { Inventory, makeStack } from './inventory';
import { PlayerState } from './playerState';

const need = (id: string): RecipeDef => {
  const r = recipe(id);
  if (!r) throw new Error(`no recipe ${id}`);
  return r;
};

describe('crafting', () => {
  it('lists the hand and workbench recipes', () => {
    expect(HAND_RECIPES.map((r) => r.id)).toContain('flint_pickaxe');
    expect(HAND_RECIPES.every((r) => r.station === 'hand')).toBe(true);
    expect(WORKBENCH_RECIPES.map((r) => r.id)).toEqual([
      'furnace_clay', 'crate', 'belt_pouch', 'stone_brick', 'pail', 'padded_coat', 'padded_coat_hide', 'bellows', 'bellows_hide', 'dough',
      'ground_coffee', 'ground_dark_coffee', 'berry_tea_blend', 'trail_blend',
      'hand_quern', 'stone_anvil', 'clay_table', 'loom', 'tanning_trough', 'bronze_hammer',
      'bronze_pickaxe', 'bronze_axe', 'bronze_shovel', 'bronze_hoe', 'bronze_maul',
      // Essentia & Research (src/content/recipesMagic.ts), last.
      'research_table', 'crucible', 'vis_rod', 'essentia_jar',
      // (The Bronze workshop pieces are made at the Bronze Furnace now: src/content/recipesWorkshop.ts.)
      // Glassware (src/content/itemsGlass.ts).
      'water_beaker', 'water_vial',
      // Decorating (src/content/areas/decor.ts; area files load in name order, decor before synergy).
      'dining_table', 'plank_bench', 'bookshelf',
      // Hen eggs (src/content/areas/farm_eggs.ts).
      'dough_egg',
      // Goat milk and wool (src/content/areas/synergy_animals.ts; area files load in name order).
      'shears', 'milk_tea', 'milk_coffee', 'dough_milk', 'padded_coat_wool', 'bellows_wool', 'wool_bedding',
      // Tool-and-block synergy (src/content/areas/synergy_tools.ts).
      'plank_slab', 'stone_slab', 'brick_slab', 'stone_brick_slab', 'stone_pillar', 'brick_pillar', 'brick_lintel', 'brick_chimney',
      'bronze_plate_block', 'brick_from_slabs',
      // Heat as a resource (src/content/areas/warmth.ts).
      'insulated_wall',
    ]);
  });

  it('counts ingredients across several inventories', () => {
    const pack = new Inventory(4);
    const crate = new Inventory(4);
    pack.add('flint', 1);
    crate.add('flint', 1);
    crate.add('stick', 2);
    const pickaxe = need('flint_pickaxe');
    const status = availability(pickaxe, [pack, crate]);
    expect(status.ok).toBe(false);
    expect(status.ingredients).toEqual([
      { item: 'flint', need: 2, have: 2, ok: true },
      { item: 'stick', need: 2, have: 2, ok: true },
      { item: 'cord', need: 1, have: 0, ok: false },
    ]);
    crate.add('cord', 1);
    expect(availability(pickaxe, [pack, crate]).ok).toBe(true);
    expect(availability(pickaxe, [pack, crate], 2).ok).toBe(false);
    // The same inventory listed twice counts once; a prebuilt tally gives the same answer.
    expect(availability(pickaxe, [crate, crate]).ingredients[0].have).toBe(1);
    expect(availability(pickaxe, tally([pack, crate])).ok).toBe(true);
    expect(ingredientStatus([{ item: 'flint', count: 1 }, { item: 'flint', count: 2 }], [pack, crate]).ingredients).toEqual([
      { item: 'flint', need: 3, have: 2, ok: false },
    ]);
    expect(mergeAmounts([{ item: 'a', count: 1 }, { item: 'b', count: 2 }, { item: 'a', count: 3 }], 2)).toEqual([
      { item: 'a', count: 8 },
      { item: 'b', count: 4 },
    ]);
  });

  it('takes from the player first, then from crates', () => {
    const pack = new Inventory(4);
    const crate = new Inventory(4);
    pack.add('plank', 4);
    crate.add('plank', 10);
    const result = craft(need('workbench'), [pack, crate], pack);
    expect(result).toEqual({ ok: true, made: [{ item: 'workbench', count: 1 }] });
    expect(pack.count('plank')).toBe(0);
    expect(crate.count('plank')).toBe(8);
    expect(pack.count('workbench')).toBe(1);
  });

  it('is atomic when an ingredient is missing', () => {
    const pack = new Inventory(4);
    const crate = new Inventory(4);
    pack.add('flint', 2);
    crate.add('stick', 2);
    const before = JSON.stringify([pack, crate]);
    let changes = 0;
    pack.onChange(() => changes++);
    const result = craft(need('flint_pickaxe'), [pack, crate], pack);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual([{ item: 'cord', count: 1 }]);
      expect(result.reason).toMatch(/^Missing 1 /);
    }
    expect(JSON.stringify([pack, crate])).toBe(before);
    expect(changes).toBe(0);
    expect(takeIngredients([{ item: 'flint', count: 2 }, { item: 'stick', count: 3 }], [pack, crate])).toBe(false);
    expect(JSON.stringify([pack, crate])).toBe(before);
    expect(takeIngredients([{ item: 'flint', count: 1 }, { item: 'stick', count: 1 }], [pack, crate], 2)).toBe(true);
    expect(pack.isEmpty() && crate.isEmpty()).toBe(true);
  });

  it('refuses, changing nothing, when the outputs do not fit', () => {
    const pack = new Inventory(2);
    const crate = new Inventory(2);
    pack.set(0, makeStack('rubble', 5));
    pack.set(1, makeStack('clay', 5));
    crate.add('oak_log', 1);
    const before = JSON.stringify([pack, crate]);
    const result = craft(need('plank'), [pack, crate], pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/^No room for 4 /);
    expect(JSON.stringify([pack, crate])).toBe(before);
    expect(maxCraftable(need('plank'), [pack, crate], pack)).toBe(0);
    expect(maxCraftable(need('plank'), [pack, crate])).toBe(1);
  });

  it('lets the ingredients make room for the outputs', () => {
    const pack = new Inventory(1);
    pack.add('oak_log', 1);
    expect(maxCraftable(need('plank'), [pack], pack)).toBe(1);
    expect(craft(need('plank'), [pack], pack).ok).toBe(true);
    expect(pack.toJSON()).toEqual([{ item: 'plank', count: 4 }]);
    // Two logs cannot both go: the second log still occupies the only slot.
    const tight = new Inventory(1);
    tight.add('oak_log', 2);
    expect(maxCraftable(need('plank'), [tight], tight)).toBe(0);
    expect(craft(need('plank'), [tight], tight).ok).toBe(false);
    expect(tight.toJSON()).toEqual([{ item: 'oak_log', count: 2 }]);
  });

  it('crafts several at once and reports how many are possible', () => {
    const pack = new Inventory(3);
    pack.add('oak_log', 5);
    const plank = need('plank');
    expect(maxCraftable(plank, [pack], pack)).toBe(5);
    expect(maxCraftable(plank, [pack], pack, 2)).toBe(2);
    expect(craft(plank, [pack], pack, 3)).toEqual({ ok: true, made: [{ item: 'plank', count: 12 }] });
    expect(pack.count('oak_log')).toBe(2);
    expect(craft(plank, [pack], pack, 3).ok).toBe(false);
    expect(craft(plank, [pack], pack, 0).ok).toBe(false);
    expect(pack.count('plank')).toBe(12);
    // Tools take a slot each: with one free slot only one pickaxe can be made, whatever the materials.
    const kit = new Inventory(4);
    kit.add('flint', 60);
    kit.add('stick', 60);
    kit.add('cord', 60);
    expect(maxCraftable(need('flint_pickaxe'), [kit])).toBe(30);
    expect(maxCraftable(need('flint_pickaxe'), [kit], kit)).toBe(1);
  });

  it('craftByPlayer announces what was made and counts it', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const made: string[] = [];
    const sounds: string[] = [];
    bus.on('item:made', (e) => made.push(`${e.count} ${e.item} @${e.station} #${e.recipeId}`));
    bus.on('sfx', (e) => sounds.push(e.name));
    const crate = new Inventory(2);
    crate.add('pine_log', 2);
    expect(craftByPlayer(player, need('plank_pine'), { crates: [crate], times: 2 }).ok).toBe(true);
    expect(made).toEqual(['8 plank @chopping_block #plank_pine']);
    expect(sounds).toEqual(['craft']);
    expect(player.stats.made.plank).toBe(8);
    expect(player.inventory.count('plank')).toBe(8);
    expect(craftByPlayer(player, need('workbench'), { sfx: null }).ok).toBe(true);
    expect(sounds).toEqual(['craft']);
    expect(craftByPlayer(player, need('workbench')).ok).toBe(false);
    expect(player.stats.made.workbench).toBe(1);
  });
});

describe('workbench offers hand recipes too', () => {
  it('lists every workbench recipe first, then every hand recipe', () => {
    expect(BENCH_RECIPES.slice(0, WORKBENCH_RECIPES.length)).toEqual([...WORKBENCH_RECIPES]);
    for (const r of HAND_RECIPES) expect(BENCH_RECIPES).toContain(r);
    expect(BENCH_RECIPES.length).toBe(WORKBENCH_RECIPES.length + BUILD_RECIPES.length + HAND_RECIPES.length);
    expect(new Set(BENCH_RECIPES.map((r) => r.id)).size).toBe(BENCH_RECIPES.length);
  });
});
