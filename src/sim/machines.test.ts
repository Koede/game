import { describe, expect, it } from 'vitest';
import { DT, MAX_HEALTH } from '../core/constants';
import { blockOf, machine } from '../core/registry';
import { voxelActive } from '../core/types';
import type { MachineEntity } from './entities';
import { fire, makeKit, type Kit } from './testKit';

/** A full lithium bank: 150 kW for anything that touches it. */
function bank(kit: Kit, x: number, y: number, z: number): MachineEntity {
  const b = kit.machine('lithium_bank', x, y, z);
  b.storedJ = machine('lithium_bank').capacityJ!;
  return b;
}

describe('processors', () => {
  const CASES: Array<[string, string, number]> = [
    ['crusher', 'copper_ore', 1], ['still', 'oil_shale', 2], ['centrifuge', 'yellowcake', 4], ['electrolyzer', 'empty_cell', 1],
  ];
  it.each(CASES)('%s runs its recipe in the recipe time at full power', (kind, input, perJob) => {
    const kit = makeKit();
    const jobs = kit.record('machine:job');
    const made = kit.record('item:made');
    const flags = kit.record('flag');
    const m = kit.machine(kind, 0, 5, 0);
    bank(kit, 1, 5, 0);
    expect(kit.sim.machineView(0, 5, 0)!.recipe).toBeNull();
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    expect(slots.accepts(input, 0)).toBe(true);
    expect(slots.accepts(input, 1)).toBe(false);
    expect(slots.accepts('plank', 0)).toBe(false);
    expect(slots.add(input, perJob * 2 + 1)).toBe(0);
    if (kind === 'electrolyzer') {
      kit.run(1);
      expect(m.demandW).toBe(0);
      expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Must touch water');
      kit.world.put(0, 4, 0, 'water');
    }
    kit.run(0.1);
    const view = kit.sim.machineView(0, 5, 0)!;
    const rec = view.recipe!;
    expect(rec.station).toBe(kind);
    expect(m.demandW).toBe(machine(kind).drawW);
    expect(rec.energyJ).toBe(machine(kind).drawW! * rec.timeS);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(true);
    kit.run(rec.timeS - 0.2);
    expect(m.slots[1]).toBeNull();
    kit.run(0.2);
    expect(m.slots[1]).toEqual({ item: rec.output.item, count: rec.output.count });
    expect(jobs).toEqual([{ kind, x: 0, y: 5, z: 0, item: rec.output.item }]);
    expect(made).toEqual([{ item: rec.output.item, count: rec.output.count, station: kind, recipeId: rec.id }]);
    kit.run(rec.timeS * 2);
    expect(m.slots[1]!.count).toBe(rec.output.count * 2);
    expect(m.slots[0]).toEqual({ item: input, count: 1 });
    expect(flags.filter((f) => f.flag === 'machine_job')).toHaveLength(1);
    // One item is left: enough for another job only where a job takes one.
    expect(m.demandW).toBe(perJob > 1 ? 0 : machine(kind).drawW);
  });

  it('stops when the output is full, pushes into a touching crate, and returns its contents when broken', () => {
    const kit = makeKit();
    const m = kit.machine('crusher', 0, 5, 0);
    bank(kit, 1, 5, 0);
    m.slots[0] = { item: 'tin_ore', count: 10 };
    m.slots[1] = { item: 'crushed_tin', count: 98 };
    kit.run(10);
    expect(m.slots[1]!.count).toBe(98);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Output is full');
    const crate = kit.machine('crate', 0, 6, 0);
    kit.run(6);
    expect(m.slots[1]).toBeNull();
    expect(crate.slots[0]!.item).toBe('crushed_tin');
    expect(crate.slots[0]!.count + (crate.slots[1]?.count ?? 0)).toBe(100);
    expect(kit.sim.machineSlots(0, 6, 0)!.accepts('plank', 3)).toBe(true);
    kit.world.setVoxel(0, 5, 0, 0, 'player');
    expect(kit.player.inventory.count('tin_ore')).toBe(9);
    kit.world.setVoxel(0, 6, 0, 0, 'player');
    expect(kit.player.inventory.count('crushed_tin')).toBe(100);
    expect(kit.sim.machineAt(0, 6, 0)).toBeNull();
  });
});

describe('bore rig', () => {
  it('mines the column below, one block per 2 s, into its buffer and a touching crate', () => {
    const kit = makeKit();
    kit.world.put(0, 0, 0, 'corestone');
    kit.world.fill(0, 1, 0, 0, 4, 0, 'stone');
    kit.world.put(0, 3, 0, 'coal_ore');
    const rig = kit.machine('bore_rig', 0, 7, 0);
    bank(kit, 1, 7, 0);
    kit.run(1.9);
    expect(blockOf(kit.world.getVoxel(0, 4, 0)).key).toBe('stone');
    kit.run(0.2);
    expect(kit.world.getVoxel(0, 4, 0)).toBe(0);
    expect(rig.slots[0]).toEqual({ item: 'rubble', count: 1 });
    expect(rig.depthY).toBe(4);
    expect(kit.sim.machineView(0, 7, 0)!.status).toBe('Boring at depth 4');
    const crate = kit.machine('crate', 0, 8, 0);
    kit.run(8);
    expect(kit.world.getVoxel(0, 1, 0)).toBe(0);
    expect(rig.halted).toBe('Reached corestone');
    expect(rig.demandW).toBe(0);
    expect(blockOf(kit.world.getVoxel(0, 0, 0)).key).toBe('corestone');
    const inCrate = (item: string) => crate.slots.reduce((n, s) => n + (s && s.item === item ? s.count : 0), 0);
    expect(inCrate('rubble')).toBe(3);
    expect(inCrate('coal')).toBeGreaterThanOrEqual(1);
    expect(rig.slots.every((s) => s === null)).toBe(true);
    expect(kit.sim.machineSlots(0, 7, 0)!.accepts('rubble', 0)).toBe(false);
  });

  it('stops at liquids and at blocks beyond its tool tier, and pauses when the buffer is full', () => {
    const kit = makeKit();
    kit.world.put(0, 3, 0, 'stone');
    kit.world.put(0, 2, 0, 'pitchblende');
    const rig = kit.machine('bore_rig', 0, 5, 0);
    bank(kit, 1, 5, 0);
    for (let i = 0; i < 9; i++) rig.slots[i] = { item: 'plank', count: 99 };
    kit.run(5);
    expect(blockOf(kit.world.getVoxel(0, 3, 0)).key).toBe('stone');
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Buffer full');
    rig.slots[4] = null;
    rig.slots[5] = null;
    kit.run(5);
    expect(kit.world.getVoxel(0, 3, 0)).toBe(0);
    expect(rig.halted).toBe('Pitchblende is too hard for the bore');
    kit.world.put(0, 2, 0, 'water');
    kit.run(1.1);
    expect(rig.halted).toBe('Stopped at water');
    kit.world.setVoxel(0, 2, 0, 0);
    kit.run(1.1);
    expect(rig.halted).toBe('Reached the bottom');
  });
});

describe('small consumers', () => {
  it('a powered blower holds the draft of the furnace it touches at 0.8', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    const blower = kit.machine('blower', 0, 2, 0);
    fire(kit, e, 'coal');
    kit.run(5);
    expect(e.draft).toBe(0);
    expect(blower.f).toBe(0);
    bank(kit, 0, 3, 0);
    kit.run(200);
    expect(e.draft).toBeGreaterThanOrEqual(0.79);
    expect(e.tempC).toBeGreaterThan(1250 + 190);
    expect(voxelActive(kit.world.getVoxel(0, 2, 0))).toBe(true);
    const lone = kit.machine('blower', 9, 2, 0);
    kit.run(0.1);
    expect(lone.demandW).toBe(0);
    expect(kit.sim.machineView(9, 2, 0)!.problem).toBe('Must touch a furnace');
  });

  it('lamps and space heaters are active only while powered and switched on', () => {
    const kit = makeKit();
    kit.machine('lamp', 0, 5, 0);
    kit.machine('space_heater', 1, 5, 0);
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(false);
    bank(kit, 2, 5, 0);
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(true);
    expect(voxelActive(kit.world.getVoxel(1, 5, 0))).toBe(true);
    expect(kit.sim.networkAt(0, 5, 0)!.demandW).toBe(310);
    expect(kit.sim.setMachineOn(0, 5, 0, false)).toEqual({ ok: true });
    kit.run(0.1);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(false);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Switched off');
    expect(kit.sim.setMachineOn(7, 7, 7, true).ok).toBe(false);
  });
});

describe('fission', () => {
  const P = machine('fission_pile').params!;
  const pileAt = (kit: Kit) => {
    const pile = kit.machine('fission_pile', 0, 5, 0);
    pile.slots[0] = { item: 'fuel_rod', count: 2 };
    kit.world.put(0, 4, 0, 'water');
    kit.world.put(0, 6, 0, 'water');
    return pile;
  };

  it('cooled: settles at 600 C, delivers 60 kW and burns its rod with the load', () => {
    const kit = makeKit();
    const pile = pileAt(kit);
    const store = kit.machine('lithium_bank', 1, 5, 0);
    expect(kit.sim.machineSlots(0, 5, 0)!.accepts('fuel_rod', 0)).toBe(true);
    expect(kit.sim.machineSlots(0, 5, 0)!.accepts('coal', 0)).toBe(false);
    kit.run(100);
    expect(pile.availW).toBe(60000);
    expect(pile.coreC).toBe(P.runTempC);
    expect(pile.slots[0]!.count).toBe(1);
    expect(pile.fuelJ).toBeCloseTo(P.rodEnergyJ - 60000 * 100, 0);
    expect(store.storedJ).toBeCloseTo(60000 * 100 * 0.9, 0);
    expect(kit.sim.machineView(0, 5, 0)).toMatchObject({ cooled: true, coreC: 600, problem: null });
    kit.sim.setMachineOn(0, 5, 0, false);
    kit.run(40);
    expect(pile.availW).toBe(0);
    expect(pile.coreC).toBe(20);
  });

  it('uncooled: no output, heats 8 C/s, warns once at 900 C, and cools when water returns', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    const alarms = kit.record('sfx');
    const pile = pileAt(kit);
    kit.run(100);
    kit.world.setVoxel(0, 6, 0, 0);
    kit.run(10);
    expect(pile.availW).toBe(0);
    expect(pile.coreC).toBeCloseTo(600 + 80, 6);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('No cooling - core at 680 C and rising');
    expect(alerts).toHaveLength(0);
    kit.player.position.x = 2.5;
    kit.player.position.y = 4.6;
    kit.player.position.z = 0.5;
    kit.run(30);
    expect(pile.coreC).toBeCloseTo(920, 6);
    expect(alerts.map((a) => a.kind)).toEqual(['meltdown_warning']);
    expect(alarms.filter((s) => s.name === 'alarm').length).toBeGreaterThanOrEqual(1);
    // 2 blocks away: 4 x (1 - 2/6) per tick the pile is past the warning temperature.
    expect(kit.player.extraRadiation).toBeGreaterThan(0);
    const dosePerTick = P.warnRadiation * (1 - 2 / P.warnRadius);
    const before = kit.player.extraRadiation;
    kit.run(DT);
    expect(kit.player.extraRadiation - before).toBeCloseTo(dosePerTick, 6);
    kit.world.put(0, 6, 0, 'water');
    kit.run(10);
    expect(pile.coreC).toBeCloseTo(920.4 - 200, 3);
    kit.run(30);
    expect(pile.coreC).toBe(600);
    expect(alerts).toHaveLength(1);
    expect(pile.availW).toBe(60000);
  });

  it('melts down after 10 s above 1200 C: blast, corium, machines and their contents gone', () => {
    const kit = makeKit();
    const explosions = kit.record('explosion');
    const removed = kit.record('machine:removed');
    kit.world.fill(-5, 0, -5, 5, 0, 5, 'corestone');
    kit.world.fill(-5, 1, -5, 5, 3, 5, 'stone');
    const pile = kit.machine('fission_pile', 0, 2, 0);
    pile.slots[0] = { item: 'fuel_rod', count: 1 };
    const crate = kit.machine('crate', 2, 2, 0);
    crate.slots[0] = { item: 'coal', count: 50 };
    const far = kit.machine('crate', 5, 2, 0);
    kit.player.position.x = 4.5;
    kit.player.position.y = 4;
    kit.player.position.z = 0.5;
    kit.run((P.meltdownTempC - 20) / P.heatRateC + P.meltdownSeconds - 0.5);
    expect(explosions).toHaveLength(0);
    expect(blockOf(kit.world.getVoxel(0, 2, 0)).key).toBe('fission_pile');
    kit.run(1);
    expect(explosions).toEqual([{ x: 0, y: 2, z: 0, radius: P.blastRadius }]);
    expect(blockOf(kit.world.getVoxel(0, 2, 0)).key).toBe('corium');
    expect(kit.world.getVoxel(2, 2, 0)).toBe(0);
    expect(kit.world.getVoxel(0, 1, 0)).toBe(0);
    expect(blockOf(kit.world.getVoxel(0, 0, 0)).key).toBe('corestone');
    expect(blockOf(kit.world.getVoxel(4, 2, 0)).key).toBe('stone');
    expect(kit.sim.machineAt(0, 2, 0)).toBeNull();
    expect(kit.sim.machineAt(2, 2, 0)).toBeNull();
    expect(kit.sim.machineAt(5, 2, 0)).toBe(far);
    expect(kit.player.inventory.count('coal')).toBe(0);
    expect(removed).toHaveLength(2);
    expect(kit.player.health).toBeLessThan(MAX_HEALTH);
    expect(kit.player.health).toBeGreaterThan(0);
    kit.run(5);
    expect(explosions).toHaveLength(1);
  });
});

describe('Starhearth ignition', () => {
  const star = (kit: Kit) => {
    const e = kit.furnace(0, 1, 0, 'furnace_star');
    e.tempC = 3100;
    return e;
  };

  it('refuses until it is a hot Starhearth on a network', () => {
    const kit = makeKit();
    kit.furnace(5, 1, 0, 'furnace_plasma').tempC = 3100;
    expect(kit.sim.startIgnition(5, 1, 0)).toEqual({ ok: false, reason: 'Only the Starhearth can be ignited' });
    const e = star(kit);
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({ ok: false, reason: 'Connect it to a power network first' });
    bank(kit, 1, 1, 0);
    e.tempC = 2500;
    kit.run(0.05);
    expect(kit.sim.startIgnition(0, 1, 0).ok).toBe(false);
    expect(kit.sim.furnaceView(0, 1, 0)!.ignition.canStart.ok).toBe(false);
  });

  it('succeeds after 90 s of full power: pinned at 5000 C, 1 MW, game won once', () => {
    const kit = makeKit();
    const events = kit.record('furnace:ignition');
    const won = kit.record('game:won');
    const flags = kit.record('flag');
    const e = star(kit);
    for (const z of [1, -1]) bank(kit, 0, 1, z);
    bank(kit, 1, 1, 0);
    kit.run(0.05);
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({ ok: true });
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({ ok: false, reason: 'Ignition is under way' });
    kit.run(45);
    expect(e.demandW).toBeGreaterThan(300000);
    expect(kit.sim.furnaceView(0, 1, 0)!.ignition).toMatchObject({ state: 'running', powerW: 300000, seconds: 90 });
    expect(kit.sim.furnaceView(0, 1, 0)!.ignition.progress).toBeCloseTo(0.5, 2);
    expect(e.ignited).toBe(false);
    kit.run(45.1);
    expect(e.ignited).toBe(true);
    expect(e.tempC).toBe(5000);
    expect(won).toHaveLength(1);
    expect(flags).toContainEqual({ flag: 'ignited' });
    expect(events[0].state).toBe('started');
    expect(events[events.length - 1]).toMatchObject({ state: 'done', progress: 1 });
    expect(events.filter((ev) => ev.state === 'progress').length).toBeLessThanOrEqual(10);
    kit.run(1);
    expect(kit.sim.generationW()).toBe(1_000_000);
    expect(voxelActive(kit.world.getVoxel(0, 1, 0))).toBe(true);
    expect(kit.sim.maxFurnaceTempC()).toBe(5000);
    // Every forge minimum is met and forging no longer chills it.
    kit.player.give('copper_ingot', 1);
    expect(kit.sim.forge(0, 1, 0, 'copper_wire')).toEqual({ ok: true, made: 1 });
    expect(e.tempC).toBe(5000);
    expect(kit.sim.light(0, 1, 0).ok).toBe(false);
    kit.run(100);
    expect(won).toHaveLength(1);
  });

  it('fails and resets when the grid sags for more than 2 s', () => {
    const kit = makeKit();
    const events = kit.record('furnace:ignition');
    const e = star(kit);
    const banks = [bank(kit, 0, 1, 1), bank(kit, 0, 1, -1), bank(kit, 1, 1, 0)];
    kit.run(0.05);
    kit.sim.startIgnition(0, 1, 0);
    kit.run(30);
    banks[0].storedJ = 0;
    banks[1].storedJ = 0;
    kit.run(1.5);
    expect(e.ignition).toBe('running');
    expect(e.ignitionProgressS).toBeCloseTo(30, 1);
    kit.run(1);
    expect(e.ignition).toBe('failed');
    expect(e.ignitionProgressS).toBe(0);
    expect(events[events.length - 1].state).toBe('failed');
    expect(e.demandW).toBeLessThanOrEqual(40000);
    for (const b of banks) b.storedJ = machine('lithium_bank').capacityJ!;
    e.tempC = 3100;
    kit.run(0.05);
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({ ok: true });
  });
});

describe('persistence and speed', () => {
  const build = (kit: Kit): void => {
    const burner = kit.machine('burner_generator', 0, 5, 0);
    burner.slots[0] = { item: 'coal', count: 20 };
    kit.machine('battery', 1, 5, 0);
    const crusher = kit.machine('crusher', 0, 5, 1);
    crusher.slots[0] = { item: 'iron_ore', count: 30 };
    kit.machine('crate', 0, 5, 2);
    const pile = kit.machine('fission_pile', 0, 5, -1);
    pile.slots[0] = { item: 'fuel_rod', count: 1 };
    kit.world.put(0, 4, -1, 'water');
    kit.world.put(0, 6, 0, 'stone');
    const rig = kit.machine('bore_rig', 1, 5, 1);
    kit.world.fill(1, 1, 1, 1, 3, 1, 'stone');
    expect(rig.depthY).toBe(5);
  };

  it('machines saved mid-run continue identically', () => {
    const a = makeKit();
    build(a);
    a.run(33.35);
    const saved = JSON.parse(JSON.stringify([...a.world.entities()]));
    const b = makeKit();
    build(b);
    for (const e of saved) b.world.setEntity(e);
    b.world.setVoxel(1, 3, 1, a.world.getVoxel(1, 3, 1));
    b.world.setVoxel(1, 2, 1, a.world.getVoxel(1, 2, 1));
    b.world.setVoxel(1, 1, 1, a.world.getVoxel(1, 1, 1));
    b.sim.resync();
    a.run(60);
    b.run(60);
    const snap = (kit: Kit) => JSON.parse(JSON.stringify([...kit.world.entities()]));
    expect(snap(b)).toEqual(snap(a));
    expect(b.sim.entityCount).toBe(6);
  });

  it('ticks 300 entities in under a millisecond', () => {
    const kit = makeKit();
    for (let i = 0; i < 60; i++) {
      const x = (i % 10) * 6;
      const z = Math.floor(i / 10) * 6;
      kit.world.put(x, 4, z, 'lava');
      kit.machine('geothermal_tap', x, 5, z);
      kit.machine('battery', x + 1, 5, z);
      const crusher = kit.machine('crusher', x + 2, 5, z);
      crusher.slots[0] = { item: 'copper_ore', count: 99 };
      const e = kit.furnace(x, 5, z + 1);
      fire(kit, e, 'coal');
      kit.machine('thermopile', x + 1, 5, z + 1);
    }
    expect(kit.sim.entityCount).toBe(300);
    kit.run(5);
    let best = Infinity;
    for (let batch = 0; batch < 8; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) kit.sim.tick(DT);
      best = Math.min(best, (performance.now() - t0) / 100);
    }
    expect(best).toBeLessThan(1);
  });
});
