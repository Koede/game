/** Spec 18.4: every "water nearby" rule counts flowing water as water (steam engine, water wheel, fission, electrolyzer, crops). */
import { describe, expect, it } from 'vitest';
import { WATER_FALLING, flowingWater } from '../world/water';
import { makeKit } from './testKit';

describe('flowing water counts as water', () => {
  it('for the steam engine, the water wheel, the fission pile and the electrolyzer', () => {
    const kit = makeKit();
    // Steam engine on a furnace, a level-6 trickle beside it.
    kit.furnace(0, 4, 0);
    kit.machine('steam_engine', 0, 5, 0);
    kit.world.setVoxel(1, 5, 0, flowingWater(6));
    // Water wheel between a stream and a waterfall.
    kit.machine('water_wheel', 10, 5, 0);
    kit.world.setVoxel(11, 5, 0, flowingWater(2));
    kit.world.setVoxel(10, 5, 1, WATER_FALLING);
    // Fission pile and electrolyzer in flowing water.
    kit.machine('fission_pile', 20, 5, 0);
    kit.world.setVoxel(21, 5, 0, flowingWater(3));
    kit.world.setVoxel(20, 6, 0, flowingWater(7));
    kit.machine('electrolyzer', 30, 5, 0);
    kit.world.setVoxel(30, 5, 1, flowingWater(5));
    kit.run(0.5);
    expect(kit.sim.machineView(0, 5, 0)!.problem).toBeNull();
    expect(kit.sim.machineView(10, 5, 0)!.problem).toBeNull();
    expect(kit.sim.machineView(20, 5, 0)!.problem).toBeNull();
    expect(kit.sim.machineView(20, 5, 0)!.cooled).toBe(true);
    expect(kit.sim.machineView(30, 5, 0)!.problem).toBeNull();
    // When the flow dries up the machines notice.
    kit.world.setVoxel(1, 5, 0, 0);
    kit.world.setVoxel(30, 5, 1, 0);
    kit.run(0.5);
    expect(kit.sim.machineView(0, 5, 0)!.problem).toBe('Needs water on one side');
    expect(kit.sim.machineView(30, 5, 0)!.problem).toBe('Must touch water');
  });

  it('for crop hydration', () => {
    const kit = makeKit();
    kit.world.put(0, 4, 0, 'farmland');
    kit.world.put(0, 5, 0, 'wheat_0');
    kit.run(0.1);
    expect(kit.sim.cropView(0, 5, 0)!.hydrated).toBe(false);
    kit.world.setVoxel(3, 4, 0, flowingWater(4));
    kit.run(0.1);
    expect(kit.sim.cropView(0, 5, 0)!.hydrated).toBe(true);
  });
});
