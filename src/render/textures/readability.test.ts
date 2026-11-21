import { describe, expect, it } from 'vitest';
import { applyReadability, readable } from './readability';

const lum = (c: readonly number[]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

describe('readability tone curve', () => {
  it('never reverses the brightness order of two greys (outlines, glow and lit variants keep their meaning)', () => {
    let last = -1;
    for (let v = 0; v <= 255; v++) {
      const out = lum(readable(v, v, v));
      expect(out, `grey ${v}`).toBeGreaterThanOrEqual(last);
      last = out;
    }
  });

  it('lifts the darkest tones so dark casings keep their detail, but keeps black below the mids', () => {
    expect(lum(readable(20, 20, 30))).toBeGreaterThan(lum([20, 20, 30]) + 8);
    expect(lum(readable(0, 0, 0))).toBeLessThan(32);
    expect(lum(readable(255, 255, 255))).toBeGreaterThan(245);
  });

  it('keeps colours in range and the hue family (a red stays red, a blue stays blue)', () => {
    for (const c of [[200, 40, 30], [30, 60, 200], [120, 200, 60], [255, 0, 255], [5, 5, 5], [250, 250, 250]]) {
      const out = readable(c[0], c[1], c[2]);
      for (const v of out) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(255);
    }
    const red = readable(200, 40, 30);
    expect(red[0]).toBeGreaterThan(red[1]);
    expect(red[0]).toBeGreaterThan(red[2]);
    const blue = readable(30, 60, 200);
    expect(blue[2]).toBeGreaterThan(blue[0]);
  });

  it('shadows lean cool and highlights lean warm', () => {
    const shadow = readable(40, 40, 40);
    expect(shadow[2]).toBeGreaterThan(shadow[0]);
    const light = readable(220, 220, 220);
    expect(light[0]).toBeGreaterThan(light[2]);
  });

  it('is pointwise: the same colour maps to the same colour wherever it appears', () => {
    const px = new Uint8ClampedArray([90, 80, 70, 255, 10, 10, 10, 255, 90, 80, 70, 255]);
    applyReadability(px);
    expect([px[0], px[1], px[2]]).toEqual([px[8], px[9], px[10]]);
  });

  it('never touches alpha, and skips fully transparent pixels', () => {
    const px = new Uint8ClampedArray([50, 60, 70, 128, 9, 9, 9, 0, 255, 0, 0, 255]);
    applyReadability(px);
    expect([px[3], px[7], px[11]]).toEqual([128, 0, 255]);
    expect([px[4], px[5], px[6]]).toEqual([9, 9, 9]);
  });
});
