/** A tab bar (the caller, or a Window, swaps the content). */
import { h, setAttr, setText } from './dom';

export interface TabSpec {
  id: string;
  label: string;
  /** Small figure after the label (for example how many recipes are ready). */
  badge?: string | number | null;
}

export interface TabsOptions {
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly TabSpec[];
  active?: string;
  onChange?: (id: string) => void;
}

interface TabView {
  button: HTMLButtonElement;
  badge: HTMLSpanElement;
}

export class Tabs {
  readonly el: HTMLDivElement;
  private readonly views = new Map<string, TabView>();
  private readonly order: string[];
  private readonly onChange: ((id: string) => void) | undefined;
  private current: string;

  constructor(opts: TabsOptions) {
    this.onChange = opts.onChange;
    this.order = opts.tabs.map((t) => t.id);
    this.current = opts.active ?? this.order[0] ?? '';
    this.el = h('div', { class: 'hw-tabs', attrs: { role: 'tablist', 'aria-label': opts.label } });
    for (const tab of opts.tabs) {
      const badge = h('span', { class: 'hw-tab__badge hw-num' });
      const button = h(
        'button',
        { class: 'hw-tab', attrs: { type: 'button', role: 'tab', 'data-tab': tab.id } },
        h('span', { class: 'hw-tab__label', text: tab.label }),
        badge,
      );
      button.addEventListener('click', () => this.choose(tab.id));
      this.views.set(tab.id, { button, badge });
      this.el.appendChild(button);
      this.setBadge(tab.id, tab.badge ?? null);
    }
    this.el.addEventListener('keydown', (ev) => {
      const step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (step === 0 || this.order.length === 0) return;
      ev.preventDefault();
      const next = this.order[(this.order.indexOf(this.current) + step + this.order.length) % this.order.length];
      this.choose(next);
      this.views.get(next)?.button.focus();
    });
    this.render();
  }

  get active(): string {
    return this.current;
  }

  /** Selects a tab without calling onChange. Unknown ids are ignored. */
  setActive(id: string): void {
    if (id === this.current || !this.views.has(id)) return;
    this.current = id;
    this.render();
  }

  setBadge(id: string, badge: string | number | null): void {
    const view = this.views.get(id);
    if (!view) return;
    const text = badge === null ? '' : String(badge);
    setText(view.badge, text);
    view.badge.hidden = text === '';
  }

  /** The tab button, to point aria-controls at a panel. */
  button(id: string): HTMLButtonElement | null {
    return this.views.get(id)?.button ?? null;
  }

  private choose(id: string): void {
    if (id === this.current) return;
    this.setActive(id);
    this.onChange?.(id);
  }

  private render(): void {
    for (const [id, view] of this.views) {
      const selected = id === this.current;
      setAttr(view.button, 'aria-selected', String(selected));
      view.button.tabIndex = selected ? 0 : -1;
      if (selected) this.reveal(view.button);
    }
  }

  /** Scrolls only the tab bar itself (scrollIntoView could also move clipped ancestors). */
  private reveal(button: HTMLButtonElement): void {
    const bar = this.el;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < bar.scrollLeft) bar.scrollLeft = left;
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  }
}
