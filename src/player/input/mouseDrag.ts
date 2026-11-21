/**
 * Pure mouse logic for when the pointer cannot be captured (pointer lock missing or refused): the view is
 * turned by dragging with a button held.
 *
 *  - a press that moves more than a few pixels becomes a look drag and does nothing else
 *  - LEFT held still for a moment starts mining and keeps mining until released (it may drag to look meanwhile)
 *  - RIGHT released without dragging is a click = use; held still it keeps using (the caller auto-repeats)
 */
import type { LookDelta } from './gestures';

export const DRAG_SLOP_PX = 4;
export const DRAG_MINE_HOLD_MS = 130;
export const DRAG_USE_HOLD_MS = 220;

const IDLE = 0;
const PENDING = 1;
const DRAGGING = 2;
const HOLDING = 3;

export type DragButton = 'left' | 'right';

interface ButtonState {
  phase: number;
  startX: number;
  startY: number;
  downT: number;
}

const newButton = (): ButtonState => ({ phase: IDLE, startX: 0, startY: 0, downT: 0 });

export class MouseDrag {
  private readonly left = newButton();
  private readonly right = newButton();
  private lastX = 0;
  private lastY = 0;
  private lookX = 0;
  private lookY = 0;
  private usePulses = 0;

  /** A button is down (in any phase). */
  get active(): boolean {
    return this.left.phase !== IDLE || this.right.phase !== IDLE;
  }

  /** Left button held still long enough: mining until it is released. */
  get mineHeld(): boolean {
    return this.left.phase === HOLDING;
  }

  /** Right button held still long enough: using until it is released. */
  get useHeld(): boolean {
    return this.right.phase === HOLDING;
  }

  down(button: DragButton, x: number, y: number, t: number): void {
    const b = this[button];
    b.phase = PENDING;
    b.startX = x;
    b.startY = y;
    b.downT = t;
    if (!this.looking()) {
      this.lastX = x;
      this.lastY = y;
    }
  }

  move(x: number, y: number, t: number): void {
    this.update(t);
    // Only travel after a drag or hold began counts, so crossing the slop never jerks the view.
    if (this.looking()) {
      this.lookX += x - this.lastX;
      this.lookY += y - this.lastY;
    }
    this.startDrag(this.left, x, y);
    this.startDrag(this.right, x, y);
    this.lastX = x;
    this.lastY = y;
  }

  up(button: DragButton, t: number): void {
    this.update(t);
    const b = this[button];
    if (button === 'right' && b.phase === PENDING) this.usePulses++;
    b.phase = IDLE;
  }

  /** Advances the hold timers. Call once per frame with the current time. */
  update(t: number): void {
    if (this.left.phase === PENDING && t - this.left.downT >= DRAG_MINE_HOLD_MS) this.left.phase = HOLDING;
    if (this.right.phase === PENDING && t - this.right.downT >= DRAG_USE_HOLD_MS) {
      this.right.phase = HOLDING;
      this.usePulses++;
    }
  }

  /** Moves the look travel (pixels) accumulated since the last call into `out`. */
  takeLook(out: LookDelta): void {
    out.x = this.lookX;
    out.y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
  }

  /** Number of use presses (right clicks, or the start of a right hold) since the last call. */
  takeUsePulses(): number {
    const n = this.usePulses;
    this.usePulses = 0;
    return n;
  }

  reset(): void {
    this.left.phase = IDLE;
    this.right.phase = IDLE;
    this.lookX = 0;
    this.lookY = 0;
    this.usePulses = 0;
  }

  private looking(): boolean {
    return this.left.phase >= DRAGGING || this.right.phase >= DRAGGING;
  }

  private startDrag(b: ButtonState, x: number, y: number): void {
    if (b.phase === PENDING && Math.hypot(x - b.startX, y - b.startY) > DRAG_SLOP_PX) b.phase = DRAGGING;
  }
}
