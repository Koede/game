import { describe, expect, it } from 'vitest';
import { Facing } from '../core/types';
import { BED_MODEL } from './bedModel';
import { boxCorners, miniBounds, MINI_MODELS, turnPoint } from './miniModel';

describe('the wool bedding model', () => {
  it('is registered under the existing block key, so the block id and saves do not change', () => {
    expect(MINI_MODELS.wool_bedding).toBe(BED_MODEL);
  });

  it('keeps every box inside the cell (a little overhang allowed for the rotated parts)', () => {
    const c = new Array<number>(24);
    for (const b of BED_MODEL.boxes) {
      boxCorners(b, c);
      for (let i = 0; i < 8; i++) for (let a = 0; a < 3; a++) {
        expect(c[i * 3 + a]).toBeGreaterThanOrEqual(-1);
        expect(c[i * 3 + a]).toBeLessThanOrEqual(17);
      }
    }
  });

  it('fills the cell from the floor to the headboard top, as a bed should', () => {
    const [x0, y0, z0, x1, y1, z1] = miniBounds(BED_MODEL);
    expect(y0).toBe(0);
    expect(y1).toBeGreaterThan(0.6);
    expect(y1).toBeLessThanOrEqual(1);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(1);
    expect(z0).toBeGreaterThanOrEqual(0);
    expect(z1).toBeLessThanOrEqual(1);
  });

  it('uses rotated parts for the posts, headboard, pillow and drape', () => {
    expect(BED_MODEL.boxes.filter((b) => b.rot).length).toBeGreaterThanOrEqual(8);
  });

  it('turns with the facing: the headboard (+Z) ends up on the west wall for Facing.East', () => {
    const out = [0, 0];
    turnPoint(8, 15.5, Facing.East, out);
    expect(out[0]).toBeCloseTo(0.5);
    turnPoint(8, 15.5, Facing.West, out);
    expect(out[0]).toBeCloseTo(15.5);
  });
});
