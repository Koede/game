import { describe, expect, it } from 'vitest';
import { FROZEN, HEAD_MAX, headBoost, riverScale } from './hydro';
import { DAYS_PER_SEASON } from './seasons';
import { flowingWater } from '../world/water';
import { makeKit } from './testKit';

describe('river flow through the year', () => {
  it('runs free in spring and summer, ices up late autumn, freezes in winter, thaws late winter', () => {
    const D = DAYS_PER_SEASON;
    for (let d = 1; d <= 2 * D; d++) expect(riverScale(d)).toBe(1);
    expect(riverScale(2 * D + 1)).toBe(1);
    expect(riverScale(3 * D)).toBeCloseTo(0.6, 6);
    expect(riverScale(3 * D + 1)).toBeLessThan(0.7);
    expect(riverScale(3 * D + 1 + Math.floor(D / 2))).toBeCloseTo(FROZEN, 6);
    expect(riverScale(4 * D)).toBeCloseTo(0.6, 6);
    expect(riverScale(4 * D + 1)).toBe(1); // next spring
    for (let d = 1; d <= 8 * D; d++) { expect(riverScale(d)).toBeGreaterThanOrEqual(FROZEN); expect(riverScale(d)).toBeLessThanOrEqual(1); }
  });

  it('head boost grows with a dam and stops at HEAD_MAX', () => {
    expect(headBoost(0)).toBe(1);
    expect(headBoost(2)).toBe(1.5);
    expect(headBoost(99)).toBe(headBoost(HEAD_MAX));
  });
});

describe('water wheel on a dammed river', () => {
  const pool = (kit: ReturnType<typeof makeKit>, depth: number) => {
    const w = kit.machine('water_wheel', 0, 5, 0);
    kit.world.put(-1, 5, 0, 'water');
    for (let h = 0; h <= depth; h++) kit.world.put(1, 5 + h, 0, 'water');
    return w;
  };

  it('makes more behind a taller dam', () => {
    const kit = makeKit();
    const w = pool(kit, 0);
    kit.run(0.05);
    expect(w.availW).toBe(400);
    kit.world.put(1, 6, 0, 'water');
    kit.world.put(1, 7, 0, 'water');
    kit.run(0.05);
    expect(w.availW).toBe(600);
    for (let h = 3; h < 9; h++) kit.world.put(1, 5 + h, 0, 'water');
    kit.run(0.05);
    expect(w.availW).toBe(800);
    kit.world.setVoxel(1, 7, 0, 0); // a breach drops the pool again
    kit.run(0.05);
    expect(w.availW).toBe(500);
  });

  it('slows as the river ices up and runs full again in spring', () => {
    const kit = makeKit();
    const w = pool(kit, 0);
    kit.clock.day = 3 * DAYS_PER_SEASON + 1 + Math.floor(DAYS_PER_SEASON / 2);
    kit.run(0.05);
    expect(w.availW).toBeCloseTo(400 * FROZEN, 6);
    kit.clock.day = 1;
    kit.run(0.05);
    expect(w.availW).toBe(400);
  });
});

describe('mill wheel (river shaft source)', () => {
  const wheel = (kit: ReturnType<typeof makeKit>) => {
    kit.world.put(0, 5, 0, 'mill_wheel');
    return () => kit.sim.millWheelAt(0, 5, 0);
  };

  it('is dead in dry air, gives 6 su per flowing side, caps at 3 sides, and a still pool counts half', () => {
    const kit = makeKit();
    const at = wheel(kit);
    expect(at()).toBeNull();
    kit.world.setVoxel(1, 5, 0, flowingWater(3));
    expect(at()).toEqual({ rpm: 16, capacity: 6 });
    kit.world.put(-1, 5, 0, 'water'); // a still pool beside it: +0.5
    expect(at()!.capacity).toBeCloseTo(9, 6);
    kit.world.setVoxel(0, 5, 1, flowingWater(2));
    kit.world.setVoxel(0, 5, -1, flowingWater(2));
    expect(at()!.capacity).toBe(18); // 4 sides capped to 3
  });

  it('gains from a dam and loses to ice, like the old wheel', () => {
    const kit = makeKit();
    const at = wheel(kit);
    kit.world.setVoxel(1, 5, 0, flowingWater(3));
    kit.world.setVoxel(1, 6, 0, flowingWater(1));
    kit.world.setVoxel(1, 7, 0, flowingWater(1));
    kit.run(0.05);
    expect(at()!.capacity).toBeCloseTo(6 * 1.5, 6);
    kit.clock.day = 3 * DAYS_PER_SEASON + 1 + Math.floor(DAYS_PER_SEASON / 2);
    kit.run(0.05);
    expect(at()!.capacity).toBeCloseTo(6 * 1.5 * FROZEN, 6);
  });
});
