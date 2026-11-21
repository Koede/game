import { describe, expect, it } from 'vitest';
import { FLAG_FIRST_POUR, MOLTEN_WINDOW_S, MOULD_POURS } from '../core/constants';
import { CAST_METALS, MOULDS, castOf } from '../core/registry';
import type { FurnaceEntity } from './entities';
import { ALLOY_POT, pourOptions } from './casting';
import { fire, makeKit, type Kit } from './testKit';
import { sanitizeEntity } from './sanitize';

/** A lit furnace hot enough for anything cast, with the player holding the given moulds. */
function setup(moulds: string[] = []): { kit: Kit; e: FurnaceEntity } {
  const kit = makeKit();
  const e = kit.furnace(0, 1, 0);
  fire(kit, e, 'charcoal');
  e.tempC = 900;
  for (const m of moulds) kit.player.inventory.add(m, 1);
  return { kit, e };
}

const molten = (e: FurnaceEntity, i: number, ingot: string, count: number, s = MOLTEN_WINDOW_S): void => {
  e.crucibleMelt[i] = { item: ingot, count };
  e.crucibleMoltenS[i] = s;
};

describe('molten smelts', () => {
  it('a finished copper smelt is molten metal, not an ingot', () => {
    const { kit, e } = setup();
    e.crucibleIn[0] = { item: 'copper_ore', count: 1 };
    kit.run(30);
    expect(e.crucibleOut[0]).toBeNull();
    expect(e.crucibleMelt[0]).toEqual({ item: 'copper_ingot', count: 1 });
    expect(e.crucibleMoltenS[0]).toBeGreaterThan(MOLTEN_WINDOW_S - 5);
    const v = kit.sim.furnaceView(0, 1, 0)!.crucibles[0];
    expect(v.moltenS).toBeGreaterThan(0);
    expect(v.status).toMatch(/^Molten Copper Ingot - pour it in \d+ s$/);
  });

  it('metal not poured in time cools into blooms, which smelt back into ingots', () => {
    const { kit, e } = setup();
    e.crucibleIn[0] = { item: 'copper_ore', count: 2 };
    kit.run(30);
    kit.run(MOLTEN_WINDOW_S + 12);
    expect(e.crucibleMelt[0]).toBeNull();
    expect(e.crucibleOut[0]).toEqual({ item: 'copper_bloom', count: 2 });
    expect(kit.sim.pourCrucible(0, 1, 0, 0, 'ingot_mould')).toEqual({ ok: false, reason: 'It has gone cold - smelt the bloom again' });
    // Blooms are re-smelted: take them out, put them in as input.
    e.crucibleIn[0] = e.crucibleOut[0];
    e.crucibleOut[0] = null;
    kit.run(20);
    expect(e.crucibleMelt[0]).toEqual({ item: 'copper_ingot', count: 2 });
  });

  it('iron comes out as ingots at once (only the cast metals go molten)', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    e.electric = false;
    fire(kit, e, 'coke');
    e.tempC = 1300;
    e.crucibleIn[0] = { item: 'iron_ore', count: 1 };
    kit.run(30);
    expect(e.crucibleOut[0]).toEqual({ item: 'iron_ingot', count: 1 });
    expect(e.crucibleMelt[0]).toBeNull();
  });

  it('a second smelt adds to the pool and restarts the window; another metal waits', () => {
    const { kit, e } = setup();
    molten(e, 0, 'copper_ingot', 1, 3);
    e.crucibleIn[0] = { item: 'copper_ore', count: 1 };
    kit.run(15);
    expect(e.crucibleMelt[0]?.count).toBe(2);
    expect(e.crucibleMoltenS[0]).toBeGreaterThan(MOLTEN_WINDOW_S - 6);
    const f = setup();
    molten(f.e, 0, 'tin_ingot', 1);
    f.e.crucibleIn[0] = { item: 'copper_ore', count: 1 };
    f.kit.run(20);
    expect(f.e.crucibleIn[0]?.count).toBe(1);
    expect(f.kit.sim.furnaceView(0, 1, 0)!.crucibles[0].active).toBe(false);
  });
});

describe('pour matrix', () => {
  const cases: Array<[string, string, string, number]> = [];
  for (const m of MOULDS) for (const metal of CAST_METALS) {
    const cast = castOf(m.item, metal.ingot);
    if (cast) cases.push([m.item, metal.ingot, cast.item, cast.units]);
  }

  it('the table has every mould and the three metals', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases)('%s poured with %s makes %s (needs %i)', (mould, ingot, made, units) => {
    const { kit, e } = setup([mould]);
    molten(e, 0, ingot, units + 1);
    const events = kit.record('cast:poured');
    const flags = kit.record('flag');
    expect(kit.sim.pourCrucible(0, 1, 0, 0, mould)).toEqual({ ok: true });
    expect(kit.player.inventory.count(made)).toBe(Math.floor((units + 1) / units));
    expect(e.crucibleMelt[0]?.count ?? 0).toBe((units + 1) % units);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ mould, item: made, at: 'furnace' });
    expect(flags.filter((f) => f.flag === FLAG_FIRST_POUR)).toHaveLength(1);
    expect(kit.player.inventory.slots.find((s) => s?.item === mould)?.durability).toBe(MOULD_POURS - Math.floor((units + 1) / units));
  });

  it('refuses a mould that does not take the metal, a short pool and no mould', () => {
    const { kit, e } = setup(['pickaxe_mould', 'ingot_mould']);
    molten(e, 0, 'copper_ingot', 3);
    expect(kit.sim.pourCrucible(0, 1, 0, 0, 'pickaxe_mould')).toMatchObject({ ok: false, reason: expect.stringContaining('does not take') });
    molten(e, 1, 'bronze_ingot', 2);
    expect(kit.sim.pourCrucible(0, 1, 0, 1, 'pickaxe_mould')).toMatchObject({ ok: false, reason: expect.stringContaining('Needs 3 molten') });
    expect(kit.sim.pourCrucible(0, 1, 0, 0, null)).toMatchObject({ ok: false });
    expect(kit.sim.pourCrucible(0, 1, 0, 0, 'axe_mould')).toMatchObject({ ok: false, reason: expect.stringContaining('You have no') });
    expect(kit.sim.pourCrucible(0, 1, 0, 9, 'ingot_mould')).toMatchObject({ ok: false });
    expect(e.crucibleMelt[0]?.count).toBe(3);
  });

  it('refuses when the pack cannot hold the cast', () => {
    const { kit, e } = setup(['ingot_mould']);
    for (let i = 0; i < kit.player.inventory.size; i++) if (!kit.player.inventory.slots[i]) kit.player.inventory.slots[i] = { item: 'dirt', count: 1 };
    molten(e, 0, 'copper_ingot', 2);
    expect(kit.sim.pourCrucible(0, 1, 0, 0, 'ingot_mould')).toEqual({ ok: false, reason: 'Your pack is full' });
  });
});

describe('mould wear', () => {
  it('wears one pour per cast and breaks at zero; the most worn mould goes first', () => {
    const { kit, e } = setup();
    const inv = kit.player.inventory;
    inv.add('ingot_mould', 1, 5);
    inv.add('ingot_mould', 1, 2);
    molten(e, 0, 'copper_ingot', 3);
    const broke = kit.record('tool:broke');
    expect(kit.sim.pourCrucible(0, 1, 0, 0, 'ingot_mould').ok).toBe(true);
    // The worn mould (2 pours left) takes the 2 casts and breaks; the other stays whole.
    const left = inv.slots.filter((s) => s?.item === 'ingot_mould').map((s) => s!.durability);
    expect(left).toEqual([5]);
    expect(broke).toEqual([{ item: 'ingot_mould' }]);
    expect(inv.count('copper_ingot')).toBe(2);
    expect(e.crucibleMelt[0]?.count).toBe(1);
  });

  it('pourOptions lists the moulds in the pack that fit the metal', () => {
    const { kit, e } = setup(['ingot_mould', 'pickaxe_mould', 'axe_mould']);
    molten(e, 0, 'bronze_ingot', 4);
    const options = pourOptions(e, 0, kit.player.inventory.slots);
    expect(options.map((o) => o.mould).sort()).toEqual(['axe_mould', 'ingot_mould', 'pickaxe_mould']);
    expect(options.find((o) => o.mould === 'ingot_mould')).toMatchObject({ casts: 4, makes: 'bronze_ingot', poursLeft: MOULD_POURS });
    molten(e, 1, 'copper_ingot', 4);
    expect(pourOptions(e, 1, kit.player.inventory.slots).map((o) => o.mould)).toEqual(['ingot_mould']);
    expect(pourOptions(e, 2, kit.player.inventory.slots)).toEqual([]);
  });
});

describe('alloy pot', () => {
  it('3 copper and 1 tin poured into a pot make 4 molten bronze, which pours into the bronze moulds', () => {
    const { kit, e } = setup(['pickaxe_mould']);
    e.crucibleIn[2] = { item: ALLOY_POT, count: 1 };
    molten(e, 0, 'copper_ingot', 3);
    molten(e, 1, 'tin_ingot', 1);
    expect(kit.sim.pourCrucible(0, 1, 0, 0, ALLOY_POT).ok).toBe(true);
    expect(e.crucibleMelt[0]).toBeNull();
    expect(e.crucibleMix[2]).toEqual([3, 0]);
    expect(e.crucibleMelt[2]).toBeNull();
    expect(kit.sim.furnaceView(0, 1, 0)!.crucibles[2].status).toBe('Alloy pot: 3 copper, 0 tin');
    expect(kit.sim.pourCrucible(0, 1, 0, 1, ALLOY_POT).ok).toBe(true);
    expect(e.crucibleMix[2]).toEqual([0, 0]);
    expect(e.crucibleMelt[2]).toEqual({ item: 'bronze_ingot', count: 4 });
    expect(e.crucibleMoltenS[2]).toBe(MOLTEN_WINDOW_S);
    expect(kit.sim.pourCrucible(0, 1, 0, 2, 'pickaxe_mould').ok).toBe(true);
    expect(kit.player.inventory.count('bronze_pickaxe_head')).toBe(1);
    expect(e.crucibleMelt[2]).toEqual({ item: 'bronze_ingot', count: 1 });
  });

  it('refuses without a pot, for a non-alloy metal, when too cold and when the pot is full of one metal', () => {
    const { kit, e } = setup();
    molten(e, 0, 'copper_ingot', 6);
    expect(kit.sim.pourCrucible(0, 1, 0, 0, ALLOY_POT)).toEqual({ ok: false, reason: 'Set an alloy pot in another crucible first' });
    e.crucibleIn[1] = { item: ALLOY_POT, count: 1 };
    molten(e, 2, 'bronze_ingot', 1);
    expect(kit.sim.pourCrucible(0, 1, 0, 2, ALLOY_POT)).toMatchObject({ ok: false, reason: 'Only copper and tin go into the pot' });
    e.tempC = 500;
    expect(kit.sim.pourCrucible(0, 1, 0, 0, ALLOY_POT)).toMatchObject({ ok: false, reason: expect.stringContaining('Needs 800 C') });
    e.tempC = 900;
    expect(kit.sim.pourCrucible(0, 1, 0, 0, ALLOY_POT).ok).toBe(true);
    expect(e.crucibleMix[1]).toEqual([6, 0]);
    expect(e.crucibleMelt[0]).toBeNull();
    molten(e, 0, 'copper_ingot', 1);
    expect(kit.sim.pourCrucible(0, 1, 0, 0, ALLOY_POT)).toMatchObject({ ok: false, reason: expect.stringContaining('full of copper') });
  });

  it('the pot goes into a crucible slot through the slot rules', () => {
    const { kit } = setup();
    expect(kit.sim.furnaceSlots(0, 1, 0)!.crucibleIn.accepts(ALLOY_POT, 0)).toBe(true);
  });
});

describe('save and load', () => {
  it('molten state survives a JSON round trip and sanitising, and old saves get empty fields', () => {
    const { e } = setup();
    molten(e, 0, 'tin_ingot', 2, 7.5);
    e.crucibleMix[1] = [2, 1];
    const copy = JSON.parse(JSON.stringify(e)) as FurnaceEntity;
    expect(sanitizeEntity(copy)).toBe('ok');
    expect(copy.crucibleMelt[0]).toEqual({ item: 'tin_ingot', count: 2 });
    expect(copy.crucibleMoltenS[0]).toBe(7.5);
    expect(copy.crucibleMix[1]).toEqual([2, 1]);
    const old = JSON.parse(JSON.stringify(e)) as Record<string, unknown>;
    delete old.crucibleMelt;
    delete old.crucibleMoltenS;
    delete old.crucibleMix;
    sanitizeEntity(old as unknown as FurnaceEntity);
    expect(old.crucibleMelt).toEqual([null]);
    expect(old.crucibleMoltenS).toEqual([0]);
  });

  it('keeps counting down after load: a loaded pool still cools on time', () => {
    const { kit, e } = setup();
    molten(e, 0, 'copper_ingot', 2, 4);
    kit.run(5);
    expect(e.crucibleOut[0]).toEqual({ item: 'copper_bloom', count: 2 });
  });

  it('repairs a pool with a bad item or negative time', () => {
    const { e } = setup();
    const raw = JSON.parse(JSON.stringify(e)) as Record<string, unknown>;
    raw.crucibleMelt = [{ item: 'nonsense', count: 2 }];
    raw.crucibleMoltenS = [-4];
    expect(sanitizeEntity(raw as unknown as FurnaceEntity)).toBe('repaired');
    expect(raw.crucibleMelt).toEqual([null]);
    expect(raw.crucibleMoltenS).toEqual([0]);
  });
});
