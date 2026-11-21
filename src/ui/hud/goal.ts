/** The goal tracker: the current objective and its progress. Tapping it opens the Hearth Log. */
import type { GameBus } from '../../core/context';
import { OBJECTIVES } from '../../core/registry';
import type { ObjectiveTracker } from '../../game/objectives';
import { h, setAttr, setText } from '../kit/dom';
import { glyph } from '../kit/icons';

export class GoalTracker {
  readonly el: HTMLButtonElement;
  private readonly kicker: HTMLSpanElement;
  private readonly title: HTMLSpanElement;
  private readonly progressText: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private shownFill = -1;

  constructor(bus: GameBus) {
    this.kicker = h('span', { class: 'hw-goal__kicker' });
    this.title = h('span', { class: 'hw-goal__title' });
    this.progressText = h('span', { class: 'hw-goal__progress hw-num' });
    this.fill = h('div', { class: 'hw-goal__fill' });
    this.el = h(
      'button',
      { class: 'hw-goal hw-hud-plate', attrs: { type: 'button' } },
      h('span', { class: 'hw-goal__top' }, this.kicker, this.progressText),
      h('span', { class: 'hw-goal__row' }, this.title, h('span', { class: 'hw-goal__more' }, glyph('chevron', 12))),
      h('div', { class: 'hw-goal__track' }, this.fill),
    );
    this.el.addEventListener('click', () => {
      bus.emit('sfx', { name: 'ui_click' });
      bus.emit('ui:open', { screen: { type: 'log' } });
    });
  }

  update(objectives: ObjectiveTracker): void {
    const current = objectives.current;
    const done = objectives.completed.length;
    if (!current) {
      setText(this.kicker, 'All goals done');
      setText(this.title, 'The star burns. Build on.');
      setText(this.progressText, '');
      this.setFill(1);
      setAttr(this.el, 'aria-label', 'All goals done. Open the Hearth Log');
      return;
    }
    const progress = objectives.progress();
    setText(this.kicker, `Goal ${done + 1} of ${OBJECTIVES.length}`);
    setText(this.title, current.title);
    setText(this.progressText, progress && progress.target > 1 ? progress.text : '');
    this.setFill(progress?.fraction ?? 0);
    setAttr(this.el, 'aria-label', `Goal: ${current.title}${progress ? `, ${progress.text}` : ''}. Open the Hearth Log`);
  }

  private setFill(fraction: number): void {
    const rounded = Math.round(fraction * 100) / 100;
    if (rounded === this.shownFill) return;
    this.shownFill = rounded;
    this.fill.style.transform = `scaleX(${rounded})`;
  }
}
