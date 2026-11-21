/** A small canvas chart for a rolling history: one filled series and an optional second line. */
import { h } from './dom';
import type { Tone } from './gauges';

export interface SparkSeries {
  /** Legend text. */
  label: string;
  tone: Tone;
  /** Fill the area under the line. Default: true for the first series, false for the second. */
  fill?: boolean;
}

export interface SparklineOptions {
  /** Accessible description of the chart. */
  label: string;
  a: SparkSeries;
  b?: SparkSeries;
  /** Fixed top of the scale. Default: fits the data. */
  max?: number;
}

const TONE_VAR: Record<Tone, string> = {
  neutral: '--hw-ash-2',
  heat: '--hw-heat',
  power: '--hw-power',
  good: '--hw-good',
  warn: '--hw-warn',
  bad: '--hw-bad',
};
const TONE_FALLBACK: Record<Tone, string> = {
  neutral: '#bdb1a2',
  heat: '#ff8a2b',
  power: '#41d6f5',
  good: '#8ccf6a',
  warn: '#e9d24a',
  bad: '#ff5a6e',
};
const MAX_PIXEL_RATIO = 3;
const EMPTY: ArrayLike<number> = [];

export class Sparkline {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly observer: ResizeObserver | null;
  private readonly series: readonly SparkSeries[];
  private readonly colors: (string | null)[] = [null, null];
  private readonly fixedMax: number | undefined;
  private data: [ArrayLike<number>, ArrayLike<number>] = [EMPTY, EMPTY];
  private width = 0;
  private height = 0;

  constructor(opts: SparklineOptions) {
    this.series = opts.b ? [opts.a, opts.b] : [opts.a];
    this.fixedMax = opts.max;
    this.canvas = h('canvas', { class: 'hw-spark__canvas', attrs: { role: 'img', 'aria-label': opts.label } });
    this.ctx = this.canvas.getContext('2d');
    const legend = h(
      'div',
      { class: 'hw-spark__legend' },
      this.series.map((s, i) =>
        h('span', { class: 'hw-spark__key', attrs: { 'data-tone': s.tone, 'data-fill': this.filled(i) } }, h('i'), s.label),
      ),
    );
    this.el = h('div', { class: 'hw-spark' }, legend, this.canvas);
    this.observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            const rect = entries[0].contentRect;
            this.resize(rect.width, rect.height);
          })
        : null;
    this.observer?.observe(this.canvas);
  }

  /**
   * Draws the histories, oldest sample first. The arrays are kept by reference (and redrawn on resize),
   * so a caller may pass the same rolling buffers every time.
   */
  set(a: ArrayLike<number>, b: ArrayLike<number> | null = null): void {
    this.data = [a, b ?? EMPTY];
    this.draw();
  }

  dispose(): void {
    this.observer?.disconnect();
  }

  private filled(index: number): boolean {
    return this.series[index].fill ?? index === 0;
  }

  private resize(cssWidth: number, cssHeight: number): void {
    const ratio = Math.min(MAX_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (width === this.width && height === this.height) return;
    this.width = this.canvas.width = width;
    this.height = this.canvas.height = height;
    this.draw();
  }

  private color(index: number): string {
    const cached = this.colors[index];
    if (cached) return cached;
    const tone = this.series[index].tone;
    // Tokens are only readable once the element is attached and styled; until then use the fallback uncached.
    const fromCss = getComputedStyle(this.el).getPropertyValue(TONE_VAR[tone]).trim();
    if (fromCss) this.colors[index] = fromCss;
    return fromCss || TONE_FALLBACK[tone];
  }

  private draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const hgt = this.height;
    if (!ctx || w <= 1 || hgt <= 1) return;
    const ratio = Math.min(MAX_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, hgt);
    let peak = this.fixedMax ?? 0;
    if (this.fixedMax === undefined) {
      for (const values of this.data) {
        for (let i = 0; i < values.length; i++) if (values[i] > peak) peak = values[i];
      }
      peak *= 1.12;
    }
    if (!(peak > 0)) peak = 1;
    const pad = 2 * ratio;
    const usable = hgt - pad * 2;
    for (let s = this.series.length - 1; s >= 0; s--) {
      const values = this.data[s];
      const n = values.length;
      if (n < 2) continue;
      const stepX = w / (n - 1);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = hgt - pad - (Math.min(peak, Math.max(0, values[i])) / peak) * usable;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * stepX, y);
      }
      ctx.lineWidth = 1.5 * ratio;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.color(s);
      ctx.stroke();
      if (this.filled(s)) {
        ctx.lineTo(w, hgt);
        ctx.lineTo(0, hgt);
        ctx.closePath();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = this.color(s);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}
