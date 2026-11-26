import { describe, expect, it } from 'vitest';
import { voxelActive } from '../core/types';
import { makeKit } from './testKit';

describe('kerosene lamp', () => {
  it('shines on a canister with no network, burns it for twenty minutes, and leaves the empty canister', () => {
    const kit = makeKit();
    const lamp = kit.machine('kerosene_lamp', 0, 5, 0);
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(false);
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    expect(slots.accepts('kerosene_canister', 0)).toBe(true);
    expect(slots.accepts('coal', 0)).toBe(false);
    expect(slots.accepts('diesel_canister', 0)).toBe(false);
    expect(slots.add('kerosene_canister', 1)).toBe(0);
    kit.run(2);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(true);
    kit.run(1000);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(true);
    kit.run(250);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(false);
    expect(lamp.slots[0]).toEqual({ item: 'empty_canister', count: 1 });
    // A full lamp does not burn without fuel, and the empty canister is not fuel.
    kit.run(30);
    expect(voxelActive(kit.world.getVoxel(0, 5, 0))).toBe(false);
  });

  it('a stack burns one canister after another and hands back one empty per canister', () => {
    const kit = makeKit();
    const lamp = kit.machine('kerosene_lamp', 0, 5, 0);
    lamp.slots[0] = { item: 'kerosene_canister', count: 2 };
    kit.run(2450);
    expect(lamp.slots[0]).toEqual({ item: 'empty_canister', count: 2 });
  });
});
