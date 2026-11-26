/**
 * The tap-to-move destination: a ring on the ground where the player is walking to (Settings.tapToMove). Placed in percent of the
 * HUD box each frame from the goal and the view; hidden when there is no walk or the goal is behind or off the screen.
 */
import { projectPoint } from '../../player/tapMove';
import { h } from '../kit/dom';

export interface TapGoalView {
  x: number;
  y: number;
  z: number;
}

export class TapMarker {
  readonly el: HTMLDivElement;
  private shown = false;
  private readonly at = { x: 0, y: 0 };

  constructor() {
    this.el = h('div', { class: 'hw-tapmark', attrs: { 'aria-hidden': 'true' } }, h('div', { class: 'hw-tapmark__ring' }), h('div', { class: 'hw-tapmark__dot' }));
    this.el.hidden = true;
  }

  /** `eye` is the camera position; yaw / pitch / fov as the controller has them; `aspect` the view's width / height. */
  update(goal: TapGoalView | null, eye: TapGoalView, yaw: number, pitch: number, fov: number, aspect: number): void {
    const p = goal ? projectPoint(goal.x - eye.x, goal.y - eye.y, goal.z - eye.z, aspect, fov, yaw, pitch, this.at) : null;
    if (!p) {
      if (this.shown) {
        this.shown = false;
        this.el.hidden = true;
      }
      return;
    }
    if (!this.shown) {
      this.shown = true;
      this.el.hidden = false;
    }
    this.el.style.left = `${((p.x + 1) * 50).toFixed(2)}%`;
    this.el.style.top = `${((1 - p.y) * 50).toFixed(2)}%`;
  }
}
