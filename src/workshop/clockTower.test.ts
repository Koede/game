import { describe, expect, it } from 'vitest';
import { SUNSET_AT } from '../core/constants';
import { TownClock } from '../npcs/townClock';
import { CLOCK_TIMER_PRESETS, HOUR_S, STRIKE_S, TOWER_RANGE, TOWER_SCHEDULES, clockTimerOn, strikeCount, striking, townTod } from './clockTower';
import { TIMER_PRESETS } from './signals';
import { setup } from './parts.test';

const HOUR = 1 / 24;

describe('clock tower: the pure clock', () => {
  it('strikes for the first seconds of every hour and counts the hours on a twelve-hour dial', () => {
    expect(striking(0)).toBe(true); // sunrise is six o'clock
    expect(striking(((STRIKE_S - 0.5) / HOUR_S) * HOUR)).toBe(true);
    expect(striking(((STRIKE_S + 0.5) / HOUR_S) * HOUR)).toBe(false);
    expect(striking(3 * HOUR + 0.0001)).toBe(true);
    expect(striking(3.5 * HOUR)).toBe(false);
    expect(strikeCount(0)).toBe(6);
    expect(strikeCount(6 * HOUR)).toBe(12);
    expect(strikeCount(7 * HOUR)).toBe(1);
  });

  it('schedules shift the town day: early risers an hour sooner, night owls two hours later', () => {
    expect(townTod(0.3, 0)).toBeCloseTo(0.3);
    expect(townTod(0.3, 1)).toBeCloseTo(0.3 + HOUR);
    expect(townTod(0.01, 2)).toBeCloseTo(1 + 0.01 - 2 * HOUR); // wraps back into the night before
    expect(townTod(0.3, 99)).toBeCloseTo(0.3); // an unknown schedule is the sun's
    expect(TOWER_SCHEDULES.map((s) => s.shift)).toEqual([0, 1, -2]);
  });

  it('clock timer settings read the sun', () => {
    expect(clockTimerOn('day', 0.3)).toBe(true);
    expect(clockTimerOn('day', SUNSET_AT + 0.01)).toBe(false);
    expect(clockTimerOn('night', SUNSET_AT + 0.01)).toBe(true);
    expect(clockTimerOn('dawn', 0.5 * HOUR)).toBe(true);
    expect(clockTimerOn('dawn', 2 * HOUR)).toBe(false);
    expect(clockTimerOn('hour', 5 * HOUR)).toBe(true);
  });
});

describe('clock tower: the block', () => {
  const at = (u: ReturnType<typeof setup>, tod: { v: number }) => {
    u.shop.timeOfDay = () => tod.v;
    return u;
  };

  it('lights wire while it strikes the hour and rings its bell once', () => {
    const tod = { v: 2 * HOUR + 0.0001 };
    const t = at(setup(), tod);
    const bells: number[] = [];
    t.bus.on('sfx', (e) => { if (e.name === 'tower_bell') bells.push(1); });
    t.put(0, 0, 0, 'clock_tower');
    t.put(1, 0, 0, 'signal_wire');
    t.put(2, 0, 0, 'signal_lamp');
    t.run(0.3);
    expect(t.shop.describe(2, 0, 0)).toContain('on');
    t.run(0.3);
    expect(bells.length).toBe(1);
    tod.v = 2.5 * HOUR;
    t.run(0.2);
    expect(t.shop.describe(2, 0, 0)).toContain('off');
    expect(t.shop.describe(0, 0, 0)).toMatch(/Clock Tower - 08:30, Sun hours/);
  });

  it('stands still with no sun to read', () => {
    const t = setup();
    t.put(0, 0, 0, 'clock_tower');
    t.put(1, 0, 0, 'signal_lamp');
    t.run(0.3);
    expect(t.shop.describe(1, 0, 0)).toContain('off');
    expect(t.shop.describe(0, 0, 0)).toContain('no sun to read');
  });

  it('a tap picks the town hours, which save', () => {
    const t = at(setup(), { v: 0.3 });
    t.put(0, 0, 0, 'clock_tower');
    t.run(0.1);
    t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.toasts.at(-1)).toContain('Early risers');
    expect(t.shop.signals.towers()).toEqual([{ x: 0, y: 0, z: 0, schedule: 1 }]);
    t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.toasts.at(-1)).toContain('Night owls');
    const snap = JSON.parse(JSON.stringify(t.shop.toJSON()));
    const u = setup();
    u.put(0, 0, 0, 'clock_tower');
    u.shop.load(snap);
    expect(u.shop.signals.towers()[0].schedule).toBe(2);
  });

  it('winds the timers near it: they gain clock settings, and sit idle away from a tower', () => {
    const tod = { v: 0.3 };
    const t = at(setup(), tod);
    t.put(0, 0, 0, 'signal_timer');
    t.put(1, 0, 0, 'signal_lamp');
    t.run(0.1);
    // No tower: the beats in seconds only, and they wrap.
    for (let i = 0; i < TIMER_PRESETS.length; i++) t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.shop.describe(0, 0, 0)).toContain('every 2 s');
    // A tower in range: past the beats come the clock settings.
    t.put(0, 0, TOWER_RANGE, 'clock_tower');
    t.run(0.1);
    for (let i = 0; i < TIMER_PRESETS.length + 1; i++) t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.shop.describe(0, 0, 0)).toContain(CLOCK_TIMER_PRESETS[1].name); // by day
    t.run(3);
    expect(t.shop.describe(1, 0, 0)).toContain('on');
    tod.v = SUNSET_AT + 0.05;
    t.run(0.2);
    expect(t.shop.describe(1, 0, 0)).toContain('off');
    // The setting saves; a timer loaded with no tower near says it is idle.
    const snap = JSON.parse(JSON.stringify(t.shop.toJSON())).sig.filter((r: unknown[]) => r[3] === 'signal_timer');
    const u = at(setup(), { v: 0.3 });
    u.put(0, 0, 0, 'signal_timer');
    u.shop.load({ ...JSON.parse(JSON.stringify(u.shop.toJSON())), sig: snap });
    u.run(0.2);
    expect(u.shop.describe(0, 0, 0)).toContain('idle: no clock tower');
  });
});

describe('the town clock (npcs/townClock.ts)', () => {
  it('takes the tower nearest the town within range and keeps its hours', () => {
    const c = new TownClock();
    c.refresh([{ x: 500, y: 0, z: 0, schedule: 1 }], [0, 0, 0]);
    expect(c.tower).toBeNull();
    expect(c.tod(0.3)).toBe(0.3);
    c.refresh([{ x: 40, y: 0, z: 0, schedule: 2 }, { x: 10, y: 0, z: 0, schedule: 1 }], [0, 0, 0]);
    expect(c.tower?.x).toBe(10);
    expect(c.tod(0.3)).toBeCloseTo(0.3 + HOUR);
    expect(c.scheduleName()).toBe('Early risers');
  });

  it('strikes when the town day turns, only for a player in earshot', () => {
    const c = new TownClock();
    c.refresh([{ x: 10, y: 0, z: 0, schedule: 0 }], [0, 0, 0]);
    expect(c.strike('day', 0.3, { x: 10, z: 0 })).toBeNull(); // the first tick only learns the phase
    expect(c.strike('day', 0.31, { x: 10, z: 0 })).toBeNull();
    expect(c.strike('evening', 0.6, { x: 10, z: 0 })).toMatch(/^The clock tower rings at \d\d:\d\d: work is done/);
    expect(c.strike('night', 0.65, { x: 900, z: 0 })).toBeNull();
  });
});
