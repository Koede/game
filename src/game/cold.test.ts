import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_S, DT, MAX_HEALTH, REGEN_MIN_FOOD, SUNSET_AT, WARMTH_DRAIN_NIGHT } from '../core/constants';
import { createBus } from '../core/context';
import type { BiomeKey } from '../core/types';
import { GameClock } from './clock';
import { COLD_REMEDY, COLD_TAG, COLD_WARN_AT, COLD_WARN_REARM, ColdWatch, FIRST_DAY_WARMTH_FLOOR, coldWarning, survivalNote } from './cold';
import { FakeWorld } from './fakeWorld';
import { PlayerState, RESPAWN_MIN_FOOD } from './playerState';
import { Survival } from './survival';
import { createWeatherState } from './weather';

const NIGHT = 0.8;

function rig(timeOfDay = NIGHT, day = 2, biome: BiomeKey = 'woodland') {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const clock = new GameClock(bus, timeOfDay);
  clock.day = day;
  const survival = new Survival(world, player, clock, () => biome);
  const toasts: string[] = [];
  bus.on('toast', (e) => {
    if (e.kind === 'warn') toasts.push(e.text);
  });
  const run = (seconds: number): void => {
    for (let i = Math.round(seconds / DT); i > 0; i--) survival.tick(DT);
  };
  const soak = (precipitation: 'rain' | 'snow'): void => {
    survival.weather = { ...createWeatherState(), kind: 'rain', previous: 'rain', precipitation, intensity: 1 };
  };
  return { bus, world, player, clock, survival, toasts, run, soak };
}

describe('ColdWatch', () => {
  it('warns once at 50 and once at 20, naming the cause, and re-arms only after warming well above', () => {
    const bus = createBus();
    const toasts: string[] = [];
    bus.on('toast', (e) => toasts.push(e.text));
    const watch = new ColdWatch(bus);
    for (let w = 100; w >= 0; w -= 0.5) watch.update(w, 'rain');
    expect(toasts).toEqual([coldWarning(0, 'rain'), coldWarning(1, 'rain')]);
    expect(toasts[0]).toContain('get under a roof');
    expect(toasts[1]).toMatch(/^Freezing!/);
    // Hovering around a level does not repeat it.
    watch.update(COLD_WARN_AT[1] + 2, 'night');
    watch.update(COLD_WARN_AT[1] - 2, 'night');
    expect(toasts).toHaveLength(2);
    watch.update(COLD_WARN_AT[1] + COLD_WARN_REARM, null);
    watch.update(COLD_WARN_AT[1] - 1, 'night');
    expect(toasts.at(-1)).toBe(coldWarning(1, 'night'));
  });

  it('says only the most urgent warning when warmth is already low, and nothing while not cooling', () => {
    const bus = createBus();
    const toasts: string[] = [];
    bus.on('toast', (e) => toasts.push(e.text));
    const watch = new ColdWatch(bus);
    watch.update(5, null);
    expect(toasts).toEqual([]);
    watch.update(5, 'frost');
    expect(toasts).toEqual([coldWarning(1, 'frost')]);
    watch.update(4, 'frost');
    expect(toasts).toHaveLength(1);
  });
});

describe('survivalNote', () => {
  it('says the most urgent thing: low warmth and its cause, then hunger, then plain cooling', () => {
    expect(survivalNote(null, 100, 20)).toBeNull();
    expect(survivalNote('night', 90, 20)).toEqual({ text: COLD_TAG.night, tone: 'cold' });
    expect(survivalNote('night', 90, 5)).toEqual({ text: 'Hungry: eat something', tone: 'warn' });
    expect(survivalNote('rain', 40, 5)).toEqual({ text: COLD_TAG.rain, tone: 'cold' });
    expect(survivalNote('rain', 10, 0)).toEqual({ text: COLD_TAG.rain, tone: 'bad' });
    expect(survivalNote(null, 10, 0)).toEqual({ text: 'Starving: eat now', tone: 'bad' });
  });
});

describe('Survival: the cold names its cause (gc-2)', () => {
  it('picks the biggest drain: night, rain, snow, frostfell or cold water', () => {
    const night = rig();
    night.run(1);
    expect(night.survival.coldCause).toBe('night');

    const rain = rig();
    rain.soak('rain');
    rain.run(1);
    expect(rain.survival.coldCause).toBe('rain');

    const snow = rig(0.3);
    snow.soak('snow');
    snow.run(1);
    expect(snow.survival.coldCause).toBe('snow');

    const frost = rig(NIGHT, 2, 'frostfell');
    frost.run(1);
    expect(frost.survival.coldCause).toBe('frost');

    const swim = rig();
    swim.player.inWater = true;
    swim.run(1);
    expect(swim.survival.coldCause).toBe('water');

    const day = rig(0.3);
    day.player.warmth = 50;
    day.run(1);
    expect(day.survival.coldCause).toBeNull();
  });

  it('warns with the cause as warmth falls, and records it at a cold death', () => {
    const r = rig();
    r.soak('rain');
    r.player.warmth = 55;
    r.run(10);
    expect(r.toasts).toEqual([coldWarning(0, 'rain')]);
    r.run(60);
    expect(r.toasts).toEqual([coldWarning(0, 'rain'), coldWarning(1, 'rain')]);
    expect(r.toasts[1]).toContain(COLD_REMEDY.rain);
    r.player.warmth = 0;
    r.run(3 * 21);
    expect(r.player.dead).toBe(true);
    expect(r.player.deathCause).toBe('cold');
    expect(r.player.coldCause).toBe('rain');
    const saved = JSON.parse(JSON.stringify(r.player.toJSON())) as ReturnType<PlayerState['toJSON']>;
    const other = rig();
    other.player.load(saved);
    expect(other.player.coldCause).toBe('rain');
  });
});

describe('Survival: the first night (gc-1)', () => {
  /** Sunset to the first dawn, standing in the open with no fire. */
  const night = (day: number) => {
    const r = rig(SUNSET_AT, day);
    r.run((1 - SUNSET_AT) * DAY_LENGTH_S - 1);
    return r;
  };

  it('keeps a margin on day 1: a clear night never takes warmth below the floor', () => {
    const first = night(1);
    expect(first.player.warmth).toBeCloseTo(FIRST_DAY_WARMTH_FLOOR, 5);
    expect(first.player.health).toBe(MAX_HEALTH);
    expect(first.survival.trend).toBe('steady');
    expect(first.toasts).toEqual([coldWarning(0, 'night'), coldWarning(1, 'night')]);
  });

  it('drains the full night from the second day on', () => {
    const later = night(2);
    expect(later.player.warmth).toBeCloseTo(Math.max(0, 100 - WARMTH_DRAIN_NIGHT * ((1 - SUNSET_AT) * DAY_LENGTH_S - 1)), 0);
    expect(later.player.warmth).toBeLessThan(FIRST_DAY_WARMTH_FLOOR);
  });

  it('does not catch a player in cold water on day 1', () => {
    const r = rig(NIGHT, 1);
    r.player.inWater = true;
    r.player.warmth = 5;
    r.run(10);
    expect(r.player.warmth).toBe(0);
  });
});

describe('Respawn food (gc-9)', () => {
  it('comes back with enough food to heal once warm, without eating first', () => {
    expect(RESPAWN_MIN_FOOD).toBeGreaterThan(REGEN_MIN_FOOD);
    const r = rig(0.3);
    r.player.food = 0;
    r.player.damage(99, 'hunger');
    r.survival.respawn();
    expect(r.player.health).toBe(MAX_HEALTH / 2);
    expect(r.player.food).toBe(RESPAWN_MIN_FOOD);
    r.run(60);
    expect(r.player.health).toBeGreaterThan(MAX_HEALTH / 2);
    expect(r.player.food).toBeGreaterThanOrEqual(REGEN_MIN_FOOD - 2);
  });
});
