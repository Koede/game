import { describe, expect, it } from 'vitest';
import { FROZEN, HEAD_MAX, headBoost, riverScale } from './hydro';
import { DAYS_PER_SEASON } from './seasons';
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
