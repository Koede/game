import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON } from '../sim/seasons';
import { leafFall, seasonTints, yearPhase } from './seasonTint';

const mid = (season: number): number => 1 + season * DAYS_PER_SEASON + DAYS_PER_SEASON / 2;

describe('season tints', () => {
  it('summer is the unchanged baseline look', () => {
    const t = seasonTints(mid(1));
    expect(t.leaf.a).toBeCloseTo(0, 5);
    expect(t.grass.a).toBeCloseTo(0, 5);
  });

  it('autumn leaves turn orange and winter leaves dull', () => {
    const autumn = seasonTints(mid(2));
    expect(autumn.leaf.a).toBeGreaterThan(0.6);
    expect(autumn.leaf.r).toBeGreaterThan(autumn.leaf.g);
    expect(autumn.leaf.g).toBeGreaterThan(autumn.leaf.b);
    const winter = seasonTints(mid(3));
    expect(winter.grass.b).toBeGreaterThan(winter.grass.r);
  });

  it('eases between seasons and wraps from winter back to spring without a jump', () => {
    let prev = seasonTints(1).leaf;
    let worst = 0;
    for (let d = 1; d < 1 + DAYS_PER_SEASON * 8; d += 0.05) {
      const t = seasonTints(d).leaf;
      worst = Math.max(worst, Math.abs(t.a - prev.a), Math.abs(t.r - prev.r), Math.abs(t.g - prev.g));
      prev = t;
    }
    expect(worst).toBeLessThan(0.08);
    expect(yearPhase(1 + DAYS_PER_SEASON * 4)).toBeCloseTo(0, 5);
  });

  it('leaves fall through autumn and stop by mid winter', () => {
    expect(leafFall(mid(0))).toBe(0);
    expect(leafFall(mid(1))).toBe(0);
    expect(leafFall(mid(2))).toBe(1);
    expect(leafFall(mid(3))).toBe(0);
  });
});
