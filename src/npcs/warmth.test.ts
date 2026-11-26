import { describe, expect, it } from 'vitest';
import { SEEK_BELOW_C, warmerSpot, warmthDelta, warmthReason } from './warmth';

const spots = { door: [1, 1, 1], hearth: [5, 1, 5], loft: [9, 1, 9] } as const;
const temps = (m: Record<string, number>) => (x: number, y: number, z: number) => m[`${x},${y},${z}`] ?? -5;

describe('warmerSpot', () => {
  it('stays put when the routine spot is already warm enough', () => {
    const at = temps({ '1,1,1': SEEK_BELOW_C, '5,1,5': 30 });
    expect(warmerSpot(spots.door, [spots.hearth], at)).toBe(spots.door);
  });
  it('takes the warmest clearly warmer spot when cold', () => {
    const at = temps({ '1,1,1': 0, '5,1,5': 22, '9,1,9': 12 });
    expect(warmerSpot(spots.door, [spots.loft, spots.hearth], at)).toBe(spots.hearth);
  });
  it('does not move for a marginal gain, or when nothing is warmer', () => {
    expect(warmerSpot(spots.door, [spots.hearth], temps({ '1,1,1': 2, '5,1,5': 4 }))).toBe(spots.door);
    expect(warmerSpot(spots.door, [spots.hearth], temps({ '1,1,1': 2 }))).toBe(spots.door);
  });
});

describe('warmthDelta', () => {
  it('a warm room pleases on every difficulty, a cold one only grates on hard', () => {
    expect(warmthDelta(20, false)).toBeGreaterThan(0);
    expect(warmthDelta(20, true)).toBeGreaterThan(0);
    expect(warmthDelta(-10, false)).toBe(0);
    expect(warmthDelta(-10, true)).toBeLessThan(0);
    expect(warmthDelta(10, true)).toBe(0);
  });
  it('stays within [-0.3, 0.3] and words itself', () => {
    expect(warmthDelta(100, true)).toBeLessThanOrEqual(0.3);
    expect(warmthDelta(-100, true)).toBeGreaterThanOrEqual(-0.3);
    expect(warmthReason(20, true)).toBe('likes a warm room');
    expect(warmthReason(-10, true)).toBe('dislikes the cold');
    expect(warmthReason(10, true)).toBeNull();
  });
});
