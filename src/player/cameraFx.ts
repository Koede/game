/** Small camera effects (pure maths; the controller applies them). All of them are skipped with Reduce motion. */

/** A landing from lower than this makes no dip at all. */
export const LAND_DIP_FROM = 0.7;
/** The deepest dip, in blocks. */
export const LAND_DIP_MAX = 0.16;

/** How far the eye sinks for a landing after falling `fell` blocks (0 for a hop, capped for a big drop). */
export function landingDip(fell: number): number {
  if (!(fell > LAND_DIP_FROM)) return 0;
  return Math.min(LAND_DIP_MAX, 0.03 + (fell - LAND_DIP_FROM) * 0.03);
}

/** Eases `value` back towards 0 with the given rate (1/s). */
export const settle = (value: number, rate: number, dt: number): number => {
  const next = value * Math.exp(-rate * dt);
  return Math.abs(next) < 1e-4 ? 0 : next;
};

/** The strongest shake, in radians of view rotation. */
export const SHAKE_MAX = 0.04;
/** Shake sizes (radians) for the events that cause it. */
export const SHAKE_DIG = 0.004;
export const SHAKE_BREAK = 0.011;
export const SHAKE_STRIKE = 0.012;
export const SHAKE_HURT = 0.03;

/** A short rattle of the view: events add to it, it dies away on its own. */
export class Shake {
  amount = 0;
  yaw = 0;
  pitch = 0;
  private t = 0;

  add(a: number): void {
    this.amount = Math.min(SHAKE_MAX, this.amount + a);
  }

  /** Advances by `dt` and updates `yaw` / `pitch` (both 0 when quiet). */
  update(dt: number): void {
    this.t += dt;
    this.amount = settle(this.amount, 11, dt);
    this.yaw = Math.sin(this.t * 53) * this.amount;
    this.pitch = Math.sin(this.t * 67 + 1.3) * this.amount;
  }

  clear(): void {
    this.amount = this.yaw = this.pitch = 0;
  }
}
