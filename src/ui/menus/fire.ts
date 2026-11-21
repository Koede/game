/**
 * The hearth behind the title screen: a low-resolution cellular fire drawn in the heat ramp and scaled up
 * with crisp pixels. Deliberately cheap (a few thousand cells, ~14 steps per second) and still under
 * prefers-reduced-motion (one settled frame, no animation).
 */
import { mulberry32 } from '../../core/math';
import { prefersReducedMotion } from '../kit/dom';
import { heatRgb } from '../kit/format';

const LEVELS = 48;
const STEP_MS = 70;
const SETTLE_STEPS = 120;
/** How far up the canvas the tallest flames reach, as a fraction of its height. */
const FLAME_REACH = 0.82;
/** Coolest and hottest colour of the flames, in degrees C on the heat ramp. */
const TEMP_LOW = 330;
const TEMP_HIGH = 1180;

function buildPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray((LEVELS + 1) * 4);
  for (let i = 1; i <= LEVELS; i++) {
    const t = i / LEVELS;
    const [r, g, b] = heatRgb(TEMP_LOW + t * t * (TEMP_HIGH - TEMP_LOW));
    palette[i * 4] = r;
    palette[i * 4 + 1] = g;
    palette[i * 4 + 2] = b;
    palette[i * 4 + 3] = Math.min(255, i * 26);
  }
  return palette;
}

export class EmberField {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly palette = buildPalette();
  private readonly random: () => number;
  private readonly observer: ResizeObserver | null;
  private cols = 0;
  private rows = 0;
  /** Heat per cell, 0..1, row-major from the top. Two extra rows below the visible ones hold the ember bed. */
  private heat = new Float32Array(0);
  private image: ImageData | null = null;
  private cooling = 0.02;
  private frame = 0;
  private last = 0;
  private running = false;

  constructor(seed = 0x4877) {
    this.random = mulberry32(seed);
    this.el = document.createElement('canvas');
    this.el.className = 'hw-title__fire';
    this.el.setAttribute('aria-hidden', 'true');
    this.ctx = this.el.getContext('2d');
    this.observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            const rect = entries[0].contentRect;
            this.resize(rect.width, rect.height);
          })
        : null;
    this.observer?.observe(this.el);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (prefersReducedMotion()) return;
    const tick = (now: number): void => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(tick);
      if (now - this.last < STEP_MS) return;
      this.last = now;
      this.step();
      this.draw();
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  dispose(): void {
    this.stop();
    this.observer?.disconnect();
  }

  private resize(width: number, height: number): void {
    if (width < 1 || height < 1) return;
    const cell = Math.min(width, height) < 420 ? 6 : 8;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    this.el.width = cols;
    this.el.height = rows;
    this.heat = new Float32Array(cols * (rows + 2));
    this.image = this.ctx ? this.ctx.createImageData(cols, rows) : null;
    this.cooling = 1 / Math.max(8, rows * FLAME_REACH);
    for (let i = 0; i < SETTLE_STEPS; i++) this.step();
    this.draw();
  }

  /**
   * One generation. The ember bed below the canvas flickers; every cell becomes the average of the three
   * cells under it and the one two rows down, minus a little random cooling. Rows are processed top-down,
   * so each row still reads the previous generation.
   */
  private step(): void {
    const { cols, rows, heat, random } = this;
    if (cols === 0) return;
    const bed = rows * cols;
    for (let x = 0; x < cols; x++) {
      if (random() < 0.35) {
        const glow = 0.35 + random() * 0.65;
        heat[bed + x] = glow;
        heat[bed + cols + x] = glow;
      }
    }
    const cooling = this.cooling * 2;
    for (let y = 0; y < rows; y++) {
      const below = (y + 1) * cols;
      const below2 = below + cols;
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const left = heat[below + (x > 0 ? x - 1 : x)];
        const right = heat[below + (x < cols - 1 ? x + 1 : x)];
        const next = (left + heat[below + x] + right + heat[below2 + x]) * 0.25 - random() * cooling;
        heat[row + x] = next > 0 ? next : 0;
      }
    }
  }

  private draw(): void {
    const { ctx, image, heat, palette } = this;
    if (!ctx || !image) return;
    const data = image.data;
    const cells = this.cols * this.rows;
    for (let i = 0; i < cells; i++) {
      const p = Math.round(heat[i] * LEVELS) * 4;
      const o = i * 4;
      data[o] = palette[p];
      data[o + 1] = palette[p + 1];
      data[o + 2] = palette[p + 2];
      data[o + 3] = palette[p + 3];
    }
    ctx.putImageData(image, 0, 0);
  }
}
