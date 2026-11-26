import { describe, expect, it } from 'vitest';
import { recipe } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import type { ForgeRow, FurnaceView, SmeltRow } from '../../../sim';
import { fire, makeKit } from '../../../sim/testKit';
import {
  FORGE_CATEGORIES, forgeAvailable, forgeCategory, forgeReady, forgeRowView, forgeRowViews, forgeShortfall, SMELT_CATEGORIES, smeltCategory,
  smeltRowViews,
} from './forgeRows';
import {
  bestFuelSlot, burnFraction, burnText, clockText, flameLook, fuelLoadCount, shortName, slotOf, sourceText, statusTone, thermoNotches,
  upgradeProgress,
} from './furnaceText';
import { pretty } from './simApi';

const r = (id: string): RecipeDef => {
  const found = recipe(id);
  if (!found) throw new Error(id);
  return found;
};

/** A real furnace view from the simulation (clay furnace at the origin). */
function liveView(setup?: (kit: ReturnType<typeof makeKit>) => void): FurnaceView {
  const kit = makeKit();
  kit.furnace(0, 1, 0);
  setup?.(kit);
  const view = kit.sim.furnaceView(0, 1, 0);
  if (!view) throw new Error('no furnace');
  return view;
}

describe('forge rows', () => {
  it('sorts every forge recipe into one of the four chips', () => {
    expect(forgeCategory(r('bronze_pickaxe'))).toBe('tools');
    expect(forgeCategory(r('shield_suit'))).toBe('tools');
    expect(forgeCategory(r('power_drill'))).toBe('tools');
    expect(forgeCategory(r('item_pipe'))).toBe('parts');
    expect(forgeCategory(r('circuit'))).toBe('parts');
    expect(forgeCategory(r('crusher'))).toBe('machines');
    expect(forgeCategory(r('lamp'))).toBe('machines');
    expect(forgeCategory(r('thermopile'))).toBe('machines');
    expect(forgeCategory(r('copper_cable'))).toBe('machines');
    expect(forgeCategory(r('battery'))).toBe('machines');
    expect(forgeCategory(r('brick'))).toBe('parts');
    expect(forgeCategory(r('concrete'))).toBe('parts');
    expect(forgeCategory(r('hearth_stew'))).toBe('kitchen');
    expect(forgeCategory(r('hearth_stew_fowl'))).toBe('kitchen');
    expect(forgeCategory(r('bronze_hoe'))).toBe('tools');
    expect(FORGE_CATEGORIES[0].id).toBe('kitchen');
  });

  it('shows stew variants the player can make, else the one they are closest to', () => {
    const stews = (setup: (kit: ReturnType<typeof makeKit>) => void): string[] =>
      forgeRowViews(liveView(setup).forge)
        .filter((v) => v.item === 'hearth_stew')
        .map((v) => v.id);
    expect(stews(() => undefined)).toEqual(['hearth_stew']);
    expect(stews((kit) => kit.player.give('cooked_fowl', 1))).toEqual(['hearth_stew_fowl']);
    const both = (kit: ReturnType<typeof makeKit>): void => {
      for (const item of ['cooked_chop', 'cooked_mutton', 'potato', 'potato', 'carrot', 'carrot', 'water_pail', 'water_pail']) kit.player.give(item, 1);
    };
    expect(stews(both)).toEqual(['hearth_stew', 'hearth_stew_mutton']);
    const stew = forgeRowViews(liveView(both).forge).find((v) => v.id === 'hearth_stew');
    expect(stew?.requirements?.map((q) => q.text)).toEqual(['300 °C', '+12 food', 'Well-Fed 6 min', 'Returns the bucket']);
  });

  it('turns live rows into kit rows: heat badge, locked tier badge, have/need chips, reason', () => {
    const view = liveView((kit) => {
      kit.player.give('bronze_ingot', 2);
      kit.player.give('glass', 1);
      const e = kit.sim.furnaceAt(0, 1, 0);
      if (e) e.tempC = 820;
    });
    const bronze = view.forge.find((f) => f.recipe.id === 'item_pipe') as ForgeRow;
    const row = forgeRowView(bronze);
    expect(row.available).toBe(1);
    expect(row.action).toBe('Forge');
    expect(row.requirements?.[0]).toMatchObject({ kind: 'heat', met: true, tempC: 800 });
    expect(row.ingredients.map((i) => [i.item, i.have, i.need])).toEqual([['bronze_ingot', 2, 2], ['glass', 1, 1]]);

    const steel = forgeRowView(view.forge.find((f) => f.recipe.id === 'steel_ingot') as ForgeRow);
    expect(steel.locked).toBe(true);
    expect(steel.available).toBe(0);
    expect(steel.requirements?.[0]).toMatchObject({ kind: 'tier', text: 'Blast Furnace', met: false });
    expect(steel.reason).toBe('Needs the Blast Furnace');

    const pick = forgeRowView(view.forge.find((f) => f.recipe.id === 'bronze_bucket') as ForgeRow);
    expect(pick.reason).toMatch(/^Missing 1 Bronze Ingot/);

    const cold = liveView().forge.find((f) => f.recipe.id === 'item_pipe') as ForgeRow;
    expect(forgeRowView(cold).reason).toBe('Needs 800 °C - charcoal, or logs with the bellows');
    expect(forgeReady(view.forge)).toBeGreaterThanOrEqual(1);
  });

  it('limits the batch by heat, ingredients and 99', () => {
    const base = { canMake: true, max: 7, heatAllows: 3 } as ForgeRow;
    expect(forgeAvailable(base)).toBe(3);
    expect(forgeAvailable({ ...base, heatAllows: Infinity })).toBe(7);
    expect(forgeAvailable({ ...base, max: 500, heatAllows: Infinity })).toBe(99);
    expect(forgeAvailable({ ...base, canMake: false })).toBe(0);
  });

  it('explains a short batch only when something was made', () => {
    expect(forgeShortfall(5, 5, 'bronze_ingot')).toBeNull();
    expect(forgeShortfall(0, 5, 'bronze_ingot')).toBeNull();
    expect(forgeShortfall(2, 5, 'bronze_ingot')).toMatch(/^Forged 2 of 5 Bronze Ingot/);
  });
});

describe('smelt reference rows', () => {
  const row = (id: string, have: number, locked = false): SmeltRow => ({ recipe: r(id), locked, tempOk: true, have, reason: locked ? 'Needs the Blast Furnace' : null });

  it('shows one route per product unless the player holds input for several', () => {
    const ids = (rows: SmeltRow[]): string[] => smeltRowViews(rows).map((v) => v.id);
    expect(ids([row('charcoal', 0), row('charcoal_pine', 0)])).toEqual(['charcoal']);
    expect(ids([row('charcoal', 0), row('charcoal_pine', 4)])).toEqual(['charcoal_pine']);
    expect(ids([row('copper_ingot', 2), row('copper_ingot_crushed', 6)])).toEqual(['copper_ingot', 'copper_ingot_crushed']);
  });

  it('offers Load while cold, refuses locked rows and asks for missing input', () => {
    const [views] = [smeltRowViews([{ ...row('copper_ingot', 3), tempOk: false }])];
    expect(views[0]).toMatchObject({ action: 'Load', available: 3 });
    expect(views[0].requirements?.find((q) => q.kind === 'heat')?.met).toBe(false);
    const locked = smeltRowViews([row('iron_ingot', 4, true)])[0];
    expect(locked.locked).toBe(true);
    expect(locked.available).toBe(0);
    expect(smeltRowViews([row('aluminum_ingot', 1)])[0]).toMatchObject({ available: 0, reason: 'Bring 2 Alumina' });
  });

  it('gathers cooking under the Kitchen chip and says what each dish restores', () => {
    expect(SMELT_CATEGORIES.map((c) => c.id)).toEqual(['kitchen', 'materials', 'fuel']);
    expect(['cooked_fowl', 'cooked_mutton', 'cooked_chop', 'baked_potato', 'bread'].map((id) => smeltCategory(r(id)))).toEqual(Array(5).fill('kitchen'));
    expect(smeltCategory(r('charcoal'))).toBe('fuel');
    expect(smeltCategory(r('coke'))).toBe('fuel');
    expect(smeltCategory(r('copper_ingot'))).toBe('materials');
    expect(smeltCategory(r('glass'))).toBe('materials');
    const bread = smeltRowViews([row('bread', 2)])[0];
    expect(bread.category).toBe('kitchen');
    expect(bread.requirements?.filter((q) => q.kind === 'food')).toEqual([{ text: '+6 food', kind: 'food' }]);
  });
});

describe('furnace texts', () => {
  it('formats clocks and names', () => {
    expect(clockText(42.2)).toBe('0:43');
    expect(clockText(725)).toBe('12:05');
    expect(clockText(Infinity)).toBe('--:--');
    expect(shortName('copper_ingot')).toBe('Copper');
    expect(shortName('glass')).toBe('Glass');
    expect(pretty('Needs 700 C - now 512 C')).toBe('Needs 700 °C - now 512 °C');
    expect(pretty('Missing 2 Coke')).toBe('Missing 2 Coke');
  });

  it('marks crucible, selected recipe, upgrade and flame temperatures on the thermometer', () => {
    const view = liveView((kit) => {
      const e = kit.sim.furnaceAt(0, 1, 0);
      if (!e) return;
      e.crucibleIn[0] = { item: 'copper_ore', count: 2 };
      fire(kit, e, 'coal', 5);
      kit.run(2);
    });
    const notches = thermoNotches(view, r('item_pipe'));
    expect(notches).toContainEqual({ tempC: 700, label: 'Copper', kind: 'threshold' });
    // Only one mark besides the flame limit: what is cooking now wins over the touched recipe and the upgrade.
    expect(notches).toHaveLength(2);
    expect(notches.find((n) => n.label === 'Flame')).toMatchObject({ tempC: 1250, kind: 'limit' });
    // With nothing cooking, the touched recipe is the mark; with neither, the upgrade temperature.
    const idle = liveView((kit) => {
      const e = kit.sim.furnaceAt(0, 1, 0);
      if (e) fire(kit, e, 'charcoal', 3);
      kit.run(2);
    });
    expect(thermoNotches(idle, r('item_pipe'))).toContainEqual({ tempC: 800, label: 'Bronze Chute', kind: 'threshold' });
    expect(thermoNotches(idle, null)).toContainEqual({ tempC: 700, label: 'Upgrade', kind: 'threshold' });
    // The same recipe twice collapses.
    expect(thermoNotches(view, r('copper_ingot')).filter((n) => n.label === 'Copper')).toHaveLength(1);
  });

  it('tones the status line by what it asks of the player', () => {
    const cold = liveView();
    expect(cold.status).toBe('No fuel');
    expect(statusTone(cold)).toBe('warn');
    const burning = liveView((kit) => {
      const e = kit.sim.furnaceAt(0, 1, 0);
      if (e) fire(kit, e, 'charcoal', 3);
      kit.run(1);
    });
    expect(statusTone(burning)).toBe('heat');
    expect(flameLook(burning)).toMatchObject({ mode: 'fire' });
    expect(burnText(burning)[0]).toBe('Charcoal');
    expect(burnFraction(burning)).toBeGreaterThan(0.9);
    expect(flameLook(cold)).toMatchObject({ mode: 'none', height: 0 });
    expect(burnText(cold)).toEqual(['Firebox', 'Empty']);
  });

  it('counts upgrade materials per item up to the need', () => {
    expect(
      upgradeProgress({
        next: {} as never, requiredC: 700, tempOk: true, ok: false, reason: null,
        ingredients: [
          { item: 'firebrick', need: 12, have: 20, ok: true },
          { item: 'bronze_ingot', need: 8, have: 5, ok: false },
          { item: 'bellows', need: 1, have: 0, ok: false },
        ],
      }),
    ).toEqual({ have: 17, need: 21 });
  });

  it('says where a missing item comes from', () => {
    expect(sourceText('bellows')).toBe('make it at the workbench');
    expect(sourceText('bronze_ingot')).toBe('alloy copper and tin in an alloy pot at 800 °C');
    expect(sourceText('iron_ingot')).toBe('smelt it here at 1150 °C (Blast Furnace)');
    expect(sourceText('tungsten_powder')).toBe('made by the Crusher');
    expect(sourceText('cord')).toBe('craft it by hand');
    expect(sourceText('clay')).toBe('gather or mine it');
  });

  it('picks real fuel before wood for Add fuel, sticks and planks before logs, and never a tool', () => {
    expect(bestFuelSlot([{ item: 'oak_log', count: 3 }, { item: 'coal', count: 1 }, { item: 'plank', count: 9 }])).toBe(1);
    expect(bestFuelSlot([{ item: 'oak_log', count: 3 }, { item: 'coke', count: 1 }, { item: 'coal', count: 9 }])).toBe(1);
    // A clay furnace (800 °C) burns charcoal before coke; a Blast Furnace (1500 °C) wants the coke.
    const coke = [{ item: 'coke', count: 3 }, { item: 'charcoal', count: 14 }, { item: 'coal', count: 2 }];
    expect(bestFuelSlot(coke, { maxTempC: 800 })).toBe(1);
    expect(bestFuelSlot(coke, { maxTempC: 1500 })).toBe(0);
    expect(bestFuelSlot(coke, { maxTempC: 1600 })).toBe(0);
    expect(bestFuelSlot([{ item: 'oak_log', count: 3 }, { item: 'plank', count: 9 }, { item: 'stick', count: 3 }])).toBe(2);
    expect(bestFuelSlot([{ item: 'oak_log', count: 3 }, { item: 'plank', count: 9 }])).toBe(1);
    expect(bestFuelSlot([{ item: 'stick', count: 3 }, { item: 'oak_log', count: 1 }])).toBe(0);
    // Baking charcoal: logs stay in the pack while anything else burns, and are the last resort otherwise.
    expect(bestFuelSlot([{ item: 'pine_log', count: 4 }, { item: 'plank', count: 2 }], { spareSmeltable: true })).toBe(1);
    expect(bestFuelSlot([null, { item: 'oak_log', count: 4 }], { spareSmeltable: true })).toBe(1);
    expect(bestFuelSlot([{ item: 'copper_ore', count: 3 }, null, { item: 'flint_pickaxe', count: 1, durability: 10 }])).toBe(-1);
    expect(slotOf([null, { item: 'sand', count: 2 }], 'sand')).toBe(1);
  });

  it('loads about two minutes of fuel per tap, at least one item', () => {
    expect(fuelLoadCount('plank', 8)).toBe(6);
    expect(fuelLoadCount('oak_log', 4)).toBe(3);
    expect(fuelLoadCount('coal', 12)).toBe(2);
    expect(fuelLoadCount('coke', 5)).toBe(2); // 100 s each
    expect(fuelLoadCount('stick', 2)).toBe(2);
  });
});
