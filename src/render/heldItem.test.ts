import { describe, expect, it } from 'vitest';
import { cubeGeometry, HeldItem, spriteGeometry } from './heldItem';

const opaqueTile = (fill: (x: number, y: number) => boolean): Uint8ClampedArray => {
  const px = new Uint8ClampedArray(1024);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px[(y * 16 + x) * 4 + 3] = fill(x, y) ? 255 : 0;
  return px;
};

describe('held item geometry', () => {
  it('builds a cube of six faces, each with its own layer', () => {
    const g = cubeGeometry([1, 2, 3, 4, 5, 6]);
    expect(g.getAttribute('position').count).toBe(24);
    expect(g.getIndex()?.count).toBe(36);
    expect(new Set(g.getAttribute('layer').array)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('extrudes every opaque texel and walls only the silhouette', () => {
    const full = spriteGeometry(7, opaqueTile(() => true));
    // 256 texels x (front + back) + 4 x 16 border walls
    expect(full.getIndex()!.count / 6).toBe(256 * 2 + 64);
    const one = spriteGeometry(7, opaqueTile((x, y) => x === 3 && y === 4));
    expect(one.getIndex()!.count / 6).toBe(6);
    const none = spriteGeometry(7, opaqueTile(() => false));
    expect(none.getAttribute('position').count).toBe(0);
  });
});

describe('HeldItem', () => {
  it('swaps the item at the bottom of the dip and swings on demand', () => {
    const held = new HeldItem(null);
    held.set('flint_pickaxe');
    expect(held.current).toBe(null);
    held.update(0.1);
    expect(held.current).toBe(null);
    held.update(0.1);
    expect(held.current).toBe('flint_pickaxe');
    held.set('plank');
    for (let i = 0; i < 10; i++) held.update(0.05);
    expect(held.current).toBe('plank');
    held.set(null);
    for (let i = 0; i < 10; i++) held.update(0.05);
    expect(held.current).toBe(null);
    held.swing();
    held.update(0.05);
    held.dispose();
  });
});
