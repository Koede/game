/** Day/night dial (with the weather and tonight's moon) and the power strip (generation against demand, once any network exists). */
import type { WeatherState } from '../../core/types';
import { h, setAttr, setFlag, setText } from '../kit/dom';
import { formatJoules, formatPercent, formatWatts } from '../kit/format';
import { glyph } from '../kit/icons';
import { DIAL_SOON_S, dayInfo, untilLabel, type GridSummary } from './hudMath';
import { moonName, moonPath, weatherGlyph, weatherWord, type WeatherGlyph } from './weatherText';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const name in attrs) el.setAttribute(name, String(attrs[name]));
  return el;
};

const R = 13;

/** A cloud of overlapping circles: an outline pass under a fill pass, so the overlaps leave no seams. */
function cloud(cls: string, dy = 0): SVGGElement {
  const g = svg('g', { class: cls });
  const parts = (): SVGElement[] => [
    svg('circle', { cx: 14.3, cy: 12.6 + dy, r: 2.7 }),
    svg('circle', { cx: 18.4, cy: 10.4 + dy, r: 3.7 }),
    svg('circle', { cx: 22.1, cy: 12.7 + dy, r: 2.6 }),
    svg('rect', { x: 14.3, y: 12.4 + dy, width: 7.8, height: 2.9 }),
  ];
  const edge = svg('g', { class: 'hw-dial__cloud-edge' });
  const fill = svg('g', { class: 'hw-dial__cloud-fill' });
  edge.append(...parts());
  fill.append(...parts());
  g.append(edge, fill);
  return g;
}

/** The weather glyph drawn in the middle of the dial face, above the horizon. */
function weatherArt(glyph: WeatherGlyph): SVGGElement {
  const g = svg('g', { class: `hw-dial__wx hw-dial__wx--${glyph}` });
  if (glyph === 'clear') return g;
  if (glyph === 'dust') {
    for (const [x1, x2, y] of [[11.5, 22.5, 9], [14, 25, 12.2], [10.5, 20, 15.4]]) {
      g.append(svg('line', { x1, y1: y, x2, y2: y, class: 'hw-dial__dust' }));
    }
    return g;
  }
  g.append(cloud('hw-dial__cloud', glyph === 'cloudy' ? 1.5 : 0));
  if (glyph === 'rain') {
    for (const x of [15, 18.6, 22.2]) g.append(svg('line', { x1: x, y1: 16.9, x2: x - 1.2, y2: 19.6, class: 'hw-dial__drop' }));
  } else if (glyph === 'snow') {
    for (const [x, y] of [[15, 17.6], [18.6, 19.3], [22.2, 17.6]]) g.append(svg('circle', { cx: x, cy: y, r: 1.15, class: 'hw-dial__flake' }));
  } else if (glyph === 'storm') {
    g.append(svg('path', { d: 'M19.6 15.4 16.4 19.6h2.3l-1.4 3.9 4.2-5.4h-2.4l1.6-2.7Z', class: 'hw-dial__bolt' }));
  }
  return g;
}

/** The dial's weather glyph on its own, cropped to its area (the Hearth Log's sky line). Clear shows the sun. */
export function weatherIcon(g: WeatherGlyph, size: number): SVGSVGElement {
  const el = svg('svg', { viewBox: '9.5 4.5 17 17', width: size, height: size, 'aria-hidden': 'true', class: `hw-dial__icon hw-dial__icon--${g}` });
  if (g === 'clear') el.append(svg('circle', { cx: 18, cy: 13, r: 4.6, class: 'hw-dial__body' }));
  else el.append(weatherArt(g));
  return el;
}

/** A small moon in its phase: a dark disc with the lit part on top. */
export function moonArt(phase: number, size: number): SVGSVGElement {
  const el = svg('svg', { viewBox: '0 0 12 12', width: size, height: size, 'aria-hidden': 'true', class: 'hw-dial__moon-icon' });
  el.append(
    svg('circle', { cx: 6, cy: 6, r: 5, class: 'hw-dial__moon-dark' }),
    svg('path', { d: moonPath(phase, 6, 6, 5), class: 'hw-dial__moon-lit' }),
    // Two craters: they show on the lit part and vanish into the dark side, so even a full moon reads as a moon.
    svg('circle', { cx: 4.4, cy: 4.6, r: 1.2, class: 'hw-dial__crater' }),
    svg('circle', { cx: 7.4, cy: 7.6, r: 0.9, class: 'hw-dial__crater' }),
  );
  return el;
}

export class DayDial {
  readonly el: HTMLDivElement;
  private readonly face: SVGSVGElement;
  private readonly body: SVGCircleElement;
  private readonly moon: SVGGElement;
  private readonly moonLit: SVGPathElement;
  private wx: SVGGElement;
  private shownGlyph: WeatherGlyph = 'clear';
  /** Null until the first update, so a game loaded at dusk does not pulse. */
  private shownSoon: boolean | null = null;
  private shownPhase = -1;
  private readonly dayEl: HTMLSpanElement;
  private readonly untilEl: HTMLSpanElement;
  private readonly untilText: HTMLSpanElement;
  private readonly nextIcon: HTMLSpanElement;
  private shownPos = '';
  private shownNight: boolean | null = null;

  constructor() {
    const face = svg('svg', { viewBox: '0 0 36 36', width: 36, height: 36, 'aria-hidden': 'true', class: 'hw-dial__face' });
    this.face = face;
    face.append(
      svg('path', { d: 'M3 18a15 15 0 0 1 30 0Z', class: 'hw-dial__sky' }),
      svg('path', { d: 'M3 18a15 15 0 0 0 30 0Z', class: 'hw-dial__night' }),
      svg('line', { x1: 2, y1: 18, x2: 34, y2: 18, class: 'hw-dial__horizon' }),
    );
    this.body = svg('circle', { r: 4, cx: 5, cy: 18, class: 'hw-dial__body' });
    // At night the body is tonight's moon in its phase.
    this.moon = svg('g', { class: 'hw-dial__moon' });
    this.moonLit = svg('path', { d: '', class: 'hw-dial__moon-lit' });
    this.moon.append(svg('circle', { cx: 0, cy: 0, r: 4.4, class: 'hw-dial__moon-dark' }), this.moonLit);
    this.wx = weatherArt('clear');
    face.append(this.body, this.moon, this.wx);
    this.dayEl = h('span', { class: 'hw-dial__day' });
    // "Night in 6 m" reads as a moon and "6 m": the dial face already says which half of the day it is.
    this.nextIcon = h('span', { class: 'hw-dial__next' });
    this.untilText = h('span', { class: 'hw-num' });
    this.untilEl = h('span', { class: 'hw-dial__until' }, this.nextIcon, this.untilText);
    this.el = h('div', { class: 'hw-dial hw-hud-plate', attrs: { role: 'img' } }, face, h('span', { class: 'hw-dial__text' }, this.dayEl, this.untilEl));
  }

  /** `weather` null: no glyph, and the moon is drawn full. */
  update(timeOfDay: number, day: number, weather: WeatherState | null = null): void {
    const info = dayInfo(timeOfDay);
    const x = 18 - R * Math.cos(info.dialAngle);
    const y = 18 - R * Math.sin(info.dialAngle);
    const pos = `${x.toFixed(1)},${y.toFixed(1)}`;
    if (pos !== this.shownPos) {
      this.shownPos = pos;
      this.body.setAttribute('cx', x.toFixed(1));
      this.body.setAttribute('cy', y.toFixed(1));
      this.moon.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    }
    const phase = weather ? weather.moonPhase : 4;
    const nightChanged = info.isNight !== this.shownNight;
    if (nightChanged) {
      this.shownNight = info.isNight;
      setFlag(this.el, 'night', info.isNight);
    }
    if (nightChanged || phase !== this.shownPhase) {
      this.shownPhase = phase;
      this.moonLit.setAttribute('d', moonPath(phase, 0, 0, 4.4));
      // By day the countdown to night shows tonight's moon; at night, the sun of the coming dawn.
      this.nextIcon.replaceChildren(info.isNight ? glyph('sun', 11) : moonArt(phase, 12));
    }
    const g = weather ? weatherGlyph(weather) : 'clear';
    if (g !== this.shownGlyph) {
      this.shownGlyph = g;
      const art = weatherArt(g);
      this.face.replaceChild(art, this.wx);
      this.wx = art;
      setAttr(this.el, 'data-weather', g);
    }
    const sky = weather ? `${weatherWord(g)}. ` : '';
    setText(this.dayEl, `Day ${day}`);
    setText(this.untilText, untilLabel(info.isNight, info.untilS));
    // Crossing the last two minutes: the dial pulses once so the coming night (or dawn) is noticed.
    const soon = info.untilS < DIAL_SOON_S;
    if (soon !== this.shownSoon) {
      if (soon && this.shownSoon === false) {
        this.el.removeAttribute('data-pulse');
        void this.el.offsetWidth;
        this.el.setAttribute('data-pulse', '');
      }
      this.shownSoon = soon;
    }
    setAttr(this.el, 'aria-label', `Day ${day}, ${info.isNight ? 'night' : 'daytime'}. ${sky}${info.text}. Tonight: ${moonName(phase).toLowerCase()}.`);
    setAttr(this.el, 'title', `${sky}${info.text}. Tonight: ${moonName(phase).toLowerCase()}`);
  }
}

const STATE_TEXT: Record<GridSummary['state'], string> = { idle: '', ok: '', short: 'Brown-out', overload: 'Overload' };

export class PowerStrip {
  readonly el: HTMLDivElement;
  private readonly genEl: HTMLSpanElement;
  private readonly noteEl: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private readonly marker: HTMLDivElement;

  constructor() {
    this.genEl = h('span', { class: 'hw-power__gen hw-num' });
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
        h('span', { class: 'hw-power__row' }, this.genEl),
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
    // The bar is generation; the marker is demand. A marker past the end of the fill means the grid is short.
    const scale = Math.max(grid.generationW, grid.demandW, 1);
    this.fill.style.transform = `scaleX(${(grid.generationW / scale).toFixed(3)})`;
    this.marker.style.left = `${((grid.demandW / scale) * 100).toFixed(1)}%`;
    this.marker.hidden = grid.demandW <= 0;
    const stateText = STATE_TEXT[grid.state];
    let note = `uses ${formatWatts(grid.demandW)}`;
    if (grid.state === 'overload') note = 'Cables overloaded';
    else if (grid.state === 'short') note = `${stateText}: ${formatPercent(grid.satisfaction)}`;
    else if (grid.capacityJ > 0) note += ` · ${formatJoules(grid.storedJ)} stored`;
    setText(this.noteEl, note);
    setAttr(this.el, 'data-state', grid.state);
    setAttr(
      this.el,
      'aria-label',
      `Power: generating ${formatWatts(grid.generationW)}, demand ${formatWatts(grid.demandW)}${stateText ? `, ${stateText.toLowerCase()}` : ''}`,
    );
  }
}
