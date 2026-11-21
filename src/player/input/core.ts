/**
 * DOM-free heart of the input layer: collects key, mouse and touch state and folds it into one Intent per
 * frame. InputManager is the thin browser adapter that feeds it events.
 */
import type { Settings } from '../../core/context';
import { TouchGestures, type LookDelta } from './gestures';
import { clearIntent, createIntent, type Intent } from './intent';
import { CMD_INVENTORY, CMD_LOG, CMD_NONE, CMD_PAUSE, NO_KEYS, isGameKey, keyAxisX, keyAxisZ, keyCommand, keyJump, keySprint, reduceKeys } from './keys';
import { MouseDrag } from './mouseDrag';

/** View rotation per pixel of mouse travel at sensitivity 1. */
export const MOUSE_RAD_PER_PX = 0.0022;
/** View rotation per CSS pixel of finger travel at sensitivity 1 (a thumb sweep across a phone turns ~100 degrees). */
export const TOUCH_RAD_PER_PX = 0.0048;
/** While the use control stays held, `use` fires again this often (seconds). */
export const USE_REPEAT_S = 0.25;
/** Time constant (seconds) of the touch look filter: evens out uneven touch sampling without perceptible lag. */
export const TOUCH_SMOOTH_S = 0.02;

/** Wheel travel (pixels) that counts as one hotbar step; a mouse wheel notch is ~100. */
const WHEEL_STEP_PX = 40;
const MAX_QUEUED_WHEEL_STEPS = 9;
/** Largest single mouse movement accepted (pixels); browsers occasionally report a wild jump while locked. */
const MAX_MOUSE_JUMP_PX = 600;

export class InputCore {
  readonly touch = new TouchGestures();
  /** Mouse state while the pointer is NOT captured (drag-to-look fallback). */
  readonly drag = new MouseDrag();

  private readonly intent = createIntent();
  private readonly look: LookDelta = { x: 0, y: 0 };
  private keys = NO_KEYS;
  private mouseX = 0;
  private mouseY = 0;
  /** Touch look travel not yet handed out (see TOUCH_SMOOTH_S). */
  private touchX = 0;
  private touchY = 0;
  private lockedMine = false;
  private lockedUse = false;
  private usePending = false;
  private useTimer = 0;
  /** Seconds between repeats of a held Use (USE_REPEAT_S; a hand station sets its own stroke rate). */
  useRepeatS = USE_REPEAT_S;
  private wheelTravel = 0;
  private wheelSteps = 0;
  private hotbarSlot: number | null = null;
  private inventoryEdge = false;
  private logEdge = false;
  private pauseEdge = false;
  private blocked = false;
  private armed = false;

  constructor(private readonly settings: Settings) {}

  /** The touch Place toggle is armed: the next Use places the held block (see Intent.place). */
  get placeArmed(): boolean {
    return this.armed;
  }

  /** Arms or disarms the touch Place toggle. */
  togglePlace(): void {
    if (!this.blocked) this.armed = !this.armed;
  }

  /** Gameplay input was blocked (a screen open or paused) on the most recent frame. */
  get isBlocked(): boolean {
    return this.blocked;
  }

  /**
   * A key went down. Returns true when the game used it (the caller then suppresses the browser default).
   * Ignored while blocked, so the key press that closes a screen cannot leak into the game.
   */
  keyDown(code: string, repeat = false): boolean {
    if (this.blocked || !isGameKey(code)) return false;
    this.keys = reduceKeys(this.keys, 'down', code);
    if (!repeat) this.command(keyCommand(code));
    return true;
  }

  keyUp(code: string): void {
    this.keys = reduceKeys(this.keys, 'up', code);
  }

  /** Relative mouse travel while the pointer is captured. */
  mouseMove(dx: number, dy: number): void {
    if (this.blocked) return;
    if (Math.abs(dx) > MAX_MOUSE_JUMP_PX || Math.abs(dy) > MAX_MOUSE_JUMP_PX) return;
    this.mouseX += dx;
    this.mouseY += dy;
  }

  /** A mouse button changed while the pointer is captured: left mines while held, right uses. */
  mouseButton(button: 'left' | 'right', down: boolean): void {
    if (this.blocked && down) return;
    if (button === 'left') {
      this.lockedMine = down;
    } else {
      if (down && !this.lockedUse) this.pressUse();
      this.lockedUse = down;
    }
  }

  /** Wheel travel in pixels (positive = towards the user = next hotbar slot). */
  wheel(deltaY: number): void {
    if (this.blocked || deltaY === 0) return;
    // A wheel notch is one step no matter how large the browser reports it; trackpads add up small deltas.
    if (Math.abs(deltaY) >= WHEEL_STEP_PX) {
      this.wheelSteps += Math.sign(deltaY);
      this.wheelTravel = 0;
    } else {
      if (Math.sign(deltaY) !== Math.sign(this.wheelTravel)) this.wheelTravel = 0;
      this.wheelTravel += deltaY;
      if (Math.abs(this.wheelTravel) >= WHEEL_STEP_PX) {
        this.wheelSteps += Math.sign(this.wheelTravel);
        this.wheelTravel = 0;
      }
    }
    this.wheelSteps = Math.max(-MAX_QUEUED_WHEEL_STEPS, Math.min(MAX_QUEUED_WHEEL_STEPS, this.wheelSteps));
  }

  /** One-shot requests from on-screen buttons and from losing the pointer capture. */
  requestInventory(): void {
    this.command(CMD_INVENTORY);
  }

  requestLog(): void {
    this.command(CMD_LOG);
  }

  requestPause(): void {
    this.command(CMD_PAUSE);
  }

  /** Lets go of every key, button and finger and drops everything accumulated. */
  releaseAll(): void {
    this.keys = NO_KEYS;
    this.touch.reset();
    this.drag.reset();
    this.mouseX = 0;
    this.mouseY = 0;
    this.touchX = 0;
    this.touchY = 0;
    this.lockedMine = false;
    this.lockedUse = false;
    this.usePending = false;
    this.useTimer = 0;
    this.wheelTravel = 0;
    this.wheelSteps = 0;
    this.hotbarSlot = null;
    this.inventoryEdge = false;
    this.logEdge = false;
    this.pauseEdge = false;
    this.armed = false;
  }

  /**
   * Builds this frame's intent and clears what was accumulated. `nowMs` drives the hold timers. While
   * `blocked`, everything held is released and the intent is neutral. The returned object is reused by
   * the next call.
   */
  frame(dtSeconds: number, nowMs: number, blocked: boolean): Intent {
    const intent = this.intent;
    this.blocked = blocked;
    if (blocked) {
      this.releaseAll();
      return clearIntent(intent);
    }
    this.touch.update(nowMs);
    this.drag.update(nowMs);

    const stick = this.touch.stick;
    let moveX = keyAxisX(this.keys) + stick.x;
    let moveZ = keyAxisZ(this.keys) + stick.z;
    const length = Math.hypot(moveX, moveZ);
    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }
    intent.moveX = moveX;
    intent.moveZ = moveZ;

    this.frameLook(intent, dtSeconds);

    intent.jump = keyJump(this.keys) || this.touch.jumpHeld;
    intent.sprint = keySprint(this.keys) || stick.sprint;
    intent.mine = this.lockedMine || this.drag.mineHeld || this.touch.mineHeld;
    intent.use = this.frameUse(dtSeconds);
    // Shift is also sprint: it only means "place" together with a Use, and sprinting needs the walk key anyway.
    intent.place = intent.use && (keySprint(this.keys) || this.armed);
    if (intent.use) this.armed = false;

    intent.hotbarSlot = this.hotbarSlot;
    this.hotbarSlot = null;
    const step = Math.sign(this.wheelSteps) as -1 | 0 | 1;
    intent.hotbarStep = step;
    this.wheelSteps -= step;

    intent.inventory = this.inventoryEdge;
    intent.log = this.logEdge;
    intent.pause = this.pauseEdge;
    this.inventoryEdge = false;
    this.logEdge = false;
    this.pauseEdge = false;
    return intent;
  }

  private frameLook(intent: Intent, dt: number): void {
    const look = this.look;
    this.drag.takeLook(look);
    const mouseX = this.mouseX + look.x;
    const mouseY = this.mouseY + look.y;
    this.mouseX = 0;
    this.mouseY = 0;

    this.touch.takeLook(look);
    this.touchX += look.x;
    this.touchY += look.y;
    const share = 1 - Math.exp(-dt / TOUCH_SMOOTH_S);
    let touchX = this.touchX * share;
    let touchY = this.touchY * share;
    if (Math.abs(this.touchX - touchX) < 0.05) touchX = this.touchX;
    if (Math.abs(this.touchY - touchY) < 0.05) touchY = this.touchY;
    this.touchX -= touchX;
    this.touchY -= touchY;

    const mouse = MOUSE_RAD_PER_PX * this.settings.mouseSensitivity;
    const touch = TOUCH_RAD_PER_PX * this.settings.touchSensitivity;
    const pitchSign = this.settings.invertY ? 1 : -1;
    intent.lookYaw = mouseX * mouse + touchX * touch;
    intent.lookPitch = pitchSign * (mouseY * mouse + touchY * touch);
  }

  private frameUse(dt: number): boolean {
    if (this.touch.takeUsePulses() + this.drag.takeUsePulses() > 0) this.pressUse();
    if (this.usePending) {
      this.usePending = false;
      this.useTimer = 0;
      return true;
    }
    if (!(this.lockedUse || this.drag.useHeld || this.touch.useHeld)) return false;
    this.useTimer += dt;
    if (this.useTimer < this.useRepeatS) return false;
    this.useTimer -= this.useRepeatS;
    return true;
  }

  private pressUse(): void {
    this.usePending = true;
  }

  private command(cmd: number): void {
    if (this.blocked || cmd === CMD_NONE) return;
    if (cmd === CMD_INVENTORY) this.inventoryEdge = true;
    else if (cmd === CMD_LOG) this.logEdge = true;
    else if (cmd === CMD_PAUSE) this.pauseEdge = true;
    else this.hotbarSlot = cmd;
  }
}
