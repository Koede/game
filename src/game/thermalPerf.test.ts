import { describe, expect, it } from 'vitest';
import { FakeWorld } from './fakeWorld';
import { Thermal, newThermalGrid } from './thermal';

describe('Thermal cost', () => {
  it('a 25 x 25 heat view grid with fires and a house costs a few ms, and a cached query microseconds', () => {
    const w = new FakeWorld();
    w.fill(-30, 0, -30, 30, 0, 30, 'stone');
    w.fill(-3, 4, -3, 3, 4, 3, 'plank');
    for (const [x0, z0, x1, z1] of [[-3, -3, 3, -3], [-3, 3, 3, 3], [-3, -3, -3, 3], [3, -3, 3, 3]] as const) w.fill(x0, 1, z0, x1, 3, z1, 'plank');
    w.put(1, 1, 1, 'lava');
    for (let i = 0; i < 6; i++) w.put(8 + i * 3, 1, 8, 'torch');
    const t = new Thermal(w, { isNight: () => true, biomeAt: () => 'plains' as never });
    const t0 = performance.now();
    t.grid(0, 1, 0, 12);
    const grid = performance.now() - t0;
    const t2 = performance.now();
    t.grid(1, 1, 0, 12); // the next refresh after a step: sources cached, rooms cached
    const warm = performance.now() - t2;
    console.log(`warm grid ${warm.toFixed(1)} ms`);
    expect(warm).toBeLessThan(120); // wall-clock bounds are loose on purpose: shared CI runners are slow and noisy
    // Spread over frames: the biggest slice (4 rows) is what a frame pays.
    const g = newThermalGrid(12);
    t.gridRows(g, 0, 1, 0, 12, 0, 1); // warm the caches
    const t3 = performance.now();
    t.gridRows(g, 0, 1, 0, 12, 8, 12);
    const slice = performance.now() - t3;
    console.log(`4-row slice ${slice.toFixed(1)} ms`);
    expect(slice).toBeLessThan(40);
    expect(slice).toBeLessThan(warm); // a slice is a fraction of a whole pass
    const t1 = performance.now();
    for (let i = 0; i < 1000; i++) t.temperatureAt(0.5, 1.5, 0.5);
    const cached = (performance.now() - t1) / 1000;
    console.log(`grid ${grid.toFixed(1)} ms, cached query ${(cached * 1000).toFixed(1)} us, floods ${t.floods}`);
    expect(grid).toBeLessThan(150);
    expect(cached).toBeLessThan(0.5);
  });
});
