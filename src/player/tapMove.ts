/**
 * Tap to move (Settings.tapToMove): a tap on the world walks the player there. DOM-free and allocation-free.
 *
 * `tapDirection` turns a tap on the screen into a ray; the controller casts it into the world and hands the cell it
 * lands on to `TapMove.set`. Each frame `steer` turns the body toward the goal and says how to walk: forward once it
 * faces the goal, a hop when something low blocks the way, and it gives up on arriving, on being stuck, on a timeout
 * and the moment the player touches the stick or a key (manual input always wins).
 */

/** Closest the body gets to the goal cell's centre before the walk counts as arrived (blocks). */
export const ARRIVE_DIST = 0.4;
/** Fastest the view turns toward the goal (rad/s). */
export const TURN_RATE = 7;
/** Walks forward only while the body is within this angle (rad) of the goal; it turns on the spot beyond. */
export const FACE_ANGLE = 0.5;
/** No progress for this long (s): hop once; for GIVE_UP_S: stop. */
export const HOP_AFTER_S = 0.3;
export const GIVE_UP_S = 1.4;
/** Progress that resets the stuck timer (blocks). */
export const PROGRESS_STEP = 0.08;
/** A walk never lasts longer than this (s). */
export const MAX_WALK_S = 25;
/** Farthest a tap is followed (blocks, ray length). */
export const TAP_RANGE = 40;

export interface Dir3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The world-space direction under a tap. `ndcX` / `ndcY` run -1..1 from the left / bottom of the view, `aspect` is
 * width / height, `fovDeg` the vertical field of view. Yaw 0 looks along -Z and positive yaw turns left; positive pitch looks up.
 */
export function tapDirection(ndcX: number, ndcY: number, aspect: number, fovDeg: number, yaw: number, pitch: number, out: Dir3): Dir3 {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const sx = ndcX * t * aspect;
  const sy = ndcY * t;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  // forward (-sinY cosP, sinP, -cosY cosP), right (cosY, 0, -sinY), up = right x forward.
  out.x = -sinY * cosP + cosY * sx + sinY * sinP * sy;
  out.y = sinP + cosP * sy;
  out.z = -cosY * cosP - sinY * sx + cosY * sinP * sy;
  const len = Math.hypot(out.x, out.y, out.z) || 1;
  out.x /= len;
  out.y /= len;
  out.z /= len;
  return out;
}

/**
 * Where a world point shows on screen, as -1..1 from the left / bottom (the inverse of `tapDirection`), or null when it
 * is behind the camera or off the screen. (dx, dy, dz) is the point minus the eye.
 */
export function projectPoint(dx: number, dy: number, dz: number, aspect: number, fovDeg: number, yaw: number, pitch: number, out: { x: number; y: number }): { x: number; y: number } | null {
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  const depth = -sinY * cosP * dx + sinP * dy - cosY * cosP * dz;
  if (depth < 0.1) return null;
  const right = cosY * dx - sinY * dz;
  const up = sinY * sinP * dx + cosP * dy + cosY * sinP * dz;
  const t = Math.tan((fovDeg * Math.PI) / 360);
  out.x = right / (depth * t * aspect);
  out.y = up / (depth * t);
  return Math.abs(out.x) <= 1 && Math.abs(out.y) <= 1 ? out : null;
}

export interface Steer {
  /** The yaw the body should have now (the controller writes it). */
  yaw: number;
  /** 1 = walk forward, 0 = turn on the spot. */
  moveZ: number;
  /** Hop (something low is in the way). */
  jump: boolean;
}

const wrap = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class TapMove {
  /** The goal cell's centre, valid while `active`. */
  x = 0;
  /** Height of the floor at the goal (for the on-screen marker). */
  y = 0;
  z = 0;
  active = false;
  private age = 0;
  private stuck = 0;
  private best = Infinity;
  private readonly out: Steer = { yaw: 0, moveZ: 0, jump: false };

  /** Starts walking toward (x, z). */
  set(x: number, z: number, y = 0): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.active = true;
    this.age = 0;
    this.stuck = 0;
    this.best = Infinity;
  }

  cancel(): void {
    this.active = false;
  }

  /**
   * One frame: body at (px, pz) facing `yaw`. `manual` is true when the player pushes the stick or a key (or hops):
   * that ends the walk. Returns what to do (the same object each call), or null when there is no walk.
   */
  steer(px: number, pz: number, yaw: number, dt: number, manual: boolean): Steer | null {
    if (!this.active) return null;
    const dx = this.x - px;
    const dz = this.z - pz;
    const dist = Math.hypot(dx, dz);
    this.age += dt;
    if (manual || dist < ARRIVE_DIST || this.age > MAX_WALK_S) {
      this.active = false;
      return null;
    }
    const want = Math.atan2(-dx, -dz);
    const diff = wrap(want - yaw);
    const turn = Math.min(Math.abs(diff), TURN_RATE * dt) * Math.sign(diff);
    const facing = Math.abs(diff) <= FACE_ANGLE;
    if (dist < this.best - PROGRESS_STEP) {
      this.best = dist;
      this.stuck = 0;
    } else if (facing) this.stuck += dt;
    if (this.stuck > GIVE_UP_S) {
      this.active = false;
      return null;
    }
    this.out.yaw = wrap(yaw + turn);
    this.out.moveZ = facing ? 1 : 0;
    this.out.jump = this.stuck > HOP_AFTER_S;
    return this.out;
  }
}
