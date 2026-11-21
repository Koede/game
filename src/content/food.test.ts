/** Spec section 12: food, farming and animals - the data the hunger, crop and animal code will run on. */
import { describe, expect, it } from 'vitest';
import {
  BLOCKS, CREATURES, ITEMS, MACHINES, MAX_FURNACE_TIER, RECIPES, TEXTURE_NAMES,
  block, creature, fuelOf, item, machine, recipesAt, recipesFor, validateCreature,
} from '../core/registry';
import type { CreaturePart, CreatureSpec } from '../core/types';
import { conditionMet, solve } from './progression';
import { FOOD_SPEC } from './specRosterFood';

const sorted = (keys: Iterable<string>): string[] => [...keys].sort();

describe('food items', () => {
  it('restore the hunger of table 12.2, and only those items are edible', () => {
    const edible = Object.fromEntries(ITEMS.filter((it) => it.food).map((it) => [it.key, it.food?.hunger]));
    expect(edible).toEqual(FOOD_SPEC.hunger);
    for (const it of ITEMS.filter((i) => i.food)) expect(it.category, it.key).toBe('food');
  });

  it('grants Well-Fed only from the forged stew', () => {
    const buffs = Object.fromEntries(ITEMS.filter((it) => it.food?.buff).map((it) => [it.key, [it.food?.buff, it.food?.buffS]]));
    expect(buffs).toEqual(FOOD_SPEC.buffs);
    for (const r of recipesFor('hearth_stew')) expect([r.station, r.kind], r.id).toEqual(['furnace', 'forge']);
  });

  it('makes cooking worth it: every cooked dish fills more than what went into the crucible', () => {
    const kitchen = recipesAt('furnace').filter((r) => item(r.output.item).food);
    expect(kitchen.map((r) => r.id).sort()).toEqual(['baked_potato', 'bread', 'cooked_chop', 'cooked_fowl', 'cooked_mutton', 'hearth_stew', 'hearth_stew_fowl', 'hearth_stew_mutton']);
    for (const r of kitchen.filter((k) => k.kind === 'smelt')) {
      const raw = item(r.inputs[0].item).food?.hunger ?? 0;
      expect(item(r.output.item).food?.hunger ?? 0, r.id).toBeGreaterThan(raw);
    }
  });

  it('cooks in a Clay Furnace that only burns sticks', () => {
    const stickFlame = fuelOf('stick')?.flameTempC ?? 0;
    for (const r of RECIPES.filter((rec) => item(rec.output.item).food && rec.station === 'furnace')) {
      expect(r.minTier, r.id).toBe(1);
      expect(r.minTempC, r.id).toBeLessThan(stickFlame);
    }
  });

  it('gives every stew back its pail, and the dough too', () => {
    for (const id of ['hearth_stew', 'hearth_stew_mutton', 'hearth_stew_fowl', 'dough']) {
      const r = RECIPES.find((rec) => rec.id === id);
      expect(r?.inputs, id).toContainEqual({ item: 'water_pail', count: 1 });
      expect(r?.byproducts, id).toEqual([{ item: 'pail', count: 1 }]);
    }
  });

  it('grinds flour by hand on the quern, stroke by stroke, and on the crusher by machine', () => {
    const hand = recipesFor('flour').find((r) => r.station === 'hand_quern');
    const mill = recipesFor('flour').find((r) => r.station === 'crusher');
    expect(hand).toBeDefined();
    expect(hand?.strokes).toBe(6);
    expect(hand?.inputs).toEqual([{ item: 'wheat', count: 1 }]);
    expect(mill?.id).toBe('flour_milled');
  });
});

describe('farming', () => {
  it('has three hoes that are never a mining tool', () => {
    const hoes = ITEMS.filter((it) => it.tool?.kind === 'hoe');
    expect(Object.fromEntries(hoes.map((h) => [h.key, [h.tool?.tier, h.tool?.durability]]))).toEqual(FOOD_SPEC.hoes);
    for (const h of hoes) expect(h.tool?.speed, h.key).toBe(1);
    expect(BLOCKS.filter((b) => b.tool === 'hoe')).toEqual([]);
    expect(recipesFor('flint_hoe').map((r) => r.station)).toEqual(['hand']);
  });

  it('plants seeds, potatoes and carrots as the first stage of their crop, with icons of their own', () => {
    const planting = Object.fromEntries(ITEMS.filter((it) => it.block && it.block !== it.key).map((it) => [it.key, it.block]));
    expect(planting).toEqual(FOOD_SPEC.plants);
    for (const key of Object.keys(FOOD_SPEC.plants)) {
      expect(item(key).icon, key).toBe(`item_${key}`);
      expect(item(key).iconLayer, key).toBe(TEXTURE_NAMES.indexOf(`item_${key}`));
    }
  });

  it('grows each crop through four stage blocks carried by one crop machine', () => {
    const spec = machine('crop');
    expect(spec.role).toBe('crop');
    expect(spec.blocks).toEqual(['wheat', 'potato', 'carrot'].flatMap((c) => [0, 1, 2, 3].map((s) => `${c}_${s}`)));
    expect([...MACHINES.values()].filter((m) => m.role === 'crop')).toEqual([spec]);
    for (const key of spec.blocks) {
      const def = block(key);
      const [crop, stage] = key.split('_');
      expect(TEXTURE_NAMES[def.layers[0]], key).toBe(`${crop}_stage${stage}`);
      expect(def.name.endsWith(stage === '3' ? '(ripe)' : ')'), def.name).toBe(true);
      expect(def.hardness, key).toBe(0);
      expect(def.solid || def.opaque || def.replaceable, key).toBe(false);
    }
    for (const [key, props] of Object.entries(FOOD_SPEC.blockProps)) expect(block(key), key).toMatchObject(props);
  });

  it('ripens in 300 s with water close by and 600 s without (params of spec 12.4)', () => {
    const p = machine('crop').params ?? {};
    const stages = 3;
    expect(stages * p.stageS).toBe(300);
    expect((stages * p.stageS) / p.dryRate).toBe(600);
    expect([p.lampRadius, p.hydrationRadius, p.minSunlight]).toEqual([5, 4, 0.3]);
  });

  it('draws farmland as dark furrows on top of plain dirt sides', () => {
    const def = block('farmland');
    expect(TEXTURE_NAMES[def.layers[2]]).toBe('farmland_top');
    expect(TEXTURE_NAMES[def.layers[0]]).toBe('dirt');
    expect(TEXTURE_NAMES[def.layers[3]]).toBe('dirt');
  });
});

describe('animals', () => {
  const mirror = (p: CreaturePart): string => JSON.stringify([[-p.to[0], p.from[1], p.from[2]], [-p.from[0], p.to[1], p.to[2]], p.color]);
  const shape = (p: CreaturePart): string => JSON.stringify([p.from, p.to, p.color]);

  it('has the species of table 12.5', () => {
    expect(CREATURES.map((c) => c.key)).toEqual(Object.keys(FOOD_SPEC.creatures));
    for (const [key, numbers] of Object.entries(FOOD_SPEC.creatures)) expect(creature(key), key).toMatchObject(numbers);
    for (const c of CREATURES) {
      expect(c.desc.length, c.key).toBeGreaterThan(20);
      expect(c.group[0], c.key).toBeGreaterThanOrEqual(2); // a group can always breed
    }
    expect(() => creature('dragon')).toThrow();
  });

  it('builds left-right symmetric models that fit their collision box', () => {
    for (const c of CREATURES) {
      const shapes = new Set(c.model.map(shape));
      for (const p of c.model) expect(shapes.has(mirror(p)), `${c.key}.${p.name} has no mirror image`).toBe(true);
      const halfWidth = Math.max(...c.model.map((p) => Math.max(-p.from[0], p.to[0])));
      expect(halfWidth * 2, c.key).toBeLessThanOrEqual(c.size.w * 16 * 1.05);
      expect(validateCreature(c), c.key).toEqual([]);
    }
  });

  it('flags broken species', () => {
    const hen = creature('hen');
    const broken: CreatureSpec = {
      ...hen,
      key: 'broken', biomes: [], drops: [{ item: 'unobtainium', count: 1 }], likes: [], group: [3, 1],
      model: [
        ...hen.model.filter((p) => p.anim !== 'legFR'),
        { name: 'body', from: [0, 0, 0], to: [0, 4, 4], color: 0x1000000, anim: 'head', pivot: [9, 9, 9] },
      ],
    };
    const problems = validateCreature(broken).join('\n');
    for (const fragment of ['no biomes', 'unobtainium', 'likes nothing', 'group', 'duplicate model part', 'empty or inverted', 'colour', 'pivot', 'legFR']) {
      expect(problems).toContain(fragment);
    }
  });

  it('likes only things a player can carry before the first furnace', () => {
    const start = solve(0);
    for (const c of CREATURES) for (const like of c.likes) expect(start.items.has(like), `${c.key} likes ${like}`).toBe(true);
  });
});

describe('progression with food', () => {
  const start = solve(0);
  const clay = solve(1);

  it('feeds the player from the first minute: hunting and gathering need no furnace', () => {
    for (const key of ['raw_fowl', 'raw_mutton', 'raw_chop', 'hide', 'potato', 'carrot', 'wheat_seeds', 'wheat', 'flour', 'flint_hoe']) {
      expect(start.items.has(key), key).toBe(true);
    }
    expect(start.source.get('raw_chop')).toBe('animal:boar');
    expect(conditionMet({ type: 'flag', flag: 'ate' }, start)).toBe(true);
    expect(conditionMet({ type: 'flag', flag: 'tilled' }, start)).toBe(true);
    expect(conditionMet({ type: 'place', block: 'wheat_0' }, start)).toBe(true);
    expect(start.items.has('bread')).toBe(false);
  });

  it('cooks, bakes and makes stew with the Clay Furnace', () => {
    for (const key of ['cooked_fowl', 'cooked_mutton', 'cooked_chop', 'baked_potato', 'dough', 'bread', 'hearth_stew']) {
      expect(clay.items.has(key), key).toBe(true);
    }
    expect(clay.recipes.has('flour_milled')).toBe(false); // the crusher is Forge Age
    expect(solve(MAX_FURNACE_TIER).recipes.has('flour_milled')).toBe(true);
  });

  it('farms wheat from tall-grass seed when no wild wheat grows, and needs soil to till for it', () => {
    const noWild = solve(1, ['wild_wheat']);
    expect(noWild.items.has('bread')).toBe(true);
    expect(noWild.source.get('wheat')).toBe('crop:wheat_3');
    const noSoil = solve(1, ['wild_wheat', 'grass', 'dirt']);
    expect(noSoil.items.has('wheat_seeds')).toBe(true);
    expect(noSoil.items.has('wheat')).toBe(false);
  });

  it('only gets potatoes and carrots from the wild plants that start their crops', () => {
    const p = solve(1, ['wild_potato', 'wild_carrot']);
    expect(p.items.has('potato')).toBe(false);
    expect(p.items.has('carrot')).toBe(false);
    expect(p.items.has('hearth_stew')).toBe(false);
    expect(p.items.has('bread')).toBe(true);
  });
});

describe('texture names of section 12', () => {
  it('names every new block face and icon', () => {
    const names = new Set(TEXTURE_NAMES);
    const expected = [
      'farmland_top', 'wild_wheat', 'wild_potato', 'wild_carrot',
      ...['wheat', 'potato', 'carrot'].flatMap((c) => [0, 1, 2, 3].map((s) => `${c}_stage${s}`)),
      ...FOOD_SPEC.items.map((key) => `item_${key}`),
    ];
    expect(sorted(expected.filter((n) => !names.has(n)))).toEqual([]);
  });
});
