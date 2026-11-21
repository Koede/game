/**
 * The hearth behind the title screen: a low-resolution cellular fire drawn in the heat ramp and scaled up
 * with crisp pixels. Deliberately cheap (a few thousand cells, ~14 steps per second) and still under
 * prefers-reduced-motion (one settled frame, no animation).
 */
import { mulberry32 } from '../../core/math';
import { prefersReducedMotion } from '../kit/dom';
import { heatRgb } from '../kit/format';

const MAX_HEAT = 36;
const STEP_MS = 70;
const SETTLE_STEPS = 120;
/** Roughly how far up the canvas the highest sparks reach, as a fraction of its height. */
const FLAME_REACH = 0.72;
/**
 * The fire is posterised into a few flat bands, like hand-placed pixel art, instead of a smooth glow.
 * Each band: the heat level (1..MAX_HEAT) it starts at, its temperature on the heat ramp, its opacity.
 */
const BANDS: readonly (readonly [from: number, tempC: number, alpha: number])[] = [
  [1, 330, 170],
  [5, 430, 235],
  [10, 520, 255],
  [16, 640, 255],
  [22, 770, 255],
  [28, 900, 255],
  [33, 1040, 255],
];

/** RGBA for every heat level 0..MAX_HEAT (level 0 is transparent). */
function buildPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray((MAX_HEAT + 1) * 4);
  let band = -1;
  for (let level = 1; level <= MAX_HEAT; level++) {
    while (band + 1 < BANDS.length && level >= BANDS[band + 1][0]) band++;
    const [, tempC, alpha] = BANDS[band];
    const [r, g, b] = heatRgb(tempC);
    palette.set([r, g, b, alpha], level * 4);
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
  /** Heat level per cell, row-major from the top; the bottom row is the ember bed. */
  private heat = new Uint8Array(0);
  /** Brightness of the bed per column, 0..1: it wanders slowly so the fire breathes instead of flickering. */
  private bed = new Float32Array(0);
  private image: ImageData | null = null;
  private cooling = 1;
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
    this.heat = new Uint8Array(cols * rows);
    this.bed = new Float32Array(cols).fill(0.9);
    this.image = this.ctx ? this.ctx.createImageData(cols, rows) : null;
    this.cooling = MAX_HEAT / Math.max(8, rows * FLAME_REACH);
    for (let i = 0; i < SETTLE_STEPS; i++) this.step();
    this.draw();
  }

  /**
   * One generation: every cell hands its heat to a cell in the row above (straight up or one to the side),
   * cooling a little on the way. Cells that receive nothing keep their old value, which is what breaks the
   * flames up into loose sparks towards the top.
   */
  private step(): void {
    const { cols, rows, heat, bed, random } = this;
    if (cols === 0) return;
    const bottom = (rows - 1) * cols;
    for (let x = 0; x < cols; x++) {
      const drift = bed[x] + (random() - 0.5) * 0.08;
      bed[x] = drift < 0.72 ? 0.72 : drift > 1 ? 1 : drift;
      heat[bottom + x] = Math.round(bed[x] * MAX_HEAT);
    }
    const whole = Math.floor(this.cooling);
    const chance = this.cooling - whole;
    for (let y = 1; y < rows; y++) {
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const tx = x + Math.floor(random() * 3) - 1;
        if (tx < 0 || tx >= cols) continue;
        const cooled = heat[row + x] - whole - (random() < chance ? 1 : 0);
        heat[row - cols + tx] = cooled > 0 ? cooled : 0;
      }
    }
  }

  private draw(): void {
    const { ctx, image, heat, palette } = this;
    if (!ctx || !image) return;
    const data = image.data;
    for (let i = 0; i < heat.length; i++) {
      const p = heat[i] * 4;
      const o = i * 4;
      data[o] = palette[p];
      data[o + 1] = palette[p + 1];
      data[o + 2] = palette[p + 2];
      data[o + 3] = palette[p + 3];
    }
    ctx.putImageData(image, 0, 0);
  }
}
