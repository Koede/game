/**
 * What the app does when the world cannot go on as normal: frames that keep failing, and a WebGL context the
 * browser took away. FrameGuard is DOM-free (node-tested); the notices are full-screen cards over the game.
 */
import { Button } from '../ui/kit/controls';
import { h } from '../ui/kit/dom';
import type { Game } from './game';

/** Consecutive failed frames that stop the world. */
export const FAILED_FRAMES_IN_A_ROW = 4;
/** Or this many failed frames within FAILURE_WINDOW_MS, even with good frames between them. */
export const FAILED_FRAMES_IN_WINDOW = 10;
export const FAILURE_WINDOW_MS = 5000;
/** How long to wait for the browser to give the graphics back before offering a reload. */
export const RESTORE_WAIT_MS = 3000;

/** Counts failing frames; `fail` says when the world should be stopped rather than retried every frame. */
export class FrameGuard {
  private streak = 0;
  private readonly times: number[] = [];

  /** A frame ran without throwing. */
  ok(): void {
    this.streak = 0;
  }

  /** A frame threw at `nowMs`. True when the world should stop. */
  fail(nowMs: number): boolean {
    this.streak++;
    this.times.push(nowMs);
    while (this.times.length > 0 && nowMs - this.times[0] > FAILURE_WINDOW_MS) this.times.shift();
    return this.streak >= FAILED_FRAMES_IN_A_ROW || this.times.length >= FAILED_FRAMES_IN_WINDOW;
  }

  reset(): void {
    this.streak = 0;
    this.times.length = 0;
  }
}

/** "3 min ago", "just now", "2 h ago" for the time of the last save. */
export function agoText(thenMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} days ago`;
}

export interface NoticeAction {
  label: string;
  kind?: 'primary' | 'default' | 'quiet';
  onClick: () => void;
}

/** A full-screen card over the running game, with any number of buttons; `update` rewrites it in place. */
export class GameNotice {
  readonly el: HTMLElement;
  private readonly card: HTMLElement;
  private buttons: Button[] = [];

  constructor(private readonly host: HTMLElement) {
    this.card = h('div', { class: 'hw-notice__card' });
    this.el = h('div', { class: ['hw-notice', 'hw-notice--game', 'hw-ui-blocking'], attrs: { role: 'alertdialog', 'aria-live': 'assertive' } }, this.card);
  }

  get shown(): boolean {
    return this.el.isConnected;
  }

  update(title: string, body: string, actions: readonly NoticeAction[] = [], detail?: string): void {
    for (const b of this.buttons) b.dispose();
    this.buttons = actions.map((a) => new Button({ label: a.label, kind: a.kind ?? 'default', block: true, onClick: a.onClick }));
    this.card.replaceChildren(
      h('h2', { class: 'hw-notice__title', text: title }),
      h('p', { class: 'hw-notice__body', text: body }),
      ...(detail ? [h('pre', { class: 'hw-notice__detail hw-notice__error', text: detail })] : []),
      ...this.buttons.map((b) => b.el),
    );
    if (!this.el.isConnected) this.host.appendChild(this.el);
  }

  hide(): void {
    for (const b of this.buttons) b.dispose();
    this.buttons = [];
    this.el.remove();
  }
}

/** Copies text to the clipboard where the page may; otherwise selects it in the notice so it can be copied by hand. */
export function copyText(text: string, fallback: HTMLElement): Promise<boolean> {
  const select = (): boolean => {
    const pre = fallback.querySelector('pre');
    const sel = window.getSelection();
    if (!pre || !sel) return false;
    const range = document.createRange();
    range.selectNodeContents(pre);
    sel.removeAllRanges();
    sel.addRange(range);
    return false;
  };
  try {
    if (!navigator.clipboard?.writeText) return Promise.resolve(select());
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => select(),
    );
  } catch {
    return Promise.resolve(select());
  }
}

/** Listens for the browser taking the WebGL context away and giving it back. Returns the unsubscribe. */
export function watchContext(canvas: HTMLCanvasElement, on: { lost(): void; restored(): void }): () => void {
  const lost = (): void => on.lost();
  const restored = (): void => on.restored();
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}

/** What Troubles needs from the app. */
export interface TroubleHost {
  game(): Game | null;
  playing(): boolean;
  /** Saves settings and the running world (the app refuses while `broken`). */
  save(): boolean;
  /** When the save in the slot was written (ms since epoch), or null. */
  savedAt(): number | null;
  persistent(): boolean;
  /** Tears the world down without saving and shows the title. */
  quit(): void;
  /** Starts the frame loop again. */
  resume(): void;
  stopLoop(): void;
}

/**
 * The notices over a running world: a world whose frames keep failing is stopped and never saved again (a snapshot
 * taken mid-failure could carry the fault into the save; the last good save stays), and a lost WebGL context holds the
 * world until the browser gives the graphics back, offering "Save and reload" when it does not within RESTORE_WAIT_MS.
 */
export class Troubles {
  /** The running world stopped after repeated failures. */
  broken = false;
  private graphicsLost = false;
  private restoreTimer = 0;
  private notice: GameNotice | null = null;
  private offContext: (() => void) | null = null;

  constructor(private readonly host: HTMLElement, private readonly app: TroubleHost) {}

  /** A new world is running: watch its canvas. */
  attach(game: Game): void {
    this.detach();
    this.offContext = watchContext(game.renderer.canvas, { lost: () => this.graphicsGone(), restored: () => this.graphicsBack() });
  }

  /** The world is gone: forget everything about it. */
  detach(): void {
    this.offContext?.();
    this.offContext = null;
    window.clearTimeout(this.restoreTimer);
    this.graphicsLost = false;
    this.broken = false;
    this.notice?.hide();
  }

  /** Frames keep failing: stop the world where it is and say so. */
  halt(err: unknown): void {
    const game = this.app.game();
    if (!game) return;
    this.app.stopLoop();
    this.broken = true;
    game.held = true;
    game.inputManager.releasePointerCapture();
    const detail = err instanceof Error ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ''}` : String(err);
    const notice = this.show();
    notice.update(
      'Something went wrong in this world',
      `The game stopped so that nothing more is lost. ${this.keptLine()}`,
      [
        { label: 'Quit to title', kind: 'primary', onClick: () => this.app.quit() },
        { label: 'Try to keep playing', onClick: () => this.resume() },
        { label: 'Copy error details', kind: 'quiet', onClick: () => void copyText(detail, notice.el) },
      ],
      detail,
    );
  }

  private resume(): void {
    const game = this.app.game();
    if (!game) return;
    this.notice?.hide();
    this.broken = false;
    game.held = this.graphicsLost;
    if (this.graphicsLost) this.waiting();
    this.app.resume();
  }

  /** The browser took the graphics away: hold the world (it would run on unseen) and wait for them to come back. */
  private graphicsGone(): void {
    const game = this.app.game();
    if (!game || this.graphicsLost) return;
    this.graphicsLost = true;
    if (this.app.playing() && !this.broken) this.app.save();
    game.held = true;
    if (this.broken) return;
    this.waiting();
    window.clearTimeout(this.restoreTimer);
    this.restoreTimer = window.setTimeout(() => {
      if (!this.graphicsLost || this.broken) return;
      this.show().update(
        'Graphics were reset by the browser',
        `They have not come back on their own; reloading the page brings them back. ${this.keptLine()}`,
        [{ label: 'Save and reload', kind: 'primary', onClick: () => this.saveAndReload() }],
      );
    }, RESTORE_WAIT_MS);
  }

  private waiting(): void {
    this.show().update('Graphics were reset by the browser', 'Waiting for them to come back. The world is paused meanwhile.');
  }

  private graphicsBack(): void {
    if (!this.graphicsLost) return;
    this.graphicsLost = false;
    window.clearTimeout(this.restoreTimer);
    const game = this.app.game();
    if (!game || this.broken) return;
    game.held = false;
    game.invalidateView();
    this.notice?.hide();
    // Back to a paused game rather than straight into whatever was happening.
    if (this.app.playing() && !game.ui.isOpen) game.bus.emit('ui:open', { screen: { type: 'pause' } });
  }

  private saveAndReload(): void {
    if (this.app.playing() && !this.broken) this.app.save();
    window.location.reload();
  }

  private show(): GameNotice {
    this.notice ??= new GameNotice(this.host);
    return this.notice;
  }

  /** "Your last save (3 min ago) is kept." */
  private keptLine(): string {
    const at = this.app.savedAt();
    if (at === null) return 'There is no earlier save of this world.';
    return `Your last save (${agoText(at, Date.now())}) is kept${this.app.persistent() ? '' : ' until this page closes'}.`;
  }
}
