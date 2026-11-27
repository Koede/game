import { describe, expect, it } from 'vitest';
import { SMOKE_FRAMES } from '../../npcs/smoke';
import { CELL_H, CELL_W, PALETTE, smokeAtlasRgba, smokeGrids } from './smokeArt';

describe('skull smoke pixel art', () => {
  const frames = smokeGrids();
  it('has the loop at a fixed size using only the palette', () => {
    expect(frames.length).toBe(SMOKE_FRAMES);
    for (const f of frames) {
      expect(f.length).toBe(CELL_H);
      for (const row of f) {
        expect(row.length).toBe(CELL_W);
        for (const c of row) expect(c === '.' || c in PALETTE).toBe(true);
      }
    }
  });
  it('is hard-edged: alpha is only 0 or 255', () => {
    const { data } = smokeAtlasRgba();
    for (let i = 3; i < data.length; i += 4) expect(data[i] === 0 || data[i] === 255).toBe(true);
  });
  it('is deterministic', () => {
    expect(smokeGrids()).toEqual(frames);
  });
  const count = (f: string[]): number => f.join('').replace(/\./g, '').length;
  it('grows from a thin curl to a full skull, chatters its jaw, then crumbles away', () => {
    expect(count(frames[0])).toBeLessThan(count(frames[4]));
    expect(count(frames[8])).toBeGreaterThan(count(frames[6]));
    expect(frames[8]).not.toEqual(frames[9]);
    expect(frames[8]).toEqual(frames[10]);
    for (let f = 12; f < 15; f++) expect(count(frames[f + 1])).toBeLessThan(count(frames[f]));
    expect(count(frames[15])).toBeGreaterThan(0);
  });
  it('the skull has dark eye sockets and a nose notch', () => {
    const f = frames[8];
    expect(f[6 + 6][4 + 4]).toBe('O');
    expect(f[6 + 6][4 + 11]).toBe('O');
    expect(f[6 + 8][4 + 7]).toBe('O');
  });
});
