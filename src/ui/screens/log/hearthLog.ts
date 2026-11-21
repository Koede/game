/**
 * The Hearth Log: the ages, the current goal with its progress, what comes next, and what is done.
 * A view the standalone Log screen and the furnace's LOG tab both embed.
 */
import { AGES, OBJECTIVES, itemOrNull } from '../../../core/registry';
import type { ObjectiveSpec } from '../../../core/types';
import type { ObjectiveTracker } from '../../../game/objectives';
import { h, setAttr, setText } from '../../kit/dom';
import { glyph } from '../../kit/icons';

const UPCOMING_SHOWN = 4;

const rewardText = (spec: ObjectiveSpec): string =>
  spec.reward && spec.reward.length > 0
    ? `Reward: ${spec.reward.map((r) => `${r.count} ${itemOrNull(r.item)?.name ?? r.item}`).join(', ')}`
    : '';

export class HearthLogView {
  readonly el: HTMLDivElement;
  private readonly objectives: ObjectiveTracker;
  private readonly ages: HTMLOListElement;
  private readonly ageName: HTMLSpanElement;
  private readonly ageBlurb: HTMLParagraphElement;
  private readonly goalCard: HTMLElement;
  private readonly goalTitle: HTMLHeadingElement;
  private readonly goalText: HTMLParagraphElement;
  private readonly goalProgress: HTMLSpanElement;
  private readonly goalFill: HTMLDivElement;
  private readonly goalReward: HTMLParagraphElement;
  private readonly upcoming: HTMLOListElement;
  private readonly doneHead: HTMLHeadingElement;
  private readonly done: HTMLOListElement;
  private shownKey = '';

  constructor(objectives: ObjectiveTracker) {
    this.objectives = objectives;
    this.ages = h('ol', { class: 'hw-log__ages', attrs: { 'aria-label': 'Ages' } });
    this.ageName = h('span', { class: 'hw-log__age-name' });
    this.ageBlurb = h('p', { class: 'hw-log__age-blurb' });
    this.goalTitle = h('h3', { class: 'hw-log__goal-title' });
    this.goalText = h('p', { class: 'hw-log__goal-text' });
    this.goalProgress = h('span', { class: 'hw-log__goal-progress hw-num' });
    this.goalFill = h('div', { class: 'hw-log__goal-fill' });
    this.goalReward = h('p', { class: 'hw-log__goal-reward' });
    this.goalCard = h(
      'section',
      { class: 'hw-log__goal' },
      h('div', { class: 'hw-log__goal-kicker' }, h('span', { text: 'Current goal' }), this.goalProgress),
      this.goalTitle,
      this.goalText,
      h('div', { class: 'hw-log__goal-track' }, this.goalFill),
      this.goalReward,
    );
    this.upcoming = h('ol', { class: 'hw-log__list hw-log__list--next' });
    this.doneHead = h('h3', { class: 'hw-heading' });
    this.done = h('ol', { class: 'hw-log__list hw-log__list--done', attrs: { reversed: true } });
    this.el = h(
      'div',
      { class: 'hw-log' },
      h('section', { class: 'hw-log__age' }, h('div', { class: 'hw-log__age-row' }, h('span', { class: 'hw-log__age-kicker', text: 'Age' }), this.ageName), this.ages, this.ageBlurb),
      this.goalCard,
      h('section', { class: 'hw-log__section' }, h('h3', { class: 'hw-heading', text: 'Up next' }), this.upcoming),
      h('section', { class: 'hw-log__section' }, this.doneHead, this.done),
    );
    this.refresh();
  }

  /** Cheap when nothing changed: the lists are rebuilt only when an objective completes. */
  refresh(): void {
    const o = this.objectives;
    const current = o.current;
    const completed = o.completed;
    const key = `${current?.id ?? '-'}|${completed.length}|${o.age}`;
    if (key !== this.shownKey) {
      this.shownKey = key;
      this.renderAges(o.age);
      this.renderLists(current, o.upcoming, completed);
    }
    if (current) {
      const p = o.progress();
      setText(this.goalProgress, p ? p.text : '');
      this.goalFill.style.transform = `scaleX(${(p?.fraction ?? 0).toFixed(3)})`;
    }
  }

  private renderAges(ageIndex: number): void {
    const age = AGES[ageIndex];
    setText(this.ageName, age ? age.name : '');
    setText(this.ageBlurb, age ? age.blurb : '');
    this.ages.replaceChildren(
      ...AGES.map((a, i) =>
        h(
          'li',
          { class: 'hw-log__age-step', attrs: { 'data-state': i < ageIndex ? 'past' : i === ageIndex ? 'now' : 'later', 'data-age': i } },
          h('i'),
          h('span', { text: a.name.replace(/ Age$/, '') }),
        ),
      ),
    );
  }

  private renderLists(current: ObjectiveSpec | null, upcoming: readonly ObjectiveSpec[], completed: readonly ObjectiveSpec[]): void {
    if (current) {
      setText(this.goalTitle, current.title);
      setText(this.goalText, current.text);
      const reward = rewardText(current);
      setText(this.goalReward, reward);
      this.goalReward.hidden = reward === '';
      setAttr(this.goalCard, 'data-done', null);
    } else {
      setText(this.goalTitle, 'Every goal is done');
      setText(this.goalText, 'The Starhearth burns. The world is yours to keep building.');
      setText(this.goalProgress, `${OBJECTIVES.length} / ${OBJECTIVES.length}`);
      this.goalFill.style.transform = 'scaleX(1)';
      this.goalReward.hidden = true;
      setAttr(this.goalCard, 'data-done', true);
    }
    const next = upcoming.slice(0, UPCOMING_SHOWN);
    const more = upcoming.length - next.length;
    this.upcoming.replaceChildren(
      ...next.map((s) => h('li', { class: 'hw-log__item', attrs: { 'data-state': 'next' } }, h('span', { class: 'hw-log__item-title', text: s.title }))),
      ...(more > 0 ? [h('li', { class: 'hw-log__more', text: `${more} more after these` })] : []),
      ...(next.length === 0 ? [h('li', { class: 'hw-log__more', text: current ? 'This is the last goal.' : 'Nothing left.' })] : []),
    );
    setText(this.doneHead, `Done  ${completed.length} / ${OBJECTIVES.length}`);
    this.done.replaceChildren(
      ...[...completed].reverse().map((s) =>
        h('li', { class: 'hw-log__item', attrs: { 'data-state': 'done' } }, h('span', { class: 'hw-log__tick' }, glyph('check', 12)), h('span', { class: 'hw-log__item-title', text: s.title })),
      ),
      ...(completed.length === 0 ? [h('li', { class: 'hw-log__more', text: 'Nothing yet. Every fire starts small.' })] : []),
    );
  }
}
