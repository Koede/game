/** One shared tooltip: hover or keyboard focus on desktop, long-press on touch. It never leaves the viewport. */
import type { Aspect } from '../../magic/aspects';
import { aspectIcon } from './aspectIcon';
import { Disposer, append, h, listen, type Dispose } from './dom';
import { placeTooltip, type Box } from './layout';
import { LONG_PRESS_MS } from './press';

export interface TooltipCard {
  title: string;
  body?: string;
  /** Colours the title by loot rarity ('fine' green, 'rare' blue, 'legendary' gold); absent or 'common' leaves it plain. */
  rarity?: string;
  /** Label / value pairs under the body ("Burns for" / "80 s"). */
  rows?: readonly (readonly [label: string, value: string])[];
  /** Coloured lines with an aspect icon under the title (enchantments: "Veinseeker II"). */
  lines?: readonly { text: string; colour: string; aspect: Aspect; title?: string }[];
}

export type TooltipContent = string | TooltipCard | Node | null;
/** Content, or a function called each time the tooltip opens (so it can show live numbers). */
export type TooltipSource = TooltipContent | (() => TooltipContent);

export interface TooltipAttachOptions {
  /** 'none' leaves long-press to the target (an item slot uses it for its secondary action). Default 'longpress'. */
  touch?: 'longpress' | 'none';
}

const HOVER_DELAY_MS = 320;
const TOUCH_LINGER_MS = 1400;
const MOVE_TOLERANCE_PX = 10;

export class Tooltip {
  readonly el: HTMLDivElement;
  private readonly host: HTMLElement;
  private readonly whileOpen = new Disposer();
  private anchor: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** `host` is the layer the tooltip is drawn in (normally `UIRoot.layers.tooltip`). */
  constructor(host: HTMLElement) {
    this.host = host;
    this.el = h('div', { class: 'hw-tooltip', attrs: { role: 'tooltip' } });
    this.el.hidden = true;
    host.appendChild(this.el);
  }

  /** Makes `target` show a tooltip. Returns a function that detaches it again. */
  attach(target: HTMLElement, source: TooltipSource, opts: TooltipAttachOptions = {}): Dispose {
    const d = new Disposer();
    const open = (): void => {
      const content = typeof source === 'function' ? source() : source;
      if (content !== null && target.isConnected) this.show(target, content);
    };
    const later = (ms: number, fn: () => void): void => {
      this.clearTimer();
      this.timer = setTimeout(fn, ms);
    };
    const close = (): void => {
      this.clearTimer();
      if (this.anchor === target) this.hide();
    };
    let startX = 0;
    let startY = 0;
    d.add(listen(target, 'pointerenter', (ev) => (ev.pointerType === 'mouse' ? later(HOVER_DELAY_MS, open) : undefined)));
    d.add(listen(target, 'pointerleave', (ev) => (ev.pointerType === 'mouse' ? close() : undefined)));
    d.add(listen(target, 'focus', () => (target.matches(':focus-visible') ? open() : undefined)));
    d.add(listen(target, 'blur', close));
    d.add(
      listen(target, 'pointerdown', (ev) => {
        if (ev.pointerType === 'mouse') {
          close();
          return;
        }
        if (opts.touch === 'none') return;
        startX = ev.clientX;
        startY = ev.clientY;
        later(LONG_PRESS_MS, open);
      }),
    );
    if (opts.touch !== 'none') {
      const release = (ev: PointerEvent): void => {
        if (ev.pointerType === 'mouse') return;
        if (this.anchor === target) later(TOUCH_LINGER_MS, close);
        else this.clearTimer();
      };
      d.add(listen(target, 'pointerup', release));
      d.add(listen(target, 'pointercancel', release));
      d.add(
        listen(target, 'pointermove', (ev) => {
          if (ev.pointerType !== 'mouse' && Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_TOLERANCE_PX) close();
        }),
      );
      // A long-press would otherwise also open the browser's own context menu on top of the tooltip.
      d.add(listen(target, 'contextmenu', (ev) => ev.preventDefault()));
    }
    d.add(close);
    return () => d.dispose();
  }

  /** Shows the tooltip for an element or a viewport-space box right now. */
  show(anchor: HTMLElement | Box, content: Exclude<TooltipContent, null>): void {
    this.whileOpen.dispose();
    this.render(content);
    const el = this.el;
    el.hidden = false;
    const hostRect = this.host.getBoundingClientRect();
    const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
    const place = placeTooltip(
      { left: rect.left - hostRect.left, top: rect.top - hostRect.top, width: rect.width, height: rect.height },
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: hostRect.width, height: hostRect.height },
    );
    el.style.transform = `translate(${place.left}px, ${place.top}px)`;
    el.dataset.side = place.side;
    this.anchor = anchor instanceof HTMLElement ? anchor : null;
    // The anchor can scroll away or be removed while the tooltip is up; do not leave it stranded.
    this.whileOpen.add(listen(document, 'scroll', () => this.hide(), true));
    this.whileOpen.add(listen(document, 'keydown', () => this.hide(), true));
    this.whileOpen.add(
      listen(document, 'pointermove', () => {
        if (this.anchor && !this.anchor.isConnected) this.hide();
      }),
    );
  }

  hide(): void {
    this.whileOpen.dispose();
    this.anchor = null;
    this.el.hidden = true;
  }

  dispose(): void {
    this.clearTimer();
    this.hide();
    this.el.remove();
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private render(content: Exclude<TooltipContent, null>): void {
    this.el.replaceChildren();
    if (typeof content === 'string') {
      append(this.el, h('div', { class: 'hw-tooltip__body', text: content }));
    } else if (content instanceof Node) {
      append(this.el, content);
    } else {
      append(
        this.el,
        h('div', { class: 'hw-tooltip__title', text: content.title, attrs: content.rarity && content.rarity !== 'common' ? { 'data-rarity': content.rarity } : {} }),
        content.lines && content.lines.length > 0
          ? h(
              'div',
              { class: 'hw-tooltip__enchants' },
              content.lines.map((l) =>
                h('div', { class: 'hw-tooltip__enchant', style: { color: l.colour }, attrs: { title: l.title ?? '' } }, aspectIcon(l.aspect, 14), h('span', { text: l.text })),
              ),
            )
          : null,
        content.body ? h('div', { class: 'hw-tooltip__body', text: content.body }) : null,
        content.rows && content.rows.length > 0
          ? h(
              'dl',
              { class: 'hw-tooltip__rows' },
              content.rows.map(([label, value]) => [h('dt', { text: label }), h('dd', { class: 'hw-num', text: value })]),
            )
          : null,
      );
    }
  }
}
