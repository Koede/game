/** Machines and fluids (spec 16.2, 16.5): boiler, steam turbine, and the fluid ports of the older machines. */
import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { Face } from '../core/types';
import type { FurnaceEntity, MachineEntity } from './entities';
import { run } from './pipeKit';
import { makeKit, type Kit } from './testKit';

function power(kit: Kit, x: number, y: number, z: number): MachineEntity {
  const bank = kit.machine('lithium_bank', x, y, z);
  bank.storedJ = 40e6;
  return bank;
}

/** Ticks while holding a furnace at a temperature (the fire model is tested elsewhere). */
function hold(kit: Kit, f: FurnaceEntity, tempC: number, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    f.tempC = tempC;
    kit.sim.tick(DT);
  }
}

/** A tank of water at x, y, z whose pipe end (the pipe at px, py, pz, towards dir) pulls. */
function waterTank(kit: Kit, at: [number, number, number], pipe: [number, number, number], dir: Face, litres = 16000): MachineEntity {
  const t = kit.machine('tank', ...at);
  t.fluidIn = { fluid: 'water', litres };
  kit.world.put(pipe[0], pipe[1], pipe[2], 'fluid_pipe');
  kit.sim.setPort(pipe[0], pipe[1], pipe[2], dir, { mode: 'pull' });
  return t;
}

describe('the boiler', () => {
  it('turns water into ten times the steam with the heat of the furnace below, and cools it for it', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0);
    const b = kit.machine('boiler', 0, 6, 0);
    waterTank(kit, [2, 6, 0], [1, 6, 0], Face.PX);
    hold(kit, f, 150, 1);
    expect(b.fluidOut).toBeNull();
    expect(kit.sim.machineView(0, 6, 0)!.status).toBe('The furnace is too cold');
    hold(kit, f, 600, 1); // 1 L/s per degree over 200: 400 L/s of steam from 40 L/s of water
    expect(kit.sim.machineView(0, 6, 0)).toMatchObject({ running: true, status: 'Boiling 400 L of steam a second' });
    expect(b.rateL).toBeCloseTo(400, 5);
    expect(f.extractW).toBeCloseTo(400 * 20, 5); // 20 J of heat per litre of steam
    hold(kit, f, 600, 2); // the 1000 L steam buffer is full and nobody uses it: it stops, and stops cooling the fire
    expect(b.fluidOut).toEqual({ fluid: 'steam', litres: 1000 });
    expect(b.rateL).toBe(0);
    expect(f.extractW).toBe(0);
    expect(kit.sim.machineView(0, 6, 0)).toMatchObject({ running: false, status: 'Steam is not being used - pipe it to a turbine' });
    hold(kit, f, 1500, 0.05);
    expect(kit.sim.machineView(0, 6, 0)!.fluids).toMatchObject({ output: { fluid: 'steam', litres: 1000 }, capacityL: 1000 });
  });

  it('needs to sit on a furnace (or its hearth) and to have water', () => {
    const kit = makeKit();
    kit.machine('boiler', 0, 6, 0);
    expect(kit.sim.machineView(0, 6, 0)!.status).toBe('Must sit on top of a furnace');
    const f = kit.furnace(0, 5, 0);
    hold(kit, f, 900, 0.1);
    expect(kit.sim.machineView(0, 6, 0)!.status).toBe('Needs water - pipe it in');
  });

  it('feeds a steam turbine through a hot pipe: 8 kW from 800 L/s, less from less, load-following', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0);
    kit.machine('boiler', 0, 6, 0);
    waterTank(kit, [-2, 6, 0], [-1, 6, 0], Face.NX);
    run(kit.world, 'hot_fluid_pipe', [1, 6, 0], [2, 6, 0]);
    // The hot pipe's end at the boiler starts pulling (the boiler only hands steam out); nothing pulls before that.
    expect(kit.sim.pipeView(1, 6, 0)!.ports.find((p) => p.block === 'boiler')!.mode).toBe('pull');
    const turbine = kit.machine('steam_turbine', 3, 6, 0);
    const bank = kit.machine('lithium_bank', 4, 6, 0); // empty: it takes up to 150 kW
    hold(kit, f, 1200, 6); // 800 L/s of steam at 1000 C and above
    expect(turbine.availW).toBeCloseTo(8000, 0);
    expect(turbine.outW).toBeCloseTo(8000, 0);
    expect(turbine.rateL).toBeCloseTo(800, 0);
    expect(bank.storedJ).toBeGreaterThan(0);
    expect(f.extractW).toBeCloseTo(800 * 20, 0); // 16 kW of heat for 8 kW of power
    expect(kit.sim.machineView(3, 6, 0)!.status).toBe('8 kW of 8 kW in use');
    // A cooler fire boils less: 300 L/s at 500 C makes 3 kW.
    hold(kit, f, 500, 6);
    expect(turbine.outW).toBeCloseTo(3000, -1);
    // Switched off, it uses no steam: the boiler stops too.
    kit.sim.setMachineOn(3, 6, 0, false);
    hold(kit, f, 500, 12); // its buffer, the pipes and the boiler's steam room fill up
    expect(turbine.rateL).toBe(0);
    expect(f.extractW).toBe(0);
  });

  it('says when it has no steam', () => {
    const kit = makeKit();
    kit.machine('steam_turbine', 0, 5, 0);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('No steam - pipe it in through a hot pipe');
  });
});

describe('piped water, fuel and lava in the older machines', () => {
  it('the steam engine runs on piped water instead of water beside it, 10 L/s', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0);
    kit.machine('steam_engine', 0, 6, 0);
    power(kit, 0, 7, 0); // a bank to charge: the engine has a load
    kit.run(0.1);
    expect(kit.sim.machineView(0, 6, 0)!.problem).toBe('Needs water on one side');
    const tank = waterTank(kit, [2, 6, 0], [1, 6, 0], Face.PX, 1000);
    kit.sim.machineAt(0, 7, 0)!.storedJ = 0;
    hold(kit, f, 800, 10);
    const view = kit.sim.machineView(0, 6, 0)!;
    expect(view.problem).toBeNull();
    expect(view.availW).toBeCloseTo(2000, 0);
    expect(view.outW).toBeCloseTo(2000, 0);
    expect((tank.fluidIn?.litres ?? 0) + (kit.sim.machineAt(0, 6, 0)!.fluidIn?.litres ?? 0)).toBeCloseTo(1000 - 100, -1);
  });

  it('the electrolyzer and the fission pile count piped water as touching water', () => {
    const kit = makeKit();
    const el = kit.machine('electrolyzer', 0, 5, 0);
    power(kit, 0, 6, 0);
    el.slots[0] = { item: 'empty_cell', count: 1 };
    kit.run(0.5);
    expect(kit.sim.machineView(0, 5, 0)!.problem).toBe('Must touch water');
    expect(el.progress).toBe(0);
    waterTank(kit, [2, 5, 0], [1, 5, 0], Face.PX);
    kit.run(50);
    expect(el.slots[1]).toEqual({ item: 'deuterium_cell', count: 1 });

    const pile = kit.machine('fission_pile', 10, 5, 0);
    pile.slots[0] = { item: 'fuel_rod', count: 1 };
    power(kit, 10, 6, 0);
    kit.run(5);
    expect(kit.sim.machineView(10, 5, 0)).toMatchObject({ cooled: false, status: 'No cooling - core at 60 C and rising' });
    const tank = waterTank(kit, [12, 5, 0], [11, 5, 0], Face.PX, 16000);
    kit.run(80);
    expect(kit.sim.machineView(10, 5, 0)).toMatchObject({ cooled: true, coreC: 600, problem: null });
    expect(16000 - tank.fluidIn!.litres).toBeGreaterThan(5000); // 100 L/s goes into cooling
  });

  it('the combustion engine burns piped refined fuel: 1000 L is one canister', () => {
    const kit = makeKit();
    const eng = kit.machine('combustion_engine', 0, 5, 0);
    const bank = kit.machine('lithium_bank', 0, 6, 0);
    eng.fluidIn = { fluid: 'fuel', litres: 1000 };
    kit.run(1);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('12 kW of 12 kW in use');
    kit.run(400);
    expect(eng.fluidIn).toBeNull();
    expect(bank.storedJ).toBeCloseTo(2.4e6 * 0.9, -4); // 2.4 MJ of electricity, stored at 90%
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('No fuel');
  });

  it('the still refines piped crude oil, 500 L into 400 L of fuel in 20 s, between item jobs', () => {
    const kit = makeKit();
    const still = kit.machine('still', 0, 5, 0);
    power(kit, 0, 6, 0);
    still.fluidIn = { fluid: 'crude_oil', litres: 1200 };
    kit.run(10);
    expect(kit.sim.machineView(0, 5, 0)).toMatchObject({ status: 'Refining crude oil - 50%', running: true });
    expect(kit.sim.machineView(0, 5, 0)!.progress).toBeCloseTo(0.5, 1);
    kit.run(10.1);
    expect(still.fluidOut).toEqual({ fluid: 'fuel', litres: 400 });
    expect(still.fluidIn).toEqual({ fluid: 'crude_oil', litres: 700 });
    still.slots[0] = { item: 'oil_shale', count: 2 }; // waits for the oil run under way
    kit.run(20.1);
    expect(still.fluidOut).toEqual({ fluid: 'fuel', litres: 800 });
    expect(still.fluidIn).toEqual({ fluid: 'crude_oil', litres: 200 });
    kit.run(20.1);
    expect(still.slots[1]).toEqual({ item: 'fuel_canister', count: 1 });
    kit.run(1);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Needs 500 L of crude oil');
    // With both to hand, the item job goes first.
    still.fluidIn = { fluid: 'crude_oil', litres: 500 };
    still.fluidOut = null;
    still.slots[0] = { item: 'oil_shale', count: 2 };
    kit.run(20.1);
    expect(still.slots[1]).toEqual({ item: 'fuel_canister', count: 2 });
    expect(still.fluidOut).toBeNull();
    kit.run(20.1);
    expect(still.fluidOut).toEqual({ fluid: 'fuel', litres: 400 });
  });

  it('the geothermal tap runs on piped lava: 1000 L lasts 600 s at full output; lava blocks still work', () => {
    const kit = makeKit();
    const tap = kit.machine('geothermal_tap', 0, 5, 0);
    kit.machine('lithium_bank', 0, 6, 0);
    expect(kit.sim.machineView(0, 5, 0)!.problem).toBe('Must touch lava');
    tap.fluidIn = { fluid: 'lava', litres: 1000 };
    kit.run(60);
    expect(kit.sim.machineView(0, 5, 0)).toMatchObject({ problem: null, availW: 6000, outW: 6000 });
    expect(tap.fluidIn!.litres).toBeCloseTo(900, 0);
    kit.world.put(1, 5, 0, 'lava');
    kit.world.put(-1, 5, 0, 'lava'); // 4 kW from blocks: piped lava only covers the other 2 kW
    kit.run(60);
    expect(tap.fluidIn!.litres).toBeCloseTo(900 - 100 / 3, 0);
  });
});
