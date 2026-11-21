import { describe, expect, it } from 'vitest';
import { WEATHER_DAYLIGHT, WET_MIN_INTENSITY } from '../core/constants';
import type { WeatherKind, WeatherState } from '../core/types';
import { sunlightAt } from '../game/clock';
import { FakeWorld } from '../game/fakeWorld';
import { createWeatherState } from '../game/weather';
import { MASK_RADIUS, RainMask, rainTop } from './rainMask';
import { applyWeather, computeSky, createSkyState, luminance, type SkyState, type SkyWeather } from './skyModel';
import { FLASH_S, WET_OUT_S, WeatherFx, flashEnvelope } from './weatherFx';

const NOON = 0.32;
const MIDNIGHT = 0.82;
const calm: SkyWeather = { cover: 0.15, daylight: 1, moon: 1, storm: 0, dust: 0, snow: 0, flash: 0 };
const sky = (t: number, w: Partial<SkyWeather> = {}): SkyState => applyWeather(computeSky(t, sunlightAt(t), createSkyState()), { ...calm, ...w });

const state = (kind: WeatherKind, extra: Partial<WeatherState> = {}): WeatherState => ({ ...createWeatherState(), kind, previous: kind, blend: 1, ...extra });

describe('applyWeather', () => {
  it('greys and darkens a noon sky and the sunlit ground as clouds thicken', () => {
    const clear = sky(NOON);
    const cloudy = sky(NOON, { cover: 0.7, daylight: WEATHER_DAYLIGHT.cloudy });
    const storm = sky(NOON, { cover: 1, daylight: WEATHER_DAYLIGHT.storm, storm: 1 });
    expect(luminance(cloudy.skyLight)).toBeLessThan(luminance(clear.skyLight));
    expect(luminance(storm.skyLight)).toBeLessThan(luminance(cloudy.skyLight));
    expect(luminance(storm.skyLight) / luminance(clear.skyLight)).toBeCloseTo(WEATHER_DAYLIGHT.storm, 2);
    // Blue drains out of the zenith: overcast is grey.
    const blueness = (s: SkyState): number => s.zenith[2] - s.zenith[0];
    expect(blueness(storm)).toBeLessThan(blueness(clear) * 0.4);
    expect(luminance(storm.zenith)).toBeLessThan(luminance(clear.zenith));
    expect(storm.cover).toBe(1);
  });

  it('lights the night by the moon: a full moon is brighter than a new one, clouds dim both and hide the stars', () => {
    const full = sky(MIDNIGHT, { moon: 1 });
    const fresh = sky(MIDNIGHT, { moon: 0 });
    expect(luminance(full.skyLight)).toBeGreaterThan(luminance(fresh.skyLight) * 1.5);
    expect(luminance(fresh.skyLight)).toBeGreaterThan(0.05);
    const overcast = sky(MIDNIGHT, { moon: 1, cover: 1 });
    expect(luminance(overcast.skyLight)).toBeLessThan(luminance(full.skyLight));
    expect(full.stars).toBeGreaterThan(0.9);
    expect(overcast.stars).toBe(0);
  });

  it('flashes the whole scene for a lightning strike and hazes the horizon in dust and snow', () => {
    const dark = sky(MIDNIGHT, { cover: 1, storm: 1 });
    const lit = sky(MIDNIGHT, { cover: 1, storm: 1, flash: 1 });
    expect(luminance(lit.skyLight)).toBeGreaterThan(luminance(dark.skyLight) + 0.5);
    expect(lit.flash).toBe(1);
    const dust = sky(NOON, { dust: 1 });
    expect(dust.horizon[0] - dust.horizon[2]).toBeGreaterThan(0.15);
    const snow = sky(NOON, { snow: 1, cover: 0.9 });
    expect(luminance(snow.horizon)).toBeGreaterThan(luminance(sky(NOON, { cover: 0.9 }).horizon));
  });
});

describe('WeatherFx', () => {
  it('turns the weather state into sky numbers, precipitation and the moon', () => {
    const fx = new WeatherFx();
    fx.update(0.016, state('storm', { cloudCover: 1, precipitation: 'rain', intensity: 1, moonPhase: 0 }));
    expect(fx.sky.cover).toBe(1);
    expect(fx.sky.daylight).toBe(WEATHER_DAYLIGHT.storm);
    expect(fx.sky.storm).toBe(1);
    expect(fx.sky.moon).toBe(0);
    expect(fx.nightLevel).toBeCloseTo(0.04);
    expect(fx.precipitation).toBe('rain');
    fx.update(0.016, state('rain', { precipitation: 'dust', intensity: 0.6 }));
    expect(fx.sky.dust).toBeCloseTo(0.6);
    fx.update(0.016, null);
    expect(fx.precipitation).toBe('none');
  });

  it('soaks the ground in rain (not in snow, drizzle or dust) and dries it slowly afterwards', () => {
    const fx = new WeatherFx();
    const run = (w: WeatherState, s: number): void => {
      for (let t = 0; t < s; t += 0.1) fx.update(0.1, w);
    };
    run(state('rain', { precipitation: 'snow', intensity: 1 }), 30);
    expect(fx.wet).toBe(0);
    run(state('rain', { precipitation: 'rain', intensity: WET_MIN_INTENSITY - 0.05 }), 30);
    expect(fx.wet).toBe(0);
    run(state('storm', { precipitation: 'rain', intensity: 1 }), 30);
    expect(fx.wet).toBeCloseTo(1);
    run(state('clear'), WET_OUT_S / 2);
    expect(fx.wet).toBeGreaterThan(0.4);
    expect(fx.wet).toBeLessThan(0.6);
    run(state('clear'), WET_OUT_S);
    expect(fx.wet).toBe(0);
  });

  it('flashes twice and fades within a second, brighter when the strike is near, with a bolt at its bearing', () => {
    expect(flashEnvelope(0)).toBe(0);
    expect(flashEnvelope(0.03)).toBeCloseTo(1);
    expect(flashEnvelope(0.15)).toBeLessThan(0.3);
    expect(flashEnvelope(0.2)).toBeGreaterThan(flashEnvelope(0.15));
    expect(flashEnvelope(FLASH_S)).toBe(0);
    const peak = (distance: number): number => {
      const fx = new WeatherFx();
      fx.lightning(distance, 1);
      let best = 0;
      for (let i = 0; i < 60; i++) {
        fx.update(1 / 60, null);
        best = Math.max(best, fx.sky.flash);
      }
      return best;
    };
    expect(peak(60)).toBeGreaterThan(peak(800));
    const fx = new WeatherFx();
    fx.lightning(100, -2);
    fx.update(0.02, null);
    expect(fx.bolt[0]).toBe(-2);
    expect(fx.bolt[1]).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) fx.update(0.05, null);
    expect(fx.bolt[1]).toBe(0);
    expect(fx.sky.flash).toBe(0);
  });
});

describe('RainMask', () => {
  it('stops rain on the first solid or liquid block from the top, not on plants or torches', () => {
    const world = new FakeWorld();
    world.fill(-40, 9, -40, 40, 9, 40, 'stone');
    expect(rainTop(world, 0, 0)).toBe(10);
    world.put(1, 10, 0, 'tall_grass');
    world.put(1, 14, 0, 'torch');
    expect(rainTop(world, 1, 0)).toBe(10);
    world.put(2, 20, 0, 'plank');
    expect(rainTop(world, 2, 0)).toBe(21);
    world.put(3, 15, 0, 'water');
    expect(rainTop(world, 3, 0)).toBe(16);
    expect(rainTop(new FakeWorld(), 5, 5)).toBe(0);
  });

  it('measures the window around the camera, follows edits and re-measures only what enters the window', () => {
    const world = new FakeWorld();
    world.fill(-80, 9, -80, 80, 9, 80, 'stone');
    const mask = new RainMask(world);
    mask.center(0.5, 0.5);
    expect(mask.pending).toBe(64 * 64);
    mask.update(100_000);
    expect(mask.pending).toBe(0);
    expect(mask.topAt(0, 0)).toBe(10);
    expect(mask.topAt(-MASK_RADIUS, MASK_RADIUS - 1)).toBe(10);

    world.put(3, 30, 4, 'stone');
    mask.invalidateColumn(3, 4);
    mask.update(10);
    expect(mask.topAt(3, 4)).toBe(31);

    mask.center(5.5, 0.5);
    expect(mask.pending).toBe(5 * 64);
    mask.update(100_000);
    expect(mask.topAt(5 + MASK_RADIUS - 1, 0)).toBe(10);
    expect(mask.topAt(3, 4)).toBe(31);

    mask.invalidateChunk(0, 0);
    expect(mask.pending).toBe(256);
    mask.invalidateColumn(1000, 1000);
    expect(mask.pending).toBe(256);
    expect(mask.update(100)).toBe(100);
  });
});
