/** The goal tracker: the current objective and its progress. Tapping it opens the Hearth Log. */
import type { GameBus } from '../../core/context';
import { OBJECTIVES } from '../../core/registry';
import type { GuideStep } from '../../game/firstHour';
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

  private guideKind: 'camp' | 'main' | null = null;

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
      bus.emit('ui:open', { screen: { type: this.guideKind === 'camp' ? 'town' : 'log' } });
    });
  }

  update(objectives: ObjectiveTracker, winter: { title: string } | null = null, guide: GuideStep | null = null): void {
    this.guideKind = winter ? null : (guide?.kind ?? null);
    if (winter) {
      setText(this.kicker, 'Winter goal');
      setText(this.title, winter.title);
      setText(this.progressText, '');
      this.setFill(0);
      setAttr(this.el, 'aria-label', `Winter goal: ${winter.title}. Open the Hearth Log`);
      return;
    }
    if (guide) {
      const own = guide.kind === 'main' && objectives.current?.id === guide.id ? objectives.progress() : null;
      setText(this.kicker, `First hour: step ${guide.index} of ${guide.total}`);
      setText(this.title, guide.title);
      setText(this.progressText, own && own.target > 1 ? own.text : '');
      this.setFill(own?.fraction ?? 0);
      const where = guide.kind === 'camp' ? 'Open the Town page' : 'Open the Hearth Log';
      setAttr(this.el, 'aria-label', `First hour, step ${guide.index} of ${guide.total}: ${guide.title}. ${where}`);
      return;
    }
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
