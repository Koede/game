/**
 * Drop-in art for the tavern's people (assets/npcs/README.md): generated or hand-drawn PNGs on a plain background are cut out, trimmed
 * and shared through a small store that the sprite renderer and the dialogue box read. `cutOut` is pure (RGBA in, RGBA out) so it is
 * testable without a canvas; `loadNpcArt` does the browser part (decode the data URLs, run `cutOut`, keep the canvases).
 */
export interface RgbaImage {
  w: number;
  h: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Colour distance (sum of channel differences) under which a pixel counts as the background. */
const KEY_TOLERANCE = 54;
/** Target height (px) of a sprite from big source art. */
export const SPRITE_PX = 96;

/**
 * Removes a plain background: the most common colour of the four corners is the key; every pixel connected to the border whose colour is
 * within tolerance of it becomes transparent (pixels inside the figure that match are kept). Then crops to the figure's bounding box.
 * Images that already have transparency keep it. Returns null when nothing is left.
 */
export function cutOut(img: RgbaImage): RgbaImage | null {
  const { w, h } = img;
  const d = new Uint8Array(img.data);
  const at = (x: number, y: number): number => (y * w + x) * 4;
  const hasAlpha = (() => {
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    return false;
  })();
  if (!hasAlpha) {
    const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].map((i) => [d[i], d[i + 1], d[i + 2]] as const);
    let key = corners[0];
    let best = -1;
    for (const c of corners) {
      const n = corners.filter((o) => Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]) + Math.abs(o[2] - c[2]) < KEY_TOLERANCE).length;
      if (n > best) {
        best = n;
        key = c;
      }
    }
    const near = (i: number): boolean => Math.abs(d[i] - key[0]) + Math.abs(d[i + 1] - key[1]) + Math.abs(d[i + 2] - key[2]) < KEY_TOLERANCE;
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) return;
      seen[y * w + x] = 1;
      if (near(at(x, y))) stack.push(y * w + x);
    };
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    while (stack.length) {
      const p = stack.pop()!;
      d[p * 4 + 3] = 0;
      const x = p % w;
      const y = (p - x) / w;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
  }
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[at(x, y) + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return null;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let k = 0; k < 4; k++) out[(y * cw + x) * 4 + k] = d[at(x + x0, y + y0) + k];
  return { w: cw, h: ch, data: out };
}

// ---- the store the renderer and the dialogue box read --------------------------------------------------------------

/** Loaded art by manifest key (`mara`, `mara_portrait`, ...): canvases, cut out and trimmed (portraits are only decoded). */
const store = new Map<string, HTMLCanvasElement>();
const listeners = new Set<() => void>();

export const npcArt = (key: string): HTMLCanvasElement | undefined => store.get(key);

/** Cells in a `<id>_faces` sheet, left to right: neutral, happy, laughing, surprised, annoyed, sly (src/npcs/mood.ts picks one per line). */
export const FACE_CELLS = 6;
export const onNpcArt = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Decodes every manifest entry (data URLs) in the browser, cuts out the sprites, fills the store and tells the listeners. */
export async function loadNpcArt(manifest: Readonly<Record<string, string>>, scales: Readonly<Record<string, number>> = {}): Promise<number> {
  if (typeof document === 'undefined') return 0;
  let n = 0;
  await Promise.all(
    Object.entries(manifest).map(async ([key, url]) => {
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        if (key.endsWith('_portrait') || key.endsWith('_faces')) {
          store.set(key, c);
          n++;
          return;
        }
        const px = ctx.getImageData(0, 0, c.width, c.height);
        const cut = cutOut({ w: px.width, h: px.height, data: px.data });
        if (!cut) return;
        const full = document.createElement('canvas');
        full.width = cut.w;
        full.height = cut.h;
        full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(cut.data), cut.w, cut.h), 0, 0);
        // Large images (generated art is ~1200 px) are brought down to about SPRITE_PX tall with smoothing, so the pixel look survives
        // the renderer's nearest-neighbour filtering instead of shimmering.
        // Same pixels per block for everyone: a character drawn bigger in the world (scale) gets proportionally more rows.
        const target = SPRITE_PX * (scales[key.replace(/_portrait$/, '')] ?? 1);
        const k = cut.h > target * 1.25 ? target / cut.h : 1;
        const o = document.createElement('canvas');
        o.width = Math.max(1, Math.round(cut.w * k));
        o.height = Math.max(1, Math.round(cut.h * k));
        const octx = o.getContext('2d')!;
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(full, 0, 0, o.width, o.height);
        store.set(key, o);
        n++;
      } catch (err) {
        console.warn(`[npc art] ${key} could not be loaded`, err);
      }
    }),
  );
  if (n > 0) for (const fn of listeners) fn();
  return n;
}
