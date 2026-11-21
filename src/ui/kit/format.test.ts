import { describe, expect, it } from 'vitest';
import {
  HEAT_STOPS,
  formatCount,
  formatDuration,
  formatJoules,
  formatPercent,
  formatTemp,
  formatWatts,
  heatColor,
  heatGradient,
  heatRgb,
  heatTextColor,
  hueFromKey,
  itemInitials,
  luminance,
  rgbToHex,
  splitUnit,
  titleFromKey,
} from './format';

const parse = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

describe('heat ramp', () => {
  it('returns the exact stop colours', () => {
    for (const stop of HEAT_STOPS) expect(heatColor(stop.tempC)).toBe(rgbToHex(stop.rgb));
  });

  it('clamps below ambient and above the hottest stop', () => {
    expect(heatColor(-50)).toBe(heatColor(20));
    expect(heatColor(9999)).toBe(heatColor(5000));
    expect(heatColor(Number.NaN)).toBe(heatColor(20));
  });

  it('interpolates between stops', () => {
    const [r, g, b] = heatRgb(650);
    expect(r).toBeCloseTo((154 + 242) / 2, 5);
    expect(g).toBeCloseTo((42 + 107) / 2, 5);
    expect(b).toBeCloseTo((20 + 29) / 2, 5);
  });

  it('reads dull red -> orange -> yellow -> white -> blue-white', () => {
    const red = parse(heatColor(500));
    expect(red[0]).toBeGreaterThan(red[1] * 2);
    const orange = parse(heatColor(800));
    expect(orange[0]).toBeGreaterThan(orange[1]);
    expect(orange[1]).toBeGreaterThan(orange[2]);
    const yellow = parse(heatColor(1100));
    expect(yellow[1]).toBeGreaterThan(180);
    expect(yellow[2]).toBeLessThan(100);
    const white = parse(heatColor(1500));
    expect(Math.min(...white)).toBeGreaterThan(215);
    const blue = parse(heatColor(1900));
    expect(blue[2]).toBeGreaterThan(blue[0]);
  });

  it('gets brighter monotonically up to white heat', () => {
    let previous = -1;
    for (let t = 200; t <= 1500; t += 50) {
      const l = luminance(heatRgb(t));
      expect(l).toBeGreaterThan(previous);
      previous = l;
    }
  });

  it('always emits a valid hex colour', () => {
    for (let t = 0; t <= 5200; t += 37) expect(heatColor(t)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('lifts dark ramp colours until they are readable as text', () => {
    for (let t = 0; t <= 5000; t += 100) {
      expect(luminance(parse(heatTextColor(t)))).toBeGreaterThanOrEqual(0.2);
    }
    // Colours that are already bright are left alone.
    expect(heatTextColor(1100)).toBe(heatColor(1100));
    expect(heatTextColor(500)).not.toBe(heatColor(500));
  });

  it('builds a gradient covering exactly the requested range', () => {
    const g = heatGradient(20, 800);
    expect(g.startsWith('linear-gradient(to top, ')).toBe(true);
    expect(g).toContain(`${heatColor(20)} 0.0%`);
    expect(g).toContain(`${heatColor(800)} 100.0%`);
    expect(g).toContain(`${heatColor(500)} ${(((500 - 20) / 780) * 100).toFixed(1)}%`);
    expect(g).not.toContain(heatColor(1100));
    expect(heatGradient(300, 300)).toBe(heatColor(300));
  });
});

describe('formatWatts', () => {
  it('uses W below a kilowatt', () => {
    expect(formatWatts(0)).toBe('0 W');
    expect(formatWatts(2.5)).toBe('2.5 W');
    expect(formatWatts(37.5)).toBe('38 W');
    expect(formatWatts(300)).toBe('300 W');
    expect(formatWatts(999)).toBe('999 W');
  });

  it('uses kW and MW with three significant digits', () => {
    expect(formatWatts(1000)).toBe('1 kW');
    expect(formatWatts(1500)).toBe('1.5 kW');
    expect(formatWatts(1234)).toBe('1.23 kW');
    expect(formatWatts(12_500)).toBe('12.5 kW');
    expect(formatWatts(120_000)).toBe('120 kW');
    expect(formatWatts(1_000_000)).toBe('1 MW');
    expect(formatWatts(2_340_000)).toBe('2.34 MW');
    expect(formatWatts(4_500_000_000)).toBe('4500 MW');
  });

  it('promotes the unit when rounding reaches 1000', () => {
    expect(formatWatts(999.6)).toBe('1 kW');
    expect(formatWatts(999_960)).toBe('1 MW');
  });

  it('keeps trailing zeros on request', () => {
    expect(formatWatts(1500, { fixed: true })).toBe('1.50 kW');
    expect(formatWatts(12_000, { fixed: true })).toBe('12.0 kW');
    expect(formatWatts(5, { fixed: true })).toBe('5.0 W');
  });

  it('handles negative and non-finite input', () => {
    expect(formatWatts(-2500)).toBe('-2.5 kW');
    expect(formatWatts(-0.01)).toBe('0 W');
    expect(formatWatts(Number.NaN)).toBe('-- W');
    expect(formatWatts(Infinity)).toBe('∞ W');
  });
});

describe('formatJoules', () => {
  it('uses J, kJ and MJ', () => {
    expect(formatJoules(400)).toBe('400 J');
    expect(formatJoules(30_000)).toBe('30 kJ');
    expect(formatJoules(1_200_000)).toBe('1.2 MJ');
    expect(formatJoules(72_000_000)).toBe('72 MJ');
    expect(formatJoules(2_000_000, { fixed: true })).toBe('2.00 MJ');
  });
});

describe('formatTemp', () => {
  it('rounds to whole degrees', () => {
    expect(formatTemp(20)).toBe('20 °C');
    expect(formatTemp(1239.6)).toBe('1240 °C');
    expect(formatTemp(Number.NaN)).toBe('-- °C');
  });
});

describe('formatDuration', () => {
  it('covers seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(3.44)).toBe('3.4 s');
    expect(formatDuration(8)).toBe('8 s');
    expect(formatDuration(45.2)).toBe('45 s');
    expect(formatDuration(59.6)).toBe('1 m 00 s');
    expect(formatDuration(125)).toBe('2 m 05 s');
    expect(formatDuration(3720)).toBe('1 h 02 m');
  });

  it('handles odd input', () => {
    expect(formatDuration(-4)).toBe('0 s');
    expect(formatDuration(Infinity)).toBe('∞');
    expect(formatDuration(Number.NaN)).toBe('-- s');
  });
});

describe('formatCount', () => {
  it('abbreviates large counts without overstating', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(64)).toBe('64');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1000)).toBe('1k');
    expect(formatCount(1999)).toBe('1.9k');
    expect(formatCount(12_345)).toBe('12k');
    expect(formatCount(3_450_000)).toBe('3.4M');
    expect(formatCount(25_000_000)).toBe('25M');
    expect(formatCount(-3)).toBe('0');
    expect(formatCount(2.9)).toBe('2');
    expect(formatCount(Number.NaN)).toBe('--');
  });
});

describe('small helpers', () => {
  it('formats a fraction as percent', () => {
    expect(formatPercent(0.637)).toBe('64%');
    expect(formatPercent(4)).toBe('100%');
    expect(formatPercent(-1)).toBe('0%');
  });

  it('splits a value from its unit', () => {
    expect(splitUnit('12.5 kW')).toEqual(['12.5', 'kW']);
    expect(splitUnit('2 m 05 s')).toEqual(['2 m 05', 's']);
    expect(splitUnit('42')).toEqual(['42', '']);
  });

  it('derives names and initials from item keys', () => {
    expect(titleFromKey('copper_ingot')).toBe('Copper Ingot');
    expect(titleFromKey('glass')).toBe('Glass');
    expect(itemInitials('copper_ingot')).toBe('CI');
    expect(itemInitials('glass')).toBe('GL');
    expect(itemInitials('steel_pickaxe')).toBe('SP');
    expect(itemInitials('')).toBe('?');
  });

  it('hashes keys to a stable hue', () => {
    expect(hueFromKey('coal')).toBe(hueFromKey('coal'));
    expect(hueFromKey('coal')).not.toBe(hueFromKey('coke'));
    for (const key of ['a', 'copper_ore', 'furnace_star']) {
      expect(hueFromKey(key)).toBeGreaterThanOrEqual(0);
      expect(hueFromKey(key)).toBeLessThan(360);
    }
  });
});
