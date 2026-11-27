/** Transient feedback: toasts (short HUD messages) and the banner (new age, objective complete). */
import type { ToastKind } from '../../core/gameEvents';
import { h, prefersReducedMotion, setText } from './dom';
import { ItemIcon, glyph, type GlyphName } from './icons';
import { TOAST_MAX_VISIBLE, evictionIndex, shortenToast, toastDuration } from './toastPolicy';

export * from './tooltip';

export interface ToastOptions {
  text: string;
  kind?: ToastKind;
  /** Item key: shows that item's icon in the toast. */
  item?: string;
  /** How long it stays. Default: 2.4 s for good news, 3.6 s for warnings, a little longer for longer text (see toastPolicy). */
  durationMs?: number;
}

export interface ToastsOptions {
  /** Most toasts on screen at once; the oldest calm one makes room. Default 3. */
  max?: number;
}

interface ToastEntry {
  key: string;
  kind: ToastKind;
  el: HTMLDivElement;
  countEl: HTMLSpanElement;
  count: number;
  timer: ReturnType<typeof setTimeout>;
}

const KIND_GLYPH: Record<ToastKind, GlyphName> = { info: 'info', good: 'check', warn: 'warn', bad: 'close' };
const LEAVE_MS = 180;

/**
 * A stack of short messages. The payload of the bus's 'toast' event can be passed to `show` as is.
 * Repeating an identical message bumps a counter on the existing toast instead of stacking a new one.
 */
export class Toasts {
  readonly el: HTMLDivElement;
  private readonly max: number;
  private entries: ToastEntry[] = [];

  /** `host` is the layer to draw in (normally `UIRoot.layers.toasts`). */
  constructor(host: HTMLElement, opts: ToastsOptions = {}) {
    this.max = opts.max ?? TOAST_MAX_VISIBLE;
    this.el = h('div', { class: 'hw-toasts', attrs: { role: 'status', 'aria-live': 'polite' } });
    host.appendChild(this.el);
  }

  /** Shows the toast; true when it is a new one (not a repeat bumping a counter). */
  show(toast: ToastOptions): boolean {
    const kind = toast.kind ?? 'info';
    const text = shortenToast(toast.text);
    const duration = toast.durationMs ?? toastDuration(kind, text.length);
    const key = `${kind}|${toast.item ?? ''}|${text}`;
    const existing = this.entries.find((e) => e.key === key);
    if (existing) {
      existing.count++;
      setText(existing.countEl, `×${existing.count}`);
      existing.countEl.hidden = false;
      clearTimeout(existing.timer);
      existing.timer = setTimeout(() => this.dismiss(existing), duration);
      return false;
    }
    const countEl = h('span', { class: 'hw-toast__count hw-num' });
    countEl.hidden = true;
    const el = h(
      'div',
      { class: 'hw-toast', attrs: { 'data-kind': kind } },
      toast.item ? new ItemIcon(toast.item).el : h('span', { class: 'hw-toast__mark' }, glyph(KIND_GLYPH[kind], 14)),
      h('span', { class: 'hw-toast__text', text, attrs: text === toast.text ? {} : { title: toast.text } }),
      countEl,
    );
    const entry: ToastEntry = { key, kind, el, countEl, count: 1, timer: setTimeout(() => this.dismiss(entry), duration) };
    this.entries.push(entry);
    this.el.appendChild(el);
    while (this.entries.length > this.max) this.remove(this.entries[evictionIndex(this.entries.map((e) => e.kind))]);
    return true;
  }

  /** Removes every toast immediately. */
  clear(): void {
    for (const entry of [...this.entries]) this.remove(entry);
  }

  dispose(): void {
    this.clear();
    this.el.remove();
  }

  private dismiss(entry: ToastEntry): void {
    if (prefersReducedMotion()) {
      this.remove(entry);
      return;
    }
    entry.el.dataset.leaving = '';
    entry.timer = setTimeout(() => this.remove(entry), LEAVE_MS);
  }

  private remove(entry: ToastEntry): void {
    clearTimeout(entry.timer);
    entry.el.remove();
    this.entries = this.entries.filter((e) => e !== entry);
  }
}

export interface BannerOptions {
  /** The announcement itself: "Forge Age", "Light the furnace". */
  title: string;
  /** Small line above the title: "New age", "Objective complete". */
  kicker?: string;
  /** One sentence under the title. */
  subtitle?: string;
  /** heat for milestones of fire, power for electrical ones, good for completed objectives. Default heat. */
  tone?: 'heat' | 'power' | 'good';
  /** 'lg' for a new age, 'md' for an objective. Default 'lg'. */
  size?: 'md' | 'lg';
  /** Time on screen. Default 4200 ms (md: 3000 ms). */
  durationMs?: number;
}

const BANNER_LEAVE_MS = 260;

/** A large centred announcement. Banners queue up: two milestones at once are shown one after the other. */
export class Banner {
  readonly el: HTMLDivElement;
  private readonly queue: BannerOptions[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private showing = false;

  /** `host` is the layer to draw in (normally `UIRoot.layers.toasts`). */
  constructor(host: HTMLElement) {
    this.el = h('div', { class: 'hw-banner', attrs: { role: 'status', 'aria-live': 'polite' } });
    this.el.hidden = true;
    host.appendChild(this.el);
  }

  show(banner: BannerOptions): void {
    this.queue.push(banner);
    if (!this.showing) this.next();
  }

  /** Drops the current banner and everything queued. */
  clear(): void {
    this.queue.length = 0;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.showing = false;
    this.el.hidden = true;
  }

  dispose(): void {
    this.clear();
    this.el.remove();
  }

  private next(): void {
    const banner = this.queue.shift();
    if (!banner) {
      this.showing = false;
      this.el.hidden = true;
      return;
    }
    this.showing = true;
    const size = banner.size ?? 'lg';
    const el = this.el;
    el.replaceChildren(
      h(
        'div',
        { class: 'hw-banner__plate' },
        banner.kicker ? h('div', { class: 'hw-banner__kicker', text: banner.kicker }) : null,
        h('div', { class: 'hw-banner__title', text: banner.title }),
        banner.subtitle ? h('div', { class: 'hw-banner__sub', text: banner.subtitle }) : null,
      ),
    );
    el.dataset.tone = banner.tone ?? 'heat';
    el.dataset.size = size;
    delete el.dataset.leaving;
    el.hidden = false;
    this.timer = setTimeout(() => {
      el.dataset.leaving = '';
      this.timer = setTimeout(() => this.next(), prefersReducedMotion() ? 0 : BANNER_LEAVE_MS);
    }, banner.durationMs ?? (size === 'lg' ? 4200 : 3000));
  }
}
