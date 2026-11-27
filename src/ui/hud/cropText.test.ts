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

  it('says what the greenhouse is doing: heated, cold or frozen', () => {
    expect(cropLabel({ ...base, shelter: 'greenhouse', tempC: 18 })).toBe('Wheat - greenhouse 18 °C, ripe in 4 m');
    expect(cropLabel({ ...base, shelter: 'cold', tempC: 4 })).toBe('Wheat - cold 4 °C, ripe in 4 m: heat it to 10 °C for full pace');
    expect(cropLabel({ ...base, shelter: 'frozen', tempC: -3, ripeInS: Infinity })).toBe('Wheat - frozen at -3 °C: heat the room to 10 °C');
    expect(cropLabel({ ...base, shelter: 'frozen', ripeInS: Infinity })).toBe('Wheat - frozen: roof it with glass and heat it');
    expect(cropLabel({ ...base, shelter: 'open' })).toBe('Wheat - growing, ripe in 4 m');
  });

  it('says when the season suits the crop or not', () => {
    expect(cropLabel({ ...base, seasonPace: 1.25 })).toBe('Wheat - growing, in season, ripe in 4 m');
    expect(cropLabel({ ...base, seasonPace: 0.3 })).toBe('Wheat - growing, out of season, ripe in 4 m');
    expect(cropLabel({ ...base, seasonPace: 1, hydrated: false, ripeInS: 480 })).toBe('Wheat - dry, ripe in 8 m: water within 4 blocks doubles it');
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

describe('crop crosshair label with bees', () => {
  it('says the bees are pollinating a watered crop', () => {
    expect(cropLabel({ ...base, pollinated: true })).toBe('Wheat - growing, bees pollinating, ripe in 4 m');
  });
});
