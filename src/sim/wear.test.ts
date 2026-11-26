import { describe, expect, it } from 'vitest';
import { machine } from '../core/registry';
import type { MachineEntity } from './entities';
import { sanitizeEntity } from './sanitize';
import { makeKit, type Kit } from './testKit';
import { WEAR_FULL_RUN_S, conditionOf, repairCost, speedOf } from './wear';

/** A full lithium bank beside a crusher fed with copper ore. */
function crusher(kit: Kit): MachineEntity {
  const m = kit.machine('crusher', 0, 5, 0);
  const b = kit.machine('lithium_bank', 1, 5, 0);
  b.storedJ = machine('lithium_bank').capacityJ!;
  m.slots[0] = { item: 'copper_ore', count: 64 };
  return m;
}

describe('machine wear', () => {
  it('a machine without wear (an older save) is in good condition and runs at the old speed', () => {
    const m = makeKit().machine('crusher', 0, 5, 0);
    expect(m.wear).toBeUndefined();
    expect(conditionOf(m)).toBe('good');
    expect(speedOf(m)).toBe(1);
    expect(sanitizeEntity(m)).toBe('ok');
    expect(m.wear).toBeUndefined();
  });

  it('working wears it; idle and switched-off machines do not wear', () => {
    const kit = makeKit();
    const m = crusher(kit);
    kit.run(60);
    expect(m.wear).toBeCloseTo(60 / WEAR_FULL_RUN_S, 1);
    const idle = kit.machine('crusher', 0, 5, 3);
    kit.run(30);
    expect(idle.wear).toBeUndefined();
    m.on = false;
    const w = m.wear!;
    kit.run(30);
    expect(m.wear).toBe(w);
  });

  it('a worn machine is slower and a broken one stops until repaired', () => {
    const kit = makeKit();
    const m = crusher(kit);
    kit.run(0.1);
    const timeS = kit.sim.machineView(0, 5, 0)!.recipe!.timeS;
    expect(timeS).toBeGreaterThan(0);
    m.wear = 0.6;
    expect(conditionOf(m)).toBe('worn');
    m.progress = 0;
    kit.run(timeS);
    expect(m.progress).toBeCloseTo(timeS * 0.85, 0);
    m.wear = 1;
    m.progress = 0;
    kit.run(5);
    expect(m.progress).toBe(0);
    expect(m.demandW).toBe(0);
    expect(kit.sim.machineView(0, 5, 0)!.status).toMatch(/Broken/);
  });

  it('a generator makes less when worn and nothing when broken', () => {
    const kit = makeKit();
    const g = kit.machine('burner_generator', 0, 5, 0);
    g.slots[0] = { item: 'coal', count: 10 };
    kit.run(0.2);
    const full = g.availW;
    expect(full).toBeGreaterThan(0);
    g.wear = 0.85;
    kit.run(0.2);
    expect(g.availW).toBeCloseTo(full * 0.6, 3);
    g.wear = 1;
    kit.run(0.2);
    expect(g.availW).toBe(0);
  });

  it('announces a breakdown once', () => {
    const kit = makeKit();
    const toasts = kit.record('toast');
    const m = crusher(kit);
    m.wear = 0.9999;
    kit.run(2);
    expect(toasts.filter((t) => /broke down/.test(t.text))).toHaveLength(1);
  });
});

describe('repair', () => {
  it('costs iron ingots by how worn it is, restores it and makes it well kept (faster)', () => {
    const kit = makeKit();
    const m = crusher(kit);
    m.wear = 0.6;
    expect(repairCost(m)).toBe(2);
    expect(kit.sim.repairMachine(0, 5, 0)).toMatchObject({ ok: false });
    expect(m.wear).toBe(0.6);
    kit.player.inventory.add('iron_ingot', 5);
    expect(kit.sim.repairMachine(0, 5, 0).ok).toBe(true);
    expect(m.wear).toBe(0);
    expect(kit.player.inventory.count('iron_ingot')).toBe(3);
    expect(conditionOf(m)).toBe('kept');
    expect(speedOf(m)).toBeGreaterThan(1);
    expect(kit.sim.repairMachine(0, 5, 0)).toMatchObject({ ok: false, reason: 'It is as good as new' });
    // Past the kept band it runs at the normal speed again.
    m.wear = 0.3;
    expect(speedOf(m)).toBe(1);
  });

  it('refuses machines that do not wear', () => {
    const kit = makeKit();
    kit.machine('lamp', 0, 5, 0);
    expect(kit.sim.repairMachine(0, 5, 0).ok).toBe(false);
  });

  it('shows condition and repair cost on the view', () => {
    const kit = makeKit();
    const m = kit.machine('crusher', 0, 5, 0);
    m.wear = 0.5;
    const v = kit.sim.machineView(0, 5, 0)!;
    expect([v.condition, v.repairCost]).toEqual(['worn', 2]);
    expect(kit.sim.machineView(0, 5, 3)).toBeNull();
    const lamp = kit.machine('lamp', 0, 5, 3);
    expect(lamp).toBeTruthy();
    expect(kit.sim.machineView(0, 5, 3)!.wear).toBeNull();
  });
});

describe('npc upkeep stub', () => {
  it('lists worn machines worst first and tending takes wear off for free', () => {
    const kit = makeKit();
    const a = kit.machine('crusher', 0, 5, 0);
    const b = kit.machine('centrifuge', 4, 5, 0);
    a.wear = 0.4;
    b.wear = 0.9;
    kit.machine('crusher', 8, 5, 0);
    expect(kit.sim.wornMachines().map((w) => w.kind)).toEqual(['centrifuge', 'crusher']);
    expect(kit.sim.wornMachines(0.25, { x: 0, z: 0, radius: 2 })).toHaveLength(1);
    expect(kit.sim.tendMachine(4, 5, 0)).toBeCloseTo(0.25);
    expect(b.wear).toBeCloseTo(0.65);
    expect(kit.sim.tendMachine(0, 5, 99)).toBe(0);
  });
});

describe('saves', () => {
  it('a bad wear value is reset, an absent one is left alone', () => {
    const m = makeKit().machine('crusher', 0, 5, 0);
    m.wear = Number.NaN;
    expect(sanitizeEntity(m)).toBe('repaired');
    expect(m.wear).toBe(0);
  });
});
