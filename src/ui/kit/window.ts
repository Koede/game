/** The modal window every screen lives in. On phone-sized viewports it becomes a full-screen sheet (see styles.css). */
import { append, h, listen, setAttr, setText, uid, type Child, type Dispose } from './dom';
import { IconButton } from './controls';
import type { Tone } from './gauges';
import { Tabs, type TabSpec } from './tabs';

export * from './tabs';

export interface WindowTab extends TabSpec {
  /** Content of the tab. When given, the window shows and hides the panels itself. */
  panel?: HTMLElement;
}

export interface WindowOptions {
  title: string;
  subtitle?: string;
  /** Element placed in the header, left of the close button (a compact readout, a toggle). */
  headerRight?: HTMLElement;
  tabs?: readonly WindowTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  body?: Child;
  /** Status line at the bottom edge. */
  footer?: string;
  /** Maximum width on large viewports: sm 440px, md 720px, lg 980px. Default md. */
  size?: 'sm' | 'md' | 'lg';
  /** 'tall' keeps a fixed generous height so tabs do not make the window jump; 'content' hugs the content. Default 'content'. */
  fit?: 'content' | 'tall';
  /** false: the body does not scroll; the content manages its own scrolling regions. Default true. */
  scroll?: boolean;
  /** false: no close button, Escape and outside taps are ignored. Default true. */
  closable?: boolean;
  /** Called once whenever the window closes (close button, Escape, outside tap, `close()`, or another window opening). */
  onClose?: () => void;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let openWindow: Window | null = null;

/** The window that is currently open, if any. */
export const currentWindow = (): Window | null => openWindow;

export class Window {
  /** The backdrop: this is what gets attached to the host layer. */
  readonly el: HTMLDivElement;
  /** The dialog itself. */
  readonly frame: HTMLElement;
  readonly body: HTMLDivElement;
  readonly tabs: Tabs | null;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly asideEl: HTMLDivElement;
  private readonly footEl: HTMLElement;
  private readonly panels = new Map<string, HTMLElement>();
  private readonly closable: boolean;
  private readonly onClose: (() => void) | undefined;
  private offKeys: Dispose | null = null;
  private restoreFocus: HTMLElement | null = null;
  private opened = false;
  private accent: string | null = null;

  constructor(opts: WindowOptions) {
    this.closable = opts.closable ?? true;
    this.onClose = opts.onClose;
    const titleId = uid('title');
    this.titleEl = h('h2', { class: 'hw-window__title', text: opts.title, attrs: { id: titleId } });
    this.subtitleEl = h('p', { class: 'hw-window__subtitle' });
    this.asideEl = h('div', { class: 'hw-window__aside' });
    this.body = h('div', { class: 'hw-window__body', attrs: { 'data-scroll': opts.scroll ?? true } });
    this.footEl = h('footer', { class: 'hw-window__foot', attrs: { role: 'status' } });
    this.tabs = opts.tabs ? this.buildTabs(opts) : null;
    this.frame = h(
      'section',
      {
        class: 'hw-window',
        attrs: {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': titleId,
          tabindex: -1,
          'data-size': opts.size ?? 'md',
          'data-fit': opts.fit ?? 'content',
          'data-tabs': this.tabs !== null,
        },
      },
      // The inner plate carries the fill and is clipped one pixel inside the frame, which leaves the frame's
      // own colour showing as a crisp edge along the chamfered corners as well.
      h(
        'div',
        { class: 'hw-window__inner' },
        h('div', { class: 'hw-window__accent' }),
        h(
          'header',
          { class: 'hw-window__head' },
          h('div', { class: 'hw-window__titles' }, this.titleEl, this.subtitleEl),
          this.tabs ? h('div', { class: 'hw-window__tabs' }, this.tabs.el) : null,
          this.asideEl,
          this.closable ? new IconButton({ icon: 'close', label: 'Close', onClick: () => this.close() }).el : null,
        ),
        this.body,
        this.footEl,
      ),
    );
    this.el = h('div', { class: 'hw-scrim' }, this.frame);
    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.target === this.el && this.closable) this.close();
    });
    this.setSubtitle(opts.subtitle ?? '');
    this.setHeaderRight(opts.headerRight ?? null);
    this.setFooter(opts.footer ?? null);
    if (opts.body !== undefined) append(this.body, opts.body);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Attaches the window to a layer (normally `UIRoot.layers.windows`). Any other open window is closed first. */
  open(host: HTMLElement): this {
    if (this.opened) return this;
    if (openWindow) openWindow.close();
    openWindow = this;
    this.opened = true;
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    host.appendChild(this.el);
    this.offKeys = listen(document, 'keydown', (ev) => this.onKey(ev), true);
    this.frame.focus({ preventScroll: true });
    return this;
  }

  /** Detaches the window and calls `onClose`. Safe to call when already closed. */
  close(): void {
    if (!this.opened) return;
    this.opened = false;
    if (openWindow === this) openWindow = null;
    this.offKeys?.();
    this.offKeys = null;
    this.el.remove();
    if (this.restoreFocus?.isConnected) this.restoreFocus.focus({ preventScroll: true });
    this.restoreFocus = null;
    this.onClose?.();
  }

  setTitle(text: string): void {
    setText(this.titleEl, text);
  }

  setSubtitle(text: string): void {
    setText(this.subtitleEl, text);
    this.subtitleEl.hidden = text === '';
  }

  setHeaderRight(el: HTMLElement | null): void {
    this.asideEl.replaceChildren(...(el ? [el] : []));
    this.asideEl.hidden = el === null;
  }

  /** Replaces the body content (for windows without tab panels). */
  setBody(...children: Child[]): void {
    this.body.replaceChildren();
    append(this.body, children);
    this.body.scrollTop = 0;
  }

  /** Sets the status line at the bottom; null removes it. The tone adds a coloured marker. */
  setFooter(text: string | null, tone: Tone = 'neutral'): void {
    this.footEl.hidden = text === null;
    setText(this.footEl, text ?? '');
    setAttr(this.footEl, 'data-tone', tone);
  }

  /**
   * Colours the strip along the top edge and the active tab marker: pass `heatColor(tempC)` for a furnace,
   * `'var(--hw-power)'` for an electrical machine, null for the neutral default.
   */
  setAccent(color: string | null): void {
    if (color === this.accent) return;
    this.accent = color;
    if (color === null) this.frame.style.removeProperty('--hw-accent');
    else this.frame.style.setProperty('--hw-accent', color);
  }

  /** Switches tab without calling `onTab`. */
  selectTab(id: string): void {
    if (!this.tabs) return;
    this.tabs.setActive(id);
    this.showPanel(this.tabs.active);
  }

  private buildTabs(opts: WindowOptions): Tabs {
    const specs = opts.tabs ?? [];
    const tabs = new Tabs({
      label: opts.title,
      tabs: specs,
      active: opts.activeTab,
      onChange: (id) => {
        this.showPanel(id);
        opts.onTab?.(id);
      },
    });
    for (const spec of specs) {
      if (!spec.panel) continue;
      const button = tabs.button(spec.id);
      const panelId = uid('panel');
      spec.panel.id = spec.panel.id || panelId;
      spec.panel.setAttribute('role', 'tabpanel');
      spec.panel.classList.add('hw-window__panel');
      button?.setAttribute('aria-controls', spec.panel.id);
      this.panels.set(spec.id, spec.panel);
      this.body.appendChild(spec.panel);
    }
    this.showPanel(tabs.active);
    return tabs;
  }

  private showPanel(id: string): void {
    for (const [panelId, panel] of this.panels) panel.hidden = panelId !== id;
    if (this.panels.size > 0) this.body.scrollTop = 0;
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      // Swallow it even when not closable, so the game underneath does not react to a key meant for the window.
      ev.preventDefault();
      ev.stopPropagation();
      if (this.closable) this.close();
      return;
    }
    if (ev.key !== 'Tab') return;
    const items = [...this.frame.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    );
    if (items.length === 0) {
      ev.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof Node && this.frame.contains(active) && active !== this.frame;
    if (ev.shiftKey && (!inside || active === first)) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (!inside || active === last)) {
      ev.preventDefault();
      first.focus();
    }
  }
}
