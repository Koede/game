import { describe, expect, it } from 'vitest';
import { Journal } from '../../../game/journal';
import { paintMap } from './journalMap';

describe('paintMap', () => {
  it('paints seen ground green-ish, unseen dark, and the player bright', () => {
    const j = new Journal(() => 1);
    j.explore(0, 0);
    j.explore(40, 0);
    const size = 32;
    const out = new Uint8ClampedArray(size * size * 4);
    const { blocksPerPx } = paintMap(j, 40, 0, size, () => 64, out);
    expect(blocksPerPx).toBeGreaterThanOrEqual(1);
    let seen = 0;
    let dark = 0;
    for (let i = 0; i < out.length; i += 4) out[i + 1] > 100 ? seen++ : out[i + 1] < 30 && dark++;
    expect(seen).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(seen);
    expect(out.every((_, i) => i % 4 !== 3 || out[i] === 255)).toBe(true);
  });

  it('draws a cyan dot for a marker', () => {
    const j = new Journal(() => 1);
    j.explore(0, 0);
    const size = 32;
    const out = new Uint8ClampedArray(size * size * 4);
    paintMap(j, 0, 0, size, () => 64, out, [{ x: 8, z: 0 }]);
    let cyan = 0;
    for (let i = 0; i < out.length; i += 4) if (out[i] === 90 && out[i + 1] === 220 && out[i + 2] === 235) cyan++;
    expect(cyan).toBeGreaterThan(4);
  });
});
