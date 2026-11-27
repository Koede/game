/**
 * Keeps a phone's screen awake while the game is being played (Settings.keepAwake), so watching a boiler or a machine does not
 * let it sleep. The Screen Wake Lock API is optional and a browser may refuse it (battery saver, an insecure page, a hidden
 * tab): every failure is ignored and the game simply plays as before. The lock is dropped while paused or hidden and asked for again
 * on return, because browsers release it themselves when the page is hidden.
 */
interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', fn: () => void): void;
}
interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

export class WakeLockKeeper {
  private sentinel: Sentinel | null = null;
  private asking = false;
  private disposed = false;

  constructor(private readonly api: () => WakeLockApi | undefined = () => (typeof navigator === 'undefined' ? undefined : (navigator as { wakeLock?: WakeLockApi }).wakeLock)) {}

  /** Called every frame with whether the screen should stay on now; cheap when nothing changes. */
  update(wanted: boolean): void {
    if (this.disposed) return;
    if (!wanted) return this.drop();
    if (this.sentinel || this.asking || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    const api = this.api();
    if (!api) return;
    this.asking = true;
    api
      .request('screen')
      .then((s) => {
        if (this.disposed) void s.release().catch(() => {});
        else {
          this.sentinel = s;
          s.addEventListener('release', () => {
            if (this.sentinel === s) this.sentinel = null;
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.asking = false;
      });
  }

  get held(): boolean {
    return this.sentinel !== null;
  }

  dispose(): void {
    this.disposed = true;
    this.drop();
  }

  private drop(): void {
    const s = this.sentinel;
    this.sentinel = null;
    if (s) void s.release().catch(() => {});
  }
}
