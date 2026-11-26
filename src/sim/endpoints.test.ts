import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { Face } from '../core/types';
import { fire, makeKit } from './testKit';

describe('item endpoints', () => {
  it('crates take and give anything', () => {
    const kit = makeKit();
    const crate = kit.machine('crate', 0, 1, 0);
    const ep = kit.sim.itemEndpoint(0, 1, 0, Face.PX)!;
    expect(ep.entity).toBe(crate);
    expect(ep.room('coal')).toBe(27 * 99);
    expect(ep.insert('coal', 150)).toBe(150);
    expect(crate.slots.slice(0, 2)).toEqual([{ item: 'coal', count: 99 }, { item: 'coal', count: 51 }]);
    expect(ep.insert('iron_pickaxe', 1, 17)).toBe(1);
    expect(ep.offer((item) => item !== 'coal')).toEqual({ item: 'iron_pickaxe', count: 1, durability: 17 });
    expect(ep.take('iron_pickaxe', 4)).toEqual({ item: 'iron_pickaxe', count: 1, durability: 17 });
    expect(ep.take('coal', 10)).toEqual({ item: 'coal', count: 10 });
    expect(ep.take('sand', 1)).toBeNull();
  });

  it('machines take their inputs or fuels and give their products', () => {
    const kit = makeKit();
    kit.machine('crusher', 0, 1, 0);
    const crusher = kit.sim.itemEndpoint(0, 1, 0, Face.NX)!;
    expect(crusher.room('plank')).toBe(0);
    expect(crusher.insert('plank', 3)).toBe(0);
    expect(crusher.room('copper_ore')).toBe(99);
    expect(crusher.insert('copper_ore', 5)).toBe(5);
    expect(crusher.offer()).toBeNull();
    kit.sim.machineAt(0, 1, 0)!.slots[1] = { item: 'crushed_copper', count: 4 };
    expect(crusher.offer()).toEqual({ item: 'crushed_copper', count: 4 });
    expect(crusher.take('copper_ore', 5)).toBeNull(); // inputs stay in
    expect(crusher.take('crushed_copper', 3)).toEqual({ item: 'crushed_copper', count: 3 });

    kit.machine('burner_generator', 3, 1, 0);
    const burner = kit.sim.itemEndpoint(3, 1, 0, Face.PY)!;
    expect(burner.insert('coal', 4)).toBe(4);
    expect(burner.room('lava_bucket')).toBe(0); // the slot already holds coal
    expect(burner.room('fuel_canister')).toBe(0);
    expect(burner.offer()).toBeNull();

    const rig = kit.machine('bore_rig', 6, 1, 0);
    rig.slots[2] = { item: 'rubble', count: 7 };
    const bore = kit.sim.itemEndpoint(6, 1, 0, Face.PY)!;
    expect(bore.room('rubble')).toBe(0);
    expect(bore.take('rubble', 99)).toEqual({ item: 'rubble', count: 7 });

    kit.machine('lamp', 9, 1, 0);
    expect(kit.sim.itemEndpoint(9, 1, 0, Face.PY)).toBeNull();
    expect(kit.sim.itemEndpoint(20, 1, 0, Face.PY)).toBeNull();
  });

  it('the furnace sorts by its smart sides', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    const ep = kit.sim.itemEndpoint(0, 1, 0, Face.NZ)!;
    expect(ep.insert('charcoal', 10)).toBe(10);
    expect(e.fuel[0]).toEqual({ item: 'charcoal', count: 10 });
    expect(ep.insert('copper_ore', 120)).toBe(120); // two working crucibles
    expect(e.crucibleIn).toEqual([{ item: 'copper_ore', count: 99 }, { item: 'copper_ore', count: 21 }]);
    expect(ep.room('tin_ore')).toBe(0);
    expect(ep.room('copper_ingot')).toBe(0); // a forge ingredient
    expect(ep.room('iron_pickaxe')).toBe(0);
    // A log is fuel, unless a crucible is already making charcoal from logs.
    expect(ep.insert('oak_log', 2)).toBe(2);
    expect(e.fuel[1]).toEqual({ item: 'oak_log', count: 2 });
    e.crucibleIn[1] = { item: 'oak_log', count: 1 };
    expect(ep.insert('oak_log', 3)).toBe(3);
    expect(e.crucibleIn[1]).toEqual({ item: 'oak_log', count: 4 });
    // Out come finished products and burned fuels' containers, never fuel or ore.
    e.crucibleOut[0] = { item: 'copper_ingot', count: 6 };
    e.fuel[1] = { item: 'bronze_bucket', count: 1 };
    expect(ep.offer()).toEqual({ item: 'copper_ingot', count: 6 });
    expect(ep.take('copper_ingot', 4)).toEqual({ item: 'copper_ingot', count: 4 });
    expect(ep.offer((item) => item !== 'copper_ingot')).toEqual({ item: 'bronze_bucket', count: 1 });
    expect(ep.take('charcoal', 5)).toBeNull();
    expect(ep.take('bronze_bucket', 1)).toEqual({ item: 'bronze_bucket', count: 1 });
    // Standing alone it smelts like the Bronze Furnace: iron ore is refused, and two crucibles work.
    const lone = kit.furnace(9, 1, 0, 'furnace_blast');
    const loneEp = kit.sim.itemEndpoint(9, 1, 0, Face.PY)!;
    expect(loneEp.room('iron_ore')).toBe(0);
    expect(loneEp.insert('copper_ore', 150)).toBe(150);
    expect(lone.crucibleIn).toEqual([{ item: 'copper_ore', count: 99 }, { item: 'copper_ore', count: 51 }]);
  });

  it('an item hatch stands for the furnace of its formed hearth, and for nothing otherwise', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    kit.machine('item_hatch', -1, 1, 1); // west wall face
    kit.sim.validateHearths();
    const hatch = kit.sim.itemEndpoint(-1, 1, 1, Face.NX)!;
    expect(hatch.entity).toBe(e);
    expect(hatch.insert('coal', 5)).toBe(5);
    expect(e.fuel[0]).toEqual({ item: 'coal', count: 5 });
    kit.world.put(1, 1, 2, 'air');
    kit.sim.validateHearths();
    expect(kit.sim.itemEndpoint(-1, 1, 1, Face.NX)).toBeNull();
    kit.machine('power_port', 5, 1, 5);
    expect(kit.sim.itemEndpoint(5, 1, 5, Face.NX)).toBeNull();
  });
});

describe('fluid endpoints', () => {
  it('a tank fills and drains one fluid', () => {
    const kit = makeKit();
    const tank = kit.machine('tank', 0, 1, 0);
    const ep = kit.sim.fluidEndpoint(0, 1, 0, Face.PY)!;
    expect(ep.room('water')).toBe(16000);
    expect(ep.fill('water', 1500)).toBe(1500);
    expect(ep.room('lava')).toBe(0);
    expect(ep.offer()).toEqual({ fluid: 'water', litres: 1500 });
    expect(ep.drain('water', 2000)).toBe(1500);
    expect(tank.fluidIn).toBeNull();
    expect(ep.room('lava')).toBe(16000);
    expect(kit.sim.fluidEndpoint(5, 1, 0, Face.PY)).toBeNull();
  });

  it('a machine takes what it accepts and gives what it makes from separate buffers', () => {
    const kit = makeKit();
    const still = kit.machine('still', 0, 1, 0);
    const ep = kit.sim.fluidEndpoint(0, 1, 0, Face.PY)!;
    expect(ep.room('fuel')).toBe(0);
    expect(ep.fill('crude_oil', 5000)).toBe(4000);
    expect(ep.offer()).toBeNull(); // crude oil goes in, it is not given back
    expect(ep.drain('crude_oil', 100)).toBe(0);
    still.fluidOut = { fluid: 'fuel', litres: 400 };
    expect(ep.offer()).toEqual({ fluid: 'fuel', litres: 400 });
    expect(ep.drain('fuel', 300)).toBe(300);
    expect(still.fluidOut).toEqual({ fluid: 'fuel', litres: 100 });
  });

  it('a fluid hatch feeds lava to the furnace of its formed hearth, no bucket coming back', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    kit.machine('fluid_hatch', 1, 1, 1); // east wall face
    kit.sim.validateHearths();
    const ep = kit.sim.fluidEndpoint(1, 1, 1, Face.PX)!;
    expect(ep.room('water')).toBe(0);
    expect(ep.fill('lava', 2500)).toBe(1000);
    expect(kit.sim.furnaceView(0, 1, 0)!.burnTimeLeftS).toBeGreaterThan(90);
    expect(kit.sim.light(0, 1, 0)).toEqual({ ok: true });
    expect(e.burnItem).toBe('lava_bucket');
    expect(e.fuel).toEqual([null, null]);
    kit.run(60);
    expect(e.tempC).toBeGreaterThan(1200);
    expect(kit.player.inventory.count('bronze_bucket')).toBe(0);
    // More lava arriving while it is still hot relights it.
    kit.run(120);
    expect(e.lit).toBe(false);
    ep.fill('lava', 1000);
    kit.run(DT);
    expect(e.lit).toBe(true);
    // Not part of a formed hearth: no endpoint.
    kit.world.put(0, 1, 2, 'air');
    kit.sim.validateHearths();
    expect(kit.sim.fluidEndpoint(1, 1, 1, Face.PX)).toBeNull();
  });

  it('lava loads count as fuel in the firebox numbers', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    kit.machine('fluid_hatch', 1, 1, 1);
    kit.sim.validateHearths();
    fire(kit, e, 'coal', 1);
    kit.sim.fluidEndpoint(1, 1, 1, Face.PX)!.fill('lava', 1000);
    const view = kit.sim.furnaceView(0, 1, 0)!;
    expect(view.burnTimeLeftS).toBeGreaterThan(150);
  });
});
