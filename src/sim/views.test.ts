import { describe, expect, it } from 'vitest';
import { FORGE_CHILL_C } from '../core/constants';
import { blockId, machine, recipesAt } from '../core/registry';
import { CHUNK_SIZE, makeVoxel, type Voxel } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { fire, makeKit, type Kit } from './testKit';

const FORGE_COUNT = recipesAt('furnace').filter((r) => r.kind === 'forge').length;
const SMELT_COUNT = recipesAt('furnace').filter((r) => r.kind === 'smelt').length;

const view = (kit: Kit, x = 0, y = 1, z = 0) => kit.sim.furnaceView(x, y, z)!;
const row = (kit: Kit, id: string) => view(kit).forge.find((r) => r.recipe.id === id)!;

describe('furnace view', () => {
  it('lists every forge and smelt recipe, locking higher tiers with what they need', () => {
    const kit = makeKit();
    kit.world.setVoxel(0, 1, 0, makeVoxel(blockId('furnace_clay'), 2), 'player');
    const v = view(kit);
    expect(v).toMatchObject({ tier: 1, home: true, lit: false, hot: false, status: 'No fuel', upgrade: { requiredC: 700 } });
    expect(v.forge).toHaveLength(FORGE_COUNT);
    expect(v.smelt).toHaveLength(SMELT_COUNT);
    expect(row(kit, 'steel_ingot')).toMatchObject({ locked: true, canMake: false, reason: 'Needs the Blast Furnace' });
    expect(row(kit, 'circuit')).toMatchObject({ locked: true, reason: 'Needs the Arc Furnace' });
    expect(row(kit, 'star_core')).toMatchObject({ locked: true, reason: 'Needs the Plasma Furnace' });
    expect(row(kit, 'bronze_ingot')).toMatchObject({ locked: false, tempOk: false, heatAllows: 0, reason: 'Needs 800 C', max: 0 });
    expect(v.smelt.find((r) => r.recipe.id === 'iron_ingot')).toMatchObject({ locked: true, reason: 'Needs the Blast Furnace' });
    expect(v.smelt.find((r) => r.recipe.id === 'copper_ingot')).toMatchObject({ locked: false, tempOk: false, reason: 'Needs 700 C', have: 0 });
    expect(v.canRest).toEqual({ ok: false, reason: 'You can only rest at night' });
    expect(v.ignition.canStart).toEqual({ ok: false, reason: 'Only the Starhearth can be ignited' });
  });

  it('judges each forge row by heat, ingredients and room, and says how many the heat allows', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'coal');
    kit.run(30);
    expect(e.tempC).toBe(800);
    kit.player.give('copper_ingot', 7);
    expect(row(kit, 'bronze_ingot')).toMatchObject({ tempOk: true, canMake: false, reason: 'Missing 1 Tin Ingot', heatAllows: 1, max: 0 });
    kit.player.give('tin_ingot', 2);
    expect(row(kit, 'bronze_ingot')).toMatchObject({ canMake: true, reason: null, max: 2 });
    expect(row(kit, 'copper_wire')).toMatchObject({ canMake: true, heatAllows: Math.floor((800 - 500) / FORGE_CHILL_C) + 1, max: 7 });
    expect(view(kit).smelt.find((r) => r.recipe.id === 'copper_ingot')).toMatchObject({ tempOk: true, reason: null });
    // A pack with no room for the product.
    for (let i = 0; i < 36; i++) if (!kit.player.inventory.get(i)) kit.player.inventory.set(i, { item: 'flint_pickaxe', count: 1, durability: 64 });
    expect(row(kit, 'copper_wire')).toMatchObject({ canMake: false, reason: 'No room in your pack' });
    expect(kit.sim.forge(0, 1, 0, 'copper_wire', 0)).toEqual({ ok: false, reason: 'Nothing to make' });
  });

  it('describes the fire, the crucibles and the cooling furnace', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    e.fuel[0] = { item: 'charcoal', count: 3 };
    expect(view(kit).status).toBe('Ready to light');
    expect(view(kit).burnTimeLeftS).toBe(240);
    kit.sim.light(0, 1, 0);
    e.crucibleIn[0] = { item: 'copper_ore', count: 9 };
    kit.run(0.05);
    let c = view(kit).crucibles[0];
    expect(c).toMatchObject({ active: false, requiredC: 700, recipe: { id: 'copper_ingot' } });
    expect(c.status).toMatch(/^Needs 700 C - now \d+ C$/);
    expect(view(kit).trend).toBe('rising');
    kit.run(40);
    const v = view(kit);
    expect(v).toMatchObject({ burning: true, flameC: 1000, trend: 'steady', targetC: 800, burnItem: 'charcoal' });
    expect(v.burnTimeLeftS).toBeCloseTo(240 - 40.05, 1);
    expect(v.status).toMatch(/^Burns out in 3:\d\d$/);
    c = v.crucibles[0];
    expect(c.active).toBe(true);
    expect(c.status).toBe('Smelting Copper Ingot');
    // 10 s per ingot at speed 1 x (1 + min(1, (800 - 700) / 300)).
    expect(c.secondsLeft).toBeCloseTo((10 - c.progress * 10) / (1 + 100 / 300), 6);
    kit.sim.douse(0, 1, 0);
    kit.run(0.5);
    expect(view(kit)).toMatchObject({ lit: false, trend: 'falling', status: 'Cooling - light it again' });
    expect(view(kit).flameC).toBeNull();
  });

  it('shows electric heating, whether it is connected, and what it gets', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0, 'furnace_arc');
    kit.run(0.05);
    expect(view(kit).electric).toMatchObject({ available: true, on: true, networked: false, maxW: 8000, deliveredW: 0, satisfaction: 0 });
    expect(view(kit).status).toBe('Connect it to a power network to heat it electrically');
    const tap = kit.machine('geothermal_tap', 1, 1, 0);
    kit.world.put(2, 1, 0, 'lava');
    kit.run(0.05);
    expect(tap.availW).toBe(2000);
    const v = view(kit);
    expect(v.electric).toMatchObject({ networked: true, demandW: 8000, deliveredW: 2000, satisfaction: 0.25 });
    expect(v.targetC).toBeCloseTo(20 + 2000 / 3, 6);
    kit.world.put(1, 1, 1, 'lava');
    kit.world.put(1, 2, 0, 'lava');
    kit.run(0.05);
    expect(view(kit).electric.deliveredW).toBe(6000);
    expect(view(kit).status).toBe('Heading for 2020 C');
  });
});

describe('queries for the HUD and the machine screens', () => {
  it('finds a network from any of its cables, and summarises the grid with its worst state', () => {
    const kit = makeKit();
    const tap = kit.machine('geothermal_tap', 0, 5, 0);
    kit.world.put(0, 4, 0, 'lava');
    kit.world.put(1, 5, 0, 'copper_cable');
    kit.world.put(2, 5, 0, 'copper_cable');
    kit.machine('lamp', 3, 5, 0);
    kit.world.put(9, 5, 9, 'copper_cable');
    kit.run(1);
    const net = kit.sim.networkAt(1, 5, 0)!;
    expect(net).toMatchObject({ cables: 2, ratingW: 10000, generationW: 2000, demandW: 10 });
    expect(kit.sim.networkAt(2, 5, 0)!.id).toBe(net.id);
    expect(kit.sim.networkAt(9, 5, 9)).toBeNull();
    expect(kit.sim.machineView(0, 5, 0)).toMatchObject({ network: net.id, satisfaction: 1, availW: 2000, outW: 10 });
    expect(net.members.map((m) => [m.kind, m.watts])).toEqual([['geothermal_tap', 10], ['lamp', -10]]);
    expect(kit.sim.grid()).toEqual({ networks: 1, generationW: 2000, demandW: 10, deliveredW: 10, storedJ: 0, capacityJ: 0, state: 'ok' });
    // A second network that browns out makes the summary report it.
    kit.machine('crusher', 20, 5, 0).slots[0] = { item: 'copper_ore', count: 9 };
    kit.machine('solar_panel', 21, 5, 0);
    kit.clock.setTimeOfDay(0.3);
    kit.run(2);
    expect(kit.sim.grid()).toMatchObject({ networks: 2, state: 'brownout' });
    expect(tap.availW).toBe(2000);
  });

  it('the home furnace follows the player', () => {
    const kit = makeKit();
    expect(kit.sim.homeFurnace()).toBeNull();
    kit.world.setVoxel(4, 1, 4, makeVoxel(blockId('furnace_blast')), 'player');
    expect(kit.sim.homeFurnace()).toMatchObject({ x: 4, y: 1, z: 4, tier: 2 });
    kit.furnace(9, 1, 9);
    kit.bus.emit('ui:opened', { screen: { type: 'furnace', x: 9, y: 1, z: 9 } });
    expect(kit.sim.homeFurnace()).toMatchObject({ x: 9, tier: 1 });
    kit.world.setVoxel(9, 1, 9, 0, 'player');
    expect(kit.sim.homeFurnace()).toBeNull();
  });

  it('every machine with a switch can be toggled, batteries included', () => {
    const kit = makeKit();
    kit.world.put(0, 4, 0, 'lava');
    kit.machine('geothermal_tap', 0, 5, 0);
    const battery = kit.machine('battery', 1, 5, 0);
    kit.run(1);
    const charged = battery.storedJ;
    expect(charged).toBeGreaterThan(0);
    expect(kit.sim.toggleMachine(1, 5, 0)).toEqual({ ok: true });
    kit.run(1);
    expect(battery.storedJ).toBe(charged);
    expect(kit.sim.machineView(1, 5, 0)!.status).toBe('Switched off');
    kit.sim.toggleMachine(1, 5, 0);
    kit.run(1);
    expect(battery.storedJ).toBeGreaterThan(charged);
    expect(kit.sim.machineView(1, 5, 0)!.status).toMatch(/^\d+% - charging 2 kW$/);
    kit.machine('crate', 5, 5, 5);
    expect(kit.sim.toggleMachine(5, 5, 5)).toEqual({ ok: false, reason: 'There is no machine here' });
  });

  it('a fuel generator reports the electric energy it holds and how long it lasts', () => {
    const kit = makeKit();
    const burner = kit.machine('burner_generator', 0, 5, 0);
    burner.slots[0] = { item: 'coal', count: 2 };
    kit.machine('space_heater', 1, 5, 0);
    kit.run(1);
    const v = kit.sim.machineView(0, 5, 0)!;
    const perCoal = 800_000 * machine('burner_generator').efficiency!;
    expect(v.fuelJ).toBeCloseTo(2 * perCoal - 300, 3);
    expect(v.fuelLeftS).toBeCloseTo(v.fuelJ / 300, 3);
    expect(v.status).toBe('300 W of 3 kW in use');
  });
});

/** A fake world in which whole chunk columns can be made absent, as the real world does when streaming. */
class PatchyWorld extends FakeWorld {
  readonly absent = new Set<string>();
  private hidden(x: number, z: number): boolean {
    return this.absent.has(`${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`);
  }
  override getVoxel(x: number, y: number, z: number): Voxel {
    return this.hidden(x, z) ? 0 : super.getVoxel(x, y, z);
  }
  override isLoaded(x = 0, z = 0): boolean {
    return !this.hidden(x, z);
  }
}

describe('keeping up with the world', () => {
  it('a block change refreshes the machines it concerns, including sky above a solar panel', () => {
    const kit = makeKit();
    const panel = kit.machine('solar_panel', 0, 5, 0);
    kit.run(0.05);
    expect(panel.availW).toBe(300);
    kit.world.put(0, 60, 0, 'stone');
    kit.run(0.05);
    expect(panel.availW).toBe(0);
    kit.world.setVoxel(0, 60, 0, 0);
    kit.run(0.05);
    expect(panel.availW).toBe(300);
    const wheelA = kit.machine('water_wheel', 10, 5, 0);
    kit.world.put(10, 4, 0, 'water');
    kit.world.put(10, 6, 0, 'water');
    kit.run(0.05);
    expect(wheelA.availW).toBe(400);
    kit.machine('water_wheel', 13, 5, 0);
    kit.run(0.05);
    expect(wheelA.availW).toBe(200);
  });

  it('a chunk unloading splits the networks that reach it, and loading it joins them again', () => {
    let world!: PatchyWorld;
    const kit = makeKit((bus) => (world = new PatchyWorld(bus)));
    kit.world.put(10, 4, 0, 'lava');
    kit.machine('geothermal_tap', 10, 5, 0);
    for (let x = 11; x <= 20; x++) kit.world.put(x, 5, 0, 'copper_cable');
    const lamp = kit.machine('lamp', 21, 5, 0);
    kit.run(0.1);
    expect(lamp.f).toBe(1);
    expect(kit.sim.allNetworks()).toHaveLength(1);
    // The chunk holding cables x = 16..20 goes away: the lamp is cut off.
    world.absent.add('1,0');
    kit.bus.emit('chunk:unloaded', { cx: 1, cz: 0 });
    kit.run(0.1);
    expect(kit.sim.allNetworks()).toHaveLength(1);
    expect(kit.sim.networkAt(10, 5, 0)!.members).toHaveLength(1);
    world.absent.delete('1,0');
    kit.bus.emit('chunk:loaded', { cx: 1, cz: 0 });
    kit.run(0.1);
    expect(kit.sim.networkAt(10, 5, 0)!.members).toHaveLength(2);
    expect(lamp.f).toBe(1);
  });
});
