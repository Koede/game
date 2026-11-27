import { describe, expect, it } from 'vitest';
import { surfaceDip } from '../liquids/liquidBoxes';
import { CRUCIBLE_RIM_LIFT, crucibleSurface } from './magicRenderer';

describe('the crucible surface stays at the rim in a boil', () => {
  const top = 10 + 1; // a crucible on the ground floor of block 10

  it('the level sits just above the block top and no higher', () => {
    expect(crucibleSurface(top).level).toBeCloseTo(top + CRUCIBLE_RIM_LIFT, 9);
    expect(CRUCIBLE_RIM_LIFT).toBeLessThanOrEqual(0.005);
  });

  for (const boil of [0, 0.35, 0.6, 0.8, 1]) {
    it(`boil ${boil}: the highest the surface gets is the level, and the slosh stays inside the body`, () => {
      const { bottom, level } = crucibleSurface(top);
      // The shader only dips below the level: its highest point is the level itself.
      const deepest = level - surfaceDip(boil);
      expect(deepest).toBeGreaterThanOrEqual(bottom);
      expect(level).toBeLessThanOrEqual(top + 0.005);
      expect(level - bottom).toBeGreaterThan(surfaceDip(boil));
    });
  }
});
