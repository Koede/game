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
const SETTLE_STEPS = 90;
/** How far up the canvas the flames reach, as a fraction of its height. */
const FLAME_REACH = 0.7;

function buildPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray((MAX_HEAT + 1) * 4);
  for (let i = 1; i <= MAX_HEAT; i++) {
    const t = i / MAX_HEAT;
    const [r, g, b] = heatRgb(260 + t * t * 1240);
    palette[i * 4] = r;
    palette[i * 4 + 1] = g;
    palette[i * 4 + 2] = b;
    palette[i * 4 + 3] = Math.min(255, 40 + i * 22);
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
  private heat = new Uint8Array(0);
  private source = new Float32Array(0);
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
    this.source = new Float32Array(cols).fill(0.8);
    this.image = this.ctx ? this.ctx.createImageData(cols, rows) : null;
    this.cooling = MAX_HEAT / Math.max(8, rows * FLAME_REACH);
    for (let i = 0; i < SETTLE_STEPS; i++) this.step();
    this.draw();
  }

  /** One generation: the bed of embers wanders, every cell passes its heat to the cell above, cooling as it rises. */
  private step(): void {
    const { cols, rows, heat, source, random } = this;
    if (cols === 0) return;
    const bottom = (rows - 1) * cols;
    for (let x = 0; x < cols; x++) {
      const drift = source[x] + (random() - 0.5) * 0.16;
      source[x] = drift < 0.45 ? 0.45 : drift > 1 ? 1 : drift;
      heat[bottom + x] = Math.round(source[x] * MAX_HEAT);
    }
    const whole = Math.floor(this.cooling);
    const chance = this.cooling - whole;
    for (let y = 1; y < rows; y++) {
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const sway = Math.floor(random() * 3) - 1;
        const tx = x + sway;
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
