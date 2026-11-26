import { describe, expect, it } from 'vitest';
import { footingHeights, planTown, RELIEF_MAX, SITE_MAX, SITE_MIN, TOWN_ORDER, type SurfaceFn } from './townPlan';
import { footprintOf, townTemplate } from './townTemplates';

const flat = (y = 10, key = 'grass'): SurfaceFn => () => ({ y, key });
const ORIGIN: [number, number] = [100, -40];

describe('town plan', () => {
  it('is deterministic per seed and origin, and differs between seeds', () => {
    const a = planTown(7, ORIGIN, flat());
    const b = planTown(7, ORIGIN, flat());
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    const c = planTown(8, ORIGIN, flat());
    expect(c?.site).not.toEqual(a?.site);
  });

  it('places the site 24 to 64 blocks from the origin', () => {
    for (const seed of [1, 2, 3, 99]) {
      const p = planTown(seed, ORIGIN, flat());
      expect(p).not.toBeNull();
      const d = Math.hypot(p!.site[0] - ORIGIN[0], p!.site[1] - ORIGIN[1]);
      expect(d).toBeGreaterThanOrEqual(SITE_MIN - 1);
      expect(d).toBeLessThanOrEqual(SITE_MAX + 1);
    }
  });

  it('lays the buildings in the library order, the storage bay first and the plaza at the site', () => {
    const p = planTown(7, ORIGIN, flat())!;
    expect(p.buildings.map((b) => b.template)).toEqual(TOWN_ORDER);
    const plaza = p.buildings.find((b) => b.template === 'well_plaza')!;
    expect(Math.abs(plaza.x + 4 - p.site[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(plaza.z + 4 - p.site[1])).toBeLessThanOrEqual(1);
    // The bay is on the nearest plot to the plaza.
    const bay = p.buildings[0];
    expect(Math.hypot(bay.x - plaza.x, bay.z - plaza.z)).toBeLessThanOrEqual(14);
  });

  it('fits every building to its plot: each footprint stands on even, buildable ground', () => {
    const p = planTown(42, ORIGIN, flat())!;
    for (const b of p.buildings) {
      const t = townTemplate(b.template)!;
      const f = footprintOf(t, b.rot);
      expect(footingHeights(flat(), b.x, b.z, f.w, f.d)).not.toBeNull();
    }
  });

  it('avoids water, trees and steep ground', () => {
    expect(planTown(7, ORIGIN, flat(10, 'water'))).toBeNull();
    expect(planTown(7, ORIGIN, flat(10, 'oak_leaves'))).toBeNull();
    const slope: SurfaceFn = (x) => ({ y: x, key: 'grass' });
    expect(planTown(7, ORIGIN, slope)).toBeNull();
  });

  it('accepts a plot whose relief is a few blocks and rejects more', () => {
    const gentle: SurfaceFn = (x) => ({ y: 10 + Math.floor(x / 9) % 2, key: 'grass' });
    expect(footingHeights(gentle, 0, 0, 9, 9)).not.toBeNull();
    const steep: SurfaceFn = (x) => ({ y: 10 + x, key: 'grass' });
    expect(footingHeights(steep, 0, 0, 9, 9)).toBeNull();
    expect(RELIEF_MAX).toBeGreaterThanOrEqual(2);
  });
});
