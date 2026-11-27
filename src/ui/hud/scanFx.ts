/**
 * The notebook scan, drawn over the crosshair: a reticle that tightens round the aimed thing, a ring that fills with a
 * sweeping arc, the thing's aspect glyphs orbiting inward as they converge, a sheen across the block and a few motes
 * drifting out towards the player; on completion a flash ring and the aspects pop out and float up. Magic exposes only
 * `scanProgress()` / `scanResult()`; this reads them each frame and touches ~25 nodes, only while a scan runs.
 * Reduce motion: just the smooth ring (no orbit, sheen, motes or pop).
 */
import { aspectInfo, type Aspect } from '../../magic/aspects';
import type { ScanDone, ScanProgress } from '../../magic/magic';
import { h } from '../kit/dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
const R = 44;
const LEN = 2 * Math.PI * R;
const MOTES = 9;
const MAX_ORBS = 5;
const TAU = Math.PI * 2;

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

/** Pure: orbit radius and angle (radians) of glyph `i` of `n` at fill `f` at time `t`: spirals inward, a turn and a half. */
export function orbitAt(i: number, n: number, f: number, t: number): { r: number; a: number } {
  const e = f * f * (3 - 2 * f);
  return { r: 58 - 44 * e, a: (i / Math.max(1, n)) * TAU + e * TAU * 1.5 + t * 0.9 };
}

/** Pure: a drifting mote at phase `u` 0..1: outward from the ring, sinking a little, fading in and out. */
export function moteAt(i: number, u: number): { x: number; y: number; o: number } {
  const ang = i * 2.399963 + 0.6; // golden angle: an even spread
  const d = 26 + 46 * u;
  return { x: Math.cos(ang) * d, y: Math.sin(ang) * d + 34 * u * u, o: Math.sin(Math.PI * u) };
}

export class ScanFx {
  readonly el: HTMLDivElement;
  private readonly box: HTMLDivElement;
  private readonly arc: SVGCircleElement;
  private readonly head: SVGCircleElement;
  private readonly ticks: SVGGElement;
  private readonly inner: SVGGElement;
  private readonly brackets: SVGGElement;
  private readonly sheen: HTMLDivElement;
  private readonly orbs: HTMLSpanElement[] = [];
  private readonly motes: HTMLSpanElement[] = [];
  private readonly pop: HTMLDivElement;
  private shown = false;
  private key = '';
  private colors: string[] = [];
  private doneId = 0;
  private popTimer = 0;
  private reduced = false;

  constructor() {
    const mk = (cls: string, attrs: Record<string, string> = {}) => svgEl('circle', { cx: '60', cy: '60', ...attrs, class: cls });
    const track = mk('hw-scan__track', { r: String(R) });
    this.arc = mk('hw-scan__arc', { r: String(R), 'stroke-dasharray': `0 ${LEN.toFixed(2)}` });
    this.head = mk('hw-scan__head', { r: '3.2' });
    this.ticks = svgEl('g', { class: 'hw-scan__ticks' });
    this.ticks.append(mk('hw-scan__tickring', { r: '52', 'stroke-dasharray': '1.5 9.3' }));
    this.inner = svgEl('g', { class: 'hw-scan__inner' });
    this.inner.append(mk('hw-scan__innerring', { r: '31', 'stroke-dasharray': '10 6 2 6' }));
    this.brackets = svgEl('g', { class: 'hw-scan__brackets' });
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.brackets.append(svgEl('path', { d: `M${60 + sx * 30} ${60 + sy * 18} V${60 + sy * 30} H${60 + sx * 18}`, class: 'hw-scan__bracket' }));
    }
    const svg = svgEl('svg', { viewBox: '0 0 120 120', width: '120', height: '120', class: 'hw-scan__svg', 'aria-hidden': 'true' });
    svg.append(this.ticks, this.inner, this.brackets, track, this.arc, this.head);
    this.sheen = h('div', { class: 'hw-scan__sheen' }, h('i'));
    for (let i = 0; i < MOTES; i++) this.motes.push(h('span', { class: 'hw-scan__mote' }));
    for (let i = 0; i < MAX_ORBS; i++) this.orbs.push(h('span', { class: 'hw-scan__orb' }));
    this.pop = h('div', { class: 'hw-scan__pop' });
    this.box = h('div', { class: 'hw-scan__box' }, this.sheen, svg, ...this.motes, ...this.orbs);
    this.box.hidden = true;
    this.el = h('div', { class: 'hw-scan', attrs: { 'aria-hidden': 'true' } }, this.box, this.pop);
  }

  /** Call every frame (cheap when idle): the live scan, and the last finished one (popped once per `id`). */
  update(p: ScanProgress | null, done: ScanDone | null, now: number): void {
    if (done && done.id !== this.doneId) {
      // The first sighting of a result (after load, an old one) is not a fresh scan: only pop when one was running.
      const fresh = this.doneId !== 0 || this.shown;
      this.doneId = done.id;
      if (fresh) this.burst(done);
    } else if (done && this.doneId === 0) this.doneId = done.id;
    if (!p) {
      if (this.shown) { this.shown = false; this.box.hidden = true; }
      return;
    }
    if (!this.shown || p.key !== this.key) this.start(p);
    this.draw(p, now);
  }

  private start(p: ScanProgress): void {
    this.shown = true;
    this.key = p.key;
    this.reduced = this.el.closest('[data-reduce-motion]') !== null;
    this.colors = p.aspects.map((a) => aspectInfo(a).color);
    const c0 = this.colors[0] ?? '#b8c4ff';
    this.box.style.setProperty('--scan-c', c0);
    this.box.hidden = false;
    this.orbs.forEach((o, i) => {
      const a = p.aspects[i];
      o.hidden = a === undefined || this.reduced;
      if (a !== undefined) this.paintGlyph(o, a);
    });
    this.motes.forEach((m, i) => {
      m.hidden = this.reduced;
      m.style.background = this.colors[i % Math.max(1, this.colors.length)] ?? c0;
    });
    this.sheen.hidden = this.reduced;
  }

  private paintGlyph(el: HTMLElement, a: Aspect): void {
    const info = aspectInfo(a);
    el.textContent = info.name[0];
    el.style.setProperty('--g', info.color);
  }

  private draw(p: ScanProgress, now: number): void {
    const f = p.f;
    this.arc.setAttribute('stroke-dasharray', `${(f * LEN).toFixed(1)} ${LEN.toFixed(1)}`);
    // The head dot rides the arc's tip (the svg is rotated -90deg by css, so angle 0 is at the top).
    const ang = f * TAU;
    this.head.setAttribute('cx', (60 + R * Math.cos(ang)).toFixed(1));
    this.head.setAttribute('cy', (60 + R * Math.sin(ang)).toFixed(1));
    this.head.style.opacity = f > 0.015 ? '1' : '0';
    if (this.reduced) return;
    const t = now / 1000;
    this.ticks.style.transform = `rotate(${(t * 22).toFixed(1)}deg)`;
    this.inner.style.transform = `rotate(${(-t * 36 - f * 200).toFixed(1)}deg)`;
    this.brackets.style.transform = `scale(${(1.28 - 0.3 * f).toFixed(3)})`;
    // The sheen sweeps left to right across the block every 0.7 s.
    const s = (t / 0.7) % 1;
    this.sheen.style.setProperty('--sx', `${((s * 2 - 1) * 70).toFixed(1)}px`);
    this.sheen.style.opacity = (0.35 + 0.65 * f).toFixed(2);
    const n = p.aspects.length;
    for (let i = 0; i < n && i < MAX_ORBS; i++) {
      const o = orbitAt(i, n, f, t);
      const el = this.orbs[i];
      el.style.transform = `translate(${(Math.cos(o.a) * o.r).toFixed(1)}px, ${(Math.sin(o.a) * o.r * 0.9).toFixed(1)}px) scale(${(0.75 + 0.45 * f).toFixed(2)})`;
      el.style.opacity = Math.min(1, 0.25 + f * 3).toFixed(2);
    }
    for (let i = 0; i < MOTES; i++) {
      const u = (t * 0.8 + i / MOTES) % 1;
      const m = moteAt(i, u);
      const el = this.motes[i];
      el.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px) scale(${(1.1 - 0.5 * u).toFixed(2)})`;
      el.style.opacity = (m.o * (0.3 + 0.7 * f)).toFixed(2);
    }
  }

  /** Completion: a flash ring, then the learned aspects pop out in a fan and float up (new ones ringed). */
  private burst(d: ScanDone): void {
    this.box.hidden = true;
    this.shown = false;
    if (this.el.closest('[data-reduce-motion]') !== null) return;
    this.pop.replaceChildren();
    const c0 = aspectInfo(d.aspects[0] ?? 'rune').color;
    this.pop.style.setProperty('--scan-c', c0);
    this.pop.append(h('div', { class: 'hw-scan__flash' }), h('div', { class: 'hw-scan__flash hw-scan__flash--2' }));
    const n = d.aspects.length;
    d.aspects.forEach((a, i) => {
      const spread = Math.min(1.9, 0.62 * Math.max(1, n - 1));
      const ang = -Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      const chip = h('span', { class: ['hw-scan__chip', d.learned.includes(a) && 'hw-scan__chip--new'], style: {
        '--dx': `${(Math.cos(ang) * 64).toFixed(0)}px`,
        '--dy': `${(Math.sin(ang) * 64 - 8).toFixed(0)}px`,
        '--d': `${i * 55}ms`,
      } });
      this.paintGlyph(chip, a);
      chip.append(h('em', { text: aspectInfo(a).name }));
      this.pop.append(chip);
    });
    this.pop.hidden = false;
    window.clearTimeout(this.popTimer);
    this.popTimer = window.setTimeout(() => this.pop.replaceChildren(), 1800);
  }
}
