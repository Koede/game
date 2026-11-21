/** Frame timing for the game loop (spec section 4). DOM-free. */
import { DT } from '../core/constants';

/** Longest frame the game simulates; anything longer (a hitch, a background tab) is cut to this. */
export const MAX_FRAME_DT = 0.1;
/** Most fixed ticks run in one frame; beyond that the simulation falls behind real time instead of spiralling. */
export const MAX_CATCH_UP_TICKS = 5;

/** Clamps a raw frame delta (seconds) to 0..MAX_FRAME_DT; garbage becomes 0. */
export function clampFrameDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return dt > MAX_FRAME_DT ? MAX_FRAME_DT : dt;
}

/** Fixed-step accumulator: feed frame times in, get the number of 20 Hz ticks to run out. */
export class FixedStep {
  private acc = 0;

  constructor(readonly step: number = DT, readonly maxTicks: number = MAX_CATCH_UP_TICKS) {}

  /** Adds a frame's dt and returns how many fixed ticks to run now (0..maxTicks). Time beyond that is dropped. */
  advance(dt: number): number {
    this.acc += dt;
    let n = Math.floor((this.acc + 1e-9) / this.step);
    if (n > this.maxTicks) {
      n = this.maxTicks;
      this.acc = 0;
    } else {
      this.acc -= n * this.step;
      if (this.acc < 0) this.acc = 0;
    }
    return n;
  }

  /** Fraction of the next tick already accumulated (0..1). */
  get alpha(): number {
    return this.acc / this.step;
  }

  reset(): void {
    this.acc = 0;
  }
}
