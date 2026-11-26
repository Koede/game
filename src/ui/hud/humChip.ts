/**
 * Orrin's Spare Pick hum on the HUD (docs/api/legendary.md): a small chip with one to three bars while ore lies within reach of the held pick, more bars the nearer it is.
 * The controller sends `legendary:hum` about twice a second; the chip hides itself shortly after the last one.
 */
import type { GameBus } from '../../core/context';
import { humBars } from '../../game/legendaryNotes';
import { h } from '../kit/dom';

/** Milliseconds the chip stays after the last hum. */
export const HUM_HOLD_MS = 900;

export class HumChip {
  readonly el: HTMLDivElement;
  private readonly bars: HTMLSpanElement[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly off: () => void;

  constructor(bus: GameBus) {
    this.bars = [1, 2, 3].map((n) => h('span', { class: 'hw-hum__bar', attrs: { 'data-bar': String(n) } }));
    this.el = h('div', { class: 'hw-hum hw-hud-plate', attrs: { 'data-testid': 'hum-chip', role: 'status', 'aria-label': 'Ore nearby' } }, ...this.bars);
    this.el.hidden = true;
    this.off = bus.on('legendary:hum', ({ level }) => this.show(level));
  }

  show(level: number): void {
    const n = humBars(level);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (n === 0) {
      this.el.hidden = true;
      return;
    }
    this.bars.forEach((b, i) => b.classList.toggle('is-on', i < n));
    this.el.hidden = false;
    this.timer = setTimeout(() => {
      this.el.hidden = true;
      this.timer = null;
    }, HUM_HOLD_MS);
  }

  dispose(): void {
    this.off();
    if (this.timer !== null) clearTimeout(this.timer);
  }
}
