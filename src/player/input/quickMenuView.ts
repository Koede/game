/** DOM of the radial quick menu: a ring of large round items around the entry button. Pure presentation. */
import { QUICK_ITEM_PX, QUICK_RADIUS_PX, fitQuickRadius, quickMenuOffsets, type QuickItem } from './quickMenu';

export interface QuickCentre {
  /** Client (viewport) pixels: the entry button's centre. */
  x: number;
  y: number;
}

export class QuickMenuView {
  readonly el: HTMLDivElement;
  private readonly surface: HTMLElement;
  private shown = false;
  private centre: QuickCentre = { x: 0, y: 0 };
  private side: 1 | -1 = 1;
  private ids = '';
  private labels = new Map<string, HTMLDivElement>();

  /** `surface` is the touch overlay root: the ring is positioned inside it. */
  constructor(surface: HTMLElement) {
    this.surface = surface;
    this.el = document.createElement('div');
    this.el.className = 'hw-touch-radial';
    this.el.hidden = true;
    surface.appendChild(this.el);
  }

  get isShown(): boolean {
    return this.shown;
  }

  /**
   * Opens the ring around `centre`. `side` is +1 when the ring opens to the right (the entry button sits in the left
   * corner) and -1 to the left. With `animated` false (reduce motion) the items appear at once.
   */
  show(centre: QuickCentre, side: 1 | -1, animated: boolean, items: QuickItem[]): void {
    this.centre = centre;
    this.side = side;
    this.shown = true;
    this.el.hidden = false;
    this.el.classList.toggle('hw-touch-radial--animated', animated);
    this.update(items, true);
  }

  /** Brings the items up to date (labels, lit and faded states); rebuilds and places them only when the list changes. */
  update(items: QuickItem[], force = false): void {
    if (!this.shown) return;
    const ids = items.map((i) => i.id).join('|');
    if (ids !== this.ids || force) {
      this.ids = ids;
      this.rebuild(items);
    }
    for (const item of items) {
      const el = this.labels.get(item.id);
      if (!el) continue;
      el.classList.toggle('hw-touch-radial__item--on', item.active);
      el.classList.toggle('hw-touch-radial__item--off', !item.enabled);
      el.setAttribute('aria-disabled', String(!item.enabled));
      el.setAttribute('aria-pressed', String(item.active));
    }
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.el.hidden = true;
    this.ids = '';
    this.labels.clear();
    this.el.replaceChildren();
  }

  /** The item under a viewport point (with a thumb's slack), or null. */
  idAt(clientX: number, clientY: number): string | null {
    if (!this.shown) return null;
    const slack = 10;
    for (const [id, el] of this.labels) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left - slack && clientX <= r.right + slack && clientY >= r.top - slack && clientY <= r.bottom + slack) return id;
    }
    return null;
  }

  /** The item an event landed on, or null. */
  idOf(target: EventTarget | null): string | null {
    if (!this.shown || !(target instanceof Element)) return null;
    const el = target.closest<HTMLElement>('[data-quick-id]');
    return el && this.el.contains(el) ? (el.dataset.quickId ?? null) : null;
  }

  dispose(): void {
    this.el.remove();
  }

  private rebuild(items: QuickItem[]): void {
    this.labels.clear();
    this.el.replaceChildren();
    const rect = this.surface.getBoundingClientRect();
    const cx = this.centre.x - rect.left;
    const cy = this.centre.y - rect.top;
    const radius = fitQuickRadius(QUICK_RADIUS_PX, items.length, { x: cx, y: cy }, { width: rect.width, height: rect.height }, this.side);
    const offsets = quickMenuOffsets(items.length, radius);
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'hw-touch-radial__item';
      el.dataset.quickId = item.id;
      el.setAttribute('role', 'button');
      el.textContent = item.label;
      const o = offsets[i];
      el.style.left = `${(cx + this.side * o.x).toFixed(1)}px`;
      el.style.top = `${(cy + o.y).toFixed(1)}px`;
      el.style.width = `${QUICK_ITEM_PX}px`;
      el.style.height = `${QUICK_ITEM_PX}px`;
      this.labels.set(item.id, el);
      this.el.appendChild(el);
    });
  }
}
