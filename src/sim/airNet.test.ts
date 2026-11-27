import { describe, expect, it } from 'vitest';
import { AIR_COMPRESSOR_MIN_RPM, AIR_MAX_BAR } from '../core/constants';
import { createBus } from '../core/context';
import { FakeWorld } from '../game/fakeWorld';
import { AirNets, isAirEntity } from './airNet';
import { makeKit } from './testKit';
import { hearthKitAir } from './airKit';

/** A row of cells along x at y = 5, z = 0, from x = 0. */
const row = (world: FakeWorld, blocks: string[]): void => blocks.forEach((b, i) => world.put(i, 5, 0, b));

describe('air network', () => {
  it('joins every touching air block into one network and adds up their volume', () => {
    const kit = makeKit();
    row(kit.world, ['air_compressor', 'air_tube', 'air_tube', 'air_tank', 'air_tube', 'blast_nozzle']);
    const net = kit.sim.air.netAt(0, 5, 0)!;
    expect(net.keys).toHaveLength(6);
    expect(net.volumeL).toBe(50 + 50 + 50 + 4000 + 50 + 20);
    expect(kit.sim.air.netAt(5, 5, 0)).toBe(net);
    expect(kit.sim.air.netAt(0, 9, 9)).toBeNull();
  });

  it('keeps air tubes apart from item and fluid pipes', () => {
    const kit = makeKit();
    row(kit.world, ['air_tube', 'item_pipe', 'fluid_pipe', 'air_tube']);
    expect(kit.sim.air.netAt(0, 5, 0)!.keys).toHaveLength(1);
    expect(kit.sim.air.netAt(3, 5, 0)!.keys).toHaveLength(1);
    // Neither pipe family treats the tube as one of its own.
    kit.run(0.2);
    expect(kit.sim.transport.items).toHaveLength(1);
    expect(kit.sim.transport.fluids).toHaveLength(1);
  });

  it('works the compressor by hand a stroke at a time, and reads pressure as bar = air / volume', () => {
    const kit = makeKit();
    row(kit.world, ['air_compressor', 'air_tank']); // 4050 L
    expect(kit.sim.air.crank(0, 5, 0)).toBe(true);
    expect(kit.sim.air.crank(0, 5, 0)).toBe(false); // too soon
    kit.run(0.5);
    expect(kit.sim.air.crank(0, 5, 0)).toBe(true);
    kit.run(0.1);
    expect(kit.sim.air.netAt(0, 5, 0)!.airL).toBeCloseTo(52, 3);
    expect(kit.sim.air.barAt(1, 5, 0)).toBeCloseTo(52 / 4050, 5);
    expect(kit.sim.air.crank(1, 5, 0)).toBe(false); // only a compressor takes strokes
  });

  it('reports what a Use on an air block says', () => {
    const kit = makeKit();
    row(kit.world, ['air_compressor', 'air_tube', 'blast_nozzle']);
    const toasts = kit.record('toast');
    kit.bus.emit('air:use', { x: 2, y: 5, z: 0 });
    expect(toasts.at(-1)!.text).toBe('Blast Nozzle: Needs 2 bar - has 0');
    kit.bus.emit('air:use', { x: 0, y: 5, z: 0 });
    expect(toasts.at(-1)!.text).toBe('Air Compressor: 0 bar - Use to pump by hand');
    expect(kit.sim.airView(1, 5, 0)).toMatchObject({ role: 'tube', name: 'Air Tube' });
    expect(kit.sim.airView(5, 5, 5)).toBeNull();
  });

  it('turns shaft rpm into 2 L/s per rpm from 32 rpm, and stalls at 6 bar', () => {
    const world = new FakeWorld(createBus());
    let rpm = 0;
    const air = new AirNets({ world, bus: createBus(), shaftRpm: () => rpm });
    world.put(0, 5, 0, 'air_compressor');
    world.put(1, 5, 0, 'air_tank');
    air.blockChanged(0, 5, 0, world.getBlock(5, 5, 5), world.getBlock(0, 5, 0));
    rpm = AIR_COMPRESSOR_MIN_RPM - 1;
    air.tick(1);
    expect(air.netAt(0, 5, 0)!.airL).toBe(0);
    rpm = 40;
    air.tick(1);
    expect(air.netAt(0, 5, 0)!.airL).toBeCloseTo(80, 6);
    for (let i = 0; i < 400; i++) air.tick(1);
    const net = air.netAt(0, 5, 0)!;
    expect(net.airL / net.volumeL).toBeLessThanOrEqual(AIR_MAX_BAR);
    expect(net.airL / net.volumeL).toBeGreaterThan(AIR_MAX_BAR - 0.05); // 2 x rpm x dt of the last step may overshoot nothing
    const stalled = net.airL;
    air.tick(1);
    expect(air.netAt(0, 5, 0)!.airL).toBe(stalled);
  });

  it('leaks at an open tube end, scaled by pressure, and not at a capped one', () => {
    const open = makeKit();
    row(open.world, ['air_tank', 'air_tube', 'air_tube']); // the far tube ends in open air
    const net = open.sim.air.netAt(0, 5, 0)!;
    expect(net.leaks).toBe(1);
    net.airL = net.volumeL * 3; // 3 bar
    open.run(1);
    expect(net.lostLPerS).toBeCloseTo(100 * (3 / AIR_MAX_BAR), 0);
    expect(net.airL).toBeLessThan(net.volumeL * 3);
    const capped = makeKit();
    row(capped.world, ['air_tank', 'air_tube', 'air_tube', 'air_tank']);
    expect(capped.sim.air.netAt(0, 5, 0)!.leaks).toBe(0);
    const walled = makeKit();
    row(walled.world, ['air_tank', 'air_tube', 'air_tube', 'stone']);
    expect(walled.sim.air.netAt(0, 5, 0)!.leaks).toBe(0); // the run ends against a solid block
  });

  it('splits and merges on a block change and keeps the pressure each part came with', () => {
    const kit = makeKit();
    row(kit.world, ['air_tank', 'air_tube', 'air_tube', 'air_tube', 'air_tank']);
    const whole = kit.sim.air.netAt(0, 5, 0)!;
    whole.airL = whole.volumeL * 2; // 2 bar everywhere
    kit.world.put(2, 5, 0, 'air');
    const a = kit.sim.air.netAt(0, 5, 0)!;
    const b = kit.sim.air.netAt(4, 5, 0)!;
    expect(a).not.toBe(b);
    expect(kit.sim.air.barAt(0, 5, 0)).toBeCloseTo(2, 5);
    expect(kit.sim.air.barAt(4, 5, 0)).toBeCloseTo(2, 5);
    // Nothing is made out of thin air: the parts hold what the whole held, less the removed tube's share.
    expect(a.airL + b.airL).toBeCloseTo(whole.airL - 50 * 2, 5);
    kit.world.put(2, 5, 0, 'air_tube');
    expect(kit.sim.air.netAt(0, 5, 0)).toBe(kit.sim.air.netAt(4, 5, 0));
  });

  it('feeds a nozzle only at 2 bar and only the air it uses', () => {
    const kit = makeKit();
    row(kit.world, ['air_tank', 'blast_nozzle']);
    const net = kit.sim.air.netAt(0, 5, 0)!;
    net.airL = net.volumeL * 1.9;
    expect(kit.sim.air.feed(1, 5, 0, 1)).toBe(false);
    net.airL = net.volumeL * 2.5;
    const before = net.airL;
    expect(kit.sim.air.feed(1, 5, 0, 0.5)).toBe(true);
    expect(before - net.airL).toBeCloseTo(10, 6); // 20 L/s for half a second
    expect(kit.sim.air.feed(0, 5, 0, 1)).toBe(false); // a tank is no user
  });

  it('saves one entity per network and floods again from it after a load', () => {
    const kit = makeKit();
    row(kit.world, ['air_tank', 'air_tube', 'air_tank']);
    kit.world.put(1, 5, 5, 'air_tank'); // a second, separate network
    kit.sim.air.netAt(0, 5, 0)!.airL = 1234;
    kit.sim.air.netAt(1, 5, 5)!.airL = 77;
    kit.sim.air.save();
    const saved = [...kit.world.entities()].filter(isAirEntity);
    expect(saved.map((e) => Math.round(e.airL)).sort((p, q) => p - q)).toEqual([77, 1234]);
    kit.sim.resync();
    expect(kit.sim.air.netAt(2, 5, 0)!.airL).toBeCloseTo(1234, 1);
    expect(kit.sim.air.netAt(1, 5, 5)!.airL).toBeCloseTo(77, 1);
    // Removing the whole network drops its entity.
    for (let x = 0; x < 3; x++) kit.world.put(x, 5, 0, 'air');
    kit.sim.air.save();
    expect([...kit.world.entities()].filter(isAirEntity)).toHaveLength(1);
  });

  it('a Blast hearth needs a nozzle, runs on one fed 2 bar, and old hearths are kept by the flag', () => {
    const { kit, furnace } = hearthKitAir();
    // Without a nozzle the shell does not form.
    expect(furnace().hearth).toBeNull();
    expect(kit.sim.structureView(0, 1, 0, { tier: 3 })!.problems.map((p) => p.code)).toEqual(['parts']);
    expect(kit.sim.structureView(0, 1, 0, { tier: 3 })!.problems[0].text).toBe('Needs 1 more Blast Nozzle in a wall');
    // A furnace flagged by the migration forms without it.
    furnace().legacyHearth = true;
    kit.sim.resync(); // a load rescans every hearth
    kit.sim.validateHearths();
    expect(furnace().hearth).toMatchObject({ tier: 3 });
    // A nozzle in a wall forms it for any furnace, and a fed one counts as 2 tuyeres while the fire burns.
    furnace().legacyHearth = false;
    kit.world.put(1, 1, 1, 'blast_nozzle'); // a wall face of the shell (it reaches back to +z)
    kit.sim.validateHearths();
    expect(furnace().hearth).toMatchObject({ tier: 3 });
    kit.world.put(2, 1, 1, 'air_tank'); // outside the east wall, touching the nozzle
    const net = kit.sim.air.netAt(2, 1, 1)!;
    net.airL = net.volumeL * 3;
    furnace().fuel[0] = { item: 'coal', count: 8 };
    expect(kit.sim.light(0, 1, 0).ok).toBe(true);
    kit.run(0.2);
    expect(furnace().lit).toBe(true);
    expect(kit.sim.furnaceView(0, 1, 0)!.hearth.tuyeres).toBe(2);
    expect(net.airL).toBeLessThan(net.volumeL * 3);
    furnace().fuel[0] = null;
    furnace().burnItem = null;
    furnace().burnLeftS = 0;
    furnace().ignited = false;
    kit.run(0.2);
    expect(furnace().lit).toBe(false);
    net.airL = net.volumeL * 3;
    kit.run(0.2);
    expect(kit.sim.furnaceView(0, 1, 0)!.hearth.tuyeres).toBe(0);
    expect(net.airL).toBe(net.volumeL * 3); // nothing burns, nothing is drawn
  });
});
