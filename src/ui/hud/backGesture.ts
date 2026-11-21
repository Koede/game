/**
 * Android's back gesture (and the browser's back button) closes the open screen instead of leaving the page:
 * one history entry is pushed while a screen is open and popped again when it closes some other way.
 * Every history call is guarded (a sandboxed frame may refuse them; then back simply does nothing special).
 */
export class BackGesture {
  private armed = false;
  private ignorePop = false;
  private readonly onPop = (): void => this.popped();

  /** `onBack` runs when the player goes back while armed; return false to stay armed (a screen that cannot close). */
  constructor(private readonly onBack: () => boolean) {
    window.addEventListener('popstate', this.onPop);
  }

  /** A screen opened. */
  arm(): void {
    if (this.armed) return;
    try {
      history.pushState({ hwScreen: true }, '');
      this.armed = true;
    } catch {
      this.armed = false;
    }
  }

  /** The screen closed by other means: drop our history entry again. */
  disarm(): void {
    if (!this.armed) return;
    this.armed = false;
    this.ignorePop = true;
    try {
      history.back();
    } catch {
      this.ignorePop = false;
    }
  }

  dispose(): void {
    window.removeEventListener('popstate', this.onPop);
  }

  private popped(): void {
    if (this.ignorePop) {
      this.ignorePop = false;
      return;
    }
    if (!this.armed) return;
    this.armed = false;
    if (!this.onBack()) this.arm();
  }
}
