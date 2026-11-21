/** Day/night dial and the power strip (generation against demand, once any network exists). */
import { h, setAttr, setFlag, setText } from '../kit/dom';
import { formatJoules, formatPercent, formatWatts } from '../kit/format';
import { glyph } from '../kit/icons';
import { dayInfo, type GridSummary } from './hudMath';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const name in attrs) el.setAttribute(name, String(attrs[name]));
  return el;
};

const R = 13;

export class DayDial {
  readonly el: HTMLDivElement;
  private readonly body: SVGCircleElement;
  private readonly dayEl: HTMLSpanElement;
  private readonly untilEl: HTMLSpanElement;
  private shownPos = '';

  constructor() {
    const face = svg('svg', { viewBox: '0 0 36 36', width: 36, height: 36, 'aria-hidden': 'true', class: 'hw-dial__face' });
    face.append(
      svg('path', { d: 'M3 18a15 15 0 0 1 30 0Z', class: 'hw-dial__sky' }),
      svg('path', { d: 'M3 18a15 15 0 0 0 30 0Z', class: 'hw-dial__night' }),
      svg('line', { x1: 2, y1: 18, x2: 34, y2: 18, class: 'hw-dial__horizon' }),
    );
    this.body = svg('circle', { r: 4, cx: 5, cy: 18, class: 'hw-dial__body' });
    face.append(this.body);
    this.dayEl = h('span', { class: 'hw-dial__day' });
    this.untilEl = h('span', { class: 'hw-dial__until hw-num' });
    this.el = h('div', { class: 'hw-dial hw-hud-plate', attrs: { role: 'img' } }, face, h('span', { class: 'hw-dial__text' }, this.dayEl, this.untilEl));
  }

  update(timeOfDay: number, day: number): void {
    const info = dayInfo(timeOfDay);
    const x = 18 - R * Math.cos(info.dialAngle);
    const y = 18 - R * Math.sin(info.dialAngle);
    const pos = `${x.toFixed(1)},${y.toFixed(1)}`;
    if (pos !== this.shownPos) {
      this.shownPos = pos;
      this.body.setAttribute('cx', x.toFixed(1));
      this.body.setAttribute('cy', y.toFixed(1));
    }
    setFlag(this.el, 'night', info.isNight);
    setText(this.dayEl, `Day ${day}`);
    setText(this.untilEl, info.text);
    setAttr(this.el, 'aria-label', `Day ${day}, ${info.isNight ? 'night' : 'daytime'}. ${info.text}`);
  }
}

const STATE_TEXT: Record<GridSummary['state'], string> = { idle: '', ok: '', short: 'Brown-out', overload: 'Overload' };

export class PowerStrip {
  readonly el: HTMLDivElement;
  private readonly genEl: HTMLSpanElement;
  private readonly useEl: HTMLSpanElement;
  private readonly noteEl: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private readonly marker: HTMLDivElement;

  constructor() {
    this.genEl = h('span', { class: 'hw-power__gen hw-num' });
    this.useEl = h('span', { class: 'hw-power__use hw-num' });
    this.noteEl = h('span', { class: 'hw-power__note hw-num' });
    this.fill = h('div', { class: 'hw-power__fill' });
    this.marker = h('div', { class: 'hw-power__marker' });
    this.el = h(
      'div',
      { class: 'hw-power hw-hud-plate', attrs: { role: 'img' } },
      h('span', { class: 'hw-power__icon' }, glyph('bolt', 14)),
      h(
        'span',
        { class: 'hw-power__body' },
        h('span', { class: 'hw-power__row' }, this.genEl, h('span', { class: 'hw-power__sep', text: '/' }), this.useEl),
        h('div', { class: 'hw-power__track' }, this.fill, this.marker),
        this.noteEl,
      ),
    );
    this.el.hidden = true;
  }

  update(grid: GridSummary): void {
    this.el.hidden = !grid.active;
    if (!grid.active) return;
    setText(this.genEl, formatWatts(grid.generationW));
    setText(this.useEl, formatWatts(grid.demandW));
    // The bar is generation; the marker is demand. A marker past the end of the fill means the grid is short.
    const scale = Math.max(grid.generationW, grid.demandW, 1);
    this.fill.style.transform = `scaleX(${(grid.generationW / scale).toFixed(3)})`;
    this.marker.style.left = `${((grid.demandW / scale) * 100).toFixed(1)}%`;
    this.marker.hidden = grid.demandW <= 0;
    const stateText = STATE_TEXT[grid.state];
    const note = stateText
      ? `${stateText} ${formatPercent(grid.satisfaction)}`
      : grid.capacityJ > 0
        ? `Stored ${formatJoules(grid.storedJ)}`
        : '';
    setText(this.noteEl, grid.state === 'overload' ? stateText : note);
    this.noteEl.hidden = this.noteEl.textContent === '';
    setAttr(this.el, 'data-state', grid.state);
    setAttr(
      this.el,
      'aria-label',
      `Power: generating ${formatWatts(grid.generationW)}, demand ${formatWatts(grid.demandW)}${stateText ? `, ${stateText.toLowerCase()}` : ''}`,
    );
  }
}
