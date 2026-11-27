import { describe, expect, it } from 'vitest';
import { BATTERY_EFFICIENCY } from '../core/constants';
import { voxelActive } from '../core/types';
import { MONITOR_DRAW_W } from '../content/areas/power_grid';
import { makeKit, type Kit } from './testKit';

const net = (kit: Kit, x: number, y: number, z: number) => kit.sim.networkAt(x, y, z)!;

/** A 2 kW geothermal tap at x, 5, z with one lava block under it. */
const tapAt = (kit: Kit, x: number, z: number) => {
  const tap = kit.machine('geothermal_tap', x, 5, z);
  kit.world.put(x, 4, z, 'lava');
  return tap;
};

describe('losses on a network', () => {
  it('counts the watts lost charging batteries', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    kit.machine('battery', 1, 5, 0);
    kit.run(2);
    const stats = net(kit, 0, 5, 0);
    expect(stats.chargeW).toBe(2000);
    expect(stats.lossW).toBeCloseTo(2000 * (1 - BATTERY_EFFICIENCY), 6);
    expect(stats.chokedW).toBe(0);
  });

  it('reports demand a thin cable holds back, and the shortfall', () => {
    const kit = makeKit();
    const engine = kit.machine('combustion_engine', 0, 5, 0);
    engine.slots[0] = { item: 'fuel_canister', count: 16 };
    kit.world.put(1, 5, 0, 'copper_cable');
    kit.machine('electrolyzer', 2, 5, 0).slots[0] = { item: 'empty_cell', count: 4 };
    kit.world.put(2, 4, 0, 'water');
    kit.run(2);
    const stats = net(kit, 0, 5, 0);
    expect(stats.generationW).toBe(12000);
    expect(stats.demandW).toBe(20000);
    // 12 kW could be made but the copper cable carries 10 kW: 2 kW is choked, and 10 kW is still short of the 20 kW asked.
    expect(stats.chokedW).toBeCloseTo(2000, 6);
    expect(stats.shortW).toBeCloseTo(10000, 6);
    expect(stats.lossW).toBe(0);
  });

  it('a quiet grid loses nothing', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    kit.machine('lamp', 1, 5, 0);
    kit.run(1);
    expect(net(kit, 0, 5, 0)).toMatchObject({ lossW: 0, chokedW: 0, shortW: 0 });
  });
});

describe('brown-out when you overbuild', () => {
  it('machines slow by the satisfaction, and a telegraphed alert fires once', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    tapAt(kit, 0, 0);
    const crusher = kit.machine('crusher', 1, 5, 0);
    const still = kit.machine('still', 2, 5, 0);
    crusher.slots[0] = { item: 'copper_ore', count: 50 };
    still.slots[0] = { item: 'oil_shale', count: 50 };
    kit.run(6);
    const stats = net(kit, 0, 5, 0);
    expect(stats.state).toBe('brownout');
    expect(stats.satisfaction).toBeCloseTo(2 / 3, 9);
    expect(alerts.map((a) => a.kind)).toEqual(['brownout']);
    expect(alerts[0].message).toMatch(/Brown-out - machines get 66% power/);
  });
});

describe('the grid overlay cells', () => {
  const grid = (): Kit => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    kit.world.put(1, 5, 0, 'copper_cable');
    kit.world.put(2, 5, 0, 'copper_cable');
    kit.machine('lamp', 3, 5, 0);
    kit.machine('battery', 0, 6, 0);
    kit.run(1);
    return kit;
  };

  it('lists every cable and machine with its kind and network', () => {
    const kit = grid();
    const { cells } = kit.sim.gridOverlay(1, 5, 1, 24);
    const kinds = Object.fromEntries(cells.map((c) => [`${c.x},${c.y},${c.z}`, c.kind]));
    expect(kinds).toEqual({ '0,5,0': 'source', '3,5,0': 'load', '0,6,0': 'storage', '1,5,0': 'cable', '2,5,0': 'cable' });
    expect(new Set(cells.map((c) => c.net)).size).toBe(1);
    expect(cells.every((c) => c.state === 'ok')).toBe(true);
  });

  it('keeps only what is in range, and only the asked network', () => {
    const kit = grid();
    expect(kit.sim.gridOverlay(0.5, 5.5, 0.5, 1.5).cells.map((c) => c.kind).sort()).toEqual(['cable', 'source', 'storage']);
    const id = net(kit, 0, 5, 0).id;
    expect(kit.sim.gridOverlay(1, 5, 1, 24, id + 1).cells).toHaveLength(0);
    expect(kit.sim.gridOverlay(1, 5, 1, 24, id).cells).toHaveLength(5);
  });

  it('rebuilds once a tick, not per call', () => {
    const kit = grid();
    const a = kit.sim.gridOverlay(1, 5, 1, 24);
    const b = kit.sim.gridOverlay(1, 5, 1, 24);
    expect(b.tick).toBe(a.tick);
    kit.run(0.1);
    expect(kit.sim.gridOverlay(1, 5, 1, 24).tick).not.toBe(a.tick);
  });

  it('marks a consumer that is short of power, and a cable that is full', () => {
    const kit = makeKit();
    const engine = kit.machine('combustion_engine', 0, 5, 0);
    engine.slots[0] = { item: 'fuel_canister', count: 16 };
    kit.world.put(1, 5, 0, 'copper_cable');
    kit.machine('electrolyzer', 2, 5, 0).slots[0] = { item: 'empty_cell', count: 4 };
    kit.world.put(2, 4, 0, 'water');
    kit.run(2);
    const cells = kit.sim.gridOverlay(1, 5, 1, 24).cells;
    expect(cells.find((c) => c.kind === 'cable')).toMatchObject({ load: 1, state: 'overload' });
    expect(cells.find((c) => c.kind === 'load')!.short).toBe(true);
  });
});

describe('the grid monitor', () => {
  it('is a powered consumer that lights while its network has power, drawing next to nothing', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    const monitor = kit.machine('grid_monitor', 1, 5, 0);
    kit.run(1);
    expect(monitor.demandW).toBe(MONITOR_DRAW_W);
    expect(voxelActive(kit.world.getVoxel(1, 5, 0))).toBe(true);
    const view = kit.sim.machineView(1, 5, 0)!;
    expect(view.satisfaction).toBe(1);
    expect(net(kit, 1, 5, 0).demandW).toBe(MONITOR_DRAW_W);
  });

  it('finds the network of the nearest switched-on monitor in range', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    kit.machine('grid_monitor', 1, 5, 0);
    kit.run(1);
    const id = net(kit, 0, 5, 0).id;
    expect(kit.sim.monitorNear(2, 5, 2, 12)).toBe(id);
    expect(kit.sim.monitorNear(40, 5, 2, 12)).toBeNull();
    kit.sim.setMachineOn(1, 5, 0, false);
    expect(kit.sim.monitorNear(2, 5, 2, 12)).toBeNull();
  });

  it('on its own network it reads not connected', () => {
    const kit = makeKit();
    kit.machine('grid_monitor', 1, 5, 0);
    kit.run(1);
    expect(kit.sim.machineView(1, 5, 0)!.status).toBe('No power');
  });
});
