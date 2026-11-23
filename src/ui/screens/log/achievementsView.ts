/** The achievements list under the Journal in the Hearth Log: earned ones bright with their day, the rest dim with what to do. */
import { ACHIEVEMENTS, type Achievements } from '../../../game/achievements';
import { h, setText } from '../../kit/dom';

export class AchievementsView {
  readonly el: HTMLElement;
  private readonly head: HTMLHeadingElement;
  private readonly list: HTMLUListElement;
  private shown = -1;

  constructor(private readonly achievements: Achievements) {
    this.head = h('h3', { class: 'hw-medals__title' });
    this.list = h('ul', { class: 'hw-medals__list', style: { 'list-style': 'none', margin: '0', padding: '0' } });
    this.el = h('section', { class: 'hw-medals' }, this.head, this.list);
  }

  refresh(): void {
    if (this.achievements.count === this.shown) return;
    this.shown = this.achievements.count;
    setText(this.head, `Achievements ${this.achievements.count} / ${ACHIEVEMENTS.length}`);
    const day = this.achievements.toJSON().unlocked;
    this.list.replaceChildren(
      ...ACHIEVEMENTS.map((a) => {
        const got = this.achievements.has(a.id);
        return h('li', { class: got ? 'hw-medals__item hw-medals__item--got' : 'hw-medals__item' }, `${a.name}${got ? ` (day ${day[a.id]})` : ''}`, h('small', { text: a.text }));
      }),
    );
  }
}
