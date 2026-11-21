/** The furnace thermometer: a vertical tube filled with the heat ramp, threshold notches, a numeric readout. */
import { h, setAttr, setText } from './dom';
import { formatTemp, heatColor, heatGradient, heatTextColor } from './format';
import { declutter, niceStep, ticksBetween } from './layout';

export interface ThermoNotch {
  tempC: number;
  /** Short name of what this temperature unlocks or limits: "Bronze", "Flame limit". */
  label: string;
  /** 'limit' draws a dashed line (the fuel's flame temperature, the tier's ceiling). Default 'threshold'. */
  kind?: 'threshold' | 'limit';
}

export interface ThermometerOptions {
  /** Bottom of the scale in degrees C. Default 0. */
  min?: number;
  /** Top of the scale: normally the furnace tier's maximum temperature. */
  max: number;
  value?: number;
  caption?: string;
  notches?: readonly ThermoNotch[];
}

const LABEL_GAP_PX = 15;
const SCALE_LABEL_PX = 34;

interface NotchView {
  notch: ThermoNotch;
  el: HTMLDivElement;
  label: HTMLSpanElement;
  met: boolean | null;
}

export class Thermometer {
  readonly el: HTMLDivElement;
  private readonly valueEl: HTMLSpanElement;
  private readonly captionEl: HTMLDivElement;
  private readonly gauge: HTMLDivElement;
  private readonly scale: HTMLDivElement;
  private readonly ramp: HTMLDivElement;
  private readonly cover: HTMLDivElement;
  private readonly level: HTMLDivElement;
  private readonly notchHost: HTMLDivElement;
  private readonly observer: ResizeObserver | null;
  private allNotches: readonly ThermoNotch[] = [];
  private notches: NotchView[] = [];
  private min: number;
  private max: number;
  private temp: number;
  private shownDegrees = Number.NaN;
  private shownLevel = '';
  private height = 0;

  constructor(opts: ThermometerOptions) {
    this.min = opts.min ?? 0;
    this.max = opts.max;
    this.temp = opts.value ?? this.min;
    this.valueEl = h('span', { class: 'hw-thermo__value hw-num' });
    this.captionEl = h('div', { class: 'hw-thermo__caption' });
    this.scale = h('div', { class: 'hw-thermo__scale', attrs: { 'aria-hidden': 'true' } });
    this.ramp = h('div', { class: 'hw-thermo__ramp' });
    this.cover = h('div', { class: 'hw-thermo__cover' });
    this.level = h('div', { class: 'hw-thermo__level' });
    this.notchHost = h('div', { class: 'hw-thermo__notches' });
    this.gauge = h(
      'div',
      { class: 'hw-thermo__gauge' },
      this.scale,
      h('div', { class: 'hw-thermo__tube' }, this.ramp, this.cover, this.level),
      this.notchHost,
    );
    this.el = h(
      'div',
      { class: 'hw-thermo', attrs: { role: 'meter', 'aria-label': 'Temperature' } },
      h('div', { class: 'hw-thermo__readout' }, this.valueEl, h('span', { class: 'hw-thermo__unit', text: '°C' })),
      this.captionEl,
      this.gauge,
    );
    this.setCaption(opts.caption ?? '');
    this.renderScale();
    this.setNotches(opts.notches ?? []);
    this.set(this.temp);
    // Label spacing depends on the rendered height, which is only known once the gauge is laid out.
    this.observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            const next = Math.round(entries[0].contentRect.height);
            if (next === this.height) return;
            this.height = next;
            this.renderScale();
            this.layoutNotches();
          })
        : null;
    this.observer?.observe(this.scale);
  }

  /** Shows a temperature. Cheap enough to call every simulation tick. */
  set(tempC: number): void {
    this.temp = tempC;
    const fraction = this.fraction(tempC);
    const level = `${(fraction * 100).toFixed(2)}%`;
    if (level !== this.shownLevel) {
      this.shownLevel = level;
      this.cover.style.height = `${((1 - fraction) * 100).toFixed(2)}%`;
      this.level.style.bottom = level;
    }
    const degrees = Math.round(tempC);
    if (degrees !== this.shownDegrees) {
      this.shownDegrees = degrees;
      setText(this.valueEl, String(degrees));
      this.valueEl.style.color = heatTextColor(tempC);
      this.el.style.setProperty('--hw-heat-now', heatColor(tempC));
      setAttr(this.el, 'aria-valuenow', degrees);
      setAttr(this.el, 'aria-valuetext', formatTemp(tempC));
    }
    for (const view of this.notches) {
      const met = tempC >= view.notch.tempC;
      if (met !== view.met) {
        view.met = met;
        view.el.dataset.met = String(met);
      }
    }
  }

  /** Changes the scale (a furnace upgrade raises the ceiling). */
  setRange(minC: number, maxC: number): void {
    if (minC === this.min && maxC === this.max) return;
    this.min = minC;
    this.max = maxC;
    this.renderScale();
    this.setNotches(this.allNotches);
  }

  /** Replaces the labelled marks beside the tube. Notches outside the scale are not drawn. */
  setNotches(notches: readonly ThermoNotch[]): void {
    this.allNotches = notches;
    this.notches = notches
      .filter((n) => n.tempC >= this.min && n.tempC <= this.max)
      .map((notch) => {
        const label = h(
          'span',
          { class: 'hw-notch__label' },
          h('span', { class: 'hw-notch__temp hw-num', text: String(Math.round(notch.tempC)) }),
          h('span', { class: 'hw-notch__name', text: notch.label }),
        );
        const el = h(
          'div',
          { class: 'hw-notch', attrs: { 'data-kind': notch.kind ?? 'threshold' }, style: { bottom: `${(this.fraction(notch.tempC) * 100).toFixed(2)}%` } },
          h('span', { class: 'hw-notch__tick' }),
          label,
        );
        return { notch, el, label, met: null };
      });
    this.notchHost.replaceChildren(...this.notches.map((v) => v.el));
    this.layoutNotches();
    this.set(this.temp);
  }

  setCaption(text: string): void {
    setText(this.captionEl, text);
    this.captionEl.hidden = text === '';
  }

  dispose(): void {
    this.observer?.disconnect();
  }

  private fraction(tempC: number): number {
    const span = this.max - this.min;
    return span > 0 && Number.isFinite(tempC) ? Math.min(1, Math.max(0, (tempC - this.min) / span)) : 0;
  }

  private renderScale(): void {
    this.ramp.style.background = heatGradient(this.min, this.max);
    setAttr(this.el, 'aria-valuemin', this.min);
    setAttr(this.el, 'aria-valuemax', this.max);
    // The scale column is exactly as wide as its longest number, leaving the rest to the notch labels.
    this.gauge.style.setProperty('--hw-scale-w', `${Math.round(String(Math.round(this.max)).length * 6.5 + 12)}px`);
    const maxTicks = Math.max(2, Math.floor((this.height || 200) / SCALE_LABEL_PX));
    const ticks = ticksBetween(this.min, this.max, niceStep(this.max - this.min, maxTicks));
    this.scale.replaceChildren(
      ...ticks.map((t) =>
        h('span', { class: 'hw-thermo__tick hw-num', text: String(t), style: { bottom: `${(this.fraction(t) * 100).toFixed(2)}%` } }),
      ),
    );
  }

  /** Nudges labels apart vertically so close thresholds stay readable; the tick stays at the true height. */
  private layoutNotches(): void {
    if (this.height <= 0 || this.notches.length === 0) return;
    const exact = this.notches.map((v) => this.fraction(v.notch.tempC) * this.height);
    const placed = declutter(exact, LABEL_GAP_PX, 0, this.height);
    this.notches.forEach((view, i) => {
      view.label.style.setProperty('--hw-nudge', `${(exact[i] - placed[i]).toFixed(1)}px`);
    });
  }
}
