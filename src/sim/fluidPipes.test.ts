/** Fluid transport (spec 16.1, 16.2, 16.4, 16.5): pumps, one fluid per network, hot and cold pipes, priorities, tanks, buckets. */
import { describe, expect, it } from 'vitest';
import { blockOf, machine } from '../core/registry';
import type { FluidKey } from '../core/types';
import { Face } from '../core/types';
import type { FluidNet } from './fluidNet';
import { netOf, run } from './pipeKit';
import { isPipeEntity } from './pipeState';
import { makeKit, type Kit } from './testKit';
import { flowingWater } from '../world/water';

/** A charged lithium bank: power for whatever touches it. */
function power(kit: Kit, x: number, y: number, z: number): void {
  kit.machine('lithium_bank', x, y, z).storedJ = 40e6;
}

/** A tank holding `litres` of a fluid. */
function tank(kit: Kit, x: number, y: number, z: number, fluid?: 'water' | 'lava' | 'crude_oil' | 'fuel' | 'steam', litres = 0) {
  const e = kit.machine('tank', x, y, z);
  if (fluid) e.fluidIn = { fluid, litres };
  return e;
}

const litresIn = (e: { fluidIn: { litres: number } | null }): number => e.fluidIn?.litres ?? 0;

describe('pumps', () => {
  it('pump water from a 2x2 pool forever, 200 L a second', () => {
    const kit = makeKit();
    for (let x = 0; x <= 1; x++) {
      for (let z = 0; z <= 1; z++) {
        kit.world.put(x, 3, z, 'stone');
        kit.world.put(x, 4, z, 'water');
      }
    }
    kit.machine('pump', 0, 5, 0);
    power(kit, 0, 6, 0);
    run(kit.world, 'fluid_pipe', [1, 5, 0], [3, 5, 0]);
    const t = tank(kit, 4, 5, 0);
    kit.run(10);
    expect(litresIn(t)).toBeGreaterThan(1900);
    expect(litresIn(t)).toBeLessThanOrEqual(2000);
    expect(blockOf(kit.world.getVoxel(0, 4, 0)).key).toBe('water');
    expect(blockOf(kit.world.getVoxel(1, 4, 0)).key).toBe('water');
    const pump = kit.sim.machineView(0, 5, 0)!;
    expect(pump).toMatchObject({ running: true, status: 'Pumping water - 200 L/s' });
    const ports = kit.sim.pipeView(2, 5, 0)!.ports;
    expect(ports.map((p) => [p.name, p.mode, p.status])).toEqual([['Pump', 'pull', 'Moving 200 L/s'], ['Tank', 'push', 'Moving 200 L/s']]);
  });

  it('use up lava and oil: one block per 1000 L, the farthest first, until the pool is gone', () => {
    const kit = makeKit();
    for (let x = 0; x < 3; x++) kit.world.put(x, 4, 0, 'lava');
    kit.machine('pump', 0, 5, 0);
    power(kit, 0, 6, 0);
    kit.world.put(1, 5, 0, 'hot_fluid_pipe');
    const t = tank(kit, 2, 5, 0);
    kit.run(5.5);
    expect(blockOf(kit.world.getVoxel(2, 4, 0)).key).toBe('air'); // the far end went first
    expect(blockOf(kit.world.getVoxel(0, 4, 0)).key).toBe('lava');
    kit.run(10);
    for (let x = 0; x < 3; x++) expect(blockOf(kit.world.getVoxel(x, 4, 0)).key).toBe('air');
    expect(litresIn(t)).toBeCloseTo(3000, 0);
    expect(t.fluidIn?.fluid).toBe('lava');
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Must touch still water, lava or oil');

    const oil = makeKit();
    oil.world.put(0, 4, 0, 'oil');
    oil.machine('pump', 0, 5, 0);
    power(oil, 0, 6, 0);
    oil.world.put(1, 5, 0, 'fluid_pipe');
    const o = tank(oil, 2, 5, 0);
    oil.run(6);
    expect(o.fluidIn).toEqual({ fluid: 'crude_oil', litres: 1000 });
    expect(blockOf(oil.world.getVoxel(0, 4, 0)).key).toBe('air'); // a lone block is no spring
  });

  it('take water sources only: a lone source is used up, flowing water is never drawn (spec 18.3)', () => {
    const kit = makeKit();
    kit.world.put(0, 3, 0, 'stone');
    kit.world.put(1, 3, 0, 'stone');
    kit.world.put(0, 4, 0, 'water');
    kit.world.setVoxel(1, 4, 0, flowingWater(1));
    kit.machine('pump', 0, 5, 0);
    power(kit, 0, 6, 0);
    kit.world.put(1, 5, 0, 'fluid_pipe');
    const t = tank(kit, 2, 5, 0);
    kit.run(1);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Pumping water - 200 L/s (the pool shrinks)');
    kit.run(7);
    expect(litresIn(t)).toBeCloseTo(1000, 0);
    expect(blockOf(kit.world.getVoxel(0, 4, 0)).key).toBe('air');
    expect(kit.world.getVoxel(1, 4, 0)).toBe(flowingWater(1));
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Must touch still water, lava or oil');
    // A source between two others refills by the flow rules: endless.
    const lake = makeKit();
    for (let x = -1; x <= 1; x++) {
      lake.world.put(x, 3, 0, 'stone');
      lake.world.put(x, 4, 0, 'water');
    }
    lake.machine('pump', 0, 5, 0);
    power(lake, 0, 6, 0);
    lake.world.put(1, 5, 0, 'fluid_pipe');
    const lt = tank(lake, 2, 5, 0);
    lake.run(12);
    expect(litresIn(lt)).toBeGreaterThan(2000);
    for (let x = -1; x <= 1; x++) expect(blockOf(lake.world.getVoxel(x, 4, 0)).key).toBe('water');
  });

  it('need power and room, and say so', () => {
    const kit = makeKit();
    kit.machine('pump', 0, 5, 0);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Must touch still water, lava or oil');
    kit.world.put(0, 4, 0, 'water');
    kit.world.put(1, 4, 0, 'water');
    kit.run(1);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('No power');
    power(kit, 0, 6, 0);
    kit.run(6);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Full - connect a pipe that pulls');
    expect(kit.sim.machineView(0, 5, 0)!.fluids).toMatchObject({ output: { fluid: 'water', litres: 1000 }, capacityL: 1000 });
  });

  it('say honestly why they are full when a pipe is attached (ui-13)', () => {
    const kit = makeKit();
    kit.world.put(0, 4, 0, 'water');
    kit.world.put(1, 4, 0, 'water');
    kit.machine('pump', 0, 5, 0);
    power(kit, 0, 6, 0);
    // A dead-end line: the pipe end at the pump pulls (the default for a pump), but nothing takes the water.
    run(kit.world, 'fluid_pipe', [1, 5, 0], [2, 5, 0]);
    kit.run(12);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Full - the line has nowhere to put it');
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'push' }).ok).toBe(true);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Full - nothing pulls from it');
    // A switched-off end is no pipe as far as the pump is concerned.
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'off' }).ok).toBe(true);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Full - connect a pipe that pulls');
    // Pulling again into a line that reaches a tank: it pumps.
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' }).ok).toBe(true);
    tank(kit, 3, 5, 0);
    kit.run(1);
    expect(kit.sim.machineView(0, 5, 0)!.status).toMatch(/^Pumping water - /);
  });
});

describe('fluid networks', () => {
  it('a cold pipe refuses hot fluids: "Too hot for this pipe"', () => {
    const kit = makeKit();
    tank(kit, 0, 5, 0, 'lava', 4000);
    run(kit.world, 'fluid_pipe', [1, 5, 0], [2, 5, 0]);
    const t = tank(kit, 3, 5, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(2);
    expect(t.fluidIn).toBeNull();
    expect(kit.sim.pipeView(1, 5, 0)!.ports[0].status).toBe('Too hot for this pipe');
    // A hot pipe carries it, 1000 L a second.
    kit.world.setVoxel(2, 5, 0, 0);
    kit.world.setVoxel(1, 5, 0, 0);
    run(kit.world, 'hot_fluid_pipe', [1, 5, 0], [2, 5, 0]);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(2);
    expect(litresIn(t)).toBeGreaterThan(1500);
  });

  it('holds one fluid: an end offering another says what the pipes hold', () => {
    const kit = makeKit();
    tank(kit, 0, 5, 0, 'water', 4000);
    run(kit.world, 'fluid_pipe', [1, 5, 0], [3, 5, 0]);
    tank(kit, 2, 6, 0, 'crude_oil', 4000);
    tank(kit, 4, 5, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.sim.setPort(2, 5, 0, Face.PY, { mode: 'pull' });
    kit.sim.setPort(3, 5, 0, Face.PX, { priority: -1 }); // fills last: the pipes stay full of water
    kit.run(1);
    const statuses = kit.sim.pipeView(1, 5, 0)!.ports.map((p) => [p.block, p.status]);
    expect(statuses).toContainEqual(['tank', 'The pipes hold Water']);
  });

  it('fills pushing ends by priority, sharing equally within a priority, up to the capacity of its pipes', () => {
    const kit = makeKit();
    tank(kit, 0, 5, 0, 'water', 16000);
    run(kit.world, 'hot_fluid_pipe', [1, 5, 0], [4, 5, 0]);
    const hi1 = tank(kit, 2, 6, 0);
    const hi2 = tank(kit, 3, 6, 0);
    const lo = tank(kit, 4, 6, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' }); // 1000 L/s in
    kit.sim.setPort(2, 5, 0, Face.PY, { priority: 1 });
    kit.sim.setPort(3, 5, 0, Face.PY, { priority: 1 });
    kit.run(4);
    expect(litresIn(hi1)).toBeCloseTo(litresIn(hi2), 0);
    expect(litresIn(hi1)).toBeGreaterThan(1500);
    expect(litresIn(lo)).toBe(0);
    // The high ones refuse (filtered): the low one gets it all.
    kit.sim.setPort(2, 5, 0, Face.PY, { filter: ['water'], filterMode: 'deny' });
    kit.sim.setPort(3, 5, 0, Face.PY, { mode: 'off' });
    kit.run(2);
    expect(litresIn(lo)).toBeGreaterThan(1500);
    const statuses = kit.sim.pipeView(1, 5, 0)!.ports.map((p) => p.status);
    expect(statuses).toEqual(expect.arrayContaining(['Filter blocks Water', 'Off', 'Moving 1,000 L/s']));
    // Nowhere to go: the pipes fill to 250 L each and the pulling end says why.
    kit.sim.setPort(4, 5, 0, Face.PY, { mode: 'off' });
    kit.run(2);
    const net = netOf(kit, 1, 5, 0) as FluidNet;
    expect(net.store).toEqual({ fluid: 'water', litres: 1000 });
    expect(kit.sim.pipeView(1, 5, 0)!.ports.find((p) => p.mode === 'pull')!.status).toBe('No destination');
    expect(kit.sim.pipeFluidAt(2, 5, 0)).toEqual({ fluid: 'water', fill: 1, litres: 1000 });
    const snap = kit.sim.transportView();
    expect(snap.fluids).toHaveLength(1);
    expect(snap.fluids[0]).toMatchObject({ fluid: 'water', colour: 0x3a86b4, fill: 1, litres: 1000, capacityL: 1000 });
    expect(Array.from(snap.fluids[0].cells)).toEqual([1, 5, 0, 2, 5, 0, 3, 5, 0, 4, 5, 0]);
  });

  it('forgets its fluid once empty', () => {
    const kit = makeKit();
    tank(kit, 0, 5, 0, 'lava', 100);
    run(kit.world, 'hot_fluid_pipe', [1, 5, 0], [2, 5, 0]);
    const t = tank(kit, 3, 5, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(1);
    expect(litresIn(t)).toBeCloseTo(100, 5);
    expect((netOf(kit, 1, 5, 0) as FluidNet).store).toEqual({ fluid: null, litres: 0 });
    t.fluidIn = null;
    tank(kit, 0, 5, 0).fluidIn = { fluid: 'water', litres: 50 };
    kit.run(1);
    expect(t.fluidIn).toEqual({ fluid: 'water', litres: 50 });
  });

  it('keeps what its pipes hold across a save', () => {
    const a = makeKit();
    tank(a, 0, 5, 0, 'fuel', 4000);
    run(a.world, 'fluid_pipe', [1, 5, 0], [4, 5, 0]);
    a.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    a.run(5);
    expect((netOf(a, 1, 5, 0) as FluidNet).store).toEqual({ fluid: 'fuel', litres: 1000 });
    const saved = JSON.parse(JSON.stringify([...a.world.entities()]));
    expect(saved.filter(isPipeEntity)).toHaveLength(1);

    const b = makeKit();
    b.world.put(0, 5, 0, 'tank');
    run(b.world, 'fluid_pipe', [1, 5, 0], [4, 5, 0]);
    for (const e of [...b.world.entities()]) b.world.removeEntity(e.x, e.y, e.z);
    for (const e of saved) b.world.setEntity(e);
    b.sim.resync();
    expect((netOf(b, 3, 5, 0) as FluidNet).store).toEqual({ fluid: 'fuel', litres: 1000 });
    expect(b.sim.machineAt(0, 5, 0)!.fluidIn).toEqual({ fluid: 'fuel', litres: 3000 });
    b.run(2);
    expect((netOf(b, 3, 5, 0) as FluidNet).store).toEqual({ fluid: 'fuel', litres: 1000 }); // still pulling, still full
  });
});

describe('tanks', () => {
  it('stacked tanks share one fluid and one level, filling from the bottom', () => {
    const kit = makeKit();
    const tanks = [tank(kit, 0, 5, 0), tank(kit, 0, 6, 0), tank(kit, 0, 7, 0)];
    tank(kit, 3, 5, 0, 'water', 16000);
    tank(kit, 3, 6, 0, 'water', 6000);
    run(kit.world, 'hot_fluid_pipe', [1, 7, 0], [2, 7, 0]); // into the top tank of the stack...
    kit.world.put(2, 6, 0, 'hot_fluid_pipe');
    kit.world.put(2, 5, 0, 'hot_fluid_pipe'); // ...from the bottom of the other stack
    kit.sim.setPort(2, 5, 0, Face.PX, { mode: 'pull' });
    kit.run(25);
    expect(tanks.map(litresIn)).toEqual([16000, 6000, 0]);
    expect(kit.sim.machineView(0, 7, 0)!.status).toBe('22,000 of 48,000 L (3 tanks)');
    expect(kit.sim.machineView(0, 6, 0)!.fluids!.stack).toEqual({ tanks: 3, fluid: 'water', litres: 22000, capacityL: 48000 });
    expect(kit.sim.machineView(3, 5, 0)!.status).toBe('Empty (2 tanks)');
  });

  it('takes a gasoline canister and a pulling pipe moves it into a second tank', () => {
    const kit = makeKit();
    const from = tank(kit, 0, 5, 0);
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'gasoline_canister')).toEqual({ ok: true, held: 'empty_canister', fluid: 'gasoline', litres: 1000 });
    expect(from.fluidIn).toEqual({ fluid: 'gasoline', litres: 1000 });
    run(kit.world, 'fluid_pipe', [1, 5, 0], [2, 5, 0]);
    const to = tank(kit, 3, 5, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(6);
    expect(to.fluidIn).toEqual({ fluid: 'gasoline', litres: 1000 });
    expect(from.fluidIn).toBeNull();
    const added: FluidKey[] = ['sap', 'syrup', 'sugar_wash', 'low_wines', 'spirit', 'fuel_ethanol', 'gasoline', 'kerosene', 'diesel', 'residue', 'slop'];
    const ports = machine('tank').fluids!;
    expect(ports.accepts).toEqual(expect.arrayContaining(added));
    expect(ports.gives).toEqual(expect.arrayContaining(added));
  });

  it('a tank holding another fluid starts a stack of its own', () => {
    const kit = makeKit();
    tank(kit, 0, 5, 0, 'water', 100);
    tank(kit, 0, 6, 0, 'lava', 100);
    tank(kit, 0, 7, 0);
    expect(kit.sim.machineView(0, 5, 0)!.fluids!.stack).toMatchObject({ tanks: 1, fluid: 'water' });
    expect(kit.sim.machineView(0, 7, 0)!.fluids!.stack).toMatchObject({ tanks: 2, fluid: 'lava' });
  });
});

describe('buckets', () => {
  it('pour into and scoop out of tanks and fluid endpoints, 1000 L at a time', () => {
    const kit = makeKit();
    const sfx = kit.record('sfx');
    const t = tank(kit, 0, 5, 0);
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'water_pail')).toEqual({ ok: true, held: 'pail', fluid: 'water', litres: 1000 });
    expect(t.fluidIn).toEqual({ fluid: 'water', litres: 1000 });
    expect(sfx.at(-1)).toMatchObject({ name: 'splash', x: 0, y: 5, z: 0 });
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'pail')).toEqual({ ok: true, held: 'water_pail', fluid: 'water', litres: 1000 });
    expect(t.fluidIn).toBeNull();
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'pail')).toEqual({ ok: false, reason: 'The Tank holds nothing to scoop', endpoint: true });
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'lava_bucket')).toEqual({ ok: true, held: 'bronze_bucket', fluid: 'lava', litres: 1000 });
    expect(sfx.at(-1)?.name).toBe('scoop_lava');
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'water_pail')).toEqual({ ok: false, reason: 'The Tank holds lava', endpoint: true });
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'pail')).toEqual({ ok: false, reason: 'Lava needs a bronze bucket', endpoint: true });
    t.fluidIn = { fluid: 'lava', litres: 400 };
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'bronze_bucket')).toEqual({ ok: false, reason: 'A bucket takes 1000 L - it holds 400 L', endpoint: true });
    t.fluidIn = { fluid: 'crude_oil', litres: 4000 };
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'pail')).toEqual({ ok: false, reason: 'A bucket cannot carry crude oil', endpoint: true });
    t.fluidIn = { fluid: 'water', litres: 15500 };
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'water_pail')).toEqual({ ok: false, reason: 'Not enough room for a bucketful', endpoint: true });
    t.fluidIn = { fluid: 'water', litres: 16000 };
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'water_pail')).toEqual({ ok: false, reason: 'The Tank is full', endpoint: true });
    expect(kit.sim.bucketUse(0, 5, 0, Face.PX, 'bronze_bucket')).toEqual({ ok: false, reason: 'A bronze bucket is kept for lava', endpoint: true });
    // Machines with fluid ports: a steam engine takes water; it gives nothing back.
    kit.machine('steam_engine', 3, 5, 0);
    expect(kit.sim.bucketUse(3, 5, 0, Face.PY, 'water_pail')).toMatchObject({ ok: true, held: 'pail' });
    expect(kit.sim.machineAt(3, 5, 0)!.fluidIn).toEqual({ fluid: 'water', litres: 1000 });
    expect(kit.sim.bucketUse(3, 5, 0, Face.PY, 'pail')).toEqual({ ok: false, reason: 'The Steam Engine holds nothing to scoop', endpoint: true });
    expect(kit.sim.bucketUse(3, 5, 0, Face.PY, 'lava_bucket')).toEqual({ ok: false, reason: 'The Steam Engine does not take lava', endpoint: true });
    // Not a fluid block, not a bucket.
    kit.machine('crate', 6, 5, 0);
    expect(kit.sim.bucketUse(6, 5, 0, Face.PY, 'pail')).toEqual({ ok: false, reason: 'Use it on a tank or a machine that takes fluids', endpoint: false });
    expect(kit.sim.bucketUse(0, 5, 0, Face.PY, 'coal')).toEqual({ ok: false, reason: 'That is not a bucket', endpoint: false });
  });

  it('a lava bucket into a formed hearth\'s fluid hatch fuels the furnace', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0, 'furnace_blast');
    kit.formed(0, 5, 0);
    kit.world.put(1, 5, 1, 'fluid_hatch');
    kit.sim.validateHearths();
    expect(kit.sim.bucketUse(1, 5, 1, Face.PX, 'lava_bucket')).toMatchObject({ ok: true, held: 'bronze_bucket' });
    expect(kit.sim.light(0, 5, 0)).toEqual({ ok: true });
    expect(f.burnItem).toBe('lava_bucket');
    kit.world.setVoxel(0, 4, 1, 0); // the hearth comes apart: the hatch is nothing on its own
    kit.run(0.1);
    expect(kit.sim.bucketUse(1, 5, 1, Face.PX, 'lava_bucket')).toEqual({ ok: false, reason: 'The hearth is not formed', endpoint: true });
  });
});
