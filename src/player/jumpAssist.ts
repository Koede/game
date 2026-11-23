/**
 * Forgiving jumps: coyote time (a jump pressed a moment after walking off a ledge still works) and jump buffering
 * (a jump pressed a moment before landing fires on touchdown). Pure and allocation-free; the physics asks it once per step.
 */

/** Seconds after leaving the ground that a jump press still counts. */
export const COYOTE_S = 0.12;
/** Seconds a jump press is remembered while still in the air. */
export const JUMP_BUFFER_S = 0.12;

export class JumpAssist {
  coyote = 0;
  buffer = 0;
  private held = false;

  /**
   * Advances the timers by `dt`. Returns true when a jump should fire now. With `enabled` false it is exactly the
   * classic rule: jump while held and standing.
   */
  update(dt: number, jump: boolean, onGround: boolean, enabled: boolean): boolean {
    const press = jump && !this.held;
    this.held = jump;
    if (!enabled) {
      this.coyote = 0;
      this.buffer = 0;
      return jump && onGround;
    }
    this.buffer = press ? JUMP_BUFFER_S : Math.max(0, this.buffer - dt);
    this.coyote = onGround ? COYOTE_S : Math.max(0, this.coyote - dt);
    const go = (jump && onGround) || (this.buffer > 0 && (onGround || this.coyote > 0));
    if (go) {
      this.buffer = 0;
      this.coyote = 0;
    }
    return go;
  }

  reset(): void {
    this.coyote = 0;
    this.buffer = 0;
    this.held = false;
  }
}
