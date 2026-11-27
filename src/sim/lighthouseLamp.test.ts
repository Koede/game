import { describe, expect, it } from 'vitest';
import { voxelActive } from '../core/types';
import { WATER_TOP } from '../world/terrain';
import { makeKit } from './testKit';

describe('lighthouse lamp', () => {
  it('burns coal for eight minutes with no network, lit and warding automatons off while it burns', () => {
    const kit = makeKit();
    const lamp = kit.machine('lighthouse_lamp', 0, 20, 0);
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 20, 0))).toBe(false);
    expect(kit.sim.isSafe(10.5, 20.5, 0.5)).toBe(false);
    const slots = kit.sim.machineSlots(0, 20, 0)!;
    expect(slots.accepts('coal', 0)).toBe(true);
    expect(slots.accepts('charcoal', 0)).toBe(true);
    expect(slots.accepts('kerosene_canister', 0)).toBe(false);
    expect(slots.add('coal', 1)).toBe(0);
    kit.run(2);
    expect(voxelActive(kit.world.getVoxel(0, 20, 0))).toBe(true);
    expect(kit.sim.isSafe(10.5, 20.5, 0.5)).toBe(true);
    expect(kit.sim.isSafe(40.5, 20.5, 0.5)).toBe(false);
    kit.run(460);
    expect(voxelActive(kit.world.getVoxel(0, 20, 0))).toBe(true);
    kit.run(30);
    expect(voxelActive(kit.world.getVoxel(0, 20, 0))).toBe(false);
    expect(lamp.slots[0]).toBeNull();
    expect(kit.sim.isSafe(10.5, 20.5, 0.5)).toBe(false);
  });

  it('raises lighthouse_lit only when it burns high over open water', () => {
    const inland = makeKit();
    const flags = inland.record('flag');
    inland.machine('lighthouse_lamp', 0, WATER_TOP + 10, 0).slots[0] = { item: 'coal', count: 1 };
    inland.run(3);
    expect(flags.map((f) => f.flag)).not.toContain('lighthouse_lit');

    const shore = makeKit();
    const shoreFlags = shore.record('flag');
    for (let x = -20; x <= 20; x++) for (let z = 4; z <= 20; z++) shore.world.put(x, WATER_TOP, z, 'water');
    shore.machine('lighthouse_lamp', 0, WATER_TOP + 10, 0).slots[0] = { item: 'coal', count: 1 };
    shore.run(3);
    expect(shoreFlags.map((f) => f.flag)).toContain('lighthouse_lit');
  });
});
