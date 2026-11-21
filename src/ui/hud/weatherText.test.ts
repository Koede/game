import { describe, expect, it } from 'vitest';
import type { WeatherState } from '../../core/types';
import { createWeatherState } from '../../game/weather';
import { forecast, moonName, moonPath, weatherGlyph } from './weatherText';

const w = (extra: Partial<WeatherState>): WeatherState => ({ ...createWeatherState(), ...extra });

describe('weather glyph', () => {
  it('shows the state the sky is turning into past half way, snow and dust where they fall', () => {
    expect(weatherGlyph(w({ kind: 'rain', previous: 'clear', blend: 0.3 }))).toBe('clear');
    expect(weatherGlyph(w({ kind: 'rain', previous: 'clear', blend: 0.6 }))).toBe('rain');
    expect(weatherGlyph(w({ kind: 'storm', previous: 'storm', blend: 1, precipitation: 'snow', intensity: 1 }))).toBe('snow');
    expect(weatherGlyph(w({ kind: 'rain', previous: 'rain', blend: 1, precipitation: 'dust', intensity: 0.6 }))).toBe('dust');
    expect(weatherGlyph(w({ kind: 'cloudy', previous: 'cloudy', blend: 1 }))).toBe('cloudy');
  });
});

describe('moon', () => {
  it('names the phases', () => {
    expect(moonName(0)).toBe('New moon');
    expect(moonName(4)).toBe('Full moon');
    expect(moonName(2)).toBe('First quarter');
    expect(moonName(6)).toBe('Last quarter');
  });

  it('draws nothing at new moon, a full disc at full moon, the right half at first quarter and the left at last', () => {
    expect(moonPath(0, 10, 10, 5)).toBe('');
    // Full: two half arcs of radius 5 (the terminator is the other half of the rim).
    expect(moonPath(4, 10, 10, 5)).toBe('M10 5A5 5 0 0 0 10 15A5 5 0 0 0 10 5Z');
    expect(moonPath(2, 10, 10, 5)).toBe('M10 5A5 5 0 0 1 10 15A0 5 0 0 0 10 5Z');
    expect(moonPath(6, 10, 10, 5)).toMatch(/^M10 5A5 5 0 0 0 10 15A0 5 0 0 [01] 10 5Z$/);
    // A waxing crescent: lit rim on the right, terminator bulging right (sweep back the same way as the rim's return).
    expect(moonPath(1, 10, 10, 5)).toMatch(/^M10 5A5 5 0 0 1 10 15A3\.54 5 0 0 0 10 5Z$/);
    expect(moonPath(3, 10, 10, 5)).toMatch(/A3\.54 5 0 0 1 10 5Z$/);
  });
});

describe('forecast', () => {
  it('reads "Rain within the hour" when rain or a storm is next', () => {
    expect(forecast(w({ kind: 'clear', previous: 'clear', next: 'rain', nextInS: 300 })).line).toBe('Rain within the hour');
    expect(forecast(w({ kind: 'cloudy', previous: 'cloudy', next: 'storm', nextInS: 30 })).line).toMatch(/^Rain within the hour/);
    expect(forecast(w({ kind: 'clear', previous: 'clear', next: 'rain', nextInS: 300 })).when).toBe('Change in about 5 min');
    expect(forecast(w({ kind: 'clear', previous: 'clear', next: 'rain', nextInS: 40 })).when).toBe('Change in a minute or so');
  });

  it('says when it will clear, worsen or stay fair', () => {
    expect(forecast(w({ kind: 'rain', previous: 'rain', next: 'clear' })).line).toBe('Clearing within the hour');
    expect(forecast(w({ kind: 'rain', previous: 'rain', next: 'cloudy' })).line).toBe('The rain will stop within the hour');
    expect(forecast(w({ kind: 'rain', previous: 'rain', next: 'storm' })).line).toBe('The rain will grow into a storm');
    expect(forecast(w({ kind: 'storm', previous: 'storm', next: 'rain' })).line).toBe('The storm will ease to steady rain');
    expect(forecast(w({ kind: 'clear', previous: 'clear', next: 'cloudy' })).line).toMatch(/Clouds gathering/);
    expect(forecast(w({ kind: 'cloudy', previous: 'cloudy', next: 'clear' })).line).toBe('Clear skies ahead');
  });
});
