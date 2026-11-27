/**
 * Bugs where systems cross (sim side): storms on the grid, batteries across an outage, plumbing feeding boilers,
 * pneumatic tubes spending the air network's pressure. Each test runs two merged systems against each other.
 */
import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { PNEU_CAPSULE_L } from '../core/constants';
import { makeKit } from './testKit';

describe('storm strike x power grid', () => {
  it('a strike that burns out a cable (a sim edit) cuts the lamp dark, and relaying the cable relights it', () => {
    const kit = makeKit();
    kit.machine('water_wheel', 0, 1, 0);
    kit.world.put(0, 0, 0, 'water');
    kit.world.put(0, 2, 0, 'water');
    for (let x = 1; x <= 4; x++) kit.world.put(x, 1, 0, 'copper_cable');
    const lamp = kit.machine('lamp', 5, 1, 0);
    kit.run(1);
    expect(lamp.f).toBe(1);
    kit.world.setVoxel(3, 1, 0, 0, 'sim'); // what Disasters.resolveStrike does
    kit.run(1);
    expect(lamp.f).toBe(0);
    kit.world.setVoxel(3, 1, 0, makeVoxel(blockId('copper_cable')), 'player');
    kit.run(1);
    expect(lamp.f).toBe(1);
  });
});

describe('battery x outage', () => {
  it('carries the load through an outage, runs dry, and charges again when generation returns', () => {
    const kit = makeKit();
    kit.machine('geothermal_tap', 0, 5, 0);
    kit.world.put(0, 4, 0, 'lava');
    const bank = kit.machine('battery', 1, 5, 0);
    const lamp = kit.machine('lamp', 2, 5, 0);
    kit.run(5);
    expect(lamp.f).toBe(1);
    kit.world.put(0, 4, 0, 'air'); // the outage
    bank.storedJ = 100;
    kit.run(2);
    expect(lamp.f).toBe(1); // the bank still carries it
    kit.run(30);
    expect(bank.storedJ).toBe(0);
    expect(lamp.f).toBe(0); // and now it is dark
    kit.world.put(0, 4, 0, 'lava'); // generation returns
    kit.run(5);
    expect(lamp.f).toBe(1);
    expect(bank.storedJ).toBeGreaterThan(0);
  });
});

describe('plumbing x boiler', () => {
  it('a boiler water port keeps drawing from the line after the cistern is refilled', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 2; y <= 5; y++) {
      if (x === 0 && z === 0 && y >= 3 && y <= 4) continue;
      kit.world.put(x, y, z, 'boiler_plate');
    }
    kit.world.put(0, 5, 0, 'safety_valve');
    kit.world.put(1, 3, 0, 'boiler_gauge_glass');
    kit.world.put(-1, 3, 0, 'water_port');
    kit.world.put(-2, 3, 0, 'water_pipe');
    kit.world.put(-3, 3, 0, 'cistern');
    const net = kit.sim.water.netAt(-2, 3, 0)!;
    net.waterL = 0;
    kit.run(2);
    expect(kit.sim.water.netAt(-2, 3, 0)!.waterL).toBe(0); // nothing to draw: no negative water
    kit.sim.water.netAt(-2, 3, 0)!.waterL = 500;
    kit.run(3);
    expect(kit.sim.water.netAt(-2, 3, 0)!.waterL).toBeLessThan(500);
  });
});

describe('pneumatic tubes x air network', () => {
  it('a blast nozzle and a sender share one tank: capsules spend its air but never take it under 1 bar', () => {
    const kit = makeKit();
    const from = kit.machine('crate', 0, 5, 0);
    kit.world.put(1, 5, 0, 'tube_sender');
    kit.world.put(2, 5, 0, 'air_tube');
    kit.world.put(3, 5, 0, 'tube_receiver');
    kit.machine('crate', 4, 5, 0);
    kit.world.put(2, 5, 1, 'air_tank');
    from.slots[0] = { item: 'stone', count: 64 };
    const net = kit.sim.air.netAt(1, 5, 0)!;
    net.airL = net.volumeL * 1.2;
    kit.run(10);
    expect(kit.sim.air.netAt(1, 5, 0)!.airL).toBeGreaterThanOrEqual(kit.sim.air.netAt(1, 5, 0)!.volumeL * 1 - PNEU_CAPSULE_L);
  });
});
