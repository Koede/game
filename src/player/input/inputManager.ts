/**
 * Browser adapter of the input layer: listens to keyboard, mouse, wheel, pointer lock and touch, feeds the
 * DOM-free InputCore, and owns the on-screen touch overlay. The game reads one Intent per frame from frame().
 */
import type { GameBus, InputState, Settings } from '../../core/context';
import { InputCore } from './core';
import type { TouchTarget } from './gestures';
import type { Intent } from './intent';
import { physicalCode } from './keys';
import { PointerLock } from './pointerLock';
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

/** Elements whose events belong to the UI, never to the game surface. */
const UI_SELECTOR = '.hw-window, .hw-ui-blocking';
/**
 * Chromium reports one bogus movement (the cursor's jump to the lock point) as pointer lock starts, just before
 * 'pointerlockchange'; movement before that event and within this many ms after it is dropped, so the view does not
 * snap on entering the game.
 */
const LOCK_SETTLE_MS = 120;

const isTextInput = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

type PointerRole = { kind: 'gesture'; button: TouchButton | null } | { kind: 'tap'; button: TouchButton };

export class InputManager {
  readonly core: InputCore;
  private readonly container: HTMLElement;
  private readonly overlay: TouchOverlay;
  private readonly lock: PointerLock;
  private readonly settings: Settings;
  private readonly state: InputState;
  private readonly bus: GameBus;
  private readonly cleanups: Array<() => void> = [];
  /** Touch pointers in flight and what they landed on. */
  private readonly touchPointers = new Map<number, PointerRole>();
  private readonly pressedCount = new Map<TouchButton, number>();
  private rectLeft = 0;
  private rectTop = 0;
  /** A touch was seen ('auto' shows the overlay from then on even if the media query said otherwise). */
  private touchSeen = false;
  private wasBlocked = false;
  private disposed = false;
  /** When the lock was announced; Infinity while it is not (Chromium moves the cursor before announcing it). */
  private lockedAt = Infinity;

  constructor(options: InputManagerOptions) {
    this.container = options.container;
    this.settings = options.settings;
    this.state = options.state;
    this.bus = options.bus;
    this.core = new InputCore(this.settings);
    this.overlay = new TouchOverlay(options.touchLayer);
    this.lock = new PointerLock(this.container, {
      locked: () => this.onLockChange(true, false),
      unlocked: (byPlayer) => this.onLockChange(false, byPlayer),
    });
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
    this.overlay.setPlaceArmed(this.core.placeArmed);
    this.overlay.render(this.core.touch);
    return intent;
  }

  /**
   * Captures the mouse for looking around (call from a user gesture). Resolves to whether it is captured.
   * When the browser refuses, drag-to-look takes over and this resolves false.
   */
  requestPointerCapture(): Promise<boolean> {
    return this.disposed ? Promise.resolve(false) : this.lock.request();
  }

  /** Lets the mouse go (a screen opened). Does not count as a pause request. */
  releasePointerCapture(): void {
    this.lock.release();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lock.dispose();
    for (const off of this.cleanups) off();
    this.cleanups.length = 0;
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
    return this.lock.locked;
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
    this.overlay.setLarge(this.settings.uiScale === 'large');
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
    if (button === 'bag' || button === 'pause' || button === 'place') {
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
      if (this.isLocked()) {
        if (performance.now() - this.lockedAt > LOCK_SETTLE_MS) this.core.mouseMove(e.movementX, e.movementY);
      }
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
        else if (role.button === 'place') this.core.togglePlace();
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
    if (which === 'left' && this.lock.worthAsking) void this.lock.request();
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

  private onLockChange(locked: boolean, byPlayer: boolean): void {
    this.state.pointerLocked = locked;
    // Whatever the drag fallback had pressed belongs to the time before the capture.
    this.core.drag.reset();
    if (locked) {
      this.lockedAt = performance.now();
      return;
    }
    this.lockedAt = Infinity;
    this.core.mouseButton('left', false);
    this.core.mouseButton('right', false);
    // The browser consumes Escape to leave pointer lock: an unlock the game did not ask for is a pause.
    if (byPlayer && !this.blocked()) this.core.requestPause();
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
