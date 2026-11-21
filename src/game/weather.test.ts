import { describe, expect, it } from 'vitest';
import {
  DAY_LENGTH_S, DT, LIGHTNING_MAX_DIST, LIGHTNING_MAX_S, LIGHTNING_MIN_DIST, LIGHTNING_MIN_S, SOUND_SPEED, WEATHER_BLEND_MAX_S,
  WEATHER_BLEND_MIN_S, WEATHER_CHANCE, WEATHER_CLOUD_COVER, WEATHER_MAX_S, WEATHER_MIN_S,
} from '../core/constants';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import type { BiomeKey } from '../core/types';
import { FakeWorld } from './fakeWorld';
import {
  FORCED_BLEND_S, PRECIP_FADE_S, RELEASE_BLEND_S, Weather, fallingKind, openSkyAbove, stormLevel, wetAt,
  type WeatherBiomeLookup,
} from './weather';
import { DRY_UNTIL_S, WEATHER_KINDS, WeatherSchedule, drawDryWeather, drawWeather } from './weatherSchedule';

const at = { x: 0.5, y: 40, z: 0.5 };

function rig(seed = 1234, biome: BiomeKey = 'woodland') {
  const bus = createBus();
  const env = { biome };
  const lookup: WeatherBiomeLookup = () => env.biome;
  const weather = new Weather(seed, bus, lookup);
  const events = { changed: [] as GameEvents['weather:changed'][], flashes: [] as (GameEvents['weather:lightning'] & { t: number })[], thunder: [] as (GameEvents['sfx'] & { t: number })[] };
  let t = 45;
  bus.on('weather:changed', (e) => events.changed.push(e));
  bus.on('weather:lightning', (e) => events.flashes.push({ ...e, t }));
  bus.on('sfx', (e) => events.thunder.push({ ...e, t }));
  weather.update(0, t, 1, at);
  return {
    bus, env, weather, events,
    get t() {
      return t;
    },
    run(seconds: number, place = at, day = 1): void {
      for (let i = Math.round(seconds / DT); i > 0; i--) {
        t += DT;
        weather.update(DT, t, day, place);
      }
    },
    jump(to: number): void {
      t = to;
      weather.update(DT, t, 1, at);
    },
  };
}

describe('WeatherSchedule', () => {
  it('is deterministic per seed, starts clear and keeps lengths and blends in range', () => {
    const a = new WeatherSchedule(77);
    const b = new WeatherSchedule(77);
    const c = new WeatherSchedule(78);
    expect(a.segment(0).kind).toBe('clear');
    expect(a.segment(0).startS).toBe(0);
    let differs = 0;
    for (let i = 0; i < 200; i++) {
      const s = a.segment(i);
      expect(b.segment(i)).toEqual(s);
      if (c.segment(i).kind !== s.kind) differs++;
      expect(s.lengthS).toBeGreaterThanOrEqual(WEATHER_MIN_S);
      expect(s.lengthS).toBeLessThan(WEATHER_MAX_S);
      expect(s.blendS).toBeGreaterThanOrEqual(WEATHER_BLEND_MIN_S);
      expect(s.blendS).toBeLessThan(WEATHER_BLEND_MAX_S);
      if (i > 0) expect(s.startS).toBeCloseTo(a.segment(i - 1).startS + a.segment(i - 1).lengthS, 6);
    }
    expect(differs).toBeGreaterThan(50);
  });

  it('draws the states with the spec chances', () => {
    const counts = { clear: 0, cloudy: 0, rain: 0, storm: 0 };
    const s = new WeatherSchedule(5);
    const n = 20000;
    for (let i = 1; i <= n; i++) counts[s.segment(i).kind]++;
    for (const k of WEATHER_KINDS) expect(counts[k] / n).toBeCloseTo(WEATHER_CHANCE[k], 1);
    expect(drawWeather(0)).toBe('clear');
    expect(drawWeather(0.999999)).toBe('storm');
  });

  it('keeps the whole first day and night dry in every world (gc-1: night 1 must not soak a new player)', () => {
    expect(DRY_UNTIL_S).toBe(DAY_LENGTH_S);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 2000; seed++) {
      const s = new WeatherSchedule(seed);
      for (let t = 0; t < DAY_LENGTH_S; t += 15) {
        const kind = s.at(t).kind;
        seen.add(kind);
        expect(kind === 'clear' || kind === 'cloudy', `seed ${seed} at ${t} s: ${kind}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual(['clear', 'cloudy']);
    // Dry draws keep clear and cloudy in their spec proportions; rain comes back after the first dawn.
    expect(drawDryWeather(0)).toBe('clear');
    expect(drawDryWeather(WEATHER_CHANCE.clear / (WEATHER_CHANCE.clear + WEATHER_CHANCE.cloudy) - 1e-9)).toBe('clear');
    expect(drawDryWeather(0.999999)).toBe('cloudy');
    let wet = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = new WeatherSchedule(seed);
      for (let i = 1; i < 6; i++) if (s.segment(i).startS >= DAY_LENGTH_S && (s.segment(i).kind === 'rain' || s.segment(i).kind === 'storm')) wet++;
    }
    expect(wet).toBeGreaterThan(50);
  });

  it('finds the segment of any time, also after going back', () => {
    const s = new WeatherSchedule(9);
    const far = s.at(50_000);
    expect(far.startS).toBeLessThanOrEqual(50_000);
    expect(far.startS + far.lengthS).toBeGreaterThan(50_000);
    expect(s.at(10).index).toBe(0);
    expect(s.at(-5).index).toBe(0);
  });
});

describe('Weather: the sky over time', () => {
  it('follows the timetable: kind, eased blend across each change, and the forecast', () => {
    const r = rig(4242);
    const sched = r.weather.schedule;
    let checked = 0;
    for (let i = 1; i < 40 && checked < 6; i++) {
      const seg = sched.segment(i);
      const prev = sched.segment(i - 1).kind;
      if (seg.kind === prev) continue;
      checked++;
      r.jump(seg.startS + 0.001);
      expect(r.weather.state.kind).toBe(seg.kind);
      expect(r.weather.state.previous).toBe(prev);
      expect(r.weather.state.blend).toBeLessThan(0.01);
      r.jump(seg.startS + seg.blendS / 2);
      expect(r.weather.state.blend).toBeCloseTo(0.5, 5);
      r.jump(seg.startS + seg.blendS + 1);
      expect(r.weather.state.blend).toBe(1);
      const next = sched.nextChange(seg, seg.kind);
      expect(r.weather.state.next).toBe(next.kind);
      expect(r.weather.state.next).not.toBe(seg.kind);
      expect(r.weather.state.nextInS).toBeCloseTo(next.startS - r.t, 6);
    }
    expect(checked).toBe(6);
  });

  it('never jumps: cloud cover and intensity move smoothly through hours of weather', () => {
    const r = rig(31337);
    let cover = r.weather.state.cloudCover;
    let intensity = r.weather.state.intensity;
    const seen = new Set<string>();
    // Smoothstep's steepest slope is 1.5 per blend length; the fastest blend is WEATHER_BLEND_MIN_S.
    const maxStep = (1.5 / WEATHER_BLEND_MIN_S) * DT * 1.01;
    for (let i = 0; i < 4 * 3600 * 20; i++) {
      r.run(DT);
      const s = r.weather.state;
      seen.add(s.kind);
      expect(Math.abs(s.cloudCover - cover)).toBeLessThanOrEqual(maxStep * (WEATHER_CLOUD_COVER.storm - WEATHER_CLOUD_COVER.clear));
      expect(Math.abs(s.intensity - intensity)).toBeLessThanOrEqual(Math.max(maxStep, DT / PRECIP_FADE_S) * 1.01);
      cover = s.cloudCover;
      intensity = s.intensity;
    }
    expect(seen.size).toBe(4);
  });

  it('announces each change once, when it begins', () => {
    const r = rig(4242);
    const sched = r.weather.schedule;
    r.run(sched.segment(8).startS - r.t + 1);
    let changes = 0;
    for (let i = 1; i <= 8; i++) if (sched.segment(i).kind !== sched.segment(i - 1).kind) changes++;
    expect(r.events.changed).toHaveLength(changes);
    for (const e of r.events.changed) expect(e.kind).not.toBe(e.previous);
  });

  it('gives tonight\'s moon from the day: a full first night, new four days later, an 8-day cycle', () => {
    const r = rig();
    const phase = (day: number): number => {
      r.weather.update(0, r.t, day, at);
      return r.weather.state.moonPhase;
    };
    expect(phase(1)).toBe(4);
    expect(phase(5)).toBe(0);
    expect(phase(9)).toBe(4);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(phase)).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
  });
});

describe('Weather: what falls where', () => {
  it('is rain in the woods, snow in the frostfell and up high, dust in the dunes, nothing in fair weather', () => {
    const r = rig(1, 'woodland');
    r.weather.force('rain', r.t, true);
    r.run(0.1);
    expect(r.weather.state.precipitation).toBe('rain');
    expect(r.weather.state.intensity).toBeCloseTo(0.6);
    r.weather.force('storm', r.t, true);
    r.run(0.1, { x: 0, y: 80, z: 0 });
    expect(r.weather.state.precipitation).toBe('snow');
    expect(r.weather.state.intensity).toBeCloseTo(1);
    r.env.biome = 'frostfell';
    r.weather.force('rain', r.t, true);
    r.run(0.1);
    expect(r.weather.state.precipitation).toBe('snow');
    r.env.biome = 'dunes';
    r.weather.force('storm', r.t, true);
    r.run(0.1, { x: 0, y: 80, z: 0 });
    expect(r.weather.state.precipitation).toBe('dust');
    r.weather.force('cloudy', r.t, true);
    r.run(0.1);
    expect(r.weather.state.precipitation).toBe('none');
    expect(r.weather.state.intensity).toBe(0);
  });

  it('fades the old precipitation out and the new one in when the player walks into another biome', () => {
    const r = rig(1, 'dunes');
    r.weather.force('rain', r.t, true);
    r.run(1);
    expect(r.weather.state.precipitation).toBe('dust');
    r.env.biome = 'woodland';
    let low = 1;
    for (let i = 0; i < 100; i++) {
      r.run(DT);
      low = Math.min(low, r.weather.state.intensity);
    }
    expect(low).toBeLessThan(0.05);
    r.run(PRECIP_FADE_S * 2);
    expect(r.weather.state.precipitation).toBe('rain');
    expect(r.weather.state.intensity).toBeCloseTo(0.6);
  });

  it('keeps the rain of a clearing sky falling (and thinning) until the change is done', () => {
    expect(fallingKind({ kind: 'clear', previous: 'rain' })).toBe('rain');
    expect(fallingKind({ kind: 'storm', previous: 'rain' })).toBe('storm');
    expect(fallingKind({ kind: 'cloudy', previous: 'clear' })).toBe('cloudy');
    expect(stormLevel({ kind: 'storm', previous: 'rain', blend: 0.3 })).toBeCloseTo(0.3);
    expect(stormLevel({ kind: 'clear', previous: 'storm', blend: 0.3 })).toBeCloseTo(0.7);
    expect(stormLevel({ kind: 'rain', previous: 'rain', blend: 1 })).toBe(0);
    const w = rig().weather.state;
    Object.assign(w, { kind: 'clear', previous: 'rain', blend: 0.2 });
    expect(wetAt(w, 'woodland', 40)).toBe(true);
    expect(wetAt(w, 'dunes', 40)).toBe(false);
    Object.assign(w, { blend: 0.8 });
    expect(wetAt(w, 'woodland', 40)).toBe(false);
  });
});

describe('Weather: storms', () => {
  it('flashes on a 6-22 s cadence at 60-900 blocks and sends the thunder after distance / speed of sound', () => {
    const r = rig(99);
    r.weather.force('storm', r.t, true);
    r.run(600);
    const f = r.events.flashes;
    expect(f.length).toBeGreaterThan(600 / LIGHTNING_MAX_S - 1);
    expect(f.length).toBeLessThanOrEqual(600 / LIGHTNING_MIN_S + 1);
    for (let i = 1; i < f.length; i++) {
      expect(f[i].t - f[i - 1].t).toBeGreaterThanOrEqual(LIGHTNING_MIN_S - DT);
      expect(f[i].t - f[i - 1].t).toBeLessThanOrEqual(LIGHTNING_MAX_S + DT);
    }
    for (const e of f) {
      expect(e.distance).toBeGreaterThanOrEqual(LIGHTNING_MIN_DIST);
      expect(e.distance).toBeLessThanOrEqual(LIGHTNING_MAX_DIST);
      expect(Math.abs(e.bearing)).toBeLessThanOrEqual(Math.PI);
    }
    const thunder = r.events.thunder.filter((e) => e.name === 'thunder');
    expect(thunder.length).toBeGreaterThanOrEqual(f.length - 1);
    for (let i = 0; i < thunder.length; i++) {
      const delay = thunder[i].t - f[i].t;
      expect(delay).toBeCloseTo(f[i].distance / SOUND_SPEED, 1);
      expect(thunder[i].volume).toBeGreaterThan(0.2);
      expect(thunder[i].pitch).toBeLessThanOrEqual(1);
      expect(thunder[i].x).toBeUndefined();
    }
  });

  it('is silent and dark in any other weather', () => {
    const r = rig(99);
    for (const k of ['clear', 'cloudy', 'rain'] as const) {
      r.weather.force(k, r.t, true);
      r.run(120);
    }
    expect(r.events.flashes).toHaveLength(0);
    expect(r.events.thunder).toHaveLength(0);
  });

  it('is deterministic: the same seed flashes at the same moments', () => {
    const a = rig(7);
    const b = rig(7);
    a.weather.force('storm', a.t, true);
    b.weather.force('storm', b.t, true);
    a.run(200);
    b.run(200);
    expect(a.events.flashes).toEqual(b.events.flashes);
  });
});

describe('Weather: overrides and saves', () => {
  it('eases a forced state in, holds it, then eases back to the timetable', () => {
    const r = rig(4242);
    const start = r.t;
    r.weather.force('storm', start);
    r.run(FORCED_BLEND_S / 2);
    expect(r.weather.state.kind).toBe('storm');
    expect(r.weather.state.blend).toBeGreaterThan(0.3);
    expect(r.weather.state.blend).toBeLessThan(0.7);
    r.run(FORCED_BLEND_S);
    expect(r.weather.state.blend).toBe(1);
    expect(r.weather.override).not.toBeNull();
    r.weather.release();
    r.run(RELEASE_BLEND_S + 1);
    expect(r.weather.override).toBeNull();
    expect(r.weather.state.kind).toBe(r.weather.schedule.at(r.t).kind);
  });

  it('saves as plain JSON and continues exactly as an unsaved run', () => {
    const a = rig(2024);
    const b = rig(2024);
    a.weather.force('rain', a.t);
    b.weather.force('rain', b.t);
    a.run(300);
    b.run(300);
    const snap = JSON.parse(JSON.stringify(a.weather.toJSON()));
    const c = rig(2024);
    c.jump(a.t);
    c.weather.load(snap);
    expect(c.weather.state).toEqual(a.weather.state);
    a.run(900);
    c.run(900);
    expect(c.weather.state).toEqual(a.weather.state);
  });
});

describe('openSkyAbove', () => {
  it('is blocked by roofs and liquids but not by plants, torches or air', () => {
    const world = new FakeWorld();
    world.fill(-2, 9, -2, 2, 9, 2, 'stone');
    expect(openSkyAbove(world, 0.5, 10, 0.5)).toBe(true);
    world.put(0, 14, 0, 'torch');
    world.put(0, 13, 0, 'tall_grass');
    expect(openSkyAbove(world, 0.5, 10, 0.5)).toBe(true);
    world.put(0, 20, 0, 'plank');
    expect(openSkyAbove(world, 0.5, 10, 0.5)).toBe(false);
    expect(openSkyAbove(world, 0.5, 21, 0.5)).toBe(true);
    world.put(1, 18, 0, 'water');
    expect(openSkyAbove(world, 1.5, 10, 0.5)).toBe(false);
    world.put(2, 18, 0, 'oak_leaves');
    expect(openSkyAbove(world, 2.5, 10, 0.5)).toBe(false);
  });
});
