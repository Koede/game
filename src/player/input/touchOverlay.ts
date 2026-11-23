/** DOM of the on-screen touch controls: buttons, the floating joystick and the hold ring. Pure presentation. */
import { HOLD_CHARGING, HOLD_MINING, HOLD_NONE, type TouchGestures } from './gestures';
import { TOUCH_CSS } from './touchStyles';

export type TouchButton = 'jump' | 'mine' | 'use' | 'place' | 'bag' | 'pause';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icon outlines on a 24 x 24 grid, drawn for this game. */
const ICONS: Readonly<Record<TouchButton, readonly string[]>> = {
  jump: ['M5 12.5 12 5.5l7 7', 'M5 19l7-7 7 7'],
  mine: ['M5.5 20 15 10.5', 'M8.5 5.2c5-1.4 9.9 1.6 10.6 7.6', 'M13.2 8.4l2.6 2.6'],
  use: ['M12 3.2 19.6 7.5v9L12 20.8 4.4 16.5v-9z', 'M4.6 7.6 12 11.9l7.4-4.3', 'M12 11.9v8.7'],
  place: ['M10 6.2 15.8 9.5v6.6L10 19.4l-5.8-3.3V9.5z', 'M4.4 9.6 10 12.8l5.6-3.2', 'M10 12.8v6.4', 'M18.2 2.8v6', 'M15.2 5.8h6'],
  bag: ['M6.2 9h11.6l1.1 9.9a1.8 1.8 0 0 1-1.8 2H6.9a1.8 1.8 0 0 1-1.8-2z', 'M9 9V7.4a3 3 0 0 1 6 0V9'],
  pause: ['M7 5h3.4v14H7z', 'M13.6 5H17v14h-3.4z'],
};

const LABELS: Readonly<Record<TouchButton, string>> = {
  jump: 'Jump',
  mine: 'Mine',
  use: 'Use',
  place: 'Place',
  bag: 'Inventory',
  pause: 'Pause',
};

const CAPTIONED: readonly TouchButton[] = ['jump', 'mine', 'use', 'place'];
const ORDER: readonly TouchButton[] = ['jump', 'mine', 'use', 'place', 'bag', 'pause'];

function icon(name: TouchButton): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

export class TouchOverlay {
  readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly buttons = new Map<TouchButton, HTMLDivElement>();
  private readonly stick: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly hold: HTMLDivElement;
  private visible = false;
  private stickActive = false;
  private stickSprint = false;
  private stickKey = '';
  private knobKey = '';
  private holdPhase = HOLD_NONE;
  private holdKey = '';
  private diameter = 0;
  private placeArmed = false;
  private large = false;

  constructor(layer: HTMLElement) {
    this.style = document.createElement('style');
    this.style.setAttribute('data-hw-touch', '');
    this.style.textContent = TOUCH_CSS;
    document.head.appendChild(this.style);

    this.root = document.createElement('div');
    this.root.className = 'hw-touch';
    this.root.hidden = true;

    this.stick = document.createElement('div');
    this.stick.className = 'hw-touch-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'hw-touch-knob';
    this.stick.appendChild(this.knob);
    this.hold = document.createElement('div');
    this.hold.className = 'hw-touch-hold';
    this.root.append(this.stick, this.hold);

    for (const name of ORDER) {
      const el = document.createElement('div');
      el.className = `hw-touch-btn hw-touch-btn--${name}`;
      el.dataset.hwTouch = name;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', LABELS[name]);
      el.appendChild(icon(name));
      if (CAPTIONED.includes(name)) {
        const caption = document.createElement('span');
        caption.className = 'hw-touch-label';
        caption.textContent = LABELS[name];
        el.appendChild(caption);
      }
      this.buttons.set(name, el);
      this.root.appendChild(el);
    }
    layer.appendChild(this.root);
  }

  /** The control button an event landed on, or null. */
  buttonAt(target: EventTarget | null): TouchButton | null {
    if (!(target instanceof Element)) return null;
    const el = target.closest<HTMLElement>('.hw-touch-btn');
    return el && this.root.contains(el) ? (el.dataset.hwTouch as TouchButton) : null;
  }

  /** Whether a viewport point is on (or within a thumb's slack of) a button - used to confirm a tap on release. */
  hit(name: TouchButton, clientX: number, clientY: number): boolean {
    const rect = this.buttons.get(name)?.getBoundingClientRect();
    if (!rect) return false;
    const slack = 12;
    return clientX >= rect.left - slack && clientX <= rect.right + slack && clientY >= rect.top - slack && clientY <= rect.bottom + slack;
  }

  /** Settings.uiScale 'large': bigger buttons and captions (`.hw-touch--large`). */
  /** One-handed layout (Settings.oneHanded): mirrors or recentres the cluster under that thumb. */
  setHanded(handed: 'off' | 'left' | 'right'): void {
    this.root.classList.toggle('hw-touch--one-left', handed === 'left');
    this.root.classList.toggle('hw-touch--one-right', handed === 'right');
  }

  setLarge(large: boolean): void {
    if (large === this.large) return;
    this.large = large;
    this.root.classList.toggle('hw-touch--large', large);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.root.hidden = !visible;
  }

  setPressed(name: TouchButton, pressed: boolean): void {
    this.buttons.get(name)?.classList.toggle('hw-touch-btn--pressed', pressed);
  }

  /** Shows the Place toggle armed (the next Use places the held block). */
  setPlaceArmed(armed: boolean): void {
    if (armed === this.placeArmed) return;
    this.placeArmed = armed;
    const el = this.buttons.get('place');
    el?.classList.toggle('hw-touch-btn--armed', armed);
    el?.setAttribute('aria-pressed', String(armed));
  }

  clearPressed(): void {
    for (const el of this.buttons.values()) el.classList.remove('hw-touch-btn--pressed');
  }

  /** Mirrors the joystick and the hold ring. Cheap to call every frame: the DOM is only written on change. */
  render(touch: TouchGestures): void {
    if (!this.visible) return;
    this.renderStick(touch);
    this.renderHold(touch);
  }

  dispose(): void {
    this.root.remove();
    this.style.remove();
  }

  private renderStick(touch: TouchGestures): void {
    const s = touch.stick;
    const diameter = Math.round(s.radius * 2);
    if (diameter !== this.diameter) {
      this.diameter = diameter;
      this.root.style.setProperty('--hw-touch-d', `${diameter}px`);
    }
    if (s.active !== this.stickActive) {
      this.stickActive = s.active;
      this.stick.classList.toggle('hw-touch-stick--active', s.active);
      if (!s.active) {
        this.stick.style.transform = '';
        this.knob.style.transform = '';
        this.stickKey = '';
        this.knobKey = '';
      }
    }
    if (s.sprint !== this.stickSprint) {
      this.stickSprint = s.sprint;
      this.stick.classList.toggle('hw-touch-stick--sprint', s.sprint);
    }
    if (!s.active) return;
    const stickKey = `translate3d(${s.originX.toFixed(1)}px,${s.originY.toFixed(1)}px,0)`;
    if (stickKey !== this.stickKey) {
      this.stickKey = stickKey;
      this.stick.style.transform = stickKey;
    }
    const knobKey = `translate3d(${s.knobX.toFixed(1)}px,${s.knobY.toFixed(1)}px,0)`;
    if (knobKey !== this.knobKey) {
      this.knobKey = knobKey;
      this.knob.style.transform = knobKey;
    }
  }

  private renderHold(touch: TouchGestures): void {
    const phase = touch.holdPhase;
    if (phase !== this.holdPhase) {
      this.holdPhase = phase;
      this.hold.classList.toggle('hw-touch-hold--mining', phase === HOLD_MINING);
      if (phase === HOLD_NONE) {
        this.hold.style.opacity = '0';
        this.holdKey = '';
      }
    }
    if (phase === HOLD_NONE) return;
    // Nothing is drawn for the first part of the charge, so quick taps and drags never flash a ring.
    const charge = phase === HOLD_CHARGING ? Math.max(0, (touch.holdProgress - 0.35) / 0.65) : 1;
    const scale = 1.5 - 0.5 * charge;
    const key = `translate3d(${touch.holdX.toFixed(1)}px,${touch.holdY.toFixed(1)}px,0) scale(${scale.toFixed(2)})`;
    if (key !== this.holdKey) {
      this.holdKey = key;
      this.hold.style.transform = key;
      this.hold.style.opacity = (phase === HOLD_MINING ? 1 : charge * 0.8).toFixed(2);
    }
  }
}
