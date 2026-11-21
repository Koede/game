import { describe, expect, it } from 'vitest';
import { SUNSET_AT, TWILIGHT } from '../core/constants';
import { smoothstep } from '../core/math';
import { computeSky, createSkyState, luminance, NIGHT_SUNLIGHT, sunAngle, sunHeight, type SkyState } from './skyModel';

/** A clock-like sunlight curve: 1 by day, NIGHT_SUNLIGHT at night, smooth ramps TWILIGHT wide. */
function sunlightAt(t: number): number {
  const half = TWILIGHT / 2;
  const dawn = t > 0.5 ? smoothstep(1 - half, 1 + half, t) : smoothstep(-half, half, t);
  const dusk = 1 - smoothstep(SUNSET_AT - half, SUNSET_AT + half, t);
  return NIGHT_SUNLIGHT + (1 - NIGHT_SUNLIGHT) * Math.min(dawn, t > 0.5 && t < 1 - half ? dusk : Math.max(dusk, dawn));
}

const skyAt = (t: number): SkyState => computeSky(t, sunlightAt(t), createSkyState());
const COLOURS = ['zenith', 'horizon', 'glow', 'sunColor', 'skyLight', 'cloud', 'sunDir', 'moonDir'] as const;

describe('sky model', () => {
  it('puts the sun on the horizon at sunrise and sunset, high at midday, below at night', () => {
    expect(sunHeight(0)).toBeCloseTo(0, 6);
    expect(sunHeight(SUNSET_AT)).toBeCloseTo(0, 6);
    expect(sunHeight(SUNSET_AT / 2)).toBeCloseTo(1, 6);
    expect(sunHeight((1 + SUNSET_AT) / 2)).toBeCloseTo(-1, 6);
    for (let t = 0.01; t < SUNSET_AT - 0.01; t += 0.01) expect(sunHeight(t)).toBeGreaterThan(0);
    for (let t = SUNSET_AT + 0.01; t < 0.99; t += 0.01) expect(sunHeight(t)).toBeLessThan(0);
  });

  it('rises in the east and sets in the west', () => {
    expect(skyAt(0.02).sunDir[0]).toBeGreaterThan(0.9);
    expect(skyAt(SUNSET_AT - 0.02).sunDir[0]).toBeLessThan(-0.9);
  });

  it('keeps sun and moon opposite unit vectors', () => {
    for (let t = 0; t < 1; t += 0.037) {
      const s = skyAt(t);
      expect(Math.hypot(s.sunDir[0], s.sunDir[1], s.sunDir[2])).toBeCloseTo(1, 5);
      for (let i = 0; i < 3; i++) expect(s.moonDir[i]).toBeCloseTo(-s.sunDir[i], 6);
    }
  });

  it('is continuous over the whole day, including the wrap from night back to sunrise', () => {
    const steps = 4000;
    let prev = skyAt(0);
    for (let i = 1; i <= steps; i++) {
      const next = skyAt((i / steps) % 1);
      for (const key of COLOURS) {
        for (let c = 0; c < 3; c++) expect(Math.abs(next[key][c] - prev[key][c])).toBeLessThan(0.02);
      }
      expect(Math.abs(next.stars - prev.stars)).toBeLessThan(0.02);
      expect(Math.abs(next.day - prev.day)).toBeLessThan(0.02);
      prev = next;
    }
    expect(sunAngle(1)).toBeCloseTo(0, 9);
    expect(sunAngle(0.999999) / (2 * Math.PI)).toBeCloseTo(1, 4);
  });

  it('makes night much darker than day but never black', () => {
    const noon = skyAt(SUNSET_AT / 2);
    const midnight = skyAt((1 + SUNSET_AT) / 2);
    expect(luminance(midnight.skyLight)).toBeLessThan(luminance(noon.skyLight) * 0.3);
    expect(luminance(midnight.zenith)).toBeLessThan(luminance(noon.zenith) * 0.1);
    expect(luminance(midnight.horizon)).toBeLessThan(luminance(noon.horizon) * 0.12);
    expect(luminance(midnight.skyLight)).toBeGreaterThan(0.12);
    expect(midnight.stars).toBe(1);
    expect(noon.stars).toBe(0);
    expect(noon.day).toBe(1);
    expect(midnight.day).toBe(0);
  });

  it('glows warm only around dawn and dusk', () => {
    expect(luminance(skyAt(SUNSET_AT / 2).glow)).toBe(0);
    expect(luminance(skyAt((1 + SUNSET_AT) / 2).glow)).toBe(0);
    const dusk = skyAt(SUNSET_AT);
    expect(dusk.glow[0]).toBeGreaterThan(dusk.glow[2] + 0.3);
    expect(dusk.horizon[0]).toBeGreaterThan(dusk.horizon[2]);
  });

  it('writes into the state it is given without allocating a new one', () => {
    const state = createSkyState();
    expect(computeSky(0.3, 1, state)).toBe(state);
  });
});
