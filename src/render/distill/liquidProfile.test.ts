import { describe, expect, it } from 'vitest';
import { GLASS_MODELS } from '../../world/glassModels';
import { jacketBodies, lighten, LIQUID_RANGE, profiledBodies, profiledTop, sliceInterior } from './liquidProfile';

const P = 1 / 16;

describe('liquid bodies follow the glass model', () => {
  for (const model of Object.keys(LIQUID_RANGE)) {
    it(`${model}: every body lies inside its own slice of the interior, in the model's liquid range`, () => {
      const bodies = profiledBodies(model, [3, 1], 1);
      expect(bodies.length).toBeGreaterThan(0);
      const { from, to } = LIQUID_RANGE[model];
      for (const b of bodies) {
        expect(b.y0).toBeGreaterThanOrEqual(from * P - 1e-9);
        expect(b.y1).toBeLessThanOrEqual(to * P + 1e-9);
        expect(b.y1).toBeGreaterThan(b.y0);
        // One footprint for the whole body: every slice it crosses has that interior.
        const k0 = Math.floor(b.y0 * 16 + 1e-6);
        const k1 = Math.ceil(b.y1 * 16 - 1e-6);
        for (let k = k0; k < k1; k++) {
          const fp = sliceInterior(GLASS_MODELS[model].body, k);
          expect(fp).not.toBeNull();
          expect(b.x0).toBeGreaterThanOrEqual(fp![0] * P - 1e-9);
          expect(b.x1).toBeLessThanOrEqual(fp![1] * P + 1e-9);
          expect(b.z0).toBeGreaterThanOrEqual(fp![2] * P - 1e-9);
          expect(b.z1).toBeLessThanOrEqual(fp![3] * P + 1e-9);
        }
      }
    });

    it(`${model}: the layers stack bottom first with one open surface on the topmost body of the top layer`, () => {
      const bodies = profiledBodies(model, [3, 1], 1);
      const top = bodies.filter((b) => b.top);
      expect(top).toHaveLength(1);
      const highest = Math.max(...bodies.map((b) => b.y1));
      expect(top[0].y1).toBeCloseTo(highest, 9);
      expect(top[0].layer).toBe(1);
      const lower = bodies.filter((b) => b.layer === 0);
      const upper = bodies.filter((b) => b.layer === 1);
      expect(Math.max(...lower.map((b) => b.y1))).toBeLessThanOrEqual(Math.min(...upper.map((b) => b.y0)) + 1e-9);
    });
  }

  it('a flask holds more liquid in its belly than in its ring: the body is round, not a block', () => {
    const bodies = profiledBodies('boiling_flask', [1], 1);
    const widthAt = (y: number): number => {
      const b = bodies.find((q) => q.y0 <= y && y < q.y1);
      return b ? b.x1 - b.x0 : 0;
    };
    // Slice 2 is the foot ring (walls 3..13), slice 5 the belly (walls 2..14).
    expect(widthAt(2.5 * P)).toBeCloseTo(8 * P, 9);
    expect(widthAt(5.5 * P)).toBeCloseTo(10 * P, 9);
    expect(widthAt(5.5 * P)).toBeGreaterThan(widthAt(2.5 * P));
  });

  it('a funnel bulb is narrow at its tip and widest in the middle, and fill scales the height', () => {
    const half = profiledBodies('separatory_funnel', [1], 0.5);
    const full = profiledBodies('separatory_funnel', [1], 1);
    const top = (bs: typeof full): number => Math.max(...bs.map((b) => b.y1));
    expect(top(half)).toBeLessThan(top(full));
    const width = (bs: typeof full, y: number): number => {
      const b = bs.find((q) => q.y0 <= y && y < q.y1);
      return b ? b.x1 - b.x0 : 0;
    };
    expect(width(full, 5.5 * P)).toBeLessThan(width(full, 8.5 * P));
  });

  it('the liquid height reported matches the bodies that were cut', () => {
    const bodies = profiledBodies('reaction_vessel', [2, 2], 0.5);
    const lo = Math.min(...bodies.map((b) => b.y0));
    const hi = Math.max(...bodies.map((b) => b.y1));
    expect(hi - lo).toBeCloseTo(profiledTop('reaction_vessel', 0.5) - 1 * P, 6);
  });

  it('nothing to pour, or no such model: no bodies', () => {
    expect(profiledBodies('boiling_flask', [], 1)).toEqual([]);
    expect(profiledBodies('boiling_flask', [1], 0)).toEqual([]);
    expect(profiledBodies('column_segment', [1], 1)).toEqual([]);
  });
});

describe('the jacket water is an annulus round the clear tube, under the shell', () => {
  it('four bodies inside the shell that never cover the tube', () => {
    const bodies = jacketBodies(1);
    expect(bodies).toHaveLength(4);
    for (const b of bodies) {
      expect(b.x0).toBeGreaterThanOrEqual(2 * P - 1e-9);
      expect(b.x1).toBeLessThanOrEqual(14 * P + 1e-9);
      expect(b.z0).toBeGreaterThanOrEqual(2 * P - 1e-9);
      expect(b.z1).toBeLessThanOrEqual(14 * P + 1e-9);
      // No body reaches into the tube's 6..10 square.
      const inTube = b.x0 < 10 * P && b.x1 > 6 * P && b.z0 < 10 * P && b.z1 > 6 * P;
      expect(inTube).toBe(false);
      expect(b.y1).toBeLessThanOrEqual(13 * P + 1e-9);
    }
  });

  it('fill sets the height, and an empty jacket has no water', () => {
    expect(Math.max(...jacketBodies(0.5).map((b) => b.y1))).toBeCloseTo(13 * P * 0.5, 9);
    expect(jacketBodies(0)).toEqual([]);
  });
});

describe('lighten', () => {
  it('moves each channel towards white by the given share', () => {
    expect(lighten(0x000000, 0.5)).toBe(0x808080);
    expect(lighten(0xffffff, 0.5)).toBe(0xffffff);
    expect(lighten(0x2060a0, 0)).toBe(0x2060a0);
  });
});
