import { describe, expect, it } from 'vitest';
import { easeToward } from './groundItems';

describe('easeToward (ground item smoothing)', () => {
  it('moves towards the target without overshooting, and stays put with no time', () => {
    let x = 0;
    for (let i = 0; i < 20; i++) {
      const next = easeToward(x, 1, 28, 1 / 60);
      expect(next).toBeGreaterThan(x);
      expect(next).toBeLessThanOrEqual(1);
      x = next;
    }
    expect(easeToward(0.3, 1, 28, 0)).toBe(0.3);
  });

  it('gives the same result for one long step as for many short ones (frame-rate independent)', () => {
    let a = 0;
    for (let i = 0; i < 10; i++) a = easeToward(a, 1, 28, 0.01);
    expect(a).toBeCloseTo(easeToward(0, 1, 28, 0.1), 6);
  });

  it('smooths a 20 Hz stepped fall into smaller frame-to-frame moves', () => {
    // Physics moves 0.3 every 50 ms; the eased position moves a fraction each 16 ms frame.
    let drawn = 5;
    let target = 5;
    const frames: number[] = [];
    for (let f = 0; f < 12; f++) {
      if (f % 3 === 0) target -= 0.3;
      const next = easeToward(drawn, target, 28, 1 / 60);
      frames.push(drawn - next);
      drawn = next;
    }
    expect(Math.max(...frames)).toBeLessThan(0.3);
  });
});
