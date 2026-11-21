/**
 * Browser adapter of the input layer: listens to keyboard, mouse, wheel, pointer lock and touch, feeds the
 * DOM-free InputCore, and owns the on-screen touch overlay. The game reads one Intent per frame from frame().
 */
import type { GameBus, InputState, Settings } from '../../core/context';
import { InputCore } from './core';
import type { TouchTarget } from './gestures';
import type { Intent } from './intent';
import { physicalCode } from './keys';
import { TouchOverlay, type TouchButton } from './touchOverlay';

export interface InputManagerOptions {
  /** The #app element: receives pointer events for looking and for world taps / holds. */
  container: HTMLElement;
  /** Element the on-screen touch controls are built in (the UI root's touch layer). */
  touchLayer: HTMLElement;
  settings: Settings;
  state: InputState;
  bus: GameBus;
}

/** How long requestPointerCapture waits for the browser to answer before giving up. */
const LOCK_TIMEOUT_MS = 800;
/** After this many refusals in a row, clicks stop asking for pointer lock (drag-to-look stays in charge). */
const MAX_AUTO_LOCK_FAILURES = 2;
/** Elements whose events belong to the UI, never to the game surface. */
const UI_SELECTOR = '.hw-window, .hw-ui-blocking';

const isTextInput = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

type PointerRole = { kind: 'gesture'; button: TouchButton | null } | { kind: 'tap'; button: TouchButton };

export class InputManager {
  readonly core: InputCore;
  private readonly container: HTMLElement;
  private readonly overlay: TouchOverlay;
  private readonly settings: Settings;
  private readonly state: InputState;
  private readonly bus: GameBus;
  private readonly cleanups: Array<() => void> = [];
  /** Touch pointers in flight and what they landed on. */
  private readonly touchPointers = new Map<number, PointerRole>();
  private readonly pressedCount = new Map<TouchButton, number>();
  private rectLeft = 0;
  private rectTop = 0;
  /** The browser has no pointer lock at all. */
  private lockUnsupported = false;
  /** Pointer lock requests refused in a row (reset by a successful capture). */
  private lockFailures = 0;
  /** We asked the browser to leave pointer lock, so the unlock is not the player pressing Escape. */
  private expectUnlock = false;
  private lockWaiters: Array<(locked: boolean) => void> = [];
  /** A touch was seen ('auto' shows the overlay from then on even if the media query said otherwise). */
  private touchSeen = false;
  private wasBlocked = false;
  private disposed = false;

  constructor(options: InputManagerOptions) {
    this.container = options.container;
    this.settings = options.settings;
    this.state = options.state;
    this.bus = options.bus;
    this.core = new InputCore(this.settings);
    this.overlay = new TouchOverlay(options.touchLayer);
    this.container.classList.add('hw-touch-surface');

    const c = this.container;
    this.listen(c, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(c, 'contextmenu', (e) => this.preventOnSurface(e));
    this.listen(c, 'dblclick', (e) => this.preventOnSurface(e));
    this.listen(c, 'selectstart', (e) => this.preventOnSurface(e));
    this.listen(c, 'touchstart', (e) => this.preventOnSurface(e), { passive: false });
    this.listen(c, 'touchmove', (e) => this.preventOnSurface(e), { passive: false });
    this.listen(c, 'gesturestart', (e) => e.preventDefault(), { passive: false });
    this.listen(c, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    // Moves and releases are followed on the window: fingers and buttons that started on the game surface
    // must keep working (and let go) wherever they travel.
    this.listen(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent, false));
    this.listen(window, 'pointercancel', (e) => this.onPointerUp(e as PointerEvent, true));
    this.listen(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(window, 'blur', () => this.releaseEverything());
    this.listen(window, 'resize', () => this.measure());
    this.listen(window, 'orientationchange', () => this.measure());
    this.listen(document, 'visibilitychange', () => this.releaseEverything());
    this.listen(document, 'pointerlockchange', () => this.onLockChange());
    this.listen(document, 'pointerlockerror', () => this.onLockError());
    this.cleanups.push(this.bus.on('settings:changed', () => this.refreshTouchVisibility()));

    this.measure();
    this.refreshTouchVisibility();
  }

  /** Whether the on-screen touch controls are enabled by the settings (and the device). */
  get touchEnabled(): boolean {
    const mode = this.settings.touchControls;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return this.touchSeen || deviceHasTouch();
  }

  /** True when the mouse is not captured, so a mouse looks around by dragging. */
  get usingDragLook(): boolean {
    return !this.isLocked();
  }

  /**
   * This frame's intent; accumulated deltas and edges are consumed. While a screen is open or the game is
   * paused it is neutral and every held control is released.
   */
  frame(dtSeconds: number): Intent {
    const blocked = this.state.uiOpen || this.state.paused;
    if (blocked && !this.wasBlocked) {
      this.touchPointers.clear();
      this.pressedCount.clear();
      this.overlay.clearPressed();
    }
    this.wasBlocked = blocked;
    const intent = this.core.frame(dtSeconds, performance.now(), blocked);
    this.state.pointerLocked = this.isLocked();
    this.overlay.setVisible(this.touchEnabled && !blocked);
    this.overlay.render(this.core.touch);
    return intent;
  }

  /**
   * Captures the mouse for looking around (call from a user gesture). Resolves to whether it is captured.
   * When the browser refuses, drag-to-look takes over and this resolves false.
   */
  requestPointerCapture(): Promise<boolean> {
    if (this.isLocked()) return Promise.resolve(true);
    if (this.disposed || this.lockUnsupported) return Promise.resolve(false);
    const el = this.container as HTMLElement & { requestPointerLock?: (options?: object) => unknown };
    if (typeof el.requestPointerLock !== 'function') {
      this.lockUnsupported = true;
      return Promise.resolve(false);
    }
    if (this.lockWaiters.length > 0) return new Promise<boolean>((resolve) => this.lockWaiters.push(resolve));
    const answer = new Promise<boolean>((resolve) => {
      this.lockWaiters.push(resolve);
      window.setTimeout(() => {
        if (this.lockWaiters.length > 0 && !this.isLocked()) this.onLockError();
      }, LOCK_TIMEOUT_MS);
    });
    try {
      const result = el.requestPointerLock();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(
          () => this.settleLock(this.isLocked()),
          () => this.onLockError(),
        );
      }
    } catch {
      this.onLockError();
    }
    return answer;
  }

  /** Lets the mouse go (a screen opened). Does not count as a pause request. */
  releasePointerCapture(): void {
    if (!this.isLocked()) return;
    this.expectUnlock = true;
    try {
      document.exitPointerLock();
    } catch {
      this.expectUnlock = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releasePointerCapture();
    for (const off of this.cleanups) off();
    this.cleanups.length = 0;
    this.settleLock(false);
    this.overlay.dispose();
    this.container.classList.remove('hw-touch-surface');
    this.state.touch = false;
    this.state.pointerLocked = false;
  }

  // ---------------------------------------------------------------------------------------------

  private listen(target: EventTarget, type: string, fn: (e: Event) => void, options?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, options);
    this.cleanups.push(() => target.removeEventListener(type, fn, options));
  }

  private isLocked(): boolean {
    return document.pointerLockElement === this.container;
  }

  /** Events on UI windows, HUD widgets and anything opted out belong to the UI, not to the game surface. */
  private isUiTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target.closest(UI_SELECTOR)) return true;
    // Inside the UI root, only the touch overlay is part of the game surface; every other element that
    // receives pointer events there (hotbar slots, the goal tracker...) is a UI widget.
    return target.closest('.hw-root') !== null && target.closest('.hw-touch') === null;
  }

  private preventOnSurface(e: Event): void {
    if (!this.isUiTarget(e.target)) e.preventDefault();
  }

  private blocked(): boolean {
    return this.state.uiOpen || this.state.paused;
  }

  private measure(): void {
    const rect = this.container.getBoundingClientRect();
    this.rectLeft = rect.left;
    this.rectTop = rect.top;
    this.core.touch.setViewport(Math.max(1, rect.width), Math.max(1, rect.height));
  }

  private refreshTouchVisibility(): void {
    this.state.touch = this.touchEnabled;
    if (!this.state.touch) this.overlay.setVisible(false);
  }

  private releaseEverything(): void {
    this.core.releaseAll();
    this.touchPointers.clear();
    this.pressedCount.clear();
    this.overlay.clearPressed();
  }

  // ---- pointer events ---------------------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    if (this.isUiTarget(e.target)) return;
    if (e.pointerType === 'mouse') {
      this.onMouseDown(e);
      return;
    }
    if (!this.touchSeen) {
      this.touchSeen = true;
      this.refreshTouchVisibility();
    }
    if (this.blocked()) return;
    e.preventDefault();
    const button = this.overlay.buttonAt(e.target);
    if (button === 'bag' || button === 'pause') {
      this.touchPointers.set(e.pointerId, { kind: 'tap', button });
      this.press(button, true);
      return;
    }
    const target: TouchTarget = button ?? 'world';
    this.touchPointers.set(e.pointerId, { kind: 'gesture', button });
    if (button) this.press(button, true);
    this.core.touch.down(e.pointerId, e.clientX - this.rectLeft, e.clientY - this.rectTop, e.timeStamp, target);
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      if (this.isLocked()) this.core.mouseMove(e.movementX, e.movementY);
      else if (!this.blocked()) this.core.drag.move(e.clientX, e.clientY, e.timeStamp);
      return;
    }
    const role = this.touchPointers.get(e.pointerId);
    if (!role || role.kind !== 'gesture') return;
    e.preventDefault();
    this.core.touch.move(e.pointerId, e.clientX - this.rectLeft, e.clientY - this.rectTop, e.timeStamp);
  }

  private onPointerUp(e: PointerEvent, cancelled: boolean): void {
    if (e.pointerType === 'mouse') {
      this.onMouseUp(e);
      return;
    }
    const role = this.touchPointers.get(e.pointerId);
    if (!role) return;
    this.touchPointers.delete(e.pointerId);
    if (role.button) this.press(role.button, false);
    if (role.kind === 'tap') {
      if (!cancelled && this.overlay.hit(role.button, e.clientX, e.clientY)) {
        if (role.button === 'bag') this.core.requestInventory();
        else this.core.requestPause();
      }
      return;
    }
    if (cancelled) this.core.touch.cancel(e.pointerId);
    else this.core.touch.up(e.pointerId, e.timeStamp);
  }

  private press(button: TouchButton, down: boolean): void {
    const n = Math.max(0, (this.pressedCount.get(button) ?? 0) + (down ? 1 : -1));
    this.pressedCount.set(button, n);
    this.overlay.setPressed(button, n > 0);
  }

  private onMouseDown(e: PointerEvent): void {
    if (this.blocked() || (e.button !== 0 && e.button !== 2)) return;
    const which = e.button === 0 ? 'left' : 'right';
    if (this.isLocked()) {
      e.preventDefault();
      this.core.mouseButton(which, true);
      return;
    }
    // Not captured yet: try to capture, and meanwhile treat the press as a drag-to-look press so a refusal
    // (or a browser without pointer lock) never leaves the player unable to look or mine.
    this.core.drag.down(which, e.clientX, e.clientY, e.timeStamp);
    if (which === 'left' && this.lockFailures < MAX_AUTO_LOCK_FAILURES) void this.requestPointerCapture();
  }

  private onMouseUp(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 2) return;
    const which = e.button === 0 ? 'left' : 'right';
    if (this.isLocked()) this.core.mouseButton(which, false);
    else this.core.drag.up(which, e.timeStamp);
  }

  private onWheel(e: WheelEvent): void {
    if (this.isUiTarget(e.target)) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
    this.core.wheel(e.deltaY * scale);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const code = physicalCode(e.code, e.key);
    if (!code) return;
    if (!down) {
      this.core.keyUp(code);
      return;
    }
    if (isTextInput(e.target)) return;
    if (this.core.keyDown(code, e.repeat) && code !== 'Escape') e.preventDefault();
  }

  // ---- pointer lock -----------------------------------------------------------------------------

  private onLockChange(): void {
    const locked = this.isLocked();
    this.state.pointerLocked = locked;
    // Whatever the drag fallback had pressed belongs to the time before the capture.
    this.core.drag.reset();
    if (locked) {
      this.lockFailures = 0;
      this.settleLock(true);
      return;
    }
    this.core.mouseButton('left', false);
    this.core.mouseButton('right', false);
    // The browser consumes Escape to leave pointer lock: treat an unlock we did not ask for as a pause.
    if (!this.expectUnlock && !this.blocked()) this.core.requestPause();
    this.expectUnlock = false;
  }

  private onLockError(): void {
    if (this.lockWaiters.length === 0) return;
    this.lockFailures++;
    this.settleLock(false);
  }

  private settleLock(locked: boolean): void {
    const waiters = this.lockWaiters;
    if (waiters.length === 0) return;
    this.lockWaiters = [];
    for (const resolve of waiters) resolve(locked);
  }
}

function deviceHasTouch(): boolean {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
  } catch {
    // matchMedia unavailable: fall through to the touch point count.
  }
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}
