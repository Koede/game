/** The loading screen and the full-screen notices (no WebGL2, a world that cannot start). */
import { Button } from '../ui/kit/controls';
import { h } from '../ui/kit/dom';
import { Meter } from '../ui/kit/gauges';
import appCss from './app.css';

export function injectAppCss(): void {
  if (document.getElementById('hw-app-css')) return;
  const style = document.createElement('style');
  style.id = 'hw-app-css';
  style.textContent = appCss;
  document.head.appendChild(style);
}

/** Lines shown while the world streams in, by progress. */
const STAGES: readonly [number, string][] = [
  [0, 'Raising the land'],
  [0.3, 'Carving caves and veins'],
  [0.6, 'Lighting the world'],
  [0.9, 'Kindling the hearth'],
];

export class LoadingScreen {
  readonly el: HTMLDivElement;
  private readonly meter = new Meter({ label: 'Loading', tone: 'heat', value: 0, max: 1 });
  private readonly status: HTMLParagraphElement;
  private readonly seed: HTMLParagraphElement;

  constructor() {
    this.status = h('p', { class: 'hw-loading__status', attrs: { role: 'status', 'aria-live': 'polite' } });
    this.seed = h('p', { class: 'hw-loading__seed' });
    this.meter.el.classList.add('hw-loading__meter');
    this.el = h(
      'div',
      { class: ['hw-loading', 'hw-ui-blocking'] },
      h(
        'div',
        { class: 'hw-loading__card' },
        h('div', { class: 'hw-loading__ember', attrs: { 'aria-hidden': 'true' } }),
        h('h1', { class: 'hw-loading__mark', attrs: { 'aria-label': 'Hearthwatt' } }, h('span', { text: 'HEARTH' }), h('span', { text: 'WATT' })),
        this.meter.el,
        this.status,
        this.seed,
      ),
    );
    this.set(0);
  }

  show(host: HTMLElement, title: string, seedLine: string): void {
    this.meter.setLabel(title);
    this.seed.textContent = seedLine;
    this.el.removeAttribute('data-leaving');
    this.set(0);
    host.appendChild(this.el);
  }

  set(progress: number): void {
    let line = STAGES[0][1];
    for (const [at, text] of STAGES) if (progress >= at) line = text;
    this.meter.set(progress, 1);
    if (this.status.textContent !== line) this.status.textContent = line;
  }

  /** Fades out, then detaches. */
  hide(): void {
    if (!this.el.parentElement) return;
    this.el.setAttribute('data-leaving', '');
    window.setTimeout(() => {
      if (this.el.hasAttribute('data-leaving')) this.el.remove();
    }, 400);
  }
}

export interface NoticeOptions {
  title: string;
  body: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}

/** A full-screen card on soot: used when the game cannot run or a world cannot start. */
export function showNotice(host: HTMLElement, opts: NoticeOptions): HTMLElement {
  const action = opts.action ? new Button({ label: opts.action.label, kind: 'primary', block: true, onClick: opts.action.onClick }) : null;
  const el = h(
    'div',
    { class: ['hw-notice', 'hw-ui-blocking'], attrs: { role: 'alert' } },
    h(
      'div',
      { class: 'hw-notice__card' },
      h('h2', { class: 'hw-notice__title', text: opts.title }),
      h('p', { class: 'hw-notice__body', text: opts.body }),
      opts.detail ? h('p', { class: 'hw-notice__detail', text: opts.detail }) : null,
      action ? action.el : null,
    ),
  );
  host.appendChild(el);
  return el;
}

/** True when this browser can create a WebGL2 context (the context is released straight away). */
export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export const NO_WEBGL_NOTICE: NoticeOptions = {
  title: 'This device cannot draw the world',
  body:
    'Hearthwatt needs WebGL2 to draw its world, and this browser or device does not provide it. ' +
    'Try a current version of Chrome, Edge, Firefox or Safari, and check that hardware acceleration is switched on.',
};
