/** The crosshair at screen centre, a ring that fills while mining, and the name of the targeted block. */
import { h, setFlag, setText } from '../kit/dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 15;
const RING_LEN = 2 * Math.PI * RING_R;

export class Crosshair {
  readonly el: HTMLDivElement;
  private readonly ring: SVGCircleElement;
  private readonly nameEl: HTMLDivElement;
  private shownRing = -2;

  constructor() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('hw-cross__svg');
    const track = document.createElementNS(SVG_NS, 'circle');
    this.ring = document.createElementNS(SVG_NS, 'circle');
    for (const c of [track, this.ring]) {
      c.setAttribute('cx', '20');
      c.setAttribute('cy', '20');
      c.setAttribute('r', String(RING_R));
    }
    track.classList.add('hw-cross__track');
    this.ring.classList.add('hw-cross__ring');
    this.ring.setAttribute('stroke-dasharray', `0 ${RING_LEN.toFixed(2)}`);
    svg.append(track, this.ring);
    this.nameEl = h('div', { class: 'hw-cross__name' });
    this.el = h('div', { class: 'hw-cross' }, h('div', { class: 'hw-cross__mark' }), svg, this.nameEl);
    this.set(null, -1);
  }

  /** `name` of the targeted block (null = nothing in reach); `mining` 0..1, or -1 when not mining. */
  set(name: string | null, mining: number): void {
    setText(this.nameEl, name ?? '');
    setFlag(this.nameEl, 'shown', name !== null);
    setFlag(this.el, 'target', name !== null);
    const ring = mining >= 0 ? Math.round(Math.min(1, mining) * 60) / 60 : -1;
    if (ring === this.shownRing) return;
    this.shownRing = ring;
    setFlag(this.el, 'mining', ring >= 0);
    const len = Math.max(0, ring) * RING_LEN;
    this.ring.setAttribute('stroke-dasharray', `${len.toFixed(2)} ${RING_LEN.toFixed(2)}`);
  }
}
