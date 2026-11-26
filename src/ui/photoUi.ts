/**
 * Photo mode's controls: a slim bar (filter, postcards, share/save toggle, exit) shown only while photo mode is on, and the postcard
 * album it opens. Touch players have no keyboard, so every photo-mode action must be reachable here or on the touch layer.
 */
import type { Postcard } from '../game/postcards';
import { filterById, nextFilter, type PhotoFilter } from '../player/photoFilters';
import { clear, h } from './kit/dom';

export interface PhotoUiHooks {
  /** The filter changed (apply it to the live view). */
  onFilter(filter: PhotoFilter): void;
  /** Leave photo mode. */
  onExit(): void;
  /** Save or share one postcard. */
  onSendCard(card: Postcard): void;
  /** The cards to show in the album, oldest first. */
  cards(): readonly Postcard[];
  /** Whether the browser can open a share sheet with a file (hides the share toggle when not). */
  canShare: boolean;
}

export class PhotoUi {
  readonly el: HTMLDivElement;
  private readonly filterBtn: HTMLButtonElement;
  private readonly albumBtn: HTMLButtonElement;
  private readonly shareBtn: HTMLButtonElement;
  private readonly album: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private filter: PhotoFilter = filterById('natural');
  private share: boolean;

  constructor(private readonly hooks: PhotoUiHooks) {
    this.share = hooks.canShare;
    this.filterBtn = this.button('hw-photo__btn', 'Filter: Natural', () => this.cycle());
    this.albumBtn = this.button('hw-photo__btn', 'Postcards', () => this.toggleAlbum());
    this.shareBtn = this.button('hw-photo__btn', '', () => {
      this.share = !this.share;
      this.paintShare();
    });
    this.shareBtn.hidden = !hooks.canShare;
    const exit = this.button('hw-photo__btn hw-photo__btn--exit', 'Done', () => hooks.onExit());
    const bar = h('div', { class: 'hw-photo__bar', attrs: { role: 'toolbar', 'aria-label': 'Photo mode' } }, this.filterBtn, this.albumBtn, this.shareBtn, exit);
    this.list = h('div', { class: 'hw-photo__cards' });
    const close = this.button('hw-photo__btn', 'Close', () => this.toggleAlbum(false));
    this.album = h('div', { class: 'hw-photo__album hw-ui-blocking', attrs: { role: 'dialog', 'aria-label': 'Postcards' } }, h('h2', { class: 'hw-photo__title', text: 'Town postcards' }), this.list, close);
    this.album.hidden = true;
    this.el = h('div', { class: 'hw-photo' }, bar, this.album);
    this.el.hidden = true;
    this.paintShare();
  }

  get shareOn(): boolean {
    return this.share;
  }

  get currentFilter(): PhotoFilter {
    return this.filter;
  }

  /** Shown while photo mode is on. */
  setActive(on: boolean): void {
    this.el.hidden = !on;
    if (!on) this.toggleAlbum(false);
    else this.refresh();
  }

  /** Updates the postcard count label (call when a card was added). */
  refresh(): void {
    const n = this.hooks.cards().length;
    this.albumBtn.textContent = n > 0 ? `Postcards (${n})` : 'Postcards';
    if (!this.album.hidden) this.paintAlbum();
  }

  private cycle(): void {
    this.filter = nextFilter(this.filter.id);
    this.filterBtn.textContent = `Filter: ${this.filter.label}`;
    this.hooks.onFilter(this.filter);
  }

  private paintShare(): void {
    this.shareBtn.textContent = this.share ? 'Share' : 'Download';
    this.shareBtn.setAttribute('aria-pressed', String(this.share));
  }

  private toggleAlbum(open = this.album.hidden): void {
    this.album.hidden = !open;
    if (open) this.paintAlbum();
  }

  private paintAlbum(): void {
    clear(this.list);
    const cards = this.hooks.cards();
    if (cards.length === 0) {
      this.list.append(h('p', { class: 'hw-photo__empty', text: 'No postcards yet. One is taken when a new age begins.' }));
      return;
    }
    for (const c of cards) {
      const img = h('img', { class: 'hw-photo__card-img', attrs: { src: c.image, alt: `${c.ageName}, day ${c.day}` } });
      const send = this.button('hw-photo__btn', this.share ? 'Share' : 'Save', () => this.hooks.onSendCard(c));
      this.list.append(h('figure', { class: 'hw-photo__card' }, img, h('figcaption', { text: `${c.ageName} - day ${c.day}` }), send));
    }
  }

  private button(cls: string, text: string, fn: () => void): HTMLButtonElement {
    return h('button', { class: cls, text, attrs: { type: 'button' }, on: { click: (e) => { e.stopPropagation(); fn(); } } });
  }
}
