/**
 * Aspect icons: the one helper every screen uses to show an essentia (Thaumcraft-style). The glyph pixels live in
 * src/magic/aspectGlyphs.ts; here each is painted once to a canvas (aspect colour, light and shade, dark outline) and
 * cached as a data URL, shown crisp (pixelated) at any size.
 */
import { ASPECT_LIST, aspectInfo, aspectsText, type Aspect } from '../../magic/aspects';
import { ASPECT_GLYPHS, GLYPH_SIZE } from '../../magic/aspectGlyphs';

const cache = new Map<Aspect, string>();

type RGB = [number, number, number];
const parse = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const mix = (c: RGB, f: number): RGB => c.map((v) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)))) as RGB;
const css = (c: RGB): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** The glyph as a PNG data URL, 12x12; '' without a canvas (tests). */
export function aspectIconUrl(key: Aspect): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = GLYPH_SIZE;
    const g = cv.getContext('2d');
    if (g) {
      const base = parse(aspectInfo(key).color);
      const lum = (base[0] * 3 + base[1] * 6 + base[2]) / 10;
      const outline: RGB = lum > 90 ? [30, 22, 36] : [236, 230, 244];
      const rows = ASPECT_GLYPHS[key];
      const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GLYPH_SIZE && y < GLYPH_SIZE && (rows[y]?.[x] ?? '.') !== '.';
      for (let y = 0; y < GLYPH_SIZE; y++) {
        for (let x = 0; x < GLYPH_SIZE; x++) {
          const ch = rows[y]?.[x] ?? '.';
          if (ch === '.') {
            if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
              g.fillStyle = css(outline);
              g.fillRect(x, y, 1, 1);
            }
            continue;
          }
          g.fillStyle = css(ch === 'h' ? mix(base, 1.4) : ch === 'd' ? mix(base, 0.6) : base);
          g.fillRect(x, y, 1, 1);
        }
      }
      url = cv.toDataURL('image/png');
    }
  }
  cache.set(key, url);
  return url;
}

/** An `<img>` of the aspect's icon, `size` css px square (default 20), crisp; alt is the aspect name. */
export function aspectIcon(key: Aspect, size = 20): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'hw-aspect-icon';
  img.src = aspectIconUrl(key);
  img.alt = aspectInfo(key).name;
  img.width = size;
  img.height = size;
  img.draggable = false;
  img.style.cssText = `width:${size}px;height:${size}px;image-rendering:pixelated;flex:none;vertical-align:middle`;
  img.dataset.aspectIcon = key;
  return img;
}

/** Icon plus a label, as one inline chip body: "[icon] Name 3". */
export function aspectLabel(key: Aspect, text: string, size = 16): HTMLSpanElement {
  const s = document.createElement('span');
  s.style.cssText = 'display:inline-flex;align-items:center;gap:4px';
  const t = document.createElement('span');
  t.textContent = text;
  s.append(aspectIcon(key, size), t);
  return s;
}

/** "[icon]2 [icon]3": a row of icons with counts for an aspect bundle, in aspect order (empty span when none). */
export function aspectsRow(as: Partial<Record<Aspect, number>>, size = 16): HTMLSpanElement {
  const s = document.createElement('span');
  s.style.cssText = 'display:inline-flex;align-items:center;flex-wrap:wrap;gap:2px 8px';
  s.title = aspectsText(as);
  for (const a of ASPECT_LIST) {
    const n = as[a] ?? 0;
    if (n > 0) s.appendChild(aspectLabel(a, String(n), size));
  }
  return s;
}
