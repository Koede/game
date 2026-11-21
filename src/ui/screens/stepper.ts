/** A compact number stepper: [−] value [+], 44 px targets, the value spelled out for screen readers. */
import { h, setAttr, setText } from '../kit/dom';

export interface StepperOptions {
  /** Visible caption above (and accessible name of) the control. */
  label: string;
  min: number;
  max: number;
  value: number;
  /** Text of the value ("+1", "3"). Default: the number. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export class Stepper {
  readonly el: HTMLDivElement;
  private readonly valueEl: HTMLOutputElement;
  private readonly minus: HTMLButtonElement;
  private readonly plus: HTMLButtonElement;
  private readonly format: (value: number) => string;
  private min: number;
  private max: number;
  private current: number;

  constructor(opts: StepperOptions) {
    this.min = opts.min;
    this.max = opts.max;
    this.current = opts.value;
    this.format = opts.format ?? String;
    this.valueEl = h('output', { class: 'hw-step__value hw-num', attrs: { 'aria-live': 'polite' } });
    this.minus = h('button', { class: 'hw-step__btn', text: '−', attrs: { type: 'button', 'aria-label': `${opts.label}: less` } });
    this.plus = h('button', { class: 'hw-step__btn', text: '+', attrs: { type: 'button', 'aria-label': `${opts.label}: more` } });
    const bump = (d: number): void => {
      const next = Math.max(this.min, Math.min(this.max, this.current + d));
      if (next === this.current) return;
      this.set(next);
      opts.onChange(next);
    };
    this.minus.addEventListener('click', () => bump(-1));
    this.plus.addEventListener('click', () => bump(1));
    this.el = h(
      'div',
      { class: 'hw-step', attrs: { role: 'group', 'aria-label': opts.label } },
      h('span', { class: 'hw-step__label', text: opts.label }),
      h('div', { class: 'hw-step__row' }, this.minus, this.valueEl, this.plus),
    );
    this.render();
  }

  get value(): number {
    return this.current;
  }

  /** Sets the value (and optionally the bounds) without calling onChange. */
  set(value: number, min = this.min, max = this.max): void {
    this.min = min;
    this.max = max;
    this.current = Math.max(min, Math.min(max, value));
    this.render();
  }

  private render(): void {
    setText(this.valueEl, this.format(this.current));
    setAttr(this.minus, 'aria-disabled', this.current <= this.min ? 'true' : null);
    setAttr(this.plus, 'aria-disabled', this.current >= this.max ? 'true' : null);
    setAttr(this.el, 'data-fixed', this.min === this.max ? '' : null);
  }
}
