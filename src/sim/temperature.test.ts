import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON } from './seasons';
import { SHELTER_DELTA_C, setTemperatureProvider, stubTemperature, temperatureAt } from './temperature';

const q = (day: number, over: Partial<Parameters<typeof temperatureAt>[0]> = {}) =>
  ({ x: 0, y: 0, z: 0, day, night: false, snowing: false, exposed: true, ...over });

describe('temperature stub', () => {
  it('is below zero only in winter, colder at night and in snow, milder under a roof', () => {
    const winter = DAYS_PER_SEASON * 3 + 1;
    expect(stubTemperature(q(winter))).toBeLessThan(0);
    expect(stubTemperature(q(DAYS_PER_SEASON * 2 + 1, { night: true }))).toBeGreaterThanOrEqual(0);
    expect(stubTemperature(q(winter, { night: true }))).toBeLessThan(stubTemperature(q(winter)));
    expect(stubTemperature(q(winter, { snowing: true }))).toBeLessThan(stubTemperature(q(winter)));
    expect(stubTemperature(q(winter, { exposed: false }))).toBe(stubTemperature(q(winter)) + SHELTER_DELTA_C);
  });

  it('defers to a provider unless it has no opinion', () => {
    setTemperatureProvider((p) => (p.x === 0 ? 3 : null));
    try {
      expect(temperatureAt(q(1))).toBe(3);
      expect(temperatureAt({ ...q(1), x: 5 })).toBe(stubTemperature({ ...q(1), x: 5 }));
    } finally {
      setTemperatureProvider(null);
    }
  });
});
