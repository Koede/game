/** Buttons and the on/off toggle. Value inputs (slider, segmented choice, text field) live in ./fields. */
import { Disposer, h, listen, setAttr, setFlag, setText } from './dom';
import { glyph, type GlyphName } from './icons';

export * from './fields';

export type ButtonKind = 'default' | 'primary' | 'power' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  label: string;
  /** primary = the heat-coloured main action; power = an electrical action; quiet = low emphasis; danger = destructive. */
  kind?: ButtonKind;
  size?: ButtonSize;
  icon?: GlyphName;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Hold-to-confirm: the button only fires after being held down this many milliseconds. */
  holdMs?: number;
  /** Small second line under the label (a hold button shows "Hold to confirm" by default). */
  hint?: string;
  onClick?: () => void;
}

/**
 * A plate button. A disabled button stays focusable and tells the player WHY it is disabled:
 * the reason replaces the hint line under the label.
 */
export class Button {
  readonly el: HTMLButtonElement;
  private readonly labelEl: HTMLSpanElement;
  private readonly subEl: HTMLSpanElement;
  private readonly disposer = new Disposer();
  private readonly hint: string;
  private readonly holdMs: number;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private kind: ButtonKind;
  private isDisabled = false;
  private onClick: (() => void) | undefined;

  constructor(opts: ButtonOptions) {
    this.kind = opts.kind ?? 'default';
    this.onClick = opts.onClick;
    this.holdMs = opts.holdMs ?? 0;
    this.hint = opts.hint ?? (this.holdMs > 0 ? 'Hold to confirm' : '');
    this.labelEl = h('span', { class: 'hw-btn__label', text: opts.label });
    this.subEl = h('span', { class: 'hw-btn__sub' });
    this.el = h(
      'button',
      {
        class: ['hw-btn', `hw-btn--${this.kind}`, `hw-btn--${opts.size ?? 'md'}`, opts.block && 'hw-btn--block'],
        attrs: { type: 'button' },
      },
      h('span', { class: 'hw-btn__main' }, opts.icon ? glyph(opts.icon) : null, this.labelEl),
      this.subEl,
    );
    this.renderSub('');
    if (this.holdMs > 0) this.bindHold();
    else this.disposer.add(listen(this.el, 'click', () => this.fire()));
  }

  get disabled(): boolean {
    return this.isDisabled;
  }

  setLabel(text: string): void {
    setText(this.labelEl, text);
  }

  setKind(kind: ButtonKind): void {
    if (kind === this.kind) return;
    this.el.classList.replace(`hw-btn--${this.kind}`, `hw-btn--${kind}`);
    this.kind = kind;
  }

  setOnClick(fn: (() => void) | undefined): void {
    this.onClick = fn;
  }

  /** Disables or enables the button. `reason` is shown inside it while disabled ("Needs 800 °C"). */
  setDisabled(disabled: boolean, reason = ''): void {
    if (disabled !== this.isDisabled) {
      this.isDisabled = disabled;
      setAttr(this.el, 'aria-disabled', disabled ? 'true' : null);
      if (disabled) this.cancelHold();
    }
    this.renderSub(disabled ? reason : '');
  }

  dispose(): void {
    this.cancelHold();
    this.disposer.dispose();
  }

  private renderSub(reason: string): void {
    const text = reason || this.hint;
    setText(this.subEl, text);
    this.subEl.hidden = text === '';
  }

  private fire(): void {
    if (this.isDisabled) {
      // Restart the refusal nudge so repeated taps keep answering.
      this.el.removeAttribute('data-denied');
      void this.el.offsetWidth;
      this.el.setAttribute('data-denied', '');
      return;
    }
    this.onClick?.();
  }

  private bindHold(): void {
    const el = this.el;
    el.style.setProperty('--hw-hold-ms', `${this.holdMs}ms`);
    el.appendChild(h('span', { class: 'hw-btn__hold' }));
    const start = (): void => {
      if (this.holdTimer !== null) return;
      if (this.isDisabled) {
        this.fire();
        return;
      }
      setFlag(el, 'holding', true);
      this.holdTimer = setTimeout(() => {
        this.cancelHold();
        this.fire();
      }, this.holdMs);
    };
    const stop = (): void => this.cancelHold();
    const isActivationKey = (ev: KeyboardEvent): boolean => ev.key === 'Enter' || ev.key === ' ';
    this.disposer.add(listen(el, 'pointerdown', (ev) => (ev.button === 0 ? start() : undefined)));
    this.disposer.add(listen(el, 'pointerup', stop));
    this.disposer.add(listen(el, 'pointerleave', stop));
    this.disposer.add(listen(el, 'pointercancel', stop));
    this.disposer.add(listen(el, 'blur', stop));
    this.disposer.add(listen(el, 'contextmenu', (ev) => ev.preventDefault()));
    this.disposer.add(
      listen(el, 'keydown', (ev) => {
        if (!isActivationKey(ev)) return;
        ev.preventDefault();
        if (!ev.repeat) start();
      }),
    );
    this.disposer.add(listen(el, 'keyup', (ev) => (isActivationKey(ev) ? stop() : undefined)));
  }

  private cancelHold(): void {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    this.holdTimer = null;
    setFlag(this.el, 'holding', false);
  }
}

export interface IconButtonOptions {
  icon: GlyphName;
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  onClick?: () => void;
}

/** A square 44px button holding a single glyph. */
export class IconButton {
  readonly el: HTMLButtonElement;

  constructor(opts: IconButtonOptions) {
    this.el = h(
      'button',
      { class: 'hw-iconbtn', attrs: { type: 'button', 'aria-label': opts.label, title: opts.label } },
      glyph(opts.icon, 18),
    );
    if (opts.onClick) this.el.addEventListener('click', opts.onClick);
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }
}

export interface ToggleOptions {
  /** Accessible name (the visible label normally sits next to the control in a settings row). */
  label: string;
  value?: boolean;
  /** Colour of the on state: 'heat' for a fire-related switch, 'power' for one that energises something. Default 'neutral'. */
  tone?: 'neutral' | 'heat' | 'power';
  onChange?: (value: boolean) => void;
  /** Text for the two states. Default On / Off. */
  onText?: string;
  offText?: string;
}

/** An on/off switch. The state is spelled out next to the track, never colour alone. */
export class Toggle {
  readonly el: HTMLButtonElement;
  private readonly stateEl: HTMLSpanElement;
  private readonly onText: string;
  private readonly offText: string;
  private current: boolean;

  constructor(opts: ToggleOptions) {
    this.current = opts.value ?? false;
    this.onText = opts.onText ?? 'On';
    this.offText = opts.offText ?? 'Off';
    this.stateEl = h('span', { class: 'hw-toggle__state' });
    this.el = h(
      'button',
      {
        class: 'hw-toggle',
        attrs: { type: 'button', role: 'switch', 'aria-label': opts.label, 'data-tone': opts.tone ?? 'neutral' },
      },
      h('span', { class: 'hw-toggle__track' }, h('span', { class: 'hw-toggle__thumb' })),
      this.stateEl,
    );
    this.el.addEventListener('click', () => {
      if (this.el.getAttribute('aria-disabled') === 'true') return;
      this.set(!this.current);
      opts.onChange?.(this.current);
    });
    this.render();
  }

  get value(): boolean {
    return this.current;
  }

  /** Sets the state without calling onChange. */
  set(value: boolean): void {
    if (value === this.current) return;
    this.current = value;
    this.render();
  }

  setDisabled(disabled: boolean): void {
    setAttr(this.el, 'aria-disabled', disabled ? 'true' : null);
  }

  private render(): void {
    this.el.setAttribute('aria-checked', String(this.current));
    setText(this.stateEl, this.current ? this.onText : this.offText);
  }
}
