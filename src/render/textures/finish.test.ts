import { describe, expect, it } from 'vitest';
import { AREA_PAINTERS } from './_generated/areas';
import { Canvas } from './canvas';
import { finished, outlineShare } from './finish';

const paint = (fn: (c: Canvas) => void, name = 'x'): Uint8ClampedArray => {
  const c = new Canvas(name);
  finished(name, fn)(c);
  return c.data;
};
const colours = (d: Uint8ClampedArray): number => new Set(Array.from({ length: 256 }, (_, i) => `${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]}`)).size;

describe('area art finish', () => {
  it('adds grain to a flat opaque tile but leaves alpha alone', () => {
    const d = paint((c) => c.each(() => [150, 120, 80]));
    expect(colours(d)).toBeGreaterThan(4);
    for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(255);
  });

  it('is deterministic per texture name', () => {
    expect(Array.from(paint((c) => c.each(() => [90, 90, 90]), 'a'))).toEqual(Array.from(paint((c) => c.each(() => [90, 90, 90]), 'a')));
  });

  it('eases a screaming colour toward grey but keeps its hue family', () => {
    const d = paint((c) => c.each(() => [255, 20, 20]));
    expect(d[1]).toBeGreaterThan(20);
    expect(d[0]).toBeGreaterThan(d[1]);
  });

  it('outlines an icon whose rim is not darker than its body, and keeps an existing outline', () => {
    const blob = (rim: number) => (c: Canvas) => {
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) c.set(x, y, [rim === 0 ? 200 : 40, rim === 0 ? 180 : 30, rim === 0 ? 120 : 40].map((v, i) => (x === 4 || x === 11 || y === 4 || y === 11 ? v : [200, 180, 120][i])) as [number, number, number]);
    };
    expect(outlineShare(paint(blob(0)))).toBeGreaterThan(0.8);
    const before = new Canvas('o');
    blob(1)(before);
    expect(Array.from(paint(blob(1), 'o'))).toEqual(Array.from(before.data));
  });

  it('skips the outline for glass and chalk marks', () => {
    const glass = (c: Canvas) => c.rect(4, 4, 8, 8, [200, 220, 230]);
    const raw = new Canvas('glassware_x');
    glass(raw);
    expect(Array.from(paint(glass, 'glassware_x'))).toEqual(Array.from(raw.data));
  });

  it('every area painter still paints something', () => {
    for (const set of AREA_PAINTERS) for (const [name, fn] of Object.entries(set)) expect(paint(fn, name).some((v, i) => i % 4 === 3 && v > 0), name).toBe(true);
  });
});
