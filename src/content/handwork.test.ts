import { describe, expect, it } from 'vitest';
import { CAST_METALS, MACHINES, MOULDS, OBJECTIVES, RECIPES, block, castMetalOfIngot, castOf, isHandStation, item, mouldOf, recipe, recipesAt, validateContent } from '../core/registry';
import { MOLTEN_WINDOW_S, MOULD_POURS } from '../core/constants';
import { isMachineRecipe, solve } from './progression';
import { HAND_SPEC } from './specRosterHand';

const STROKES: Record<string, number> = {
  plank: 3, plank_pine: 3, stick: 2, flour: 6, copper_plate: 8, bronze_plate: 8, copper_wire: 6, crushed_copper_mortar: 8, crushed_tin_mortar: 8, cloth: 10,
  unfired_cup: 4, unfired_cone: 4, unfired_alloy_pot: 4, unfired_ingot_mould: 4, unfired_pickaxe_mould: 4, unfired_axe_mould: 4,
  unfired_shovel_mould: 4, unfired_hoe_mould: 4, unfired_maul_mould: 4,
};
const TIMED: Record<string, number> = { soaked_hide: 60, leather: 120, bronze_ingot_alloy: 8 };

describe('Ember handwork data (EMBER_PLAN section 2)', () => {
  it('validates, and the constants are the plan\'s', () => {
    expect(validateContent()).toEqual([]);
    expect(MOLTEN_WINDOW_S).toBe(20);
    expect(MOULD_POURS).toBe(40);
  });

  it('gives every stroke recipe the stroke count of the plan and every timed one its time', () => {
    for (const [id, n] of Object.entries(STROKES)) expect(recipe(id)?.strokes, id).toBe(n);
    for (const [id, s] of Object.entries(TIMED)) {
      expect(recipe(id)?.timeS, id).toBe(s);
      expect(recipe(id)?.strokes, id).toBeUndefined();
    }
    expect(recipe('plank')?.toolOutput).toEqual({ item: 'plank', count: 6 });
    expect(recipe('crushed_copper_mortar')?.bonus).toEqual({ item: 'crushed_copper', count: 1, chance: 0.35 });
  });

  it('makes each station a block of a hand machine, with the tool and sound of its table row', () => {
    const rows: Record<string, [number, string | undefined, string | undefined]> = {
      chopping_block: [4, 'axe', 'chop'], hand_quern: [3, undefined, 'grind'], stone_anvil: [2.5, 'hammer', 'hammer'],
      mortar: [2, undefined, 'grind'], clay_table: [2, undefined, 'scrape'], loom: [2, undefined, 'loom'],
    };
    for (const [key, [rate, tool, sound]] of Object.entries(rows)) {
      const hs = block(key).handStation;
      expect(hs?.strokesPerS, key).toBe(rate);
      expect(hs?.tool, key).toBe(tool);
      expect(hs?.strokeSound, key).toBe(sound);
      expect(isHandStation(key), key).toBe(true);
      expect(recipesAt(key).length, key).toBeGreaterThan(0);
    }
    expect(block('stone_anvil').handStation?.hot).toBe(true);
    expect(block('drying_rack').handStation?.sky).toBe(true);
    for (const key of HAND_SPEC.blocks) expect(MACHINES.get(block(key).machine ?? '')?.role, key).toBe('hand');
    expect(block('stone_anvil').handStation?.tool && item('flint_hammer').tool?.kind).toBe('hammer');
  });

  it('casts: every mould, metal and head resolves, and a pour costs what the instant forge recipe did', () => {
    expect(CAST_METALS.map((m) => m.key)).toEqual(['copper', 'tin', 'bronze']);
    expect(castOf('ingot_mould', 'copper_ingot')).toEqual({ item: 'copper_ingot', units: 1 });
    expect(castOf('ingot_mould', 'iron_ingot')).toBeNull();
    expect(castOf('pickaxe_mould', 'tin_ingot')).toBeNull();
    const units: Record<string, number> = { pickaxe: 3, axe: 3, shovel: 1, hoe: 2, maul: 4 };
    for (const [kind, n] of Object.entries(units)) expect(castOf(`${kind}_mould`, 'bronze_ingot'), kind).toEqual({ item: `bronze_${kind}_head`, units: n });
    for (const m of MOULDS) {
      expect(item(m.item).mould?.pours, m.item).toBe(MOULD_POURS);
      expect(item(m.item).stack, m.item).toBe(1);
      expect(mouldOf(m.item)).toBe(m);
      // Each mould is fired from its unfired piece in a crucible.
      expect(RECIPES.some((r) => r.station === 'furnace' && r.kind === 'smelt' && r.inputs[0].item === m.unfired && r.output.item === m.item), m.item).toBe(true);
    }
    expect(castMetalOfIngot('copper_ingot')?.bloom).toBe('copper_bloom');
    expect(castMetalOfIngot('iron_ingot')).toBeNull();
    for (const m of CAST_METALS) expect(RECIPES.some((r) => r.output.item === m.ingot && r.inputs[0].item === m.bloom), m.key).toBe(true);
  });

  it('moves the instant recipes onto the stations, and binds tools from cast heads', () => {
    expect(recipe('plank')?.station).toBe('chopping_block');
    expect(recipe('stick')?.station).toBe('chopping_block');
    expect(recipe('flour')?.station).toBe('hand_quern');
    expect(recipe('copper_wire')?.station).toBe('stone_anvil');
    for (const kind of ['pickaxe', 'axe', 'shovel', 'hoe', 'maul']) {
      const r = recipe(`bronze_${kind}`);
      expect(r?.station).toBe('workbench');
      expect(r?.inputs.map((i) => i.item)).toEqual([`bronze_${kind}_head`, 'stick', 'cord']);
    }
    expect(recipe('bronze_ingot_alloy')?.inputs).toEqual([{ item: 'copper_ingot', count: 3 }, { item: 'tin_ingot', count: 1 }]);
    expect(RECIPES.filter((r) => r.output.item === 'bronze_ingot').map((r) => r.id).sort()).toEqual(['bronze_ingot_alloy', 'bronze_ingot_bloom']);
    expect(recipe('padded_coat')?.inputs.map((i) => i.item)).toContain('cloth');
  });

  it('keeps every hand station recipe to one input item type per station (the sim picks the recipe by input)', () => {
    // Where two recipes share an input the loaded count picks the job (the sim runs the first the count can pay for): their
    // counts must differ and be listed from the dearest down.
    for (const station of HAND_SPEC.blocks) {
      const rs = recipesAt(station);
      for (const r of rs) {
        const same = rs.filter((o) => o.inputs[0].item === r.inputs[0].item);
        expect(new Set(same.map((o) => o.inputs[0].count)).size, `${station}/${r.id}`).toBe(same.length);
        expect(same.map((o) => o.inputs[0].count), `${station}/${r.id}`).toEqual([...same.map((o) => o.inputs[0].count)].sort((a, b) => b - a));
      }
    }
  });

  it('can be completed with zero machines: every hand goal is reachable at furnace tier 1, in the plan\'s order', () => {
    const p = solve(1);
    const ids = OBJECTIVES.map((o) => o.id);
    const order = ['place_chopping_block', 'make_planks', 'place_workbench', 'place_clay_table', 'fire_mould', 'smelt_copper', 'first_pour', 'place_quern', 'grind_flour',
      'bake_bread', 'place_anvil', 'hammer_plate', 'make_bronze', 'cast_pick_head', 'forge_maul', 'bronze_pickaxe', 'place_drying_rack', 'make_leather', 'weave_cloth'];
    order.reduce((prev, id) => {
      expect(ids.indexOf(id), id).toBeGreaterThan(prev);
      return ids.indexOf(id);
    }, -1);
    for (const key of [...HAND_SPEC.blocks, ...HAND_SPEC.items, 'bronze_pickaxe', 'bronze_hoe', 'bronze_maul', 'bronze_axe', 'bronze_shovel', 'padded_coat']) {
      expect(p.items.has(key), key).toBe(true);
    }
    // No machine recipe is needed for any item of the Ember handwork or its tools.
    const route = (key: string, seen = new Set<string>()): void => {
      if (seen.has(key)) return;
      seen.add(key);
      const r = recipe(p.source.get(key) ?? '');
      if (!r) return;
      expect(isMachineRecipe(r), `${key} via ${r.id}`).toBe(false);
      for (const i of r.inputs) route(i.item, seen);
    };
    for (const key of [...HAND_SPEC.items, 'bronze_pickaxe', 'bronze_maul', 'padded_coat', 'bronze_plate', 'leather']) route(key);
  });

  it('only gets ingots through a fired ingot mould, and blooms without one', () => {
    const p = solve(1);
    expect(p.source.get('copper_ingot')).toBe('copper_ingot');
    expect(p.source.get('copper_bloom')).toBe('copper_ingot:bloom');
    expect(p.source.get('bronze_pickaxe_head')).toBe('cast:pickaxe_mould');
  });
});
