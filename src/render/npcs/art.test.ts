import { describe, expect, it } from 'vitest';
import { cutOut, type RgbaImage } from './art';

function image(w: number, h: number, bg: [number, number, number], paint: (x: number, y: number) => [number, number, number] | null): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y) ?? bg;
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return { w, h, data };
}

describe('cutting out a plain background', () => {
  it('removes the background colour, trims to the figure and keeps its pixels', () => {
    const img = image(20, 20, [200, 200, 200], (x, y) => (x >= 5 && x < 11 && y >= 4 && y < 16 ? [180, 40, 60] : null));
    const out = cutOut(img)!;
    expect([out.w, out.h]).toEqual([6, 12]);
    expect([out.data[0], out.data[1], out.data[2], out.data[3]]).toEqual([180, 40, 60, 255]);
  });

  it('keeps background-coloured pixels that are inside the figure (not connected to the border)', () => {
    const img = image(20, 20, [200, 200, 200], (x, y) => {
      if (x >= 4 && x < 16 && y >= 4 && y < 16) return x === 9 && y === 9 ? [200, 200, 200] : [30, 90, 160];
      return null;
    });
    const out = cutOut(img)!;
    const i = ((9 - 4) * out.w + (9 - 4)) * 4;
    expect(out.data[i + 3]).toBe(255);
    expect(out.w).toBe(12);
  });

  it('copes with a slightly noisy background and keeps existing transparency', () => {
    const noisy = image(16, 16, [210, 208, 205], (x, y) => (x >= 4 && x < 8 && y >= 2 && y < 14 ? [20, 20, 90] : (x + y) % 3 === 0 ? [214, 205, 208] : null));
    expect([cutOut(noisy)!.w, cutOut(noisy)!.h]).toEqual([4, 12]);
    const clear: RgbaImage = { w: 8, h: 8, data: new Uint8Array(8 * 8 * 4) };
    clear.data.set([10, 10, 10, 255], (3 * 8 + 2) * 4);
    clear.data.set([10, 10, 10, 255], (5 * 8 + 4) * 4);
    const out = cutOut(clear)!;
    expect([out.w, out.h]).toEqual([3, 3]);
  });

  it('returns null for an image that is all background', () => {
    expect(cutOut(image(8, 8, [255, 255, 255], () => null))).toBeNull();
  });
});
