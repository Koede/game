/**
 * Adaptive render resolution for slow GPUs (phones). Fed the wall-clock time between drawn frames, it lowers the drawing
 * buffer's scale when frames keep coming slower than ~40 fps and raises it again, slowly, when the screen keeps up at
 * full speed. Only the pixel count changes: the world, the controls and the saved settings are untouched. DOM-free.
 */
export interface GovernorOptions {
  /** Frames per judgement window. */
  window?: number;
  /** Mean frame time (ms) above which the scale drops. */
  slowMs?: number;
  /** Mean frame time (ms) at or below which a window counts as comfortable (60 Hz vsync is 16.7). */
  fastMs?: number;
  minScale?: number;
}

const MAX_GAP_MS = 250;

export class ResolutionGovernor {
  private readonly window: number;
  private readonly slowMs: number;
  private readonly fastMs: number;
  private readonly minScale: number;
  private sum = 0;
  private n = 0;
  private comfy = 0;
  /** Windows to wait after a drop before trying a higher scale. */
  private cooldown = 0;
  /** 1 = the device's full ratio. */
  scale = 1;

  constructor(options: GovernorOptions = {}) {
    this.window = options.window ?? 90;
    this.slowMs = options.slowMs ?? 25;
    this.fastMs = options.fastMs ?? 18.5;
    this.minScale = options.minScale ?? 0.6;
  }

  /** Reports the time since the previous drawn frame; returns true when `scale` changed. Gaps (pauses, a hidden tab) are ignored. */
  frame(ms: number): boolean {
    if (!(ms > 0) || ms > MAX_GAP_MS) return false;
    this.sum += ms;
    if (++this.n < this.window) return false;
    const mean = this.sum / this.n;
    this.sum = 0;
    this.n = 0;
    if (this.cooldown > 0) this.cooldown--;
    if (mean > this.slowMs && this.scale > this.minScale) {
      // Pixels scale with the square of the ratio: shrink by a step that roughly matches the overrun.
      this.scale = Math.max(this.minScale, Math.round(this.scale * Math.max(0.75, Math.min(0.92, this.slowMs / mean)) * 100) / 100);
      this.comfy = 0;
      this.cooldown = 6;
      return true;
    }
    this.comfy = mean <= this.fastMs ? this.comfy + 1 : 0;
    if (this.comfy >= 4 && this.cooldown === 0 && this.scale < 1) {
      this.scale = Math.min(1, Math.round((this.scale + 0.1) * 100) / 100);
      this.comfy = 0;
      this.cooldown = 3;
      return true;
    }
    return false;
  }
}
