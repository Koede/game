import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { clampFrameDt, FixedStep, MAX_CATCH_UP_TICKS, MAX_FRAME_DT } from './loop';

describe('frame timing', () => {
  it('clamps frame deltas to 0..0.1 s', () => {
    expect(clampFrameDt(0.016)).toBe(0.016);
    expect(clampFrameDt(3)).toBe(MAX_FRAME_DT);
    expect(clampFrameDt(-1)).toBe(0);
    expect(clampFrameDt(Number.NaN)).toBe(0);
    expect(clampFrameDt(Infinity)).toBe(0);
  });

  it('runs 20 ticks per simulated second at any frame rate', () => {
    for (const fps of [144, 60, 30, 24, 13]) {
      const step = new FixedStep();
      let ticks = 0;
      for (let i = 0; i < fps * 10; i++) ticks += step.advance(1 / fps);
      expect(Math.abs(ticks - 200)).toBeLessThanOrEqual(1);
    }
  });

  it('carries the remainder between frames', () => {
    const step = new FixedStep();
    expect(step.advance(DT * 0.6)).toBe(0);
    expect(step.advance(DT * 0.6)).toBe(1);
    expect(step.alpha).toBeCloseTo(0.2, 6);
  });

  it('never runs more than five catch-up ticks and drops the backlog', () => {
    const step = new FixedStep();
    expect(step.advance(1)).toBe(MAX_CATCH_UP_TICKS);
    expect(step.advance(0)).toBe(0);
    expect(step.advance(MAX_FRAME_DT)).toBe(2);
  });
});
