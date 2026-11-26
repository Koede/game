/**
 * The goal tracker: the current objective and its progress. Tapping it opens the Hearth Log. The kicker counts goals
 * per age ("Age 1 - Ember", step "3/9"), never against the whole list (docs/advice/phone-ux.md 3.3); the goal's own
 * count shows as the bar under the title.
 */
import type { GameBus } from '../../core/context';
import { AGES, OBJECTIVES } from '../../core/registry';
import type { ObjectiveSpec } from '../../core/types';
import type { ObjectiveTracker } from '../../game/objectives';
import { h, setAttr, setText } from '../kit/dom';
import { glyph } from '../kit/icons';

/** The short name of an age: "Ember" for "Ember Age". */
export const ageShortName = (age: number): string => (AGES[age]?.name ?? `Age ${age + 1}`).replace(/ Age$/, '');

/** Kicker and step for a goal: "Age 1 - Ember" and "3/9" (its place among its own age's goals). */
export function goalKicker(goal: ObjectiveSpec, all: readonly ObjectiveSpec[] = OBJECTIVES): { kicker: string; step: string } {
  const ofAge = all.filter((o) => o.age === goal.age);
  const at = ofAge.findIndex((o) => o.id === goal.id);
  return { kicker: `Age ${goal.age + 1} - ${ageShortName(goal.age)}`, step: at >= 0 ? `${at + 1}/${ofAge.length}` : '' };
}

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
    if (!current) {
      setText(this.kicker, 'All goals done');
      setText(this.title, 'The star burns. Build on.');
      setText(this.progressText, '');
      this.setFill(1);
      setAttr(this.el, 'aria-label', 'All goals done. Open the Hearth Log');
      return;
    }
    const progress = objectives.progress();
    const { kicker, step } = goalKicker(current);
    setText(this.kicker, kicker);
    setText(this.title, current.title);
    setText(this.progressText, step);
    this.setFill(progress?.fraction ?? 0);
    setAttr(this.el, 'aria-label', `${kicker}, goal ${step}: ${current.title}${progress && progress.target > 1 ? `, ${progress.text}` : ''}. Open the Hearth Log`);
  }

  private setFill(fraction: number): void {
    const rounded = Math.round(fraction * 100) / 100;
    if (rounded === this.shownFill) return;
    this.shownFill = rounded;
    this.fill.style.transform = `scaleX(${rounded})`;
  }
}
