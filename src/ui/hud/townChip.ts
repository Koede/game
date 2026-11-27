/** The town chip under the goal tracker: the camp goal (or the building going up). A tap opens the Town page. Hidden when there is no town. */
import type { GameBus } from '../../core/context';
import { h, setText } from '../kit/dom';
import { glyph } from '../kit/icons';

export interface TownChipInfo {
  kicker: string;
  title: string;
  /** The camp goal's id when the chip shows one (the guided first hour covers some of them). */
  goal?: string;
}

export class TownChip {
  readonly el: HTMLButtonElement;
  private readonly kicker: HTMLSpanElement;
  private readonly title: HTMLSpanElement;

  constructor(bus: GameBus) {
    this.kicker = h('span', { class: 'hw-goal__kicker' });
    this.title = h('span', { class: 'hw-goal__title' });
    this.el = h(
      'button',
      { class: 'hw-goal hw-town-chip hw-hud-plate', attrs: { type: 'button', 'data-testid': 'town-chip' } },
      h('span', { class: 'hw-goal__top' }, this.kicker),
      h('span', { class: 'hw-goal__row' }, this.title, h('span', { class: 'hw-goal__more' }, glyph('chevron', 12))),
    );
    this.el.hidden = true;
    this.el.addEventListener('click', () => {
      bus.emit('sfx', { name: 'ui_click' });
      bus.emit('ui:open', { screen: { type: 'town' } });
    });
  }

  update(info: TownChipInfo | null): void {
    this.el.hidden = info === null;
    if (!info) return;
    setText(this.kicker, info.kicker);
    setText(this.title, info.title);
    this.el.setAttribute('aria-label', `${info.kicker}: ${info.title}. Open the Town page`);
  }
}
