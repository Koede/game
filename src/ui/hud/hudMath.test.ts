import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_S, SUNSET_AT } from '../../core/constants';
import { FEED_LINGER_MS, FEED_MAX, GainFeed, dayInfo, formatCountdown, frostLevel, relativeBearing, summarizeGrid, untilLabel, wrapAngle } from './hudMath';

const net = (o: Partial<Parameters<typeof summarizeGrid>[0][number]>) => ({
  generationW: 0, demandW: 0, deliveredW: 0, storedJ: 0, capacityJ: 0, satisfaction: 1, overloaded: false, ...o,
});

describe('relativeBearing', () => {
  it('is 0 straight ahead, positive to the right, PI behind', () => {
    // Facing north (yaw 0 looks at -Z).
    expect(relativeBearing(0, 0, 0, 0, -10)).toBeCloseTo(0);
    expect(relativeBearing(0, 0, 0, 10, 0)).toBeCloseTo(Math.PI / 2);
    expect(relativeBearing(0, 0, 0, -10, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(relativeBearing(0, 0, 0, 0, 10))).toBeCloseTo(Math.PI);
  });

  it('follows the yaw convention (positive yaw turns left)', () => {
    // Facing west (yaw +PI/2): north is on the right, south on the left.
    expect(relativeBearing(0, 0, Math.PI / 2, 0, -10)).toBeCloseTo(Math.PI / 2);
    expect(relativeBearing(0, 0, Math.PI / 2, 0, 10)).toBeCloseTo(-Math.PI / 2);
    expect(relativeBearing(5, 5, Math.PI / 2, -5, 5)).toBeCloseTo(0);
  });

  it('wraps angles into (-PI, PI]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-0.5)).toBeCloseTo(-0.5);
  });
});

describe('summarizeGrid', () => {
  it('ignores empty networks (a lone tier-1 furnace forms one)', () => {
    expect(summarizeGrid([net({})]).active).toBe(false);
    expect(summarizeGrid([]).state).toBe('idle');
  });

  it('sums networks and reports the worst state', () => {
    const ok = summarizeGrid([net({ generationW: 300, demandW: 10, deliveredW: 10 }), net({ capacityJ: 2e6, storedJ: 5e5 })]);
    expect(ok).toMatchObject({ active: true, generationW: 300, demandW: 10, storedJ: 5e5, capacityJ: 2e6, state: 'ok', satisfaction: 1 });
    const short = summarizeGrid([net({ generationW: 300, demandW: 1000, deliveredW: 300, satisfaction: 0.3 })]);
    expect(short.state).toBe('short');
    expect(short.satisfaction).toBeCloseTo(0.3);
    const over = summarizeGrid([net({ generationW: 300, demandW: 1000, satisfaction: 0.3 }), net({ generationW: 20000, demandW: 15000, overloaded: true, satisfaction: 0.6 })]);
    expect(over.state).toBe('overload');
  });
});

describe('dayInfo', () => {
  it('counts down to sunset by day and to sunrise at night', () => {
    const morning = dayInfo(0.05);
    expect(morning.isNight).toBe(false);
    expect(morning.untilS).toBeCloseTo((SUNSET_AT - 0.05) * DAY_LENGTH_S);
    expect(morning.text).toBe(`Night in ${Math.ceil(((SUNSET_AT - 0.05) * DAY_LENGTH_S) / 60)} m`);
    const night = dayInfo(0.95);
    expect(night.isNight).toBe(true);
    expect(night.text).toBe('Dawn in 45 s');
  });

  it('moves the dial hand continuously through the whole day', () => {
    expect(dayInfo(0).dialAngle).toBeCloseTo(0);
    expect(dayInfo(SUNSET_AT - 1e-9).dialAngle).toBeCloseTo(Math.PI);
    expect(dayInfo(SUNSET_AT).dialAngle).toBeCloseTo(Math.PI);
    expect(dayInfo(0.999999).dialAngle).toBeCloseTo(2 * Math.PI, 4);
  });

  it('formats countdowns rounding up', () => {
    expect(formatCountdown(0.2)).toBe('1 s');
    expect(formatCountdown(59.5)).toBe('1 m');
    expect(formatCountdown(45)).toBe('45 s');
    expect(formatCountdown(61)).toBe('2 m');
    expect(untilLabel(false, 540)).toBe('Night 9 m');
    expect(untilLabel(true, 45)).toBe('Dawn 45 s');
    expect(formatCountdown(-4)).toBe('0 s');
  });
});

describe('frostLevel', () => {
  it('starts below 30 warmth and is full at 0', () => {
    expect(frostLevel(80)).toBe(0);
    expect(frostLevel(30)).toBe(0);
    expect(frostLevel(15)).toBeCloseTo(0.5);
    expect(frostLevel(0)).toBe(1);
  });
});

describe('GainFeed', () => {
  it('adds repeated gains of an item into one line and moves it last', () => {
    const feed = new GainFeed();
    feed.push('oak_log', 1, 0);
    feed.push('flint', 1, 10);
    feed.push('oak_log', 2, 20);
    expect(feed.entries.map((e) => [e.item, e.count])).toEqual([['flint', 1], ['oak_log', 3]]);
    expect(feed.entries[1].rev).toBe(1);
  });

  it('keeps at most FEED_MAX lines and expires old ones', () => {
    const feed = new GainFeed();
    for (let i = 0; i < FEED_MAX + 2; i++) feed.push(`item_${i}`, 1, i);
    expect(feed.entries).toHaveLength(FEED_MAX);
    expect(feed.entries[0].item).toBe('item_2');
    expect(feed.expire(FEED_LINGER_MS + 3)).toBe(true);
    expect(feed.entries.map((e) => e.item)).toEqual(['item_3', 'item_4', 'item_5', 'item_6']);
    expect(feed.expire(FEED_LINGER_MS + 3)).toBe(false);
  });
});
