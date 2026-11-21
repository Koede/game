/**
 * What the player wants to do this frame, independent of the device it came from.
 *
 * Conventions:
 *  - moveX > 0 strafes right, moveZ > 0 walks forward (the direction the view faces). The (moveX, moveZ)
 *    vector never exceeds length 1; a half-pushed joystick gives a shorter vector (analog walking).
 *  - lookYaw > 0 turns the view to the RIGHT, lookPitch > 0 tilts it UP. Both are deltas for this frame in
 *    radians, already scaled by the mouse / touch sensitivity and (pitch) by invertY from Settings.
 */
export interface Intent {
  moveX: number;
  moveZ: number;
  lookYaw: number;
  lookPitch: number;
  /** Held. */
  jump: boolean;
  /** Held. */
  sprint: boolean;
  /** Held. */
  mine: boolean;
  /** True on the frame the use control was pressed, and again every USE_REPEAT_S while it stays held. */
  use: boolean;
  /** 0-8 on the frame a number key was pressed, otherwise null. */
  hotbarSlot: number | null;
  /** -1 (previous slot), 0 or +1 (next slot) from the mouse wheel. */
  hotbarStep: -1 | 0 | 1;
  /** Edge-triggered: true for exactly one frame per press. */
  inventory: boolean;
  log: boolean;
  pause: boolean;
}

export function createIntent(): Intent {
  return {
    moveX: 0,
    moveZ: 0,
    lookYaw: 0,
    lookPitch: 0,
    jump: false,
    sprint: false,
    mine: false,
    use: false,
    hotbarSlot: null,
    hotbarStep: 0,
    inventory: false,
    log: false,
    pause: false,
  };
}

/** Resets `intent` in place to "nothing pressed" and returns it. */
export function clearIntent(intent: Intent): Intent {
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.lookYaw = 0;
  intent.lookPitch = 0;
  intent.jump = false;
  intent.sprint = false;
  intent.mine = false;
  intent.use = false;
  intent.hotbarSlot = null;
  intent.hotbarStep = 0;
  intent.inventory = false;
  intent.log = false;
  intent.pause = false;
  return intent;
}
