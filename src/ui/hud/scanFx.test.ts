import { describe, expect, it } from 'vitest';
import { moteAt, orbitAt } from './scanFx';

describe('scan fx maths', () => {
  it('glyphs spiral inward and a turn and a half as the scan fills', () => {
    const a = orbitAt(0, 3, 0, 0);
    const b = orbitAt(0, 3, 1, 0);
    expect(a.r).toBeGreaterThan(b.r);
    expect(b.a - a.a).toBeCloseTo(Math.PI * 3, 5);
    expect(orbitAt(1, 3, 0, 0).a - a.a).toBeCloseTo((Math.PI * 2) / 3, 5);
  });

  it('motes fade in and out and drift away from the ring', () => {
    expect(moteAt(2, 0).o).toBeCloseTo(0, 5);
    expect(moteAt(2, 1).o).toBeCloseTo(0, 5);
    expect(moteAt(2, 0.5).o).toBeCloseTo(1, 5);
    const d = (u: number) => Math.hypot(moteAt(2, u).x, moteAt(2, u).y);
    expect(d(0.9)).toBeGreaterThan(d(0.1));
  });
});
