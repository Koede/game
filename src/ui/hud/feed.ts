/** Item-gain feed ("+3 Rubble") along the left edge, and the screen-edge vignettes. */
import { itemOrNull } from '../../core/registry';
import { h, setFlag, setText } from '../kit/dom';
import { ItemIcon } from '../kit/icons';
import { hungerLevel } from '../screens/food';
import { GainFeed, frostLevel, type FeedEntry } from './hudMath';

interface Line {
  el: HTMLDivElement;
  icon: ItemIcon;
  text: HTMLSpanElement;
  rev: number;
}

export class FeedView {
  readonly el: HTMLDivElement;
  private readonly model = new GainFeed();
  private readonly lines = new Map<FeedEntry, Line>();

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
    for (const [entry, line] of this.lines) line.icon.set(entry.parts[0].item);
  }

  private render(): void {
    const entries = this.model.entries;
    for (const [entry, line] of this.lines) {
      if (entries.includes(entry)) continue;
      line.el.remove();
      this.lines.delete(entry);
    }
    for (const entry of entries) {
      let line = this.lines.get(entry);
      if (!line) {
        // The icon is the batch's first item; "+12 Stone, +3 Log" reads as one line.
        const icon = new ItemIcon(entry.parts[0].item);
        const text = h('span', { class: 'hw-feed__text' });
        line = { el: h('div', { class: 'hw-feed__line' }, icon.el, text), icon, text, rev: -1 };
        this.lines.set(entry, line);
      }
      if (line.rev !== entry.rev) {
        line.rev = entry.rev;
        setText(line.text, entry.parts.map((p) => `+${p.count} ${itemOrNull(p.item)?.name ?? p.item}`).join(', '));
        // Restart the little bump animation on every new gain.
        line.el.classList.remove('hw-feed__line--bump');
        void line.el.offsetWidth;
        line.el.classList.add('hw-feed__line--bump');
      }
      this.el.appendChild(line.el);
    }
  }
}

/**
 * Red flash on damage, frost creeping in from the edges when cold, an amber glow while Well-Warmed, and a dull
 * umber shadow at the edges while Hungry that deepens and breathes slowly as the bar empties.
 */
export class Vignettes {
  readonly el: HTMLDivElement;
  private readonly hurt: HTMLDivElement;
  private readonly frost: HTMLDivElement;
  private readonly warm: HTMLDivElement;
  private readonly hunger: HTMLDivElement;
  private shownFrost = -1;
  private shownWarm = false;
  private shownHunger = -1;

  constructor() {
    this.hurt = h('div', { class: 'hw-vignette hw-vignette--hurt' });
    this.frost = h('div', { class: 'hw-vignette hw-vignette--frost' });
    this.warm = h('div', { class: 'hw-vignette hw-vignette--warm' });
    this.hunger = h('div', { class: 'hw-vignette hw-vignette--hunger' });
    this.warm.hidden = true;
    this.hunger.hidden = true;
    this.el = h('div', { class: 'hw-vignettes', attrs: { 'aria-hidden': 'true' } }, this.warm, this.hunger, this.frost, this.hurt);
  }

  /** A hit: a short red pulse, stronger for bigger hits. */
  damage(amount: number): void {
    const strength = Math.min(1, 0.45 + amount * 0.12);
    this.hurt.style.setProperty('--hw-hurt', strength.toFixed(2));
    this.hurt.classList.remove('hw-vignette--pulse');
    void this.hurt.offsetWidth;
    this.hurt.classList.add('hw-vignette--pulse');
  }

  update(warmth: number, wellWarmed: boolean, food: number): void {
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
    const hunger = Math.round(hungerLevel(food) * 20) / 20;
    if (hunger !== this.shownHunger) {
      this.shownHunger = hunger;
      this.hunger.style.setProperty('--hw-hunger', hunger.toFixed(2));
      this.hunger.hidden = hunger === 0;
      setFlag(this.hunger, 'starving', food <= 0);
    }
  }
}
