/** Value inputs: slider, segmented choice, text field. */
import { h, setText, uid } from './dom';

export interface SliderOptions {
  /** Accessible name. */
  label: string;
  min: number;
  max: number;
  step?: number;
  value?: number;
  /** Text of the readout next to the track ("72°", "80%"). Default: the number itself. */
  format?: (value: number) => string;
  /** Called continuously while dragging. */
  onChange?: (value: number) => void;
}

/** A native range input (keyboard and touch for free) with a tabular readout. */
export class Slider {
  readonly el: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly output: HTMLOutputElement;
  private readonly format: (value: number) => string;

  constructor(opts: SliderOptions) {
    this.format = opts.format ?? String;
    this.input = h('input', {
      class: 'hw-slider__input',
      attrs: { type: 'range', min: opts.min, max: opts.max, step: opts.step ?? 1, 'aria-label': opts.label },
    });
    this.output = h('output', { class: 'hw-slider__value hw-num' });
    this.el = h('div', { class: 'hw-slider' }, this.input, this.output);
    this.input.value = String(opts.value ?? opts.min);
    this.input.addEventListener('input', () => {
      this.render();
      opts.onChange?.(this.value);
    });
    this.render();
  }

  get value(): number {
    return Number(this.input.value);
  }

  /** Sets the value without calling onChange. */
  set(value: number): void {
    this.input.value = String(value);
    this.render();
  }

  private render(): void {
    const min = Number(this.input.min);
    const max = Number(this.input.max);
    const value = this.value;
    const fraction = max > min ? (value - min) / (max - min) : 0;
    this.input.style.setProperty('--hw-fill', `${(fraction * 100).toFixed(1)}%`);
    const text = this.format(value);
    setText(this.output, text);
    this.input.setAttribute('aria-valuetext', text);
  }
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedOptions<T extends string> {
  /** Accessible name of the group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange?: (value: T) => void;
}

/** A row of mutually exclusive choices (radio group; arrow keys move the selection). */
export class Segmented<T extends string> {
  readonly el: HTMLDivElement;
  private readonly buttons = new Map<T, HTMLButtonElement>();
  private readonly order: T[];
  private current: T;

  constructor(opts: SegmentedOptions<T>) {
    this.current = opts.value;
    this.order = opts.options.map((o) => o.value);
    this.el = h('div', { class: 'hw-seg', attrs: { role: 'radiogroup', 'aria-label': opts.label } });
    for (const option of opts.options) {
      const button = h('button', { class: 'hw-seg__opt', text: option.label, attrs: { type: 'button', role: 'radio', 'data-value': option.value } });
      button.addEventListener('click', () => this.choose(option.value, opts.onChange));
      this.buttons.set(option.value, button);
      this.el.appendChild(button);
    }
    this.el.addEventListener('keydown', (ev) => {
      const step = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;
      ev.preventDefault();
      const next = this.order[(this.order.indexOf(this.current) + step + this.order.length) % this.order.length];
      this.choose(next, opts.onChange);
      this.buttons.get(next)?.focus();
    });
    this.render();
  }

  get value(): T {
    return this.current;
  }

  /** Sets the selection without calling onChange. */
  set(value: T): void {
    if (value === this.current) return;
    this.current = value;
    this.render();
  }

  private choose(value: T, onChange: ((value: T) => void) | undefined): void {
    if (value === this.current) return;
    this.current = value;
    this.render();
    onChange?.(value);
  }

  private render(): void {
    for (const [value, button] of this.buttons) {
      const selected = value === this.current;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
  }
}

export interface TextFieldOptions {
  /** Visible label above the input. */
  label: string;
  placeholder?: string;
  value?: string;
  maxLength?: number;
  /** Monospace input (seeds, codes). */
  mono?: boolean;
  onInput?: (value: string) => void;
  onEnter?: (value: string) => void;
}

/** A labelled single-line text input. Keystrokes typed into it never reach the game's key handlers. */
export class TextField {
  readonly el: HTMLLabelElement;
  readonly input: HTMLInputElement;

  constructor(opts: TextFieldOptions) {
    const id = uid('field');
    this.input = h('input', {
      class: ['hw-input', opts.mono && 'hw-input--mono'],
      attrs: {
        id,
        type: 'text',
        placeholder: opts.placeholder,
        maxlength: opts.maxLength,
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: 'done',
      },
    });
    this.input.value = opts.value ?? '';
    this.el = h('label', { class: 'hw-field', attrs: { for: id } }, h('span', { class: 'hw-field__label', text: opts.label }), this.input);
    this.input.addEventListener('input', () => opts.onInput?.(this.input.value));
    const shield = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') return;
      ev.stopPropagation();
      if (ev.type === 'keydown' && ev.key === 'Enter') {
        this.input.blur();
        opts.onEnter?.(this.input.value);
      }
    };
    this.input.addEventListener('keydown', shield);
    this.input.addEventListener('keyup', shield);
  }

  get value(): string {
    return this.input.value;
  }

  set(value: string): void {
    this.input.value = value;
  }
}
