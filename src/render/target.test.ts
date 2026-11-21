import { describe, expect, it } from 'vitest';
import { CRACK_STAGES, paintCracks, shapeBounds } from './target';

const STAGE_BYTES = 16 * 16 * 4;
const visible = (data: Uint8Array, stage: number): boolean[] => {
  const out: boolean[] = [];
  for (let i = 0; i < 256; i++) out.push(data[stage * STAGE_BYTES + i * 4 + 3] > 0);
  return out;
};

describe('mining cracks', () => {
  it('paints eight stages that only ever grow', () => {
    const data = paintCracks();
    expect(data.length).toBe(CRACK_STAGES * STAGE_BYTES);
    let before = visible(data, 0);
    let count = before.filter(Boolean).length;
    expect(count).toBeGreaterThan(0);
    for (let s = 1; s < CRACK_STAGES; s++) {
      const now = visible(data, s);
      for (let i = 0; i < 256; i++) if (before[i]) expect(now[i]).toBe(true);
      const n = now.filter(Boolean).length;
      expect(n).toBeGreaterThan(count);
      before = now;
      count = n;
    }
    // The last stage is well cracked but still mostly the block underneath.
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThan(200);
  });

  it('is deterministic', () => {
    expect(paintCracks()).toEqual(paintCracks());
  });
});

describe('outline bounds', () => {
  it('hugs the visible part of thin shapes and the whole cell otherwise', () => {
    expect(shapeBounds('cube')).toEqual([0, 0, 0, 1, 1, 1]);
    expect(shapeBounds('slab')[4]).toBe(0.5);
    expect(shapeBounds('pipe')).toEqual([0.25, 0.25, 0.25, 0.75, 0.75, 0.75]);
    const t = shapeBounds('torch');
    expect(t[3] - t[0]).toBeLessThan(0.3);
    expect(t[4]).toBeLessThan(0.75);
  });
});
