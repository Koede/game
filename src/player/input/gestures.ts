/**
 * Pure multi-touch gesture state machine: pointer down / move / up with timestamps in; joystick vector, look
 * deltas, taps, holds and button states out. No DOM - the adapter in InputManager feeds it pointer events.
 *
 * Every pointer gets a role when it lands and keeps it until it lifts, so three fingers (stick, look, button)
 * never disturb each other:
 *  - 'world' in the lower-left region while no stick exists -> the floating joystick
 *  - 'world' anywhere else -> look; a short still tap fires use; holding still starts mining, and that
 *    same finger may then drag to look while it keeps mining
 *  - 'jump' | 'mine' | 'use' -> that on-screen button; a finger resting on Mine or Use may drag to look
 */
import { clamp } from '../../core/math';

export type TouchTarget = 'world' | 'jump' | 'mine' | 'use';

export interface GestureConfig {
  /** A world touch shorter than this (ms) that stayed within tapSlopPx is a tap (use). */
  tapMaxMs: number;
  tapSlopPx: number;
  /** A world touch that stayed within tapSlopPx for this long (ms) becomes a hold (mine). */
  holdMs: number;
  /** Finger travel ignored before a look drag starts, so taps do not nudge the view. */
  lookSlopPx: number;
  /** Fraction of the stick radius around the centre that reads as zero. */
  deadZone: number;
  /** Stick deflection (0..1 of the radius) at which sprint switches on / back off. */
  sprintOn: number;
  sprintOff: number;
}

export const GESTURE_DEFAULTS: Readonly<GestureConfig> = {
  // Equal to holdMs: a still touch lifted at any time before mining starts is a tap (no dead band between them).
  tapMaxMs: 280,
  tapSlopPx: 10,
  holdMs: 280,
  lookSlopPx: 4,
  deadZone: 0.14,
  sprintOn: 0.9,
  sprintOff: 0.78,
};

/** Hold indicator phases (for the ring drawn under a finger that is about to mine / is mining). */
export const HOLD_NONE = 0;
export const HOLD_CHARGING = 1;
export const HOLD_MINING = 2;

const NONE = 0;
const STICK = 1;
const LOOK = 2;
const JUMP = 3;
const MINE = 4;
const USE = 5;
const MAX_POINTERS = 10;
/**
 * Most a single frame adds to a still finger's hold time (ms). After a stall the next frames may run before the lift
 * that happened during it is delivered; counting the stall in full would turn that tap into mining.
 */
export const MAX_HOLD_STEP_MS = 150;

interface Pointer {
  id: number;
  role: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  downT: number;
  /** Farthest the pointer ever got from where it landed. */
  maxDist: number;
  /** Hold time counted by frames (each frame adds at most MAX_HOLD_STEP_MS). */
  frameHeld: number;
  looking: boolean;
  holding: boolean;
}

/** Live joystick state. `x`/`z` are the dead-zoned move vector (length <= 1, z forward). */
export interface StickState {
  active: boolean;
  /** Centre of the base in viewport pixels (where the thumb landed, dragged along when pulled past the rim). */
  originX: number;
  originY: number;
  /** Knob offset from the centre in pixels, limited to the radius. */
  knobX: number;
  knobY: number;
  x: number;
  z: number;
  sprint: boolean;
  radius: number;
}

export interface LookDelta {
  x: number;
  y: number;
}

export class TouchGestures {
  readonly config: GestureConfig;
  readonly stick: StickState = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0, x: 0, z: 0, sprint: false, radius: 60 };
  /** Hold indicator, refreshed by update(): phase, finger position and 0..1 charge. */
  holdPhase = HOLD_NONE;
  holdX = 0;
  holdY = 0;
  holdProgress = 0;

  private readonly pointers: Pointer[] = [];
  private width = 390;
  private height = 844;
  private lookX = 0;
  private lookY = 0;
  private usePulses = 0;
  private worldTaps = 0;
  private jumpCount = 0;
  private mineCount = 0;
  private useCount = 0;
  /** Time of the previous update() (frame clock); -Infinity before the first. */
  private lastUpdateT = -Infinity;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...GESTURE_DEFAULTS, ...config };
    for (let i = 0; i < MAX_POINTERS; i++) {
      this.pointers.push({ id: 0, role: NONE, startX: 0, startY: 0, lastX: 0, lastY: 0, downT: 0, maxDist: 0, frameHeld: 0, looking: false, holding: false });
    }
    this.setViewport(this.width, this.height);
  }

  /** Size of the touch surface in pixels; pointer coordinates are relative to its top-left corner. */
  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.stick.radius = clamp(Math.min(width, height) * 0.16, 48, 66);
  }

  /** One-handed: the joystick starts in the lower part of that side's half (buttons win first), looking uses the rest. */
  handed: 'off' | 'left' | 'right' = 'off';

  /** The joystick may start anywhere in the lower-left region: left half, below the HUD band. */
  inStickRegion(x: number, y: number): boolean {
    if (this.handed !== 'off') {
      const onSide = this.handed === 'left' ? x < this.width * 0.5 : x >= this.width * 0.5;
      return onSide && y > this.height * 0.55;
    }
    const top = this.width > this.height ? 0.22 : 0.4;
    return x < this.width * 0.5 && y > this.height * top;
  }

  has(id: number): boolean {
    return this.find(id) !== null;
  }

  get jumpHeld(): boolean {
    return this.jumpCount > 0;
  }

  /** Mine button held, or a finger holding still on the world. */
  get mineHeld(): boolean {
    return this.mineCount > 0;
  }

  /** Use button held (drives auto-repeat; the press itself arrives through takeUsePulses). */
  get useHeld(): boolean {
    return this.useCount > 0;
  }

  down(id: number, x: number, y: number, t: number, target: TouchTarget): void {
    if (this.find(id)) this.cancel(id);
    const p = this.pointers.find((slot) => slot.role === NONE);
    if (!p) return;
    p.id = id;
    p.startX = p.lastX = x;
    p.startY = p.lastY = y;
    p.downT = t;
    p.maxDist = 0;
    p.frameHeld = 0;
    p.looking = false;
    p.holding = false;
    switch (target) {
      case 'jump':
        p.role = JUMP;
        this.jumpCount++;
        break;
      case 'mine':
        p.role = MINE;
        this.mineCount++;
        break;
      case 'use':
        p.role = USE;
        this.useCount++;
        this.usePulses++;
        break;
      default:
        if (!this.stick.active && this.inStickRegion(x, y)) {
          p.role = STICK;
          this.stick.active = true;
          this.stick.originX = x;
          this.stick.originY = y;
          this.setStick(0, 0);
        } else {
          p.role = LOOK;
        }
    }
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.find(id);
    if (!p) return;
    if (p.role === STICK) {
      this.moveStick(x, y);
    } else if (p.role !== JUMP) {
      this.promoteHold(p, t);
      p.maxDist = Math.max(p.maxDist, Math.hypot(x - p.startX, y - p.startY));
      if (p.looking) {
        this.lookX += x - p.lastX;
        this.lookY += y - p.lastY;
      } else if (p.maxDist > (p.role === LOOK ? this.config.lookSlopPx : this.config.tapSlopPx)) {
        // Looking starts from here: the slop travelled so far is dropped rather than applied as a jump.
        p.looking = true;
      }
    }
    p.lastX = x;
    p.lastY = y;
  }

  up(id: number, t: number): void {
    const p = this.find(id);
    if (!p) return;
    if (p.role === LOOK) {
      const still = p.maxDist <= this.config.tapSlopPx;
      if (still && t - p.downT <= this.config.tapMaxMs && t - p.downT < this.config.holdMs) {
        // The finger lifted before the hold threshold by the event clock: a tap, even if a late frame already
        // promoted it to a hold (the frame clock ran ahead of events queued during a stall).
        if (p.holding) {
          p.holding = false;
          this.mineCount--;
        }
        this.usePulses++;
        this.worldTaps++;
      } else {
        this.promoteHold(p, t);
      }
    }
    this.release(p);
  }

  /** The pointer was taken away by the system: release it without firing a tap. */
  cancel(id: number): void {
    const p = this.find(id);
    if (p) this.release(p);
  }

  /**
   * Advances time-based state (hold-to-mine). Call once per frame with the current time. Frames count a still finger's
   * hold time at most MAX_HOLD_STEP_MS each, so a stall never turns a quick tap into mining by itself; if a late frame
   * still promotes a touch whose lift (by its own timestamp) came before holdMs, up() turns it back into a tap.
   */
  update(t: number): void {
    this.holdPhase = HOLD_NONE;
    const prev = this.lastUpdateT;
    this.lastUpdateT = t;
    for (const p of this.pointers) {
      if (p.role !== LOOK) continue;
      if (!p.holding && p.maxDist <= this.config.tapSlopPx) {
        p.frameHeld += Math.min(Math.max(0, t - Math.max(p.downT, prev)), MAX_HOLD_STEP_MS);
        if (p.frameHeld >= this.config.holdMs) {
          p.holding = true;
          this.mineCount++;
        }
      }
      const phase = p.holding ? HOLD_MINING : p.maxDist <= this.config.tapSlopPx ? HOLD_CHARGING : HOLD_NONE;
      if (phase <= this.holdPhase) continue;
      this.holdPhase = phase;
      this.holdX = p.lastX;
      this.holdY = p.lastY;
      this.holdProgress = p.holding ? 1 : clamp(p.frameHeld / this.config.holdMs, 0, 1);
    }
  }

  /** Moves the look travel (pixels, +x right, +y down) accumulated since the last call into `out`. */
  takeLook(out: LookDelta): void {
    out.x = this.lookX;
    out.y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
  }

  /** Number of taps on the bare world (not the Use button) since the last call: a stray tap must not do what only the button should. */
  takeWorldTaps(): number {
    const n = this.worldTaps;
    this.worldTaps = 0;
    return n;
  }

  /** Number of use presses (world taps + Use button presses) since the last call. */
  takeUsePulses(): number {
    const n = this.usePulses;
    this.usePulses = 0;
    return n;
  }

  /** Lifts every finger and forgets everything accumulated. */
  reset(): void {
    for (const p of this.pointers) if (p.role !== NONE) this.release(p);
    this.lookX = 0;
    this.lookY = 0;
    this.usePulses = 0;
    this.worldTaps = 0;
    this.holdPhase = HOLD_NONE;
  }

  private find(id: number): Pointer | null {
    for (const p of this.pointers) if (p.role !== NONE && p.id === id) return p;
    return null;
  }

  private promoteHold(p: Pointer, t: number): void {
    if (p.role !== LOOK || p.holding) return;
    if (p.maxDist <= this.config.tapSlopPx && t - p.downT >= this.config.holdMs) {
      p.holding = true;
      this.mineCount++;
    }
  }

  private release(p: Pointer): void {
    switch (p.role) {
      case STICK:
        this.stick.active = false;
        this.setStick(0, 0);
        break;
      case JUMP:
        this.jumpCount--;
        break;
      case MINE:
        this.mineCount--;
        break;
      case USE:
        this.useCount--;
        break;
      default:
        if (p.holding) this.mineCount--;
    }
    p.role = NONE;
  }

  private moveStick(x: number, y: number): void {
    const s = this.stick;
    let dx = x - s.originX;
    let dy = y - s.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > s.radius) {
      // The base trails the thumb so the rim stays under it and reversing direction is immediate.
      const pull = 1 - s.radius / dist;
      s.originX += dx * pull;
      s.originY += dy * pull;
      dx -= dx * pull;
      dy -= dy * pull;
    }
    this.setStick(dx, dy);
  }

  private setStick(dx: number, dy: number): void {
    const s = this.stick;
    const { deadZone, sprintOn, sprintOff } = this.config;
    s.knobX = dx;
    s.knobY = dy;
    const mag = Math.min(1, Math.hypot(dx, dy) / s.radius);
    if (mag <= deadZone) {
      s.x = 0;
      s.z = 0;
    } else {
      // Rescaled so the vector grows smoothly from 0 at the dead-zone edge to 1 at the rim.
      const scale = (mag - deadZone) / (1 - deadZone) / (mag * s.radius);
      s.x = dx * scale;
      s.z = -dy * scale;
    }
    s.sprint = s.active && mag >= (s.sprint ? sprintOff : sprintOn);
  }
}
