import { describe, expect, it } from 'vitest';
import {
  BIOME_PRECIPITATION, MOON_PHASES, NIGHT_LIGHT_FULL_MOON, NIGHT_LIGHT_NEW_MOON, SNOW_LINE_Y, WEATHER_BLEND_MAX_S,
  WEATHER_BLEND_MIN_S, WEATHER_CHANCE, WEATHER_CLOUD_COVER, WEATHER_DAYLIGHT, WEATHER_INTENSITY, WEATHER_MAX_S,
  WEATHER_MIN_S, WEATHER_SOLAR, WEATHER_WIND, WET_MIN_INTENSITY,
} from './constants';
import { ALL_BIOMES, type WeatherKind } from './types';
import { isWet, moonIllumination, moonPhase, nightLight, precipitationFor, weatherValue } from './weather';

const KINDS: WeatherKind[] = ['clear', 'cloudy', 'rain', 'storm'];

describe('weather tables (spec 15)', () => {
  it('draws clear 45%, cloudy 25%, rain 20%, storm 10%', () => {
    expect(WEATHER_CHANCE).toEqual({ clear: 0.45, cloudy: 0.25, rain: 0.2, storm: 0.1 });
    expect(KINDS.reduce((s, k) => s + WEATHER_CHANCE[k], 0)).toBeCloseTo(1, 10);
  });

  it('lasts 4-12 minutes and changes over 30-60 s', () => {
    expect([WEATHER_MIN_S, WEATHER_MAX_S]).toEqual([240, 720]);
    expect([WEATHER_BLEND_MIN_S, WEATHER_BLEND_MAX_S]).toEqual([30, 60]);
    expect(WEATHER_BLEND_MAX_S).toBeLessThan(WEATHER_MIN_S);
  });

  it('darkens, clouds over and dims the sun as the weather worsens', () => {
    for (let i = 1; i < KINDS.length; i++) {
      expect(WEATHER_CLOUD_COVER[KINDS[i]]).toBeGreaterThan(WEATHER_CLOUD_COVER[KINDS[i - 1]]);
      expect(WEATHER_DAYLIGHT[KINDS[i]]).toBeLessThan(WEATHER_DAYLIGHT[KINDS[i - 1]]);
      expect(WEATHER_SOLAR[KINDS[i]]).toBeLessThanOrEqual(WEATHER_SOLAR[KINDS[i - 1]]);
    }
    expect(WEATHER_SOLAR).toEqual({ clear: 1, cloudy: 0.5, rain: 0.2, storm: 0.2 });
    expect(WEATHER_WIND).toEqual({ clear: 1, cloudy: 1, rain: 1, storm: 1.5 });
    expect(WEATHER_INTENSITY.clear).toBe(0);
    expect(WEATHER_INTENSITY.cloudy).toBe(0);
    expect(WEATHER_INTENSITY.rain).toBeGreaterThan(WET_MIN_INTENSITY);
    expect(WEATHER_INTENSITY.storm).toBe(1);
  });

  it('names what falls in every biome, the marsh included', () => {
    expect(Object.keys(BIOME_PRECIPITATION).sort()).toEqual([...ALL_BIOMES].sort());
    expect(ALL_BIOMES).toContain('marsh');
  });
});

describe('precipitationFor', () => {
  it('lets nothing fall from a clear or cloudy sky', () => {
    for (const biome of ALL_BIOMES) for (const kind of ['clear', 'cloudy'] as const) expect(precipitationFor(kind, biome, 40)).toBe('none');
  });

  it('turns rain to snow in the frostfell and high up, and to dust in the dunes', () => {
    for (const kind of ['rain', 'storm'] as const) {
      expect(precipitationFor(kind, 'woodland', 40)).toBe('rain');
      expect(precipitationFor(kind, 'marsh', 33)).toBe('rain');
      expect(precipitationFor(kind, 'scar', 50)).toBe('rain');
      expect(precipitationFor(kind, 'frostfell', 40)).toBe('snow');
      expect(precipitationFor(kind, 'woodland', SNOW_LINE_Y)).toBe('snow');
      expect(precipitationFor(kind, 'woodland', SNOW_LINE_Y - 1)).toBe('rain');
      expect(precipitationFor(kind, 'dunes', 40)).toBe('dust');
      expect(precipitationFor(kind, 'dunes', 90)).toBe('dust');
    }
  });

  it('only soaks with real rain or snow', () => {
    expect(isWet('rain', 0.6)).toBe(true);
    expect(isWet('snow', 1)).toBe(true);
    expect(isWet('rain', WET_MIN_INTENSITY - 0.01)).toBe(false);
    expect(isWet('dust', 1)).toBe(false);
    expect(isWet('none', 1)).toBe(false);
  });
});

describe('weatherValue', () => {
  it('eases a table from the previous state to the current one', () => {
    expect(weatherValue(WEATHER_SOLAR, { previous: 'clear', kind: 'storm', blend: 0 })).toBe(1);
    expect(weatherValue(WEATHER_SOLAR, { previous: 'clear', kind: 'storm', blend: 0.5 })).toBeCloseTo(0.6);
    expect(weatherValue(WEATHER_SOLAR, { previous: 'clear', kind: 'storm', blend: 1 })).toBe(0.2);
    expect(weatherValue(WEATHER_WIND, { previous: 'rain', kind: 'storm', blend: 7 })).toBe(1.5);
    expect(weatherValue(WEATHER_WIND, { previous: 'rain', kind: 'storm', blend: -1 })).toBe(1);
  });
});

describe('the moon', () => {
  it('is full on the first night and runs an 8-day cycle', () => {
    expect(MOON_PHASES).toBe(8);
    expect(moonPhase(0)).toBe(4);
    expect(moonPhase(4)).toBe(0);
    expect(moonPhase(8)).toBe(moonPhase(0));
    expect(moonPhase(-1)).toBe(3);
    for (let d = 0; d < 20; d++) {
      expect(Number.isInteger(moonPhase(d))).toBe(true);
      expect(moonPhase(d)).toBeGreaterThanOrEqual(0);
      expect(moonPhase(d)).toBeLessThan(8);
    }
  });

  it('lights the night from 0.04 at new moon to 0.12 at full moon, waxing and waning symmetrically', () => {
    expect(nightLight(0)).toBeCloseTo(NIGHT_LIGHT_NEW_MOON);
    expect(nightLight(4)).toBeCloseTo(NIGHT_LIGHT_FULL_MOON);
    expect([NIGHT_LIGHT_NEW_MOON, NIGHT_LIGHT_FULL_MOON]).toEqual([0.04, 0.12]);
    for (let p = 1; p < 4; p++) {
      expect(nightLight(p)).toBeGreaterThan(nightLight(p - 1));
      expect(nightLight(p)).toBeCloseTo(nightLight(8 - p));
    }
    expect(moonIllumination(2)).toBeCloseTo(0.5);
  });
});
