import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_S, SUNSET_AT, TWILIGHT } from '../core/constants';
import { createBus } from '../core/context';
import { GameClock, NIGHT_SUNLIGHT, START_TIME_OF_DAY, WAKE_TIME_OF_DAY, phaseAt, sunlightAt } from './clock';

describe('GameClock', () => {
  it('starts early in the morning of day 1', () => {
    const clock = new GameClock();
    expect(clock.timeOfDay).toBe(0.05);
    expect(START_TIME_OF_DAY).toBe(0.05);
    expect(clock.day).toBe(1);
    expect(clock.phase).toBe('day');
    expect(clock.isNight).toBe(false);
    expect(clock.sunlight()).toBe(1);
  });

  it('names the phases', () => {
    expect(phaseAt(0)).toBe('dawn');
    expect(phaseAt(TWILIGHT - 0.001)).toBe('dawn');
    expect(phaseAt(TWILIGHT)).toBe('day');
    expect(phaseAt(0.3)).toBe('day');
    expect(phaseAt(SUNSET_AT - TWILIGHT)).toBe('dusk');
    expect(phaseAt(SUNSET_AT - 0.001)).toBe('dusk');
    expect(phaseAt(SUNSET_AT)).toBe('night');
    expect(phaseAt(0.999)).toBe('night');
  });

  it('keeps sunlight continuous over the whole day, including the wrap', () => {
    const steps = 9000;
    let lo = Infinity;
    let hi = -Infinity;
    let prev = sunlightAt((steps - 1) / steps);
    for (let i = 0; i < steps; i++) {
      const s = sunlightAt(i / steps);
      expect(Math.abs(s - prev)).toBeLessThan(0.005);
      prev = s;
      lo = Math.min(lo, s);
      hi = Math.max(hi, s);
    }
    expect(lo).toBeCloseTo(NIGHT_SUNLIGHT);
    expect(NIGHT_SUNLIGHT).toBeCloseTo(0.08);
    expect(hi).toBe(1);
    expect(sunlightAt(0.3)).toBe(1);
    expect(sunlightAt(0.8)).toBe(NIGHT_SUNLIGHT);
    expect(sunlightAt(TWILIGHT / 2)).toBeCloseTo((1 + NIGHT_SUNLIGHT) / 2);
    expect(sunlightAt(SUNSET_AT - TWILIGHT / 2)).toBeCloseTo((1 + NIGHT_SUNLIGHT) / 2);
  });

  it('announces each phase once as a day passes and counts days at sunrise', () => {
    const bus = createBus();
    const phases: string[] = [];
    bus.on('time:phase', (e) => phases.push(e.phase));
    const clock = new GameClock(bus);
    for (let t = 0; t < DAY_LENGTH_S; t += 0.05) clock.tick(0.05);
    expect(phases).toEqual(['dusk', 'night', 'dawn', 'day']);
    expect(clock.day).toBe(2);
    expect(clock.timeOfDay).toBeCloseTo(0.05, 3);
    clock.tick(DAY_LENGTH_S * 2);
    expect(clock.day).toBe(4);
    expect(phases).toHaveLength(4);
    clock.tick(0);
    clock.tick(-5);
    expect(clock.day).toBe(4);
    expect(clock.worldTimeS).toBeCloseTo((3 + clock.timeOfDay) * DAY_LENGTH_S);
  });

  it('reports the sun angle along its arc', () => {
    const clock = new GameClock(null, 0);
    expect(clock.sunAngle()).toBe(0);
    clock.setTimeOfDay(SUNSET_AT / 2);
    expect(clock.sunAngle()).toBeCloseTo(Math.PI / 2);
    clock.setTimeOfDay(SUNSET_AT);
    expect(clock.sunAngle()).toBeCloseTo(Math.PI);
    clock.setTimeOfDay((1 + SUNSET_AT) / 2);
    expect(clock.sunAngle()).toBeCloseTo(Math.PI * 1.5);
  });

  it('skips the night to the next dawn', () => {
    const bus = createBus();
    const phases: string[] = [];
    bus.on('time:phase', (e) => phases.push(e.phase));
    const clock = new GameClock(bus);
    clock.setTimeOfDay(0.8);
    expect(clock.isNight).toBe(true);
    expect(phases).toEqual(['night']);
    const skipped = clock.skipToDawn();
    expect(clock.day).toBe(2);
    expect(clock.timeOfDay).toBe(WAKE_TIME_OF_DAY);
    expect(clock.phase).toBe('dawn');
    expect(clock.isNight).toBe(false);
    expect(skipped).toBeCloseTo((0.2 + WAKE_TIME_OF_DAY) * DAY_LENGTH_S);
    expect(phases).toEqual(['night', 'dawn']);
    // Used in the middle of the day it still lands on the NEXT dawn, never back in time.
    clock.setTimeOfDay(0.3);
    expect(clock.skipToDawn()).toBeGreaterThan(0);
    expect(clock.day).toBe(3);
  });

  it('saves and loads without announcing anything', () => {
    const bus = createBus();
    const clock = new GameClock(bus);
    clock.tick(DAY_LENGTH_S * 1.7);
    const snapshot = JSON.parse(JSON.stringify(clock)) as ReturnType<GameClock['toJSON']>;
    const events: string[] = [];
    bus.on('time:phase', (e) => events.push(e.phase));
    const other = new GameClock(bus);
    other.load(snapshot);
    expect(other.toJSON()).toEqual(clock.toJSON());
    expect(other.day).toBe(2);
    expect(other.isNight).toBe(true);
    expect(events).toEqual([]);
    other.tick(0.05);
    expect(events).toEqual([]);
  });
});
