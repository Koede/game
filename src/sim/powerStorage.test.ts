import { describe, expect, it } from 'vitest';
import { BATTERY_EFFICIENCY } from '../core/constants';
import { block, machine, recipe } from '../core/registry';
import { NIGHT_S, coverText, formatSpan, storageCover } from './storageCover';
import { makeKit } from './testKit';

describe('cell rack', () => {
  it('is a storage block between the battery and the lithium bank', () => {
    const spec = machine('cell_rack');
    expect(spec.role).toBe('storage');
    expect(spec.capacityJ!).toBeGreaterThan(machine('battery').capacityJ!);
    expect(spec.capacityJ!).toBeLessThan(machine('lithium_bank').capacityJ!);
    expect(spec.rateW!).toBeGreaterThan(machine('battery').rateW!);
    expect(spec.rateW!).toBeLessThan(machine('lithium_bank').rateW!);
    expect(block('cell_rack').machine).toBe('cell_rack');
    expect(recipe('cell_rack')!.inputs.map((i) => i.item)).toEqual(['battery', 'steel_plate', 'copper_coil']);
  });

  it('charges from surplus and feeds the load once generation stops, and the monitor says how long', () => {
    const kit = makeKit();
    const tap = kit.machine('geothermal_tap', 0, 5, 0);
    kit.world.put(0, 4, 0, 'lava');
    const rack = kit.machine('cell_rack', 1, 5, 0);
    kit.run(10);
    expect(rack.storedJ).toBeCloseTo(2000 * BATTERY_EFFICIENCY * 10, 3);
    expect(kit.sim.machineView(1, 5, 0)?.status).toMatch(/charging/);
    // Night: the tap stops; the stored charge carries a heater alone.
    kit.world.put(0, 4, 0, 'air');
    kit.machine('space_heater', 2, 5, 0);
    rack.storedJ = 5_000_000;
    kit.run(2);
    const stats = kit.sim.networkAt(1, 5, 0)!;
    expect(tap.availW).toBe(0);
    expect(stats.storageRateW).toBe(20_000);
    expect(stats.deliveredW).toBeCloseTo(stats.demandW, 6);
    expect(rack.outW).toBeGreaterThan(0);
    expect(coverText(stats)).toMatch(/^Lasts the night/);
  });

  it('is off the monitor when switched off', () => {
    const kit = makeKit();
    kit.machine('cell_rack', 0, 5, 0);
    kit.machine('lamp', 1, 5, 0);
    kit.sim.setMachineOn(0, 5, 0, false);
    kit.run(1);
    expect(kit.sim.networkAt(0, 5, 0)?.storageRateW).toBe(0);
  });
});

describe('storage cover', () => {
  it('has no limit without demand and none without charge', () => {
    expect(storageCover({ storedJ: 0, storageRateW: 3000, demandW: 0 }).aloneS).toBe(Infinity);
    expect(coverText({ storedJ: 0, storageRateW: 3000, demandW: 10 })).toBe('');
    expect(coverText({ storedJ: 1000, storageRateW: 3000, demandW: 0 })).toBe('');
  });

  it('is charge over demand, and calls out a load the rate cannot carry', () => {
    expect(storageCover({ storedJ: 2_000_000, storageRateW: 3000, demandW: 1000 }).aloneS).toBe(2000);
    expect(storageCover({ storedJ: 10_000_000, storageRateW: 20_000, demandW: 10_000 }).nightOk).toBe(true);
    expect(storageCover({ storedJ: 1_000_000, storageRateW: 20_000, demandW: 10_000 }).nightOk).toBe(false);
    const over = storageCover({ storedJ: 2_000_000, storageRateW: 3000, demandW: 6000 });
    expect(over.share).toBe(0.5);
    expect(over.nightOk).toBe(false);
    expect(coverText({ storedJ: 2_000_000, storageRateW: 3000, demandW: 6000 })).toBe('Only 50% of the load at once');
  });

  it('writes spans and the night mark plainly', () => {
    expect(formatSpan(50)).toBe('50 s');
    expect(formatSpan(840)).toBe('14 min');
    expect(formatSpan(7500)).toBe('2 h 5 min');
    expect(formatSpan(Infinity)).toBe('indefinitely');
    expect(NIGHT_S).toBe(324);
    expect(coverText({ storedJ: 10_000, storageRateW: 100, demandW: 10 })).toBe('Lasts the night (17 min)');
    expect(coverText({ storedJ: 600, storageRateW: 100, demandW: 10 })).toBe('Lasts 60 s unaided');
  });
});

describe('storage face glow', () => {
  it('lights while the block holds charge', async () => {
    const { voxelActive } = await import('../core/types');
    const kit = makeKit();
    const rack = kit.machine('cell_rack', 0, 5, 0);
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(false);
    rack.storedJ = 5_000_000;
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(true);
  });
});
