/** Item-gain feed ("+3 Rubble") along the left edge, and the screen-edge vignettes. */
import { itemOrNull } from '../../core/registry';
import { h, setText } from '../kit/dom';
import { ItemIcon } from '../kit/icons';
import { GainFeed, frostLevel } from './hudMath';

interface Line {
  el: HTMLDivElement;
  icon: ItemIcon;
  text: HTMLSpanElement;
  rev: number;
}

export class FeedView {
  readonly el: HTMLDivElement;
  private readonly model = new GainFeed();
  private readonly lines = new Map<string, Line>();

  constructor() {
    this.el = h('div', { class: 'hw-feed', attrs: { 'aria-live': 'polite', role: 'log' } });
  }

  push(item: string, count: number): void {
    this.model.push(item, count, performance.now());
    this.render();
  }

  /** Expires old lines; cheap when nothing changed. */
  tick(): void {
    if (this.model.expire(performance.now())) this.render();
  }

  refreshIcons(): void {
    for (const [item, line] of this.lines) line.icon.set(item);
  }

  private render(): void {
    const entries = this.model.entries;
    const keep = new Set(entries.map((e) => e.item));
    for (const [item, line] of this.lines) {
      if (keep.has(item)) continue;
      line.el.remove();
      this.lines.delete(item);
    }
    for (const entry of entries) {
      let line = this.lines.get(entry.item);
      if (!line) {
        const icon = new ItemIcon(entry.item);
        const text = h('span', { class: 'hw-feed__text' });
        line = { el: h('div', { class: 'hw-feed__line' }, icon.el, text), icon, text, rev: -1 };
        this.lines.set(entry.item, line);
      }
      if (line.rev !== entry.rev) {
        line.rev = entry.rev;
        setText(line.text, `+${entry.count} ${itemOrNull(entry.item)?.name ?? entry.item}`);
        // Restart the little bump animation on every new gain.
        line.el.classList.remove('hw-feed__line--bump');
        void line.el.offsetWidth;
        line.el.classList.add('hw-feed__line--bump');
      }
      this.el.appendChild(line.el);
    }
  }
}

/** Red flash on damage, frost creeping in from the edges when cold, an amber glow while Well-Warmed. */
export class Vignettes {
  readonly el: HTMLDivElement;
  private readonly hurt: HTMLDivElement;
  private readonly frost: HTMLDivElement;
  private readonly warm: HTMLDivElement;
  private shownFrost = -1;
  private shownWarm = false;

  constructor() {
    this.hurt = h('div', { class: 'hw-vignette hw-vignette--hurt' });
    this.frost = h('div', { class: 'hw-vignette hw-vignette--frost' });
    this.warm = h('div', { class: 'hw-vignette hw-vignette--warm' });
    this.warm.hidden = true;
    this.el = h('div', { class: 'hw-vignettes', attrs: { 'aria-hidden': 'true' } }, this.warm, this.frost, this.hurt);
  }

  /** A hit: a short red pulse, stronger for bigger hits. */
  damage(amount: number): void {
    const strength = Math.min(1, 0.45 + amount * 0.12);
    this.hurt.style.setProperty('--hw-hurt', strength.toFixed(2));
    this.hurt.classList.remove('hw-vignette--pulse');
    void this.hurt.offsetWidth;
    this.hurt.classList.add('hw-vignette--pulse');
  }

  update(warmth: number, wellWarmed: boolean): void {
    const frost = Math.round(frostLevel(warmth) * 50) / 50;
    if (frost !== this.shownFrost) {
      this.shownFrost = frost;
      this.frost.style.opacity = frost.toFixed(2);
      this.frost.hidden = frost === 0;
    }
    if (wellWarmed !== this.shownWarm) {
      this.shownWarm = wellWarmed;
      this.warm.hidden = !wellWarmed;
    }
  }
}
