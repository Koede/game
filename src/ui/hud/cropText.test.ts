import { describe, expect, it } from 'vitest';
import { makeKit } from '../../sim/testKit';
import { cropLabel } from './cropText';

const base = { name: 'Wheat (sprouting)', ripe: false, soil: true, lit: true, hydrated: true, ripeInS: 240 };

describe('crop crosshair label', () => {
  it('says why a crop is or is not growing', () => {
    expect(cropLabel(base)).toBe('Wheat - growing, ripe in 4 m');
    expect(cropLabel({ ...base, hydrated: false, ripeInS: 480 })).toBe('Wheat - dry, ripe in 8 m: water within 4 blocks doubles it');
    expect(cropLabel({ ...base, lit: false, ripeInS: Infinity })).toBe('Wheat - needs light: sun or a lamp');
    expect(cropLabel({ ...base, soil: false })).toBe('Wheat - needs farmland');
    expect(cropLabel({ ...base, name: 'Wheat (ripe)', ripe: true, ripeInS: 0 })).toBe('Wheat - ripe, harvest it');
  });

  it('reads a real crop from the simulation (planted on dry farmland by day)', () => {
    const kit = makeKit();
    kit.clock.timeOfDay = 0.3;
    kit.world.put(0, 10, 0, 'farmland');
    kit.world.put(0, 11, 0, 'wheat_0');
    const view = kit.sim.cropView(0, 11, 0);
    expect(view).not.toBeNull();
    expect(cropLabel(view!)).toMatch(/^Wheat - dry, ripe in \d+ m: water within 4 blocks doubles it$/);
    expect(kit.sim.cropView(5, 11, 0)).toBeNull();
  });
});
