/**
 * Pointer lock with every way it can fail handled: the API missing, requestPointerLock throwing, its promise
 * rejecting, a 'pointerlockerror' event, or no answer at all (sandboxed frames). Tells its owner whether an
 * unlock was asked for by the game or done by the player (Escape), which the input layer turns into a pause.
 */

/** How long a request waits for the browser to answer before counting as refused. */
const LOCK_TIMEOUT_MS = 800;
/** After this many refusals in a row, clicks stop asking for the lock on their own. */
const MAX_AUTO_FAILURES = 2;

export interface PointerLockEvents {
  locked(): void;
  /** `byPlayer` is true when the game did not ask for it (the browser's Escape handling). */
  unlocked(byPlayer: boolean): void;
}

export class PointerLock {
  private unsupported = false;
  private failures = 0;
  private expectUnlock = false;
  private wasLocked = false;
  private waiters: Array<(locked: boolean) => void> = [];
  private disposed = false;
  private readonly onChange = (): void => this.changed();
  private readonly onError = (): void => this.failed();

  constructor(
    private readonly element: HTMLElement,
    private readonly events: PointerLockEvents,
  ) {
    document.addEventListener('pointerlockchange', this.onChange);
    document.addEventListener('pointerlockerror', this.onError);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  /** Whether a click on the game surface should ask for the lock (it has not been refused repeatedly). */
  get worthAsking(): boolean {
    return !this.unsupported && this.failures < MAX_AUTO_FAILURES;
  }

  /** Asks for the lock (call from a user gesture). Resolves to whether the pointer is now locked. */
  request(): Promise<boolean> {
    if (this.locked) return Promise.resolve(true);
    if (this.disposed || this.unsupported) return Promise.resolve(false);
    const el = this.element as HTMLElement & { requestPointerLock?: () => unknown };
    if (typeof el.requestPointerLock !== 'function') {
      this.unsupported = true;
      return Promise.resolve(false);
    }
    const answer = new Promise<boolean>((resolve) => this.waiters.push(resolve));
    if (this.waiters.length > 1) return answer;
    window.setTimeout(() => {
      if (!this.locked) this.failed();
    }, LOCK_TIMEOUT_MS);
    try {
      const result = el.requestPointerLock();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(
          () => this.settle(this.locked),
          () => this.failed(),
        );
      }
    } catch {
      this.failed();
    }
    return answer;
  }

  /** Leaves the lock on the game's behalf (not reported as the player's doing). */
  release(): void {
    if (!this.locked) return;
    this.expectUnlock = true;
    try {
      document.exitPointerLock();
    } catch {
      this.expectUnlock = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.release();
    this.disposed = true;
    document.removeEventListener('pointerlockchange', this.onChange);
    document.removeEventListener('pointerlockerror', this.onError);
    this.settle(false);
  }

  private changed(): void {
    if (this.locked) {
      this.wasLocked = true;
      this.failures = 0;
      this.settle(true);
      this.events.locked();
      return;
    }
    if (!this.wasLocked) return;
    this.wasLocked = false;
    const byPlayer = !this.expectUnlock;
    this.expectUnlock = false;
    this.events.unlocked(byPlayer);
  }

  private failed(): void {
    if (this.waiters.length === 0) return;
    this.failures++;
    this.settle(false);
  }

  private settle(locked: boolean): void {
    const waiters = this.waiters;
    if (waiters.length === 0) return;
    this.waiters = [];
    for (const resolve of waiters) resolve(locked);
  }
}
