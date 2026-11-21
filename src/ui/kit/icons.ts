/** UI glyphs (inline SVG on a 16px grid) and item icons (pixel art from an injected provider). */
import { hueFromKey, itemInitials } from './format';

const SVG_NS = 'http://www.w3.org/2000/svg';

const GLYPHS = {
  close: 'M3 4.4 4.4 3 8 6.6 11.6 3 13 4.4 9.4 8 13 11.6 11.6 13 8 9.4 4.4 13 3 11.6 6.6 8Z',
  back: 'M10.4 2 12 3.6 7.6 8l4.4 4.4-1.6 1.6-6-6Z',
  check: 'M6.2 10.4 3.4 7.6 2 9l4.2 4.2L14 5.4 12.6 4Z',
  lock: 'M5 7V5a3 3 0 0 1 6 0v2h1v7H4V7Zm2 0h2V5a1 1 0 0 0-2 0Z',
  bolt: 'M9.5 1 3 9h4l-1.5 6L13 7H8.6Z',
  flame: 'M8.4 1c.6 3 3.6 4.3 3.6 8a4 4 0 0 1-8 0c0-1.8.8-3 2-4 0 1.5.6 2.2 1.2 2.4C7 5.2 7.4 3 8.4 1Z',
  gear:
    'M6.6 2.9 6.8.9h2.4l.2 2 1.3.5 1.5-1.3 1.7 1.7-1.3 1.5.5 1.3 2 .2v2.4l-2 .2-.5 1.3 1.3 1.5-1.7 1.7-1.5-1.3-1.3.5-.2 2H6.8l-.2-2-1.3-.5-1.5 1.3-1.7-1.7 1.3-1.5-.5-1.3-2-.2V6.8l2-.2.5-1.3-1.3-1.5 1.7-1.7 1.5 1.3Z' +
    'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z',
  help: 'M5 5.5a3 3 0 1 1 4.6 2.5C9.1 8.4 9 8.7 9 9.3V10H7v-.9c0-1.3.6-2 1.3-2.5A1 1 0 1 0 7 5.5ZM7 11.5h2v2H7Z',
  warn: 'M8 1.5 15 14H1ZM7 6v4h2V6Zm0 5v2h2v-2Z',
  info: 'M7 3h2v2H7Zm0 4h2v6H7Z',
  play: 'M4 2.5 13 8l-9 5.5Z',
  heart: 'M8 14.2 2.1 8.4A3.4 3.4 0 0 1 7 3.6l1 1 1-1a3.4 3.4 0 0 1 4.9 4.8Z',
  air: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-1.4 1.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z',
  home: 'M8 1.5 15 7.6l-1.3 1.5-1-.9V14H9.5v-3.5h-3V14H3.3V8.2l-1 .9L1 7.6Z',
  needle: 'M8 1 12.5 14 8 11.2 3.5 14Z',
  sun: 'M7 0h2v3H7Zm0 13h2v3H7ZM0 7h3v2H0Zm13 0h3v2h-3ZM2.3 3.7l1.4-1.4 2 2-1.4 1.4Zm8 8 1.4-1.4 2 2-1.4 1.4Zm0-7.4 2-2 1.4 1.4-2 2Zm-8 8 2-2 1.4 1.4-2 2ZM8 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  moon: 'M10.2 1.5A6.6 6.6 0 1 0 14.5 11 5.4 5.4 0 0 1 10.2 1.5Z',
  up: 'M8 3 14 11H2Z',
  down: 'M8 13 2 5h12Z',
  chevron: 'M5.6 2 4 3.6 8.4 8 4 12.4 5.6 14l6-6Z',
  /** A steaming bowl: food (the HUD's food meter, Well-Fed). */
  bowl:
    'M5.6 1.2C4.5 2.6 4.6 3.4 5.4 4.3c.6.7.6 1.3.1 1.9l1.1.4c.7-.8.7-1.8-.1-2.7-.6-.7-.7-1.2.2-2.2ZM9.1 1.2C8 2.6 8.1 3.4 8.9 4.3c.6.7.6 1.3.1 1.9l1.1.4c.7-.8.7-1.8-.1-2.7-.6-.7-.7-1.2.2-2.2ZM1 7.6h14c0 3.6-3 5.8-7 5.8S1 11.2 1 7.6ZM5.5 13.7h5V15h-5Z',
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** A monochrome glyph that takes the current text colour. Decorative by default (aria-hidden). */
export function glyph(name: GlyphName, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('hw-glyph');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', GLYPHS[name]);
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(path);
  return svg;
}

/**
 * Supplies the pixel-art icon of an item (the renderer owns the textures). The returned canvas is only read:
 * each ItemIcon copies it into a canvas of its own. Return null for an unknown item.
 */
export type IconProvider = (itemKey: string) => HTMLCanvasElement | null;

let provider: IconProvider | null = null;
let providerVersion = 0;

/** Installs (or with null removes) the icon source. Icons already on screen pick it up on their next `set`. */
export function setIconProvider(next: IconProvider | null): void {
  provider = next;
  providerVersion++;
}

/** One item icon. Until a provider knows the item it shows a neutral tile with the item's initials. */
export class ItemIcon {
  readonly el: HTMLSpanElement;
  private key: string | null = null;
  private version = -1;
  private canvas: HTMLCanvasElement | null = null;

  constructor(itemKey: string | null = null) {
    this.el = document.createElement('span');
    this.el.className = 'hw-icon';
    this.el.setAttribute('aria-hidden', 'true');
    this.set(itemKey);
  }

  get item(): string | null {
    return this.key;
  }

  /** Shows an item (null = nothing). Cheap when nothing changed. */
  set(itemKey: string | null): void {
    if (itemKey === this.key && this.version === providerVersion) return;
    this.key = itemKey;
    this.version = providerVersion;
    const el = this.el;
    if (itemKey === null) {
      el.replaceChildren();
      el.removeAttribute('data-placeholder');
      el.dataset.empty = '';
      return;
    }
    delete el.dataset.empty;
    const source = provider ? provider(itemKey) : null;
    if (source && source.width > 0 && source.height > 0) {
      const canvas = this.canvas ?? (this.canvas = document.createElement('canvas'));
      if (canvas.width !== source.width) canvas.width = source.width;
      if (canvas.height !== source.height) canvas.height = source.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0);
      }
      el.removeAttribute('data-placeholder');
      el.replaceChildren(canvas);
      return;
    }
    el.dataset.placeholder = '';
    el.style.setProperty('--hw-ph-hue', String(hueFromKey(itemKey)));
    el.replaceChildren(itemInitials(itemKey));
  }
}
