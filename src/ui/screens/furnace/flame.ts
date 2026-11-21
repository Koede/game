/**
 * The live fire in the firebox: a small cellular flame drawn in crisp pixels. Its height follows the draft, its
 * colours follow the flame temperature on the heat ramp; embers when hot but unlit, glowing coils on electric
 * heat, a white star once the Starhearth is ignited. A bellows pump throws sparks. Under prefers-reduced-motion
 * it draws one settled frame per update instead of animating.
 */
import { mulberry32 } from '../../../core/math';
import { h, prefersReducedMotion } from '../../kit/dom';
import { heatRgb } from '../../kit/format';
import type { FlameLook } from './furnaceText';

const COLS = 36;
const ROWS = 22;
const MAX_HEAT = 32;
const STEP_MS = 60;
const SETTLE_STEPS = 40;
/** Posterised bands: from which heat level, at what fraction of the flame temperature, with what opacity. */
const BANDS: readonly (readonly [from: number, share: number, alpha: number])[] = [
  [1, 0.3, 150],
  [5, 0.42, 225],
  [10, 0.55, 255],
  [16, 0.7, 255],
  [22, 0.85, 255],
  [28, 1, 255],
];

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class Flame {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly image: ImageData | null;
  private readonly heat = new Uint8Array(COLS * ROWS);
  private readonly bed = new Float32Array(COLS).fill(0.8);
  private readonly palette = new Uint8ClampedArray((MAX_HEAT + 1) * 4);
  private readonly random = mulberry32(0x6e47);
  private readonly sparks: Spark[] = [];
  private readonly still = prefersReducedMotion();
  private look: FlameLook = { mode: 'none', height: 0, tempC: 20 };
  private paletteKey = '';
  private boost = 0;
  private frame = 0;
  private last = 0;
  private running = false;

  constructor() {
    this.canvas = h('canvas', { class: 'hw-flame__canvas', attrs: { width: COLS, height: ROWS, 'aria-hidden': 'true' } });
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx ? this.ctx.createImageData(COLS, ROWS) : null;
    this.el = h('div', { class: 'hw-flame' }, this.canvas);
  }

  /** New state from the simulation (a few times per second). */
  set(look: FlameLook): void {
    const changedMode = look.mode !== this.look.mode;
    this.look = look;
    this.el.dataset.mode = look.mode;
    const key = `${look.mode}|${Math.round(look.tempC / 25)}`;
    if (key !== this.paletteKey) {
      this.paletteKey = key;
      this.buildPalette();
    }
    if (this.still) {
      if (changedMode || this.frame === 0) for (let i = 0; i < SETTLE_STEPS; i++) this.step();
      this.frame = 1;
      this.draw();
    }
  }

  /** The bellows: a burst of height and a shower of sparks. */
  pump(): void {
    if (this.look.mode === 'none' || this.still) return;
    this.boost = 1;
    for (let i = 0; i < 14; i++) {
      this.sparks.push({
        x: COLS * (0.25 + this.random() * 0.5),
        y: ROWS - 3,
        vx: (this.random() - 0.5) * 9,
        vy: -(14 + this.random() * 18),
        life: 0.5 + this.random() * 0.6,
      });
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.still) return;
    const tick = (now: number): void => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(tick);
      if (now - this.last < STEP_MS) return;
      const dt = Math.min(0.2, (now - this.last) / 1000);
      this.last = now;
      this.step();
      this.moveSparks(dt);
      this.draw();
    };
    this.frame = requestAnimationFrame(tick);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private buildPalette(): void {
    const { mode, tempC } = this.look;
    // Electric elements glow orange-yellow whatever the chamber temperature, so the haze stays a dull red.
    const top = mode === 'star' ? 6000 : mode === 'electric' ? Math.min(Math.max(450, tempC), 1300) : Math.max(450, tempC);
    let band = -1;
    for (let level = 1; level <= MAX_HEAT; level++) {
      while (band + 1 < BANDS.length && level >= BANDS[band + 1][0]) band++;
      const [, share, alpha] = BANDS[band];
      const [r, g, b] = heatRgb(Math.max(320, top * share));
      this.palette.set([r, g, b, alpha], level * 4);
    }
  }

  /** One generation: heat rises from the bed, drifting sideways and cooling; cooling sets the height. */
  private step(): void {
    const { mode, height } = this.look;
    const heat = this.heat;
    const rnd = this.random;
    this.boost = Math.max(0, this.boost - 0.06);
    const reach = Math.min(1, height + this.boost * 0.35);
    if (mode === 'electric') {
      this.coils();
      return;
    }
    const cooling = mode === 'none' ? MAX_HEAT : MAX_HEAT / Math.max(2.5, ROWS * (0.15 + 0.85 * reach));
    for (let x = 0; x < COLS; x++) {
      this.bed[x] = Math.min(1, Math.max(0.35, this.bed[x] + (rnd() - 0.5) * 0.25));
      let bed = 0;
      if (mode === 'fire' || mode === 'star') bed = this.bed[x] * (mode === 'star' ? 1 : 0.75 + 0.25 * reach);
      else if (mode === 'embers') bed = rnd() < 0.35 ? this.bed[x] * 0.5 : 0.1;
      // A fire is narrower at the edges of the firebox.
      const edge = Math.min(x + 1, COLS - x) / 4;
      heat[(ROWS - 1) * COLS + x] = Math.round(MAX_HEAT * bed * Math.min(1, edge));
    }
    // Each cell hands its heat to the row above, one step left, straight or right; half the time it cools by
    // twice the mean. Whole runs of cells keep their heat together, which draws tongues instead of speckle.
    const double = cooling * 2;
    const whole = Math.floor(double);
    const part = double - whole;
    for (let y = 1; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const r = Math.floor(rnd() * 3);
        const to = (y - 1) * COLS + Math.min(COLS - 1, Math.max(0, x + r - 1));
        const loss = rnd() < 0.5 ? 0 : whole + (rnd() < part ? 1 : 0);
        heat[to] = Math.max(0, heat[y * COLS + x] - loss);
      }
    }
  }

  /** Electric heat: three glowing heating elements across the bottom, a warm haze above them, a slow shimmer. */
  private coils(): void {
    const heat = this.heat;
    const shimmer = 0.9 + 0.1 * Math.sin(this.random() * Math.PI * 2);
    for (let y = 0; y < ROWS; y++) {
      const fromBottom = ROWS - 1 - y;
      const coil = fromBottom === 1 || fromBottom === 4 || fromBottom === 7;
      const haze = Math.max(0, 1 - fromBottom / (ROWS * 0.8));
      for (let x = 0; x < COLS; x++) {
        const inset = x >= 2 && x < COLS - 2;
        const level = coil && inset ? 0.95 * shimmer : haze * 0.24;
        heat[y * COLS + x] = Math.round(MAX_HEAT * level);
      }
    }
  }

  private moveSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 10 * dt;
      if (s.life <= 0 || s.y < 0 || s.x < 0 || s.x >= COLS) this.sparks.splice(i, 1);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const image = this.image;
    if (!ctx || !image) return;
    const data = image.data;
    for (let i = 0; i < this.heat.length; i++) {
      const p = this.heat[i] * 4;
      const o = i * 4;
      data[o] = this.palette[p];
      data[o + 1] = this.palette[p + 1];
      data[o + 2] = this.palette[p + 2];
      data[o + 3] = this.palette[p + 3];
    }
    const hot = MAX_HEAT * 4;
    for (const s of this.sparks) {
      const o = (Math.floor(s.y) * COLS + Math.floor(s.x)) * 4;
      data[o] = this.palette[hot];
      data[o + 1] = this.palette[hot + 1];
      data[o + 2] = this.palette[hot + 2];
      data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
}
