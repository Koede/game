import { describe, expect, it } from 'vitest';
import { AMBIENT_TEMP_C, DRAFT_FLAME_BONUS_C, FORGE_CHILL_C, FURNACE_HOT_C } from '../core/constants';
import { blockId, blockOf, fuelOf, furnaceTier, recipe } from '../core/registry';
import { makeVoxel, voxelActive, voxelFacing } from '../core/types';
import { fire, makeKit } from './testKit';

const FUELS: Array<[string, string]> = [
  ['stick', 'furnace_clay'], ['plank', 'furnace_clay'], ['oak_log', 'furnace_clay'],
  ['charcoal', 'furnace_blast'], ['coal', 'furnace_blast'], ['coke', 'furnace_arc'],
];

describe('furnace heat', () => {
  it.each(FUELS)('a %s fire reaches its flame temperature and sits there', (fuel, block) => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, block);
    e.electric = false;
    e.fuel[0] = { item: fuel, count: 99 };
    e.fuel[e.fuel.length - 1] = { item: fuel, count: 99 };
    expect(kit.sim.light(0, 1, 0).ok).toBe(true);
    const flame = fuelOf(fuel)!.flameTempC;
    kit.run(300);
    expect(e.tempC).toBeCloseTo(flame, 6);
    kit.run(20);
    expect(e.tempC).toBeCloseTo(flame, 6);
    expect(kit.sim.furnaceView(0, 1, 0)!.trend).toBe('steady');
  });

  it('never exceeds the tier maximum', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'coal');
    kit.run(300);
    expect(e.tempC).toBe(furnaceTier(1).maxTempC);
  });

  it('bellows raise the flame by up to 250 C and burn fuel faster', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'stick', 99);
    kit.run(120);
    const before = e.tempC;
    const left = e.fuel[0]!.count;
    kit.run(24);
    const calm = left - e.fuel[0]!.count;
    let peak = 0;
    const left2 = e.fuel[0]!.count;
    for (let i = 0; i < 24; i++) {
      for (let p = 0; p < 3; p++) kit.sim.pump(0, 1, 0);
      kit.run(1);
      peak = Math.max(peak, e.tempC);
    }
    const pumped = left2 - e.fuel[0]!.count;
    expect(e.draft).toBeGreaterThan(0.85);
    expect(peak).toBeGreaterThan(before + 200);
    expect(peak).toBeLessThanOrEqual(before + DRAFT_FLAME_BONUS_C + 1e-6);
    expect(calm).toBe(2);
    expect(pumped).toBeGreaterThanOrEqual(calm * 2 - 1);
    kit.run(30);
    expect(e.draft).toBe(0);
  });

  it('cools along the exponential curve once the fire is out', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'oak_log', 4);
    kit.run(100);
    kit.sim.douse(0, 1, 0);
    const t0 = e.tempC;
    const tier = furnaceTier(1);
    const tau = tier.heatCapacityJ / tier.lossWPerC;
    kit.run(tau);
    const expected = AMBIENT_TEMP_C + (t0 - AMBIENT_TEMP_C) / Math.E;
    expect(Math.abs(e.tempC - expected)).toBeLessThan(2);
    kit.run(2000);
    expect(e.tempC).toBeCloseTo(AMBIENT_TEMP_C, 3);
  });

  it('lights only with fuel, goes out when it is burned, relights when fuel is added while hot', () => {
    const kit = makeKit();
    const lit = kit.record('furnace:lit');
    const out = kit.record('furnace:out');
    const flags = kit.record('flag');
    const e = kit.furnace(0, 1, 0);
    expect(kit.sim.light(0, 1, 0)).toEqual({ ok: false, reason: 'No fuel in the firebox' });
    fire(kit, e, 'plank', 2);
    expect(flags).toContainEqual({ flag: 'furnace_lit' });
    expect(kit.sim.light(0, 1, 0).ok).toBe(false);
    kit.run(39);
    expect(e.lit).toBe(true);
    expect(voxelActive(kit.world.getVoxel(0, 1, 0))).toBe(true);
    kit.run(2);
    expect(e.lit).toBe(false);
    expect(out).toHaveLength(1);
    expect(e.tempC).toBeGreaterThan(FURNACE_HOT_C);
    e.fuel[0] = { item: 'plank', count: 1 };
    kit.run(0.1);
    expect(e.lit).toBe(true);
    expect(lit).toHaveLength(2);
    kit.run(600);
    expect(voxelActive(kit.world.getVoxel(0, 1, 0))).toBe(false);
    e.fuel[0] = { item: 'plank', count: 1 };
    kit.run(1);
    expect(e.lit).toBe(false);
  });

  it('a doused fire stays out and keeps its fuel', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'plank', 5);
    kit.run(30);
    expect(kit.sim.douse(0, 1, 0).ok).toBe(true);
    kit.run(5);
    expect(e.lit).toBe(false);
    expect(e.fuel[0]!.count).toBe(3);
    expect(kit.sim.douse(0, 1, 0).ok).toBe(false);
  });
});

describe('crucibles', () => {
  it('only advance at or above the recipe temperature, faster when hotter', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    const r = recipe('copper_ingot')!;
    e.crucibleIn[0] = { item: 'copper_ore', count: 3 };
    fire(kit, e, 'oak_log');
    kit.run(200);
    expect(e.tempC).toBeCloseTo(650, 3);
    expect(e.crucibleProgress[0]).toBe(0);
    expect(kit.sim.furnaceView(0, 1, 0)!.status).toBe('Copper Ingot needs 700 C - now 650');
    e.tempC = r.minTempC;
    e.lit = false;
    kit.run(1);
    // Just under 700 C again after a tick of cooling: no progress.
    expect(e.crucibleProgress[0]).toBeLessThanOrEqual(0.05 + 1e-9);

    const hot = makeKit();
    const h = hot.furnace(0, 1, 0);
    fire(hot, h, 'charcoal');
    hot.run(120);
    expect(h.tempC).toBe(800);
    h.crucibleIn[0] = { item: 'copper_ore', count: 3 };
    // At 800 C: speed 1 x (1 + 100/300) -> the 10 s recipe takes 7.5 s.
    hot.run(7.3);
    expect(h.crucibleOut[0]).toBeNull();
    hot.run(7.9);
    expect(h.crucibleOut[0]).toEqual({ item: 'copper_ingot', count: 2 });
  });

  it('report each finished item and stop when the output is full', () => {
    const kit = makeKit();
    const smelted = kit.record('furnace:smelted');
    const made = kit.record('item:made');
    const e = kit.furnace(0, 1, 0);
    e.crucibleIn[0] = { item: 'clay', count: 4 };
    e.crucibleOut[0] = { item: 'firebrick', count: 96 };
    fire(kit, e, 'oak_log');
    kit.run(120);
    expect(e.crucibleOut[0]).toEqual({ item: 'firebrick', count: 98 });
    expect(e.crucibleIn[0]).toEqual({ item: 'clay', count: 3 });
    expect(smelted).toEqual([{ x: 0, y: 1, z: 0, item: 'firebrick', count: 2 }]);
    expect(made).toEqual([{ item: 'firebrick', count: 2, station: 'furnace', recipeId: 'firebrick' }]);
    expect(kit.sim.furnaceView(0, 1, 0)!.crucibles[0].status).toBe('Output is full');
  });

  it('accept only what the tier can smelt, and the firebox only fuel', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0);
    const slots = kit.sim.furnaceSlots(0, 1, 0)!;
    expect(slots.crucibleIn.accepts('copper_ore', 0)).toBe(true);
    expect(slots.crucibleIn.accepts('iron_ore', 0)).toBe(false);
    expect(slots.crucibleIn.accepts('plank', 0)).toBe(false);
    expect(slots.fuel.accepts('coal', 0)).toBe(true);
    expect(slots.fuel.accepts('fuel_canister', 0)).toBe(false);
    expect(slots.crucibleOut.accepts('copper_ingot', 0)).toBe(false);
    expect(slots.fuel.add('stick', 5)).toBe(0);
    expect(kit.sim.furnaceAt(0, 1, 0)!.fuel[0]).toEqual({ item: 'stick', count: 5 });
    kit.furnace(4, 1, 0, 'furnace_blast');
    expect(kit.sim.furnaceSlots(4, 1, 0)!.crucibleIn.accepts('iron_ore', 1)).toBe(true);
  });

  it('a higher tier smelts faster and in more crucibles', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    expect(e.crucibleIn).toHaveLength(2);
    e.crucibleIn[0] = { item: 'tin_ore', count: 1 };
    e.crucibleIn[1] = { item: 'tin_ore', count: 1 };
    e.tempC = 250;
    fire(kit, e, 'stick');
    // Tier speed 1.25; the fire passes 550 C within seconds so the bonus is soon the full x2.
    kit.run(8 / 1.25);
    expect(e.crucibleOut[0]).toEqual({ item: 'tin_ingot', count: 1 });
    expect(e.crucibleOut[1]).toEqual({ item: 'tin_ingot', count: 1 });
  });
});

describe('forging and upgrading', () => {
  it('forges from the pack, chills the furnace, and says why it cannot', () => {
    const kit = makeKit();
    const made = kit.record('item:made');
    const e = kit.furnace(0, 1, 0);
    kit.player.give('copper_ingot', 3);
    expect(kit.sim.forge(0, 1, 0, 'copper_wire')).toEqual({ ok: false, reason: 'Needs 500 C - the furnace is at 20 C' });
    expect(kit.sim.forge(0, 1, 0, 'iron_plate')).toEqual({ ok: false, reason: 'Needs the Blast Furnace' });
    expect(kit.sim.forge(0, 1, 0, 'copper_ingot').ok).toBe(false);
    e.tempC = 540;
    expect(kit.sim.forge(0, 1, 0, 'copper_wire', 5)).toEqual({ ok: true, made: 2 });
    expect(e.tempC).toBe(540 - 2 * FORGE_CHILL_C);
    expect(kit.player.inventory.count('copper_wire')).toBe(6);
    expect(kit.player.inventory.count('copper_ingot')).toBe(1);
    expect(made).toHaveLength(2);
    e.tempC = 700;
    kit.player.inventory.remove('copper_ingot', 1);
    const r = kit.sim.forge(0, 1, 0, 'copper_wire');
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.reason).toMatch(/Missing/);
  });

  it('borrows ingredients from crates within reach, the pack first', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    const near = kit.machine('crate', 4, 1, 0);
    const far = kit.machine('crate', 5, 1, 0);
    near.slots[0] = { item: 'copper_ingot', count: 2 };
    far.slots[0] = { item: 'copper_ingot', count: 50 };
    kit.player.give('copper_ingot', 1);
    kit.player.give('tin_ingot', 1);
    e.tempC = 800;
    const rows = kit.sim.forgeList(0, 1, 0);
    const bronze = rows.find((r) => r.recipe.id === 'bronze_ingot')!;
    expect(bronze.canMake).toBe(true);
    expect(bronze.ingredients.find((i) => i.item === 'copper_ingot')).toMatchObject({ have: 3, need: 3, ok: true });
    expect(rows.find((r) => r.recipe.id === 'iron_plate')).toMatchObject({ locked: true, canMake: false });
    expect(kit.sim.forge(0, 1, 0, 'bronze_ingot', 2)).toEqual({ ok: true, made: 1 });
    expect(kit.player.inventory.count('copper_ingot')).toBe(0);
    expect(near.slots[0]).toBeNull();
    expect(far.slots[0]!.count).toBe(50);
    expect(kit.player.inventory.count('bronze_ingot')).toBe(4);
  });

  it('upgrades in place: block swapped, facing and contents kept, more slots', () => {
    const kit = makeKit();
    const upgraded = kit.record('furnace:upgraded');
    const placed = kit.record('machine:placed');
    kit.world.setVoxel(0, 1, 0, makeVoxel(blockId('furnace_clay'), 2), 'player');
    const e = kit.sim.furnaceAt(0, 1, 0)!;
    expect(kit.player.home).toEqual({ x: 0, y: 1, z: 0 });
    e.fuel[0] = { item: 'charcoal', count: 9 };
    e.crucibleIn[0] = { item: 'copper_ore', count: 2 };
    expect(kit.sim.upgrade(0, 1, 0)).toEqual({ ok: false, reason: 'Needs 700 C - the furnace is at 20 C' });
    e.tempC = 750;
    const missing = kit.sim.upgrade(0, 1, 0);
    expect(missing.ok ? '' : missing.reason).toBe('Missing 12 Firebrick, 8 Bronze Ingot, 1 Bellows');
    kit.player.give('firebrick', 12);
    kit.player.give('bronze_ingot', 8);
    kit.player.give('bellows', 1);
    expect(kit.sim.furnaceView(0, 1, 0)!.upgrade).toMatchObject({ ok: true, reason: null });
    expect(kit.sim.upgrade(0, 1, 0)).toEqual({ ok: true });
    const v = kit.world.getVoxel(0, 1, 0);
    expect(blockOf(v).key).toBe('furnace_blast');
    expect(voxelFacing(v)).toBe(2);
    expect(kit.sim.furnaceAt(0, 1, 0)).toBe(e);
    expect(e.tier).toBe(2);
    expect(e.fuel).toEqual([{ item: 'charcoal', count: 9 }, null]);
    expect(e.crucibleIn).toEqual([{ item: 'copper_ore', count: 2 }, null]);
    expect(kit.player.inventory.count('firebrick')).toBe(0);
    expect(upgraded).toEqual([{ x: 0, y: 1, z: 0, tier: 2 }]);
    expect(placed).toHaveLength(1);
    expect(kit.sim.maxFurnaceTier()).toBe(2);
  });

  it('breaking a furnace hands back what it held', () => {
    const kit = makeKit();
    const removed = kit.record('machine:removed');
    const e = kit.furnace(0, 1, 0);
    e.fuel[0] = { item: 'coal', count: 7 };
    e.crucibleIn[0] = { item: 'tin_ore', count: 2 };
    e.crucibleOut[0] = { item: 'tin_ingot', count: 3 };
    kit.world.setVoxel(0, 1, 0, 0, 'player');
    expect(kit.sim.furnaceAt(0, 1, 0)).toBeNull();
    expect(kit.world.getEntity(0, 1, 0)).toBeUndefined();
    expect(kit.player.inventory.count('coal')).toBe(7);
    expect(kit.player.inventory.count('tin_ore')).toBe(2);
    expect(kit.player.inventory.count('tin_ingot')).toBe(3);
    expect(removed).toHaveLength(1);
  });
});

describe('rest and home', () => {
  it('rests until dawn only at night, close by, with a fire that lasts', () => {
    const kit = makeKit();
    const flags = kit.record('flag');
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'oak_log', 3);
    kit.run(60);
    expect(kit.sim.rest(0, 1, 0)).toEqual({ ok: false, reason: 'You can only rest at night' });
    kit.clock.setTimeOfDay(0.8);
    kit.player.position.x = 30;
    expect(kit.sim.rest(0, 1, 0)).toEqual({ ok: false, reason: 'Come closer to the furnace' });
    kit.player.position.x = 0.5;
    const before = e.burnLeftS + e.fuel[0]!.count * 50;
    expect(kit.sim.furnaceView(0, 1, 0)!.canRest.ok).toBe(true);
    expect(kit.sim.rest(0, 1, 0)).toEqual({ ok: true });
    expect(kit.clock.isNight).toBe(false);
    expect(kit.clock.day).toBe(2);
    expect(e.burnLeftS + (e.fuel[0]?.count ?? 0) * 50).toBeCloseTo(before - 60, 6);
    expect(flags).toContainEqual({ flag: 'rested' });

    kit.clock.setTimeOfDay(0.8);
    e.fuel[0] = null;
    e.burnLeftS = 10;
    expect(kit.sim.rest(0, 1, 0)).toEqual({ ok: false, reason: 'The fire would not last the night - add fuel' });
  });

  it('opening a furnace screen makes it home', () => {
    const kit = makeKit();
    kit.furnace(3, 1, 3);
    expect(kit.player.home).toBeNull();
    kit.bus.emit('ui:opened', { screen: { type: 'furnace', x: 3, y: 1, z: 3 } });
    expect(kit.player.home).toEqual({ x: 3, y: 1, z: 3 });
  });
});

describe('persistence', () => {
  it('a furnace saved mid-run continues identically', () => {
    const a = makeKit();
    const e = a.furnace(0, 1, 0, 'furnace_blast');
    e.crucibleIn[0] = { item: 'copper_ore', count: 9 };
    e.crucibleIn[1] = { item: 'sand', count: 9 };
    fire(a, e, 'charcoal', 6);
    a.sim.pump(0, 1, 0);
    a.run(47.3);
    const saved = JSON.parse(JSON.stringify(e));

    const b = makeKit();
    b.world.setEntity(saved);
    b.world.put(0, 1, 0, 'furnace_blast', true);
    expect(b.sim.furnaceAt(0, 1, 0)).toBe(saved);
    a.run(200);
    b.run(200);
    expect(JSON.parse(JSON.stringify(b.sim.furnaceAt(0, 1, 0)))).toEqual(JSON.parse(JSON.stringify(e)));
  });
});
