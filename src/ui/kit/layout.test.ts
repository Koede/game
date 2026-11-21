import { describe, expect, it } from 'vitest';
import { declutter, niceStep, placeTooltip, ticksBetween } from './layout';

describe('declutter', () => {
  it('leaves well-spaced positions alone', () => {
    expect(declutter([10, 50, 90], 12, 0, 100)).toEqual([10, 50, 90]);
  });

  it('pushes crowded labels apart, keeping order', () => {
    expect(declutter([40, 42, 44], 12, 0, 100)).toEqual([40, 52, 64]);
  });

  it('pushes back down when the top would overflow', () => {
    const out = declutter([90, 95, 98], 12, 0, 100);
    expect(out).toEqual([76, 88, 100]);
  });

  it('returns positions in the input order, not sorted order', () => {
    const out = declutter([44, 40, 42], 12, 0, 100);
    expect(out).toEqual([64, 40, 52]);
  });

  it('clamps into the range', () => {
    expect(declutter([-20, 140], 12, 0, 100)).toEqual([0, 100]);
  });

  it('handles empty and single inputs', () => {
    expect(declutter([], 12, 0, 100)).toEqual([]);
    expect(declutter([55], 12, 0, 100)).toEqual([55]);
  });
});

describe('placeTooltip', () => {
  const viewport = { width: 390, height: 844 };
  const tip = { width: 200, height: 60 };

  it('centres above the anchor when there is room', () => {
    const p = placeTooltip({ left: 150, top: 400, width: 48, height: 48 }, tip, viewport);
    expect(p).toEqual({ left: 74, top: 332, side: 'top' });
  });

  it('flips below when the anchor is near the top', () => {
    const p = placeTooltip({ left: 150, top: 20, width: 48, height: 48 }, tip, viewport);
    expect(p.side).toBe('bottom');
    expect(p.top).toBe(76);
  });

  it('never leaves the viewport horizontally', () => {
    const left = placeTooltip({ left: 0, top: 400, width: 40, height: 40 }, tip, viewport);
    expect(left.left).toBe(8);
    const right = placeTooltip({ left: 360, top: 400, width: 30, height: 40 }, tip, viewport);
    expect(right.left).toBe(390 - 8 - 200);
  });

  it('stays inside even when the tip is larger than the space on both sides', () => {
    const p = placeTooltip({ left: 100, top: 30, width: 40, height: 40 }, { width: 500, height: 300 }, { width: 390, height: 200 });
    expect(p.left).toBe(8);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });
});

describe('scale ticks', () => {
  it('picks 1-2-5 steps', () => {
    expect(niceStep(780, 5)).toBe(200);
    expect(niceStep(1480, 6)).toBe(500);
    expect(niceStep(3180, 6)).toBe(1000);
    expect(niceStep(90, 10)).toBe(10);
    expect(niceStep(0, 5)).toBe(1);
  });

  it('lists the multiples inside a range', () => {
    expect(ticksBetween(20, 800, 200)).toEqual([200, 400, 600, 800]);
    expect(ticksBetween(0, 1500, 500)).toEqual([0, 500, 1000, 1500]);
    expect(ticksBetween(0, 10, 0)).toEqual([]);
  });
});
