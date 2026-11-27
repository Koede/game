/**
 * A tiny painter for the tavern's portraits and sprites, in the spirit of Stardew Valley's character art: soft cel shading (a base
 * tone, a shadow tone, a highlight), COLOURED outlines (each shape is outlined in a dark shade of its own colour, not black), big
 * glossy eyes, rosy cheeks. Shapes are drawn in float design units onto an RGBA buffer scaled by `res`, so curves are smooth and tests
 * need no canvas. Later shapes paint over earlier ones.
 */
export type Rgb = readonly [number, number, number];

export const hex = (n: number): Rgb => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
/** The shadow tone of a colour: darker and a little cooler/more saturated, like hand-painted cel shading. */
export const shadowOf = (c: Rgb): Rgb => mix([c[0] * 0.72, c[1] * 0.66, c[2] * 0.78] as Rgb, [60, 30, 70], 0.1);
export const lightOf = (c: Rgb): Rgb => mix(c, [255, 244, 220], 0.28);
/** The outline of a colour: its dark, warm shade. */
export const lineOf = (c: Rgb): Rgb => mix([c[0] * 0.45, c[1] * 0.38, c[2] * 0.42] as Rgb, [40, 20, 36], 0.3);

export interface ShapeOpts {
  /** Outline colour (default: the dark shade of the fill); null for none. */
  line?: Rgb | null;
  /** Cel shading: shadow on the lower right, a highlight on the upper left (default true). */
  shade?: boolean;
  /** Overrides the shadow tone. */
  shadow?: Rgb;
}

export class Canvas {
  readonly data: Uint8Array;
  readonly pw: number;
  readonly ph: number;

  constructor(readonly w: number, readonly h: number, readonly res: number) {
    this.pw = Math.round(w * res);
    this.ph = Math.round(h * res);
    this.data = new Uint8Array(this.pw * this.ph * 4);
  }

  /** A hi-res pixel. */
  set(x: number, y: number, c: Rgb, a = 255): void {
    if (x < 0 || y < 0 || x >= this.pw || y >= this.ph) return;
    const i = (y * this.pw + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.pw || y >= this.ph) return 0;
    return this.data[(y * this.pw + x) * 4 + 3];
  }

  /** Fills every pixel whose design-unit centre satisfies `inside`, in the bounding box given (design units). */
  private fill(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, paint: (x: number, y: number) => Rgb | null): void {
    const r = this.res;
    for (let py = Math.max(0, Math.floor(y0 * r)); py <= Math.min(this.ph - 1, Math.ceil(y1 * r)); py++) {
      for (let px = Math.max(0, Math.floor(x0 * r)); px <= Math.min(this.pw - 1, Math.ceil(x1 * r)); px++) {
        const x = (px + 0.5) / r;
        const y = (py + 0.5) / r;
        if (!inside(x, y)) continue;
        const c = paint(x, y);
        if (c) this.set(px, py, c);
      }
    }
  }

  /** A shaded, outlined shape given by an inside test, its box and a size scale for shading. */
  private shape(box: [number, number, number, number], inside: (x: number, y: number) => boolean, color: Rgb, o: ShapeOpts): void {
    const [x0, y0, x1, y1] = box;
    const line = o.line === undefined ? lineOf(color) : o.line;
    const t = 1 / this.res;
    if (line) {
      // Outline: the shape grown by one hi-res pixel, painted first.
      this.fill(x0 - 2 * t, y0 - 2 * t, x1 + 2 * t, y1 + 2 * t, (x, y) => inside(x, y) || inside(x + t, y) || inside(x - t, y) || inside(x, y + t) || inside(x, y - t), () => line);
    }
    const sh = o.shadow ?? shadowOf(color);
    const hl = lightOf(color);
    const w = Math.max(1e-6, x1 - x0);
    const h = Math.max(1e-6, y1 - y0);
    const sx = 0.13 * w;
    const sy = 0.13 * h;
    const hx = 0.09 * w;
    const hy = 0.09 * h;
    this.fill(x0, y0, x1, y1, inside, (x, y) => {
      if (o.shade === false) return color;
      // A crescent of shadow along the lower right (the shape pushed up-left no longer covers it), a thin highlight crescent upper left.
      if (!inside(x - sx, y - sy)) return sh;
      if (!inside(x + hx, y + hy) && (x - x0) / w + (y - y0) / h < 0.8) return hl;
      return color;
    });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: Rgb, o: ShapeOpts = {}): void {
    this.shape([cx - rx, cy - ry, cx + rx, cy + ry], (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, color, o);
  }

  /** A rounded rectangle. */
  rrect(x: number, y: number, w: number, h: number, r: number, color: Rgb, o: ShapeOpts = {}): void {
    const rr = Math.min(r, w / 2, h / 2);
    this.shape([x, y, x + w, y + h], (px, py) => {
      const dx = Math.max(x + rr - px, 0, px - (x + w - rr));
      const dy = Math.max(y + rr - py, 0, py - (y + h - rr));
      return px >= x && px <= x + w && py >= y && py <= y + h && dx * dx + dy * dy <= rr * rr;
    }, color, o);
  }

  /** A convex or concave polygon (even-odd). */
  poly(points: readonly (readonly [number, number])[], color: Rgb, o: ShapeOpts = {}): void {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    this.shape([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], (x, y) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, color, o);
  }

  /** A thick line with round ends, flat colour. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, color: Rgb): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = Math.max(1e-9, dx * dx + dy * dy);
    const r = width / 2;
    this.fill(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      return (x - (x0 + t * dx)) ** 2 + (y - (y0 + t * dy)) ** 2 <= r * r;
    }, () => color);
  }

  /** A flat dot (an ellipse without shading or outline). */
  dot(cx: number, cy: number, rx: number, ry: number, color: Rgb): void {
    this.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, () => color);
  }

  /**
   * A big glossy eye in the Stardew manner: dark lash line on top, a coloured iris with a darker rim and a lighter lower half, a dark
   * pupil, two white highlights.
   */
  eye(cx: number, cy: number, rx: number, ry: number, iris: Rgb, lash: Rgb, mirror = false): void {
    this.dot(cx, cy, rx + 0.15, ry + 0.15, [250, 246, 240]);
    this.dot(cx, cy + ry * 0.05, rx * 0.78, ry * 0.95, mix(iris, [20, 14, 30], 0.35));
    this.dot(cx, cy + ry * 0.2, rx * 0.62, ry * 0.7, iris);
    this.dot(cx, cy + ry * 0.42, rx * 0.5, ry * 0.32, lightOf(iris));
    this.dot(cx, cy, rx * 0.3, ry * 0.4, [22, 14, 28]);
    const hx = mirror ? 0.28 : -0.28;
    this.dot(cx + hx * rx, cy - ry * 0.35, rx * 0.22, ry * 0.22, [255, 255, 255]);
    this.dot(cx - hx * rx * 0.5, cy + ry * 0.4, rx * 0.1, ry * 0.1, [255, 255, 255]);
    // The upper lid: a thick dark arc.
    this.line(cx - rx * 1.05, cy - ry * 0.55, cx, cy - ry * 1.05, 0.28, lash);
    this.line(cx, cy - ry * 1.05, cx + rx * 1.05, cy - ry * 0.55, 0.28, lash);
  }

  /** Soft blush: a translucent warm ellipse over what is there. */
  blush(cx: number, cy: number, rx: number, ry: number, color: Rgb = [238, 120, 120], strength = 0.38): void {
    const r = this.res;
    for (let py = Math.floor((cy - ry) * r); py <= Math.ceil((cy + ry) * r); py++) {
      for (let px = Math.floor((cx - rx) * r); px <= Math.ceil((cx + rx) * r); px++) {
        if (!this.alpha(px, py)) continue;
        const x = (px + 0.5) / r;
        const y = (py + 0.5) / r;
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1) continue;
        const k = strength * (1 - d);
        const i = (py * this.pw + px) * 4;
        for (let ch = 0; ch < 3; ch++) this.data[i + ch] = Math.round(this.data[i + ch] * (1 - k) + color[ch] * k);
      }
    }
  }

  /** Shifts a colour of every opaque pixel in a box (a gentle vertical gradient for hair, cloth, skin). */
  gradient(x0: number, y0: number, x1: number, y1: number, top: number, bottom: number): void {
    const r = this.res;
    for (let py = Math.max(0, Math.floor(y0 * r)); py <= Math.min(this.ph - 1, Math.ceil(y1 * r)); py++) {
      for (let px = Math.max(0, Math.floor(x0 * r)); px <= Math.min(this.pw - 1, Math.ceil(x1 * r)); px++) {
        if (!this.alpha(px, py)) continue;
        const t = (py / r - y0) / Math.max(1e-6, y1 - y0);
        const k = top + (bottom - top) * t;
        const i = (py * this.pw + px) * 4;
        for (let ch = 0; ch < 3; ch++) this.data[i + ch] = Math.max(0, Math.min(255, Math.round(this.data[i + ch] * k)));
      }
    }
  }
}
