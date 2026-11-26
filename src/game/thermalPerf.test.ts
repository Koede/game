import { describe, expect, it } from 'vitest';
import { FakeWorld } from './fakeWorld';
import { Thermal } from './thermal';

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
    const t1 = performance.now();
    for (let i = 0; i < 1000; i++) t.temperatureAt(0.5, 1.5, 0.5);
    const cached = (performance.now() - t1) / 1000;
    console.log(`grid ${grid.toFixed(1)} ms, cached query ${(cached * 1000).toFixed(1)} us, floods ${t.floods}`);
    expect(grid).toBeLessThan(150);
    expect(cached).toBeLessThan(0.5);
  });
});
