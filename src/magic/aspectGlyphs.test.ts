import { describe, expect, it } from 'vitest';
import { ASPECT_LIST } from './aspects';
import { ASPECT_GLYPHS, GLYPH_SIZE } from './aspectGlyphs';

describe('aspect glyphs', () => {
  it('every aspect has a well-formed glyph', () => {
    for (const a of ASPECT_LIST) {
      const rows = ASPECT_GLYPHS[a];
      expect(rows, a).toBeDefined();
      expect(rows.length, a).toBe(GLYPH_SIZE);
      for (const r of rows) expect(r, a).toMatch(new RegExp(`^[.#hd]{${GLYPH_SIZE}}$`));
      const filled = rows.join('').replace(/\./g, '').length;
      expect(filled, a).toBeGreaterThan(20);
    }
  });
  it('no glyph is an alias of another', () => {
    const seen = new Map<string, string>();
    for (const a of ASPECT_LIST) {
      const sil = ASPECT_GLYPHS[a].join('').replace(/[#hd]/g, '#');
      expect(seen.get(sil), `${a} duplicates ${seen.get(sil)}`).toBeUndefined();
      seen.set(sil, a);
      const full = ASPECT_GLYPHS[a].join('');
      expect(seen.get('f' + full)).toBeUndefined();
      seen.set('f' + full, a);
    }
  });
  it('silhouettes differ in at least 10 pixels from every other', () => {
    const bits = (a: string): string => ASPECT_GLYPHS[a as keyof typeof ASPECT_GLYPHS].join('').replace(/[#hd]/g, '1').replace(/\./g, '0');
    for (const a of ASPECT_LIST) for (const b of ASPECT_LIST) {
      if (a >= b) continue;
      const x = bits(a), y = bits(b);
      let d = 0;
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++;
      expect(d, `${a} vs ${b}`).toBeGreaterThanOrEqual(10);
    }
  });
});
