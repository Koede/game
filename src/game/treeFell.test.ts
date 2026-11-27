import { describe, expect, it } from 'vitest';
import {
  CANOPY_LOG_BONUS,
  PIECE_BLOCKS,
  WAIT_S,
  advanceWait,
  axePower,
  canopyLevelsOf,
  cutPiece,
  fallDirection,
  impactDamage,
  inFallZone,
  pieceCount,
  pieceSizes,
  treeHealth,
  woodYield,
} from './treeFell';

describe('tree health and the axe', () => {
  it('a taller trunk takes more blows, and a better axe takes fewer', () => {
    expect(treeHealth(8)).toBeGreaterThan(treeHealth(3));
    expect(axePower(3)).toBeGreaterThan(axePower(1));
    const blows = (trunk: number, tier: number) => Math.ceil(treeHealth(trunk) / axePower(tier));
    expect(blows(8, 1)).toBeGreaterThan(blows(8, 3));
    expect(blows(3, 1)).toBeLessThan(blows(8, 1));
  });
});

describe('fall direction from the last blow', () => {
  it('points from the player through the trunk, at any angle', () => {
    const d = fallDirection(0, 0, 3, 4, 0);
    expect(d.dx).toBeCloseTo(0.6, 6);
    expect(d.dz).toBeCloseTo(0.8, 6);
    expect(Math.hypot(d.dx, d.dz)).toBeCloseTo(1, 6);
  });

  it('uses the facing when the player stands on the trunk column', () => {
    const north = fallDirection(5, 5, 5, 5, 0);
    expect(north.dx).toBeCloseTo(0, 6);
    expect(north.dz).toBeCloseTo(-1, 6);
  });
});

describe('the strike zone and the wait rule', () => {
  it('covers the fall line from the stump out to the reach, and nothing far to the side', () => {
    expect(inFallZone(4, 0, 0, 0, 1, 0, 6)).toBe(true);
    expect(inFallZone(4, 3, 0, 0, 1, 0, 6)).toBe(false);
    expect(inFallZone(-3, 0, 0, 0, 1, 0, 6)).toBe(false);
    expect(inFallZone(8, 0, 0, 0, 1, 0, 6)).toBe(false);
  });

  it('holds the fall clock while someone stands in the zone in its first 0.4 s', () => {
    expect(advanceWait(0, 0.1, true)).toBe(0);
    expect(advanceWait(0.3, 0.1, true)).toBe(0.3);
  });

  it('lets the clock run once the zone is clear, and never waits after 0.4 s', () => {
    expect(advanceWait(0.2, 0.1, false)).toBeCloseTo(0.3, 9);
    expect(advanceWait(WAIT_S, 0.1, true)).toBeCloseTo(WAIT_S + 0.1, 9);
  });
});

describe('impact damage', () => {
  it('scales with the tree and with the speed at impact, at least 1', () => {
    expect(impactDamage(3, 0)).toBeGreaterThanOrEqual(1);
    expect(impactDamage(10, 10)).toBeGreaterThan(impactDamage(3, 10));
    expect(impactDamage(6, 20)).toBeGreaterThan(impactDamage(6, 2));
    expect(impactDamage(40, 60)).toBeLessThanOrEqual(12);
  });
});

describe('wood yield', () => {
  it('is the trunk length plus a bonus per canopy level', () => {
    expect(woodYield(6, 0)).toBe(6);
    expect(woodYield(6, 4)).toBe(6 + 4 * CANOPY_LOG_BONUS);
    expect(woodYield(6, 4)).toBeGreaterThan(6);
  });

  it('counts canopy levels as distinct leaf heights', () => {
    expect(canopyLevelsOf([7, 7, 8, 9, 9])).toBe(3);
    expect(canopyLevelsOf([])).toBe(0);
  });
});

describe('cutting a fallen log into pieces', () => {
  it('counts one piece per PIECE_BLOCKS of trunk, the remainder being the last', () => {
    expect(pieceCount(0)).toBe(0);
    expect(pieceCount(1)).toBe(1);
    expect(pieceCount(PIECE_BLOCKS)).toBe(1);
    expect(pieceCount(PIECE_BLOCKS + 1)).toBe(2);
    expect(pieceCount(9)).toBe(3);
    expect(pieceCount(10)).toBe(4);
  });

  it('cuts a piece off the tip and leaves the rest', () => {
    expect(cutPiece(8)).toEqual({ take: PIECE_BLOCKS, remaining: 8 - PIECE_BLOCKS });
    expect(cutPiece(2)).toEqual({ take: 2, remaining: 0 });
    expect(cutPiece(0)).toEqual({ take: 0, remaining: 0 });
  });

  it('the piece sizes always sum to the length, and agree with the count', () => {
    for (const len of [1, 3, 4, 7, 9, 12]) {
      const sizes = pieceSizes(len);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(len);
      expect(sizes.length).toBe(pieceCount(len));
      expect(sizes[sizes.length - 1]).toBeGreaterThan(0);
    }
  });
});
