/** The ward beacon (spec 19.4) and the safe-zone query the mob manager uses (spec 19.2-19.4). */
import { describe, expect, it } from 'vitest';
import { FURNACE_HOT_C, WARD_BEACON_RADIUS } from '../core/constants';
import { block, machine } from '../core/registry';
import { voxelActive } from '../core/types';
import { furnaceWarmRadius } from './safeZones';
import { fire, makeKit, type Kit } from './testKit';

/** A charged lithium bank: power for whatever touches it. */
function bank(kit: Kit, x: number, y: number, z: number) {
  const e = kit.machine('lithium_bank', x, y, z);
  e.storedJ = 40e6;
  return e;
}

describe('ward beacon', () => {
  it('draws 500 W and wards only while powered', () => {
    const kit = makeKit();
    const beacon = kit.machine('ward_beacon', 0, 1, 0);
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 1, 0))).toBe(false);
    expect(kit.sim.machineView(0, 1, 0)!.status).toBe('No power - automatons can come near');
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(false);

    const store = bank(kit, 1, 1, 0);
    const before = store.storedJ;
    kit.run(1);
    expect(beacon.demandW).toBe(500);
    expect(machine('ward_beacon').drawW).toBe(500);
    expect(before - store.storedJ).toBeCloseTo(500, -1);
    expect(voxelActive(kit.world.getVoxel(0, 1, 0))).toBe(true);
    const view = kit.sim.machineView(0, 1, 0)!;
    expect(view.running).toBe(true);
    expect(view.status).toBe(`Warding ${WARD_BEACON_RADIUS} blocks all round - automatons keep away`);
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(true);

    kit.sim.setMachineOn(0, 1, 0, false);
    kit.run(0.1);
    expect(voxelActive(kit.world.getVoxel(0, 1, 0))).toBe(false);
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(false);
    expect(kit.sim.machineView(0, 1, 0)!.status).toBe('Switched off');
  });

  it('guards a sphere of the radius in its params, measured from the middle of its block', () => {
    const kit = makeKit();
    kit.machine('ward_beacon', 10, 40, 10);
    bank(kit, 11, 40, 10);
    kit.run(0.1);
    const r = machine('ward_beacon').params!.radius;
    expect(r).toBe(WARD_BEACON_RADIUS);
    const c = 10.5;
    expect(kit.sim.isSafe(c + r, 40.5, c)).toBe(true);
    expect(kit.sim.isSafe(c + r + 0.01, 40.5, c)).toBe(false);
    expect(kit.sim.isSafe(c, 40.5 - r, c)).toBe(true);
    expect(kit.sim.isSafe(c, 40.5 + r + 0.01, c)).toBe(false);
    const d = r / Math.sqrt(3) - 0.01;
    expect(kit.sim.isSafe(c + d, 40.5 + d, c - d)).toBe(true);
    expect(kit.sim.safeZones()).toEqual([{ kind: 'beacon', x: c, y: 40.5, z: c, radius: r }]);
    expect(kit.sim.safeZoneAt(c, 41, c)).toEqual({ kind: 'beacon', x: c, y: 40.5, z: c, radius: r });
    expect(kit.sim.safeZoneAt(c + 40, 41, c)).toBeNull();
  });

  it('stops warding when its network browns out, and when it is broken', () => {
    const kit = makeKit();
    kit.machine('ward_beacon', 0, 1, 0);
    const store = bank(kit, 1, 1, 0);
    store.storedJ = 600;
    kit.run(0.5);
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(true);
    kit.run(3);
    expect(store.storedJ).toBe(0);
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(false);
    store.storedJ = 40e6;
    kit.run(0.1);
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(true);
    kit.world.setVoxel(0, 1, 0, 0, 'player');
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(false);
    expect(kit.sim.safeZones()).toEqual([]);
  });
});

describe('safe zones', () => {
  it('a furnace is one from FURNACE_HOT_C, over its block\'s warmth radius', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    const r = block('furnace_clay').warmthActive;
    expect(furnaceWarmRadius(1)).toBe(r);
    expect(kit.sim.safeZones()).toEqual([]);
    fire(kit, e, 'oak_log');
    let crossed = -1;
    for (let i = 0; i < 2400 && crossed < 0; i++) {
      kit.sim.tick(0.05);
      if (kit.sim.isSafe(0.5, 1.5, 0.5)) crossed = e.tempC;
      else expect(e.tempC).toBeLessThan(FURNACE_HOT_C);
    }
    expect(crossed).toBeGreaterThanOrEqual(FURNACE_HOT_C);
    expect(kit.sim.isSafe(0.5 + r, 1.5, 0.5)).toBe(true);
    expect(kit.sim.isSafe(0.5 + r + 0.01, 1.5, 0.5)).toBe(false);
    expect(kit.sim.safeZones()).toEqual([{ kind: 'furnace', x: 0.5, y: 1.5, z: 0.5, radius: r }]);

    // Doused, it cools below the threshold and the zone goes.
    kit.sim.douse(0, 1, 0);
    for (let i = 0; i < 20000 && e.tempC >= FURNACE_HOT_C; i++) kit.sim.tick(0.05);
    kit.sim.tick(0.05);
    expect(e.tempC).toBeLessThan(FURNACE_HOT_C);
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(false);
  });

  it('follow upgrades: a bigger furnace warms a wider zone', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.formed(0, 1, 0);
    e.tempC = 900;
    kit.run(0.05);
    expect(kit.sim.safeZones()[0].radius).toBe(block('furnace_blast').warmthActive);
    expect(furnaceWarmRadius(2)).toBeGreaterThan(furnaceWarmRadius(1));
  });

  it('are cached: steady furnaces and beacons never rebuild the list, a change rebuilds it once', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'oak_log');
    kit.machine('ward_beacon', 20, 1, 0);
    bank(kit, 21, 1, 0);
    kit.run(120);
    expect(e.tempC).toBeGreaterThan(FURNACE_HOT_C);
    const zones = kit.sim.safeZones();
    expect(zones.map((z) => z.kind).sort()).toEqual(['beacon', 'furnace']);
    const version = kit.sim.safeZonesVersion;
    const rebuilds = kit.sim.safeZoneRebuilds;
    for (let i = 0; i < 200; i++) {
      kit.sim.tick(0.05);
      kit.sim.isSafe(5, 1, 5);
    }
    expect(kit.sim.safeZoneRebuilds).toBe(rebuilds);
    expect(kit.sim.safeZones()).toBe(zones);
    expect(kit.sim.safeZonesVersion).toBe(version);

    kit.sim.setMachineOn(20, 1, 0, false);
    kit.run(0.05);
    expect(kit.sim.safeZones().map((z) => z.kind)).toEqual(['furnace']);
    expect(kit.sim.safeZonesVersion).toBe(version + 1);
    expect(kit.sim.safeZoneRebuilds).toBe(rebuilds + 1);
    kit.sim.isSafe(0, 0, 0);
    expect(kit.sim.safeZoneRebuilds).toBe(rebuilds + 1);
  });

  it('come back after a reload (resync)', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'oak_log');
    kit.run(120);
    kit.sim.resync();
    expect(kit.sim.isSafe(0.5, 1.5, 0.5)).toBe(true);
  });
});
