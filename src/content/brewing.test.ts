/** Brewing's data (BREWING_PLAN 3, 11): contracts, content, the cup table, recipes, goals and the solver. */
import { describe, expect, it } from 'vitest';
import { BOIL_TEMP_C, DRINK_BUFF_S, FLAG_BOILED_WATER, FLAG_BREWED, FLAG_SIX_CUPS } from '../core/constants';
import { CONTAINER_BLOCKS, CUP_BLOCK, CUP_STAGES, DRINK_BUFFS, DRINK_BUFF_KEYS, cupStageOfBlock } from '../core/brewing';
import { validateBrewing, type BrewTables } from '../core/brewValidation';
import {
  DRINKS, ITEMS, OBJECTIVES, RECIPES, block, blockOrNull, containerBoilingTo, containerEmptiedTo, drinkBrewedFrom, isBrewIngredient, item, itemOrNull,
  machine, recipesAt, recipesFor, validateContent, MACHINES,
} from '../core/registry';
import { hasPainter } from '../render/textures';
import { conditionMet, solve } from './progression';
import { BREW_SPEC } from './specRosterBrew';

const drinkRows = Object.fromEntries(DRINKS.map((d) => [d.key, [d.drink?.buff, d.drink?.buffS, d.drink?.warmth ?? 0]]));

describe('brewing contracts', () => {
  it('passes the registry validation, brewing checks included', () => {
    expect(validateContent()).toEqual([]);
  });

  it('has six drinks, three of each family, each with its own buff', () => {
    expect(drinkRows).toEqual(BREW_SPEC.drinks);
    expect(DRINKS.map((d) => d.drink?.buff).sort()).toEqual([...DRINK_BUFF_KEYS].sort());
    expect(DRINKS.filter((d) => d.drink?.family === 'tea')).toHaveLength(3);
    expect(DRINKS.filter((d) => d.drink?.family === 'coffee')).toHaveLength(3);
    for (const d of DRINKS) {
      expect(d.stack, d.key).toBe(1);
      expect(d.drink?.buffS, d.key).toBe(DRINK_BUFF_S);
      expect(DRINK_BUFFS[d.drink?.buff ?? 'spring'].family, d.key).toBe(d.drink?.family);
      expect(d.food, d.key).toBeUndefined();
      expect(hasPainter(`item_${d.key}`), d.key).toBe(true);
    }
  });

  it('brews each drink from exactly one ingredient', () => {
    const made = ITEMS.filter((it) => it.brews).map((it) => [it.key, it.brews, it.drink?.buff ?? null]);
    expect(Object.fromEntries(made.map(([k, b]) => [k, b]))).toEqual(Object.fromEntries(Object.entries(BREW_SPEC.brews).map(([k, v]) => [k, v[0]])));
    for (const [ingredient, [drink, buff, family]] of Object.entries(BREW_SPEC.brews)) {
      expect(isBrewIngredient(ingredient)).toBe(true);
      expect(drinkBrewedFrom(ingredient)?.key).toBe(drink);
      expect(drinkBrewedFrom(ingredient)?.drink).toMatchObject({ buff, family });
    }
    expect(new Set(ITEMS.filter((it) => it.brews).map((it) => it.brews)).size).toBe(6);
    expect(drinkBrewedFrom('stick')).toBeNull();
  });

  it('keeps one cup table: every stage has a brew_cup block and every block a stage', () => {
    for (const stage of CUP_STAGES) {
      expect(block(CUP_BLOCK[stage]).machine).toBe('brew_cup');
      expect(cupStageOfBlock(CUP_BLOCK[stage])).toBe(stage);
    }
    expect(machine('brew_cup').blocks.sort()).toEqual(Object.values(CUP_BLOCK).sort());
    expect(cupStageOfBlock('stone')).toBeNull();
    expect(block('clay_cup').itemKey).toBe('clay_cup');
    for (const stage of CUP_STAGES.slice(1)) expect(block(CUP_BLOCK[stage]).itemKey, stage).toBeNull();
  });

  it('makes the water bucket a container that boils to the boiling bucket and cools back', () => {
    expect(item('water_pail').container).toEqual({ holds: 'water', boilsTo: 'boiling_pail', emptyTo: 'pail' });
    expect(CONTAINER_BLOCKS.water_pail).toEqual({ cold: 'furnace_bucket', boiling: 'furnace_bucket_boiling' });
    expect(item('boiling_pail')).toMatchObject({ stack: 1, cools: { to: 'water_pail', afterS: 90 } });
    expect(containerBoilingTo('boiling_pail')?.key).toBe('water_pail');
    expect(containerEmptiedTo('pail')?.key).toBe('water_pail');
    expect(containerEmptiedTo('stick')).toBeNull();
  });

  it('puts a bucket on any furnace or hearth roof and gives the kettle the same places', () => {
    for (const key of ['furnace_bucket', 'furnace_bucket_boiling', 'kettle_pot']) {
      expect(block(key).placeOn, key).toEqual(expect.arrayContaining(['furnace_clay', 'furnace_star', 'brick', 'star_casing']));
    }
    expect(machine('kettle').params).toMatchObject({ boilC: 120, fillL: 1000, drainL: 1000 });
    expect(machine('boil_bucket').params?.boilC).toBe(BOIL_TEMP_C);
  });

  it('flags broken tables', () => {
    const tables: BrewTables = {
      items: ITEMS.map((it) => (it.key === 'dried_tea' ? { ...it, brews: 'stick' } : it)),
      knownItem: (k) => itemOrNull(k) !== null,
      block: blockOrNull,
      machine: (k) => (k === 'kettle' ? { ...machine('kettle'), role: 'crop' } : MACHINES.get(k) ?? null),
    };
    const problems = validateBrewing(tables);
    expect(problems.some((p) => p.includes('dried_tea') && p.includes('not a drink item'))).toBe(true);
    expect(problems.some((p) => p.includes('kettle') && p.includes("role must be 'brew'"))).toBe(true);
  });
});

describe('brewing content', () => {
  it('has the roster of blocks, items, properties, machines and recipes', () => {
    for (const key of BREW_SPEC.blocks) expect(blockOrNull(key), key).not.toBeNull();
    for (const key of BREW_SPEC.items) expect(itemOrNull(key), key).not.toBeNull();
    for (const [key, props] of Object.entries(BREW_SPEC.blockProps)) expect(block(key), key).toMatchObject(props);
    for (const [kind, [role, numbers]] of Object.entries(BREW_SPEC.machines)) {
      expect(machine(kind).role, kind).toBe(role);
      expect(machine(kind).params, kind).toEqual(numbers);
    }
    const line = (r: (typeof RECIPES)[number]): string => {
      const io = `${r.id}: ${r.output.count} ${r.output.item} <- ${r.inputs.map((i) => `${i.count} ${i.item}`).join(', ')}`;
      return r.station === 'furnace' ? `${io} @${r.minTempC}${r.kind === 'smelt' ? ` ${r.timeS}s` : ''} T${r.minTier}` : io;
    };
    for (const [station, lines] of Object.entries(BREW_SPEC.recipes)) {
      const mine = recipesAt(station).map(line).filter((l) => lines.includes(l));
      expect(mine, station).toEqual(lines);
    }
  });

  it('regrows both bush families after 360 s, and cuttings plant the bare bush', () => {
    for (const [bush, fruit, cutting] of [['tea_bush', 'tea_leaves', 'tea_cutting'], ['coffee_shrub', 'coffee_cherries', 'coffee_cutting']] as const) {
      expect(machine(bush)).toMatchObject({ role: 'bush', blocks: [bush, `${bush}_bare`], params: { regrowS: 360 } });
      expect(block(bush).harvestLeaves).toBe(`${bush}_bare`);
      expect(block(bush).drops).toEqual([{ item: fruit, count: [2, 3] }, { item: cutting, count: 1, chance: 0.25 }]);
      expect(item(cutting).block).toBe(`${bush}_bare`);
      expect(block(`${bush}_bare`).placeOn).toContain('farmland');
    }
  });

  it('keeps crucible inputs unique and the dark roast at 400 C', () => {
    expect(recipesFor('dark_beans')[0]).toMatchObject({ minTempC: 400, kind: 'smelt', inputs: [{ item: 'roasted_beans', count: 1 }] });
    expect(recipesFor('black_tea')[0]).toMatchObject({ minTempC: 250 });
    const inputs = recipesAt('furnace').filter((r) => r.kind === 'smelt').map((r) => r.inputs[0].item);
    expect(new Set(inputs).size).toBe(inputs.length);
  });

  it('places the goals right after bake_bread, in order', () => {
    const ids = OBJECTIVES.map((o) => o.id);
    const at = ids.indexOf('bake_bread');
    expect(ids.slice(at + 1, at + 4)).toEqual(['boil_bucket', 'first_brew', 'six_cups']);
    expect(OBJECTIVES.filter((o) => o.condition.type === 'flag').map((o) => (o.condition as { flag: string }).flag)).toEqual(
      expect.arrayContaining([FLAG_BOILED_WATER, FLAG_BREWED, FLAG_SIX_CUPS]),
    );
  });
});

describe('brewing in the progression solver', () => {
  const start = solve(0);
  const clay = solve(1);

  it('harvests both bush families from the world, cuttings included', () => {
    for (const key of ['tea_leaves', 'tea_cutting', 'coffee_cherries', 'coffee_cutting']) expect(start.items.has(key), key).toBe(true);
  });

  it('reaches all six drinks, boiling water and the goals with the Clay Furnace alone', () => {
    for (const key of ['clay_cup', 'drip_cone', 'kettle_pot', 'boiling_pail', ...DRINKS.map((d) => d.key)]) expect(clay.items.has(key), key).toBe(true);
    for (const flag of [FLAG_BOILED_WATER, FLAG_BREWED, FLAG_SIX_CUPS]) expect(conditionMet({ type: 'flag', flag }, clay), flag).toBe(true);
    expect(clay.hottestC).toBeGreaterThanOrEqual(400);
  });

  it('cannot brew before there is a furnace', () => {
    expect(start.items.has('boiling_pail')).toBe(false);
    expect(start.items.has('green_tea')).toBe(false);
    expect(conditionMet({ type: 'flag', flag: FLAG_BREWED }, start)).toBe(false);
  });

  it('finishes without brewing: no drink is an ingredient of anything but a cup', () => {
    for (const r of RECIPES) for (const i of r.inputs) expect(DRINKS.map((d) => d.key), r.id).not.toContain(i.item);
  });
});
