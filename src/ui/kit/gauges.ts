/** Read-outs: badge, chip, meter, stat figure. The thermometer and the sparkline have their own files. */
import { h, setAttr, setFlag, setText } from './dom';
import { formatPercent, splitUnit } from './format';
import { glyph, type GlyphName } from './icons';

export * from './thermometer';
export * from './sparkline';

/** heat and power are the two semantic hues of the game; good / warn / bad are status only. */
export type Tone = 'neutral' | 'heat' | 'power' | 'good' | 'warn' | 'bad';

export interface BadgeOptions {
  text: string;
  tone?: Tone;
  /** A small colour square before the text (a heat-ramp colour for temperature requirements). */
  swatch?: string | null;
  icon?: GlyphName;
  /** For requirement badges: true = satisfied (quiet, ticked), false = not yet (emphasised, dashed). */
  met?: boolean | null;
}

/** A small non-interactive label: "900 °C", "Tier 2", "8 s". */
export class Badge {
  readonly el: HTMLSpanElement;
  private readonly textEl: HTMLSpanElement;
  private readonly swatchEl: HTMLSpanElement;
  private readonly tickEl: SVGSVGElement;
  private swatch: string | null = null;

  constructor(opts: BadgeOptions) {
    this.textEl = h('span', { class: 'hw-badge__text' });
    this.swatchEl = h('span', { class: 'hw-badge__swatch' });
    this.tickEl = glyph('check', 10);
    this.tickEl.classList.add('hw-badge__tick');
    this.el = h('span', { class: 'hw-badge' }, this.swatchEl, opts.icon ? glyph(opts.icon, 12) : null, this.textEl, this.tickEl);
    this.update(opts);
  }

  update(opts: Omit<BadgeOptions, 'icon'>): void {
    setText(this.textEl, opts.text);
    setAttr(this.el, 'data-tone', opts.tone ?? 'neutral');
    setAttr(this.el, 'data-met', opts.met === undefined || opts.met === null ? null : String(opts.met));
    const swatch = opts.swatch ?? null;
    this.swatchEl.hidden = swatch === null;
    if (swatch !== null && swatch !== this.swatch) this.swatchEl.style.backgroundColor = swatch;
    this.swatch = swatch;
  }
}

export interface ChipOptions {
  label: string;
  /** A small figure after the label (how many recipes of a category can be made right now). */
  count?: number | null;
  selected?: boolean;
  onClick?: () => void;
}

/** A selectable filter chip (toggle button). */
export class Chip {
  readonly el: HTMLButtonElement;
  private readonly labelEl: HTMLSpanElement;
  private readonly countEl: HTMLSpanElement;

  constructor(opts: ChipOptions) {
    this.labelEl = h('span', { class: 'hw-chip__label', text: opts.label });
    this.countEl = h('span', { class: 'hw-chip__count hw-num' });
    this.el = h('button', { class: 'hw-chip', attrs: { type: 'button' } }, this.labelEl, this.countEl);
    if (opts.onClick) this.el.addEventListener('click', opts.onClick);
    this.setSelected(opts.selected ?? false);
    this.setCount(opts.count ?? null);
  }

  setLabel(text: string): void {
    setText(this.labelEl, text);
  }

  setSelected(selected: boolean): void {
    setAttr(this.el, 'aria-pressed', String(selected));
  }

  setCount(count: number | null): void {
    this.countEl.hidden = count === null;
    if (count !== null) setText(this.countEl, String(count));
    setFlag(this.el, 'zero', count === 0);
  }
}

export interface MeterOptions {
  label: string;
  tone?: Tone;
  value?: number;
  max?: number;
  /** Text on the right. Default: the percentage. */
  text?: string;
}

/** A horizontal bar with a label and a value: stored energy, burn time left, crucible progress. */
export class Meter {
  readonly el: HTMLDivElement;
  private readonly labelEl: HTMLSpanElement;
  private readonly valueEl: HTMLSpanElement;
  private readonly track: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly marker: HTMLDivElement;
  private max: number;

  constructor(opts: MeterOptions) {
    this.max = opts.max ?? 1;
    this.labelEl = h('span', { class: 'hw-meter__label', text: opts.label });
    this.valueEl = h('span', { class: 'hw-meter__value hw-num' });
    this.fill = h('div', { class: 'hw-meter__fill' });
    this.marker = h('div', { class: 'hw-meter__marker' });
    this.marker.hidden = true;
    this.track = h('div', { class: 'hw-meter__track', attrs: { role: 'meter', 'aria-label': opts.label, 'aria-valuemin': 0 } }, this.fill, this.marker);
    this.el = h('div', { class: 'hw-meter' }, h('div', { class: 'hw-meter__top' }, this.labelEl, this.valueEl), this.track);
    this.setTone(opts.tone ?? 'neutral');
    this.set(opts.value ?? 0, this.max, opts.text);
  }

  /** Updates the bar. `text` replaces the percentage on the right ("1.2 MJ / 2 MJ"). */
  set(value: number, max: number = this.max, text?: string): void {
    this.max = max;
    const fraction = max > 0 && Number.isFinite(value) ? Math.min(1, Math.max(0, value / max)) : 0;
    const scale = `scaleX(${fraction.toFixed(4)})`;
    if (this.fill.style.transform !== scale) this.fill.style.transform = scale;
    const shown = text ?? formatPercent(fraction);
    setText(this.valueEl, shown);
    setAttr(this.track, 'aria-valuemax', max);
    setAttr(this.track, 'aria-valuenow', Number.isFinite(value) ? Math.round(value * 100) / 100 : 0);
    setAttr(this.track, 'aria-valuetext', shown);
  }

  setLabel(text: string): void {
    setText(this.labelEl, text);
  }

  setTone(tone: Tone): void {
    setAttr(this.el, 'data-tone', tone);
  }

  /** A tick across the bar at a fraction 0..1 (demand against generation, a cable's rating); null hides it. */
  setMarker(fraction: number | null): void {
    this.marker.hidden = fraction === null;
    if (fraction !== null) this.marker.style.left = `${(Math.min(1, Math.max(0, fraction)) * 100).toFixed(2)}%`;
  }
}

export interface StatFigureOptions {
  caption: string;
  /** A formatted reading such as "12.5 kW": the unit is split off and set smaller. */
  reading?: string;
  note?: string;
  tone?: Tone;
  size?: 'md' | 'lg';
}

/** A big number with its unit and a caption: the headline figure of a panel. */
export class StatFigure {
  readonly el: HTMLDivElement;
  private readonly valueEl: HTMLSpanElement;
  private readonly unitEl: HTMLSpanElement;
  private readonly noteEl: HTMLDivElement;
  private color: string | null = null;

  constructor(opts: StatFigureOptions) {
    this.valueEl = h('span', { class: 'hw-stat__value hw-num' });
    this.unitEl = h('span', { class: 'hw-stat__unit' });
    this.noteEl = h('div', { class: 'hw-stat__note' });
    this.el = h(
      'div',
      { class: ['hw-stat', opts.size === 'lg' && 'hw-stat--lg'] },
      h('div', { class: 'hw-stat__caption', text: opts.caption }),
      h('div', { class: 'hw-stat__row' }, this.valueEl, this.unitEl),
      this.noteEl,
    );
    this.setTone(opts.tone ?? 'neutral');
    this.set(opts.reading ?? '--');
    this.setNote(opts.note ?? '');
  }

  /** Shows a formatted reading ("850 W", "1240 °C"). */
  set(reading: string): void {
    const [value, unit] = splitUnit(reading);
    setText(this.valueEl, value);
    setText(this.unitEl, unit);
  }

  setNote(text: string): void {
    setText(this.noteEl, text);
    this.noteEl.hidden = text === '';
  }

  setTone(tone: Tone): void {
    setAttr(this.el, 'data-tone', tone);
  }

  /** Overrides the number's colour (a heat-ramp text colour); null returns to the tone colour. */
  setColor(color: string | null): void {
    if (color === this.color) return;
    this.color = color;
    if (color === null) this.valueEl.style.removeProperty('color');
    else this.valueEl.style.color = color;
  }
}
