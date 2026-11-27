import { describe, expect, it } from 'vitest';
import { DT, PLUMB_STROKE_L, SPRINKLER_L_PER_S } from '../core/constants';
import { voxelActive } from '../core/types';
import { isCrop } from './cropRules';
import { isWaterEntity } from './waterNet';
import { makeKit, type Kit } from './testKit';

/** A row of cells along x at y = 5, z = 0, from x = 0. */
const row = (kit: Kit, blocks: string[], y = 5): void => blocks.forEach((b, i) => kit.world.put(i, y, 0, b));

/** A pond of 3 water sources west of x = 0 at y = 5 (the middle one refills: two sources beside it). */
function pond(kit: Kit): void {
  for (const z of [-1, 0, 1]) {
    kit.world.put(-1, 5, z, 'water');
    kit.world.put(-1, 4, z, 'stone');
  }
}

function strokes(kit: Kit, n: number, x = 0, y = 5, z = 0): void {
  for (let i = 0; i < n; i++) {
    expect(kit.sim.water.stroke(x, y, z)).toBe(true);
    kit.run(0.4);
  }
}

describe('water network', () => {
  it('joins pipes, pump, cistern and sprinkler into one line and adds up what they hold', () => {
    const kit = makeKit();
    row(kit, ['hand_pump', 'water_pipe', 'water_pipe', 'cistern', 'water_pipe', 'sprinkler']);
    const net = kit.sim.water.netAt(0, 5, 0)!;
    expect(net.keys).toHaveLength(6);
    expect(net.capL).toBe(20 + 25 + 25 + 2000 + 25 + 10);
    expect(kit.sim.water.netAt(5, 5, 0)).toBe(net);
    // Never mixed with the Forge's fluid pipes or the air tubes.
    row(kit, ['water_pipe', 'fluid_pipe', 'air_tube', 'water_pipe'], 9);
    expect(kit.sim.water.netAt(0, 9, 0)!.keys).toHaveLength(1);
    expect(kit.sim.water.netAt(3, 9, 0)!.keys).toHaveLength(1);
  });

  it('pumps only while touching still water, a stroke at a time', () => {
    const kit = makeKit();
    row(kit, ['hand_pump', 'cistern']);
    expect(kit.sim.water.stroke(0, 5, 0)).toBe(false);
    expect(kit.sim.waterView(0, 5, 0)?.status).toBe('Must touch still water');
    pond(kit);
    expect(kit.sim.water.stroke(0, 5, 0)).toBe(true);
    expect(kit.sim.water.stroke(0, 5, 0)).toBe(false); // too soon
    kit.run(0.4);
    expect(kit.sim.water.stroke(0, 5, 0)).toBe(true);
    expect(kit.sim.water.netAt(1, 5, 0)!.waterL).toBeCloseTo(2 * PLUMB_STROKE_L, 5);
    expect(kit.sim.water.stroke(1, 5, 0)).toBe(false); // only a pump takes strokes
  });

  it('uses up a lone source after 1000 L, but not a pond that refills', () => {
    const kit = makeKit();
    row(kit, ['hand_pump', 'cistern', 'cistern']);
    kit.world.put(0, 4, 0, 'water'); // one lone source under the pump
    strokes(kit, 25); // 1000 L
    expect(kit.world.getBlock(0, 4, 0).liquid).toBeNull();
    expect(kit.sim.water.stroke(0, 5, 0)).toBe(false);

    const k2 = makeKit();
    row(k2, ['hand_pump', 'cistern', 'cistern']);
    pond(k2);
    strokes(k2, 30);
    expect(k2.world.getBlock(-1, 5, 0).liquid).toBe('water');
  });

  it('turns a workshop shaft into half a litre a second per rpm', () => {
    const kit = makeKit();
    row(kit, ['hand_pump', 'cistern']);
    pond(kit);
    kit.sim.airShaftRpm = (x, y, z) => (x === 0 && y === 5 && z === 0 ? 16 : 0);
    kit.run(10);
    expect(kit.sim.water.netAt(0, 5, 0)!.waterL).toBeCloseTo(80, 0);
    expect(kit.sim.waterView(0, 5, 0)?.status).toMatch(/^Pumping 8 L\/s/);
  });

  it('sprays while the line holds water and waters crops within 4 blocks, roofed or not, then runs dry', () => {
    const kit = makeKit();
    kit.clock.timeOfDay = 0.05;
    // A sprinkler two blocks over a wheat field, under a glass roof, fed by a pipe from a cistern.
    kit.world.put(0, 7, 0, 'sprinkler');
    kit.world.put(0, 7, 1, 'water_pipe');
    kit.world.put(0, 7, 2, 'cistern');
    for (const [x, z] of [[2, 0], [4, 4], [5, 0]] as const) {
      kit.world.put(x, 4, z, 'farmland');
      kit.world.put(x, 5, z, 'wheat_0');
      kit.world.put(x, 9, z, 'glass');
    }
    kit.run(1);
    expect(kit.sim.cropView(2, 5, 0)?.hydrated).toBe(false);
    expect(kit.sim.waterView(0, 7, 0)?.status).toBe('Dry - pump water into its line');
    kit.sim.water.netAt(0, 7, 0)!.waterL = 10;
    const sprays = kit.record('water:spray');
    kit.run(1);
    expect(kit.sim.water.isSpraying(0, 7, 0)).toBe(true);
    expect(voxelActive(kit.world.getVoxel(0, 7, 0))).toBe(true);
    expect(sprays.length).toBeGreaterThan(0);
    expect(kit.sim.cropView(2, 5, 0)?.hydrated).toBe(true);
    expect(kit.sim.cropView(4, 5, 4)?.hydrated).toBe(true);
    expect(kit.sim.cropView(5, 5, 0)?.hydrated).toBe(false); // 5 across: out of reach
    expect(kit.sim.water.netAt(0, 7, 0)!.waterL).toBeCloseTo(10 - SPRINKLER_L_PER_S * 1, 1);
    // A crop under it grows at the hydrated rate.
    const e = kit.world.getEntity(2, 5, 0);
    expect(isCrop(e)).toBe(true);
    // 10 L lasts 20 s.
    kit.run(20);
    expect(kit.sim.water.isSpraying(0, 7, 0)).toBe(false);
    expect(voxelActive(kit.world.getVoxel(0, 7, 0))).toBe(false);
    expect(kit.sim.cropView(2, 5, 0)?.hydrated).toBe(false);
  });

  it('fills a sealed boiler through its Water Port from a line', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 2; y <= 5; y++) {
      if (x === 0 && z === 0 && y >= 3 && y <= 4) continue;
      kit.world.put(x, y, z, 'boiler_plate');
    }
    kit.world.put(0, 5, 0, 'safety_valve');
    kit.world.put(1, 3, 0, 'boiler_gauge_glass');
    kit.world.put(-1, 3, 0, 'water_port');
    kit.world.put(-2, 3, 0, 'water_pipe');
    kit.world.put(-3, 3, 0, 'cistern');
    const net = kit.sim.water.netAt(-2, 3, 0)!;
    expect(net.ports).toHaveLength(1);
    net.waterL = 1000;
    for (let i = 0; i < Math.round(3 / DT); i++) {
      f.tempC = 20;
      kit.sim.tick(DT);
    }
    expect(kit.sim.water.netAt(-2, 3, 0)!.waterL).toBeLessThan(1000 - 20);
    expect(kit.sim.brewView(1, 3, 0)?.text).not.toMatch(/no water/);
  });

  it('keeps its water through a save and load', () => {
    const kit = makeKit();
    row(kit, ['hand_pump', 'water_pipe', 'cistern']);
    kit.sim.water.netAt(0, 5, 0)!.waterL = 500;
    kit.run(1.1);
    const saved = [...kit.world.entities()].filter(isWaterEntity);
    expect(saved).toHaveLength(1);
    expect(saved[0].waterL).toBeCloseTo(500, 0);
    kit.sim.resync();
    expect(kit.sim.water.netAt(2, 5, 0)!.waterL).toBeCloseTo(500, 0);
  });

  it('answers a Use with what the line holds', () => {
    const kit = makeKit();
    row(kit, ['hand_pump', 'water_pipe', 'sprinkler']);
    pond(kit);
    const toasts = kit.record('toast');
    kit.bus.emit('water:use', { x: 0, y: 5, z: 0 });
    expect(toasts.at(-1)!.text).toBe('Hand Pump: Use to pump - 40 L of 55 L in the line');
    kit.bus.emit('water:use', { x: 1, y: 5, z: 0 });
    expect(toasts.at(-1)!.text).toMatch(/^Copper Water Pipe: /);
  });
});
