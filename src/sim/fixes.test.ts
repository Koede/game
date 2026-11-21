/** Regression tests for the review fixes of the furnace, power and machine rules (one describe per finding). */
import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { Face } from '../core/types';
import { createBus } from '../core/context';
import { stackLimit } from '../game/inventory';
import { createFurnace, createNode, type SimContext } from './entities';
import { applyFurnace } from './furnace';
import { furnaceStats } from './hearthStats';
import type { Network } from './power';
import { run } from './pipeKit';
import { makeKit } from './testKit';
import { targetTemp } from './views';

describe('heading-for temperature with fire, electric heat and a large extract (sim-2)', () => {
  it('adds every source like the furnace does, so the estimate matches where it settles', () => {
    const fs = furnaceStats(3, { tier: 3, inner: [1, 1, 1], closed: true, windows: 0, min: [0, 0, 0], max: [2, 2, 2] });
    const e = createFurnace(0, 0, 0, 3);
    e.fuel[0] = { item: 'coal', count: 99 };
    e.lit = true;
    const node = createNode(e);
    node.fs = fs;
    node.net = { f: 1 } as Network;
    const bus = createBus();
    const ctx = { bus, giveBack: () => undefined, setActive: () => undefined, flagOnce: () => undefined } as unknown as SimContext;
    // More heat goes to machines than the fire or the heater gives alone, but less than both together.
    const extract = 12000;
    expect(fs.electricHeatW).toBeLessThan(extract);
    e.tempC = 1500;
    for (let i = 0; i < 20 * 600; i++) {
      e.heatDemandW = fs.electricHeatW;
      e.extractW = extract;
      applyFurnace(node, ctx, DT);
    }
    const settled = e.tempC;
    expect(settled).toBeGreaterThan(400);
    const target = targetTemp(e, fs, e.flameC, 1, 1);
    expect(target).toBeCloseTo(settled, 0);
  });

  it('a fire alone never heads past its flame, and electric heat above the flame still counts', () => {
    const fs = furnaceStats(3, { tier: 3, inner: [1, 1, 1], closed: true, windows: 0, min: [0, 0, 0], max: [2, 2, 2] });
    const e = createFurnace(0, 0, 0, 3);
    e.lit = true;
    e.burnItem = 'charcoal';
    e.burnLeftS = 10;
    e.extractW = 0;
    e.heatDemandW = 0;
    expect(targetTemp(e, fs, 1000, 1, 1)).toBe(1000);
    e.heatDemandW = fs.electricHeatW;
    expect(targetTemp(e, fs, 1000, 1, 1)).toBeCloseTo(Math.min(fs.maxTempC, 20 + fs.electricHeatW / fs.lossWPerC), 6);
  });
});

describe('an empty bucket in the firebox (sim-11)', () => {
  it('does not count as fuel: Light says what to do, and the status says it too', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    e.fuel[0] = { item: 'lava_bucket', count: 1 };
    expect(kit.sim.light(0, 1, 0)).toEqual({ ok: true });
    kit.run(260);
    expect(e.lit).toBe(false);
    expect(e.fuel).toEqual([{ item: 'bronze_bucket', count: 1 }]);
    expect(kit.sim.light(0, 1, 0)).toEqual({ ok: false, reason: 'Take the Bronze Bucket out of the firebox' });
    expect(kit.sim.furnaceView(0, 1, 0)!.status).toBe('Take the Bronze Bucket out of the firebox');
    expect(kit.sim.furnaceView(0, 1, 0)!.fuelItems).toBe(0);
    e.fuel[0] = null;
    expect(kit.sim.light(0, 1, 0)).toEqual({ ok: false, reason: 'No fuel in the firebox' });
  });
});

describe('piped ore spreads over the crucibles (sim-8)', () => {
  it('fills every working crucible of a Blast hearth, least filled first', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    const ep = kit.sim.itemEndpoint(0, 1, 0, Face.PY)!;
    for (let i = 0; i < 6; i++) expect(ep.insert('iron_ore', 4)).toBe(4);
    expect(e.crucibleIn.slice(0, 2)).toEqual([{ item: 'iron_ore', count: 12 }, { item: 'iron_ore', count: 12 }]);
  });
});

describe('brown-out alerts (sim-9)', () => {
  it('a few percent short is no brown-out', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    kit.world.put(0, 4, 0, 'lava');
    kit.machine('geothermal_tap', 0, 5, 0);
    for (let x = 1; x <= 7; x++) kit.machine('space_heater', x, 5, 0);
    kit.run(5);
    expect(kit.sim.networkAt(0, 5, 0)!.satisfaction).toBeCloseTo(2000 / 2100, 6);
    expect(alerts).toEqual([]);
  });

  it('says a stalled network is stalled, only after it held for a few seconds', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    kit.world.put(0, 4, 0, 'lava');
    kit.machine('geothermal_tap', 0, 5, 0);
    for (let x = 1; x <= 9; x++) kit.machine('crusher', x, 5, 0).slots[0] = { item: 'copper_ore', count: 64 };
    kit.run(1);
    expect(alerts).toEqual([]);
    kit.run(3);
    expect(alerts.map((a) => a.message)).toEqual(['Stalled - only 22% power, machines stop below 25%']);
  });

  it('a consumer alone on its network raises no alert', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    kit.machine('crusher', 0, 5, 0).slots[0] = { item: 'copper_ore', count: 64 };
    kit.run(5);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('No power');
    expect(alerts).toEqual([]);
  });
});

describe('breaking a machine never deletes what the pack cannot hold (sim-1)', () => {
  const ironIn = (kit: ReturnType<typeof makeKit>): number => {
    let n = kit.player.inventory.count('iron_ore');
    for (let x = -3; x <= 3; x++) {
      for (let y = 0; y <= 8; y++) for (let z = -3; z <= 3; z++) for (const s of kit.sim.machineAt(x, y, z)?.slots ?? []) if (s?.item === 'iron_ore') n += s.count;
    }
    return n;
  };

  it('a full crate broken with a nearly full pack leaves the rest in a crate where it stood', () => {
    const kit = makeKit();
    const toasts = kit.record('toast');
    const crate = kit.machine('crate', 0, 5, 0);
    for (let i = 0; i < crate.slots.length; i++) crate.slots[i] = { item: 'iron_ore', count: 64 };
    for (let i = 0; i < 30; i++) kit.player.inventory.set(i, { item: 'flint_pickaxe', count: 1, durability: 64 });
    expect(ironIn(kit)).toBe(27 * 64);
    kit.world.setVoxel(0, 5, 0, 0, 'player');
    kit.run(DT);
    expect(kit.player.inventory.count('iron_ore')).toBe(6 * stackLimit('iron_ore'));
    expect(kit.sim.machineAt(0, 5, 0)).toMatchObject({ kind: 'crate' });
    expect(ironIn(kit)).toBe(27 * 64);
    expect(toasts.map((t) => t.text)).toContain('Your pack is full - the rest is left in a crate');
    // A saved and reloaded world keeps the spill crate.
    expect(kit.world.getEntity(0, 5, 0)).toBe(kit.sim.machineAt(0, 5, 0));
  });

  it('a furnace keeps its fuel and crucibles the same way', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    e.fuel[0] = { item: 'coal', count: 40 };
    e.crucibleIn[0] = { item: 'copper_ore', count: 20 };
    for (let i = 0; i < 36; i++) kit.player.inventory.set(i, { item: 'flint_pickaxe', count: 1, durability: 64 });
    kit.world.setVoxel(0, 1, 0, 0, 'player');
    kit.run(DT);
    const spill = kit.sim.machineAt(0, 1, 0)!;
    expect(spill.kind).toBe('crate');
    expect(spill.slots.filter((s) => s)).toEqual([{ item: 'coal', count: 40 }, { item: 'copper_ore', count: 20 }]);
  });

  it('everything that fits goes to the pack and no crate appears', () => {
    const kit = makeKit();
    kit.machine('crate', 0, 5, 0).slots[0] = { item: 'iron_ore', count: 10 };
    kit.world.setVoxel(0, 5, 0, 0, 'player');
    kit.run(DT);
    expect(kit.player.inventory.count('iron_ore')).toBe(10);
    expect(kit.sim.machineAt(0, 5, 0)).toBeNull();
  });
});

describe('a boiler-to-turbine line works as built, and says why when it does not (sim-3)', () => {
  it('the hot pipe end at the boiler pulls by default; a push end there says to set it to Pull', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0);
    const boiler = kit.machine('boiler', 0, 6, 0);
    run(kit.world, 'hot_fluid_pipe', [1, 6, 0], [2, 6, 0]);
    kit.machine('steam_turbine', 3, 6, 0);
    const port = () => kit.sim.pipeView(1, 6, 0)!.ports.find((p) => p.block === 'boiler')!;
    expect(port().mode).toBe('pull');
    expect(kit.sim.pipeView(2, 6, 0)!.ports.find((p) => p.block === 'steam_turbine')!.mode).toBe('push');
    // Wrenched (or saved) the wrong way round: every status points at the fix.
    expect(kit.sim.setPort(1, 6, 0, Face.NX, { mode: 'push' })).toEqual({ ok: true });
    boiler.fluidIn = { fluid: 'water', litres: 500 };
    boiler.fluidOut = { fluid: 'steam', litres: 1000 };
    kit.run(1);
    f.tempC = 600;
    expect(port().status).toBe('Holds steam - set this end to Pull');
    expect(kit.sim.machineView(0, 6, 0)!.status).toBe('Holds steam - wrench the pipe end at the boiler to Pull');
    expect(kit.sim.machineView(3, 6, 0)!.status).toBe('Steam line has no end pulling from a boiler - wrench the boiler end to Pull');
    expect(kit.sim.setPort(1, 6, 0, Face.NX, { mode: 'pull' })).toEqual({ ok: true });
    kit.run(1);
    expect(kit.sim.machineAt(3, 6, 0)!.fluidIn?.litres ?? 0).toBeGreaterThan(0);
  });

  it('a boiler fed water through a cold pipe still pushes on that pipe', () => {
    const kit = makeKit();
    kit.furnace(0, 5, 0);
    kit.machine('boiler', 0, 6, 0);
    run(kit.world, 'fluid_pipe', [1, 6, 0], [2, 6, 0]);
    expect(kit.sim.pipeView(1, 6, 0)!.ports.find((p) => p.block === 'boiler')!.mode).toBe('push');
  });
});

describe('hearth parts say whether they are part of a hearth (sim-10)', () => {
  it('a lone hatch is not part of a hearth; built into a formed one it says which', () => {
    const kit = makeKit();
    kit.machine('item_hatch', 10, 1, 10);
    kit.machine('fluid_hatch', 12, 1, 10);
    expect(kit.sim.machineView(10, 1, 10)!.status).toBe('Not part of a formed hearth - build it into a hearth wall');
    expect(kit.sim.machineView(12, 1, 10)!.status).toBe('Not part of a formed hearth - build it into a hearth wall');
    kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    const hatch = kit.machine('fluid_hatch', 1, 1, 1);
    kit.sim.validateHearths();
    expect(kit.sim.machineView(1, 1, 1)!.status).toBe('Part of the Blast hearth');
    hatch.fluidIn = { fluid: 'lava', litres: 600 };
    expect(kit.sim.machineView(1, 1, 1)!.status).toBe('Part of the Blast hearth - holds 600 L of lava');
  });
});

describe('the ignition check looks at what the grid can carry (sim-5)', () => {
  const star = () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_star');
    kit.formed(0, 1, 0);
    e.tempC = 3100;
    return { kit, e };
  };
  const charged = (kit: ReturnType<typeof makeKit>, x: number, y: number, z: number) => {
    const b = kit.machine('lithium_bank', x, y, z);
    b.storedJ = b.storedJ || 40_000_000;
    return b;
  };

  it('a cable that cannot carry it refuses the start and names the cable to lay', () => {
    const { kit } = star();
    kit.world.put(0, 1, 5, 'heavy_cable'); // behind a power port in the back wall
    charged(kit, 0, 1, 6);
    charged(kit, 1, 1, 6);
    charged(kit, -1, 1, 6);
    kit.run(0.05);
    const v = kit.sim.furnaceView(0, 1, 0)!;
    const p = v.ignition.power!;
    expect(p.ratingW).toBe(120000);
    expect(p.needW).toBeGreaterThan(300000);
    expect(p).toMatchObject({ cableOk: false, supplyOk: true, storageOk: true });
    const reason = `Cable limit 120 kW - needs ${Math.round(p.needW / 1000)} kW: lay super cable`;
    expect(v.ignition.canStart).toEqual({ ok: false, reason });
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({ ok: false, reason });
    kit.world.put(0, 1, 5, 'super_cable');
    kit.run(0.05);
    expect(kit.sim.furnaceView(0, 1, 0)!.ignition.power).toMatchObject({ cableOk: true, supplyOk: true, storageOk: true });
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({ ok: true });
  });

  it('a supply short of the need is reported, with how long storage would last', () => {
    const { kit } = star();
    const b = charged(kit, 0, 1, 5);
    b.storedJ = 1_200_000;
    kit.run(0.05);
    const p = kit.sim.furnaceView(0, 1, 0)!.ignition.power!;
    expect(p).toMatchObject({ cableOk: true, supplyOk: false, storageOk: false, dischargeW: 150000, generationW: 0 });
    expect(p.lastsS).toBeLessThan(10);
    // Failing stays part of the game: the start is allowed (spec 3.1), the panel warns.
    expect(kit.sim.furnaceView(0, 1, 0)!.ignition.canStart).toEqual({ ok: true });
  });
});

describe('a first hearth on flat ground (sim-4)', () => {
  it('forms with the ground left under the furnace, and the plan does not ask to dig there', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    kit.world.put(0, 0, 0, 'grass'); // the floor cell under the furnace: walled in, never placed
    kit.sim.validateHearths();
    expect(kit.sim.furnaceAt(0, 1, 0)!.hearth).toMatchObject({ tier: 2 });
    const v = kit.sim.structureView(0, 1, 0, { tier: 2 })!;
    expect(v.target.cells.find((c) => c.x === 0 && c.y === 0 && c.z === 0)).toMatchObject({ has: 'grass', state: 'ok' });
    expect(v.target.materials).toEqual([expect.objectContaining({ item: 'brick', need: 15, missing: 0 })]);
    // A hole there is still a gap.
    kit.world.put(0, 0, 0, 'air');
    kit.sim.validateHearths();
    expect(kit.sim.furnaceAt(0, 1, 0)!.hearth).toBeNull();
    expect(kit.sim.structureView(0, 1, 0)!.problems[0]).toMatchObject({ code: 'missing', x: 0, y: 0, z: 0, text: 'Floor has a gap' });
  });
});

describe('hearth problems say what is really wrong (sim-6)', () => {
  it('a wall block taken out of a formed hearth is a gap, where it is', () => {
    const kit = makeKit();
    const toasts = kit.record('toast');
    kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    kit.world.put(1, 1, 1, 'air'); // the east wall, on the line the scan walks
    kit.sim.validateHearths();
    expect(toasts.map((t) => t.text)).toContain('The Blast hearth came apart - wall has a gap');
    expect(kit.sim.structureView(0, 1, 0)!.problems[0]).toEqual({ code: 'missing', x: 1, y: 1, z: 1, text: 'Wall has a gap' });
    // Still so after the next scans, and the plan keeps the old box.
    kit.run(2);
    expect(kit.sim.furnaceView(0, 1, 0)!.hearth.problem).toBe('Wall has a gap');
    kit.world.put(1, 1, 1, 'brick');
    kit.sim.validateHearths();
    expect(kit.sim.furnaceAt(0, 1, 0)!.hearth).toMatchObject({ tier: 2 });
  });

  it('a lone furnace has no problem, only a neutral note', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0);
    const v = kit.sim.structureView(0, 1, 0)!;
    expect(v.problems).toEqual([]);
    expect(v.note).toBe('No hearth built around this furnace yet');
    expect(kit.sim.furnaceView(0, 1, 0)!.hearth.problem).toBeNull();
  });

  it('walls that do not close quote the planned tier\'s inside limit', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0);
    kit.world.put(1, 1, 0, 'brick');
    expect(kit.sim.structureView(0, 1, 0)!.problems[0].text).toBe('The walls do not close around the inside - it can be at most 3 blocks across');
  });
});

describe('a hearth plan keeps clear of machines (sim-7)', () => {
  it('shifts sideways away from a crate, can be shifted by hand, and lists what is in the way', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0, 'furnace_blast'); // facing north: the inside lies towards +z, along +x is "right"
    kit.machine('crate', -2, 1, 1);
    const auto = kit.sim.structureView(0, 1, 0, { tier: 2, inner: [3, 1, 1] })!;
    expect(auto.target).toMatchObject({ offset: 0, offsets: [-2, 0], machines: [] });
    const centred = kit.sim.structureView(0, 1, 0, { tier: 2, inner: [3, 1, 1], offset: -1 })!;
    expect(centred.target.offset).toBe(-1);
    expect(centred.target.machines).toEqual([{ x: -2, y: 1, z: 1, block: 'crate', name: 'Crate' }]);
  });
});

describe('damaged entities from a save are repaired, not fatal (sim-12)', () => {
  it('a furnace with a broken firebox, an unknown machine and garbage pipe ports load and tick', () => {
    const kit = makeKit();
    const toasts = kit.record('toast');
    const e = kit.furnace(0, 1, 0);
    e.crucibleIn[0] = { item: 'copper_ore', count: 3 };
    kit.machine('crate', 3, 1, 0).slots[0] = { item: 'no_such_item', count: 5 };
    kit.world.put(5, 1, 0, 'item_pipe');
    const raw = e as unknown as Record<string, unknown>;
    raw.fuel = null;
    raw.tempC = 'hot';
    raw.tier = 99;
    raw.crucibleProgress = 'x';
    kit.world.setEntity({ kind: 'mystery', x: 2, y: 1, z: 0 });
    kit.world.setEntity({ kind: 'pipe', x: 5, y: 1, z: 0, ports: [{ mode: 'sideways' }, 7], packets: 'lots' } as never);
    expect(() => kit.sim.resync()).not.toThrow();
    expect(() => kit.run(2)).not.toThrow();
    expect(kit.world.getEntity(2, 1, 0)).toBeUndefined();
    const f = kit.sim.furnaceAt(0, 1, 0)!;
    expect(f.fuel).toEqual([null]);
    expect(f.tier).toBe(1); // the clay furnace block standing there
    expect(f.tempC).toBe(20);
    expect(f.crucibleIn[0]).toEqual({ item: 'copper_ore', count: 3 });
    expect(f.crucibleProgress.every((p) => p === 0)).toBe(true);
    expect(kit.sim.machineAt(3, 1, 0)!.slots[0]).toBeNull();
    expect(() => kit.sim.pipeView(5, 1, 0)).not.toThrow();
    expect(() => kit.sim.furnaceView(0, 1, 0)).not.toThrow();
    expect(toasts.map((t) => t.text)).toContain('4 damaged machines were reset');
  });

  it('a sound save loads without a word', () => {
    const kit = makeKit();
    fireUp(kit);
    const toasts = kit.record('toast');
    // An older save's furnace without the fields added since is filled in quietly.
    delete (kit.sim.furnaceAt(0, 1, 0) as unknown as Record<string, unknown>).fuelSeen;
    kit.sim.resync();
    expect(toasts).toEqual([]);
    expect(kit.sim.furnaceAt(0, 1, 0)!.fuelSeen).toBe(0);
  });
});

function fireUp(kit: ReturnType<typeof makeKit>): void {
  const e = kit.furnace(0, 1, 0, 'furnace_blast');
  kit.formed(0, 1, 0);
  e.fuel[0] = { item: 'coal', count: 3 };
  kit.sim.light(0, 1, 0);
  kit.machine('crusher', 4, 1, 0).slots[0] = { item: 'copper_ore', count: 4 };
  kit.machine('tank', 6, 1, 0).fluidIn = { fluid: 'water', litres: 500 };
  kit.run(1);
}
