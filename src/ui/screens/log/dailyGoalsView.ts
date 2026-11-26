/** Daily and seasonal goals under the age goal in the Hearth Log, and the keepsake shelf they fill (tap one to wear it). */
import { itemOrNull } from '../../../core/registry';
import { KEEPSAKES, keepsakeOf, type DailyGoals, type GoalView, type Reward } from '../../../game/dailyGoals';
import { h, setText } from '../../kit/dom';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const rewardLabel = (r: Reward): string => (r.kind === 'blueprint' ? `Blueprint: ${r.id.replace(/_/g, ' ')}` : r.kind === 'cosmetic' ? `Keepsake: ${keepsakeOf(r.id)?.name ?? r.id}` : `${r.count} ${itemOrNull(r.item)?.name ?? r.item}`);

function goalRow(g: GoalView): HTMLElement {
  return h(
    'li',
    { class: g.done ? 'hw-dg__goal hw-dg__goal--done' : 'hw-dg__goal' },
    h('span', { class: 'hw-dg__row' }, h('span', { class: 'hw-dg__text', text: `${g.done ? '✓ ' : ''}${g.text}` }), h('span', { class: 'hw-dg__num hw-num', text: g.done ? 'Done' : `${g.current.toLocaleString('en-US')} / ${g.target.toLocaleString('en-US')}` })),
    h('span', { class: 'hw-dg__track' }, h('span', { class: 'hw-dg__fill', style: { transform: `scaleX(${Math.round(g.fraction * 100) / 100})` } })),
    h('small', { class: 'hw-dg__reward', text: rewardLabel(g.reward) }),
  );
}

export class DailyGoalsView {
  readonly el: HTMLElement;
  private readonly dailyList = h('ul', { class: 'hw-dg__list' });
  private readonly seasonHead = h('h3', { class: 'hw-dg__title' });
  private readonly seasonList = h('ul', { class: 'hw-dg__list' });
  private readonly shelfHead = h('h3', { class: 'hw-dg__title' });
  private readonly shelf = h('ul', { class: 'hw-dg__shelf' });
  private shown = '';

  constructor(private readonly goals: DailyGoals) {
    this.el = h(
      'section',
      { class: 'hw-dg', attrs: { 'aria-label': 'Daily and seasonal goals' } },
      h('h3', { class: 'hw-dg__title', text: 'Daily goals' }),
      this.dailyList,
      this.seasonHead,
      this.seasonList,
      this.shelfHead,
      this.shelf,
    );
  }

  refresh(): void {
    const daily = this.goals.daily();
    const season = this.goals.seasonal();
    const key = JSON.stringify([daily, season, this.goals.keepsakes, this.goals.worn]);
    if (key === this.shown) return;
    this.shown = key;
    this.dailyList.replaceChildren(...daily.map(goalRow));
    setText(this.seasonHead, `${cap(season.season)} goals · ${season.daysLeft} day${season.daysLeft === 1 ? '' : 's'} left`);
    this.seasonList.replaceChildren(...season.goals.map(goalRow));
    setText(this.shelfHead, `Keepsakes ${this.goals.keepsakes.length} / ${KEEPSAKES.length}`);
    this.shelf.replaceChildren(
      ...KEEPSAKES.map((k) => {
        const got = this.goals.keepsakes.includes(k.id);
        const worn = this.goals.worn === k.id;
        const btn = h('button', { class: ['hw-dg__keep', got && 'hw-dg__keep--got', worn && 'hw-dg__keep--worn'], attrs: { type: 'button', disabled: !got, 'aria-pressed': got ? worn : null, title: got ? k.text : 'Not found yet' }, on: { click: () => { this.goals.wear(worn ? null : k.id); this.refresh(); } } }, got ? k.name : '???', worn ? h('small', { text: 'Worn' }) : null);
        return h('li', null, btn);
      }),
    );
  }
}
