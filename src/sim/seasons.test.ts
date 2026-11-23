import { describe, expect, it } from 'vitest';
import { CROP_SEASON, DAYS_PER_SEASON, MIN_SCALE, SNOW_GROWTH, cropScale, dayOfSeason, seasonOf } from './seasons';

describe('seasons', () => {
  it('turns every DAYS_PER_SEASON days, spring first, and wraps the year', () => {
    expect(seasonOf(1)).toBe('spring');
    expect(seasonOf(DAYS_PER_SEASON)).toBe('spring');
    expect(seasonOf(DAYS_PER_SEASON + 1)).toBe('summer');
    expect(seasonOf(DAYS_PER_SEASON * 3 + 1)).toBe('winter');
    expect(seasonOf(DAYS_PER_SEASON * 4 + 1)).toBe('spring');
    expect(dayOfSeason(DAYS_PER_SEASON + 2)).toBe(2);
  });

  it('changes what grows: each crop has a best season and winter is slow for all', () => {
    expect(cropScale('summer', 'wheat', false)).toBeGreaterThan(cropScale('autumn', 'wheat', false));
    expect(cropScale('autumn', 'carrot', false)).toBeGreaterThan(cropScale('summer', 'carrot', false));
    for (const crop of Object.keys(CROP_SEASON)) expect(cropScale('winter', crop, false), crop).toBeLessThan(0.7);
    expect(cropScale('spring', 'unknown_crop', false)).toBe(1);
  });

  it('snow slows crops but never stops them', () => {
    expect(cropScale('spring', 'wheat', true)).toBeCloseTo(SNOW_GROWTH);
    expect(cropScale('winter', 'wheat', true)).toBe(MIN_SCALE);
  });
});
