/**
 * First-minutes coach marks on touch screens: "Drag here to look", "Aim at a tree and hold MINE", "Tap the goal for
 * details". One shows at a time, each goes for good once the player has done what it says. Remembered per device in
 * localStorage (best effort: a sandboxed frame without storage simply shows them again next session).
 */
import { h, setAttr, setText } from '../kit/dom';

export type CoachMark = 'look' | 'mine' | 'goal';

const STORAGE_KEY = 'hearthwatt.coach';
/** Radians of look (yaw plus pitch) that count as "has dragged to look". */
export const LOOK_DONE_RAD = 0.4;

const TEXT: Record<CoachMark, string> = {
  look: 'Drag here to look around',
  mine: 'Aim at a tree and hold MINE',
  goal: 'Tap the goal for details',
};

/** The rules, DOM-free: which mark shows now, and what dismisses each. */
export class CoachState {
  readonly seen: Set<CoachMark>;
  private looked = 0;
  private goalReady = false;

  constructor(seen: Iterable<CoachMark> = []) {
    this.seen = new Set(seen);
  }

  /** The mark to show now, or null. Look first, then mine; the goal tip once the first goal is done. */
  current(): CoachMark | null {
    if (!this.seen.has('look')) return 'look';
    if (!this.seen.has('mine')) return 'mine';
    if (!this.seen.has('goal') && this.goalReady) return 'goal';
    return null;
  }

  /** The view turned by this much (radians). True when that finished a mark. */
  addLook(radians: number): boolean {
    if (this.seen.has('look')) return false;
    this.looked += Math.abs(radians);
    return this.looked >= LOOK_DONE_RAD && this.done('look');
  }

  blockBroken(): boolean {
    return this.done('mine');
  }

  objectiveCompleted(): void {
    this.goalReady = true;
  }

  goalOpened(): boolean {
    return this.done('goal');
  }

  private done(mark: CoachMark): boolean {
    if (this.seen.has(mark)) return false;
    this.seen.add(mark);
    return true;
  }
}

function load(): CoachMark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((m): m is CoachMark => m === 'look' || m === 'mine' || m === 'goal') : [];
  } catch {
    return [];
  }
}

function save(seen: ReadonlySet<CoachMark>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // Storage refused (sandboxed frame, private mode): the marks show again next session, nothing else breaks.
  }
}

/** The bubble in the HUD layer. Hidden without touch, while a screen is open, and once every mark is done. */
export class CoachMarks {
  readonly el: HTMLDivElement;
  private readonly text: HTMLSpanElement;
  private readonly state = new CoachState(load());
  private lastYaw = Number.NaN;
  private lastPitch = Number.NaN;
  private shown: CoachMark | null | undefined;

  constructor() {
    this.text = h('span', { class: 'hw-coach__text' });
    this.el = h('div', { class: 'hw-coach', attrs: { 'aria-live': 'polite' } }, this.text);
    this.el.hidden = true;
  }

  /** Every frame with the player's view: counts look drags. Cheap: compares two numbers. */
  look(yaw: number, pitch: number, touch: boolean): void {
    if (touch && !Number.isNaN(this.lastYaw)) {
      const d = Math.abs(yaw - this.lastYaw) + Math.abs(pitch - this.lastPitch);
      // A teleport or respawn can jump the view; only small steps are a finger dragging.
      if (d < 0.5 && this.state.addLook(d)) this.changed();
    }
    this.lastYaw = yaw;
    this.lastPitch = pitch;
  }

  blockBroken(): void {
    if (this.state.blockBroken()) this.changed();
  }

  objectiveCompleted(): void {
    this.state.objectiveCompleted();
  }

  goalOpened(): void {
    if (this.state.goalOpened()) this.changed();
  }

  /** Shows the current mark (touch only, no screen open). The goal tip hangs under `goal` (the goal tracker). */
  render(touch: boolean, screenOpen: boolean, goal: HTMLElement): void {
    const mark = touch && !screenOpen ? this.state.current() : null;
    if (mark === 'goal') {
      const r = goal.getBoundingClientRect();
      this.el.style.top = `${Math.round(r.bottom + 10)}px`;
      this.el.style.left = `${Math.round(r.left + 12)}px`;
    } else if (this.shown === 'goal') {
      this.el.style.top = '';
      this.el.style.left = '';
    }
    if (mark === this.shown) return;
    this.shown = mark;
    this.el.hidden = mark === null;
    setAttr(this.el, 'data-mark', mark);
    setText(this.text, mark ? TEXT[mark] : '');
  }

  private changed(): void {
    save(this.state.seen);
  }
}
