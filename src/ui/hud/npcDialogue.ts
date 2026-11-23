/**
 * The dialogue box you get when you talk to someone, Stardew Valley style (docs/api/npcs.md): a wide parchment card at the bottom of
 * the screen with a framed portrait on the left, the speaker's name on a tab above it and their words typed out letter by letter.
 * Tap / click the box to finish the line at once, and again to close it; it also closes by itself a while after the line is read, and
 * when another person speaks it is replaced. Driven by the 'npc:say' event; the portrait is painted by src/render/npcs/portraits.ts.
 */
import type { GameBus } from '../../core/context';
import type { NpcRole } from '../../npcs/data';
import { npcArt } from '../../render/npcs/art';
import { hasPortrait, paintPortrait, PORTRAIT_PX } from '../../render/npcs/portraits';
import { h } from '../kit/dom';

/** Characters typed per second. */
const TYPE_CPS = 55;
/** Seconds the finished line stays up per character, plus a floor. */
const READ_S_PER_CHAR = 0.045;
const READ_S_MIN = 2.8;

export class NpcDialogue {
  readonly el: HTMLDivElement;
  private readonly portrait: HTMLCanvasElement;
  private readonly frame: HTMLDivElement;
  private readonly nameEl: HTMLSpanElement;
  private readonly titleEl: HTMLSpanElement;
  private readonly textEl: HTMLParagraphElement;
  private readonly more: HTMLSpanElement;
  private readonly off: () => void;
  private text = '';
  private shown = 0;
  private holdS = 0;
  private timer: number | null = null;
  private last = 0;
  private portraits = new Map<string, HTMLCanvasElement>();

  constructor(bus: GameBus, parent: HTMLElement) {
    this.portrait = h('canvas', { class: 'hw-npcsay__portrait', attrs: { width: String(PORTRAIT_PX), height: String(PORTRAIT_PX), 'aria-hidden': 'true' } });
    this.frame = h('div', { class: 'hw-npcsay__frame' }, this.portrait);
    this.nameEl = h('span', { class: 'hw-npcsay__name' });
    this.titleEl = h('span', { class: 'hw-npcsay__title' });
    this.textEl = h('p', { class: 'hw-npcsay__text', attrs: { 'aria-live': 'polite' } });
    this.more = h('span', { class: 'hw-npcsay__more', text: '▼', attrs: { 'aria-hidden': 'true' } });
    this.el = h(
      'div',
      { class: 'hw-npcsay', attrs: { role: 'dialog', 'aria-label': 'Conversation' } },
      this.frame,
      h('div', { class: 'hw-npcsay__card' }, h('div', { class: 'hw-npcsay__tab' }, this.nameEl, this.titleEl), this.textEl, this.more),
    );
    this.el.hidden = true;
    this.el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.advance();
    });
    parent.appendChild(this.el);
    this.off = bus.on('npc:say', (e) => this.say(e.role as NpcRole, e.name, e.title, e.text, e.id));
  }

  /** Shows a line (replacing any being shown). */
  say(role: NpcRole, name: string, title: string, text: string, id = ''): void {
    this.nameEl.textContent = name;
    this.titleEl.textContent = title;
    const art = id ? npcArt(`${id}_portrait`) : undefined;
    const sprite = id ? npcArt(id) : undefined;
    this.frame.hidden = !art && !sprite && !hasPortrait(role);
    if (art) this.drawArt(art);
    else if (sprite) this.drawHead(sprite);
    else if (hasPortrait(role)) this.drawPortrait(role);
    this.text = text;
    this.shown = 0;
    this.holdS = Math.max(READ_S_MIN, text.length * READ_S_PER_CHAR);
    this.textEl.textContent = '';
    this.more.hidden = true;
    this.el.hidden = false;
    this.start();
  }

  /** Pointer: finish typing, or close when the line is fully shown. */
  advance(): void {
    if (this.el.hidden) return;
    if (this.shown < this.text.length) {
      this.shown = this.text.length;
      this.textEl.textContent = this.text;
      this.more.hidden = false;
    } else this.hide();
  }

  hide(): void {
    this.el.hidden = true;
    this.stop();
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** What is typed so far (for tests and screen readers). */
  get typed(): string {
    return this.textEl.textContent ?? '';
  }

  /** No portrait art but a sprite: the head and shoulders of the sprite, cropped square, fill the frame. */
  private drawHead(sprite: HTMLCanvasElement): void {
    const ctx = this.portrait.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PORTRAIT_PX, PORTRAIT_PX);
    ctx.fillStyle = '#e3c898';
    ctx.fillRect(0, 0, PORTRAIT_PX, PORTRAIT_PX);
    ctx.imageSmoothingEnabled = false;
    const side = Math.min(sprite.width, sprite.height * 0.34);
    ctx.drawImage(sprite, (sprite.width - side) / 2, sprite.height * 0.04, side, side, 0, 0, PORTRAIT_PX, PORTRAIT_PX);
  }

  /** Drop-in portrait art, scaled to cover the frame. */
  private drawArt(art: HTMLCanvasElement): void {
    const ctx = this.portrait.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PORTRAIT_PX, PORTRAIT_PX);
    ctx.imageSmoothingEnabled = false;
    const k = Math.max(PORTRAIT_PX / art.width, PORTRAIT_PX / art.height);
    const w = art.width * k;
    const h = art.height * k;
    ctx.drawImage(art, (PORTRAIT_PX - w) / 2, (PORTRAIT_PX - h) / 2, w, h);
  }

  private drawPortrait(role: NpcRole): void {
    let cached = this.portraits.get(role);
    if (!cached) {
      const img = paintPortrait(role);
      const c = document.createElement('canvas');
      c.width = img.w;
      c.height = img.h;
      const ctx = c.getContext('2d');
      if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
      this.portraits.set(role, c);
      cached = c;
    }
    const ctx = this.portrait.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, PORTRAIT_PX, PORTRAIT_PX);
      ctx.drawImage(cached, 0, 0);
    }
  }

  private start(): void {
    this.stop();
    this.last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.shown < this.text.length) {
        this.shown = Math.min(this.text.length, this.shown + dt * TYPE_CPS);
        this.textEl.textContent = this.text.slice(0, Math.floor(this.shown));
        if (this.shown >= this.text.length) this.more.hidden = false;
      } else {
        this.holdS -= dt;
        if (this.holdS <= 0) {
          this.hide();
          return;
        }
      }
      this.timer = requestAnimationFrame(tick);
    };
    this.timer = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.timer !== null) cancelAnimationFrame(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stop();
    this.off();
    this.el.remove();
  }
}
